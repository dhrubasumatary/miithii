"""Production Modal entrypoint for Miithii Voice.

Miithii's target native transport is Cloudflare Realtime SFU between the
Android/iOS libwebrtc peer and Pipecat's aiortc peer on Modal. The legacy
direct SmallWebRTC endpoints remain available until the native SFU path has
passed the physical-device release gate.

For the private alpha this function is pinned to one warm replica. That keeps
session-scoped signalling deterministic while still allowing multiple peer
connections inside the replica. We can shard deliberately later, once a
session-routing strategy exists; autoscaling this stateful endpoint blindly
would make trickle ICE requests land on containers that do not own the peer.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import time
from functools import wraps
from pathlib import Path
from typing import Any

import modal

SERVICE_DIR = Path(__file__).resolve().parent
SESSION_SECONDS = 20 * 60
SFU_CLEANUP_GRACE_SECONDS = 60 * 60
SFU_CLEANUP_RECONCILE_DELAY_SECONDS = 0.25
SFU_CLEANUP_RETRY_SECONDS = 20.0
SFU_UNCERTAIN_RECONCILE_SECONDS = 20.0
SFU_UNCERTAIN_RECONCILE_DELAYS = (0.5, 1.0, 2.0, 4.0, 8.0)
STUN_URL = "stun:stun.l.google.com:19302"
CLOUDFLARE_TURN_API = "https://rtc.live.cloudflare.com/v1/turn/keys"
MODAL_APP_NAME = os.environ.get("MIITHII_MODAL_APP_NAME", "miithii-voice").strip()
DEPLOY_REVISION = os.environ.get("MIITHII_DEPLOY_REVISION", "dev").strip()

runtime_image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("ffmpeg")
    .pip_install(
        "aiohttp>=3.13,<4",
        "python-dotenv>=1,<2",
        "pipecat-ai[silero,webrtc]==1.10.0",
        "fastapi>=0.118,<1",
    )
    # Pipecat warms NLTK's sentence tokenizer during PipelineWorker setup.
    # Fetch its data at build time so a cold Voice session never blocks on a
    # runtime download and trips the worker's setup deadline.
    .run_commands("python -m nltk.downloader -d /usr/local/nltk_data punkt_tab")
    .env({"MIITHII_DEPLOY_REVISION": DEPLOY_REVISION, "NLTK_DATA": "/usr/local/nltk_data"})
    .add_local_file(str(SERVICE_DIR / "bot.py"), remote_path="/root/bot.py")
    .add_local_dir(str(SERVICE_DIR / "miithii_voice"), remote_path="/root/miithii_voice")
    .add_local_dir(str(SERVICE_DIR / "contracts"), remote_path="/root/contracts")
)

app = modal.App(MODAL_APP_NAME)
voice_secret = modal.Secret.from_name("miithii-voice")
realtime_secret = modal.Secret.from_name("miithii-realtime")


@app.function(
    image=runtime_image,
    secrets=[voice_secret, realtime_secret],
    # SmallWebRTC's request handler and aiortc peers are process-local, so keep
    # at most one replica until session routing exists. During private alpha we
    # scale to zero to protect the budget; after a request, keep the container
    # warm for a few minutes so iterative device testing avoids repeated cold
    # starts without paying for a 24/7 idle replica.
    min_containers=0,
    max_containers=1,
    scaledown_window=300,
    region="ap",
    timeout=60,
)
@modal.asgi_app()
def connect_app():
    """Serve authenticated SmallWebRTC signalling and Miithii voice sessions."""

    logging.basicConfig(level=logging.INFO)
    logging.getLogger("aioice").setLevel(logging.INFO)

    import aiohttp
    from aioice.turn import TurnTransport, create_turn_endpoint
    from aiortc import RTCSessionDescription
    from fastapi import FastAPI, Header, HTTPException
    from pipecat.runner.types import RunnerArguments
    from pipecat.transports.base_transport import TransportParams
    from pipecat.transports.smallwebrtc.connection import IceServer, SmallWebRTCConnection
    from pipecat.transports.smallwebrtc.request_handler import (
        IceCandidate,
        SmallWebRTCPatchRequest,
        SmallWebRTCRequest,
        SmallWebRTCRequestHandler,
    )
    from pipecat.transports.smallwebrtc.transport import RawAudioTrack, SmallWebRTCTransport

    from bot import run_bot
    from miithii_voice.aioice_patch import apply_aioice_turn_data_indication_patch
    from miithii_voice.cloudflare_sfu import CloudflareSFUConnection
    from miithii_voice.session import VoiceSessionClaims, verify_voice_session

    apply_aioice_turn_data_indication_patch()

    os.environ["MIITHII_DEV_NO_AUTH"] = "false"
    os.environ["MIITHII_API_URL"] = "https://api.miithii.in"

    web = FastAPI(title="Miithii Voice", docs_url=None, redoc_url=None)
    # The client receives the signed capability from Cloudflare, calls /start,
    # then automatically derives /sessions/{sessionId}/api/offer. Keep only the
    # minimum state necessary to bind those requests to the minted capability.
    sessions: dict[str, dict[str, Any]] = {}
    peers: dict[str, str] = {}
    bot_tasks: set[asyncio.Task[None]] = set()
    cleanup_tasks: set[asyncio.Task[None]] = set()
    turn_probes: dict[str, dict[str, Any]] = {}
    # Keep ownership after cleanup so repeated /sfu/leave requests from the same
    # capability remain idempotent while cross-capability cleanup stays denied.
    # The Modal container is short lived (private-alpha scaledown is five minutes),
    # so these tiny tombstones do not outlive the process.
    sfu_sessions: dict[str, str] = {}
    sfu_active_sessions: set[str] = set()
    sfu_attempts: dict[str, dict[str, Any]] = {}
    sfu_pipecat_peers: dict[str, dict[str, Any]] = {}

    class TurnProbeReceiver(asyncio.DatagramProtocol):
        def __init__(self):
            self.queue: asyncio.Queue[tuple[bytes, tuple[str, int]]] = asyncio.Queue()

        def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
            self.queue.put_nowait((data, addr))

    def relay_is_configured() -> bool:
        return bool(
            os.environ.get("CLOUDFLARE_TURN_KEY_ID")
            and os.environ.get("CLOUDFLARE_TURN_KEY_API_TOKEN")
        )

    async def get_ice_config(ttl: int) -> tuple[list[dict[str, Any]], list[IceServer]]:
        """Return independent client and server ICE configurations.

        A WebRTC session has two TURN clients: the Android/libwebrtc peer and
        Modal's aiortc peer. Cloudflare issues short-lived credentials per TURN
        user, so each side gets its own ephemeral credential. The long-lived
        Cloudflare TURN key never leaves the Modal container.
        """

        key_id = os.environ.get("CLOUDFLARE_TURN_KEY_ID")
        api_token = os.environ.get("CLOUDFLARE_TURN_KEY_API_TOKEN")
        if not key_id and not api_token:
            client_config = [{"urls": [STUN_URL]}]
            server_config = client_config
        elif not key_id or not api_token:
            raise HTTPException(status_code=503, detail="Voice relay is misconfigured")
        else:
            url = f"{CLOUDFLARE_TURN_API}/{key_id}/credentials/generate-ice-servers"

            async def generate_turn_config() -> list[dict[str, Any]]:
                try:
                    async with aiohttp.ClientSession(
                        timeout=aiohttp.ClientTimeout(total=8)
                    ) as http:
                        async with http.post(
                            url,
                            headers={"authorization": f"Bearer {api_token}"},
                            json={"ttl": max(60, min(ttl, SESSION_SECONDS))},
                        ) as response:
                            payload = await response.json()
                            if response.status != 201:
                                raise RuntimeError(f"TURN credential HTTP {response.status}")
                except (aiohttp.ClientError, TimeoutError, RuntimeError) as error:
                    raise HTTPException(
                        status_code=503,
                        detail="Voice relay credentials unavailable",
                    ) from error

                config = payload.get("iceServers") if isinstance(payload, dict) else None
                if not isinstance(config, list) or not config:
                    raise HTTPException(
                        status_code=503,
                        detail="Voice relay credentials invalid",
                    )
                return config

            try:
                client_config, server_config = await asyncio.gather(
                    generate_turn_config(),
                    generate_turn_config(),
                )
            except HTTPException:
                raise

        aiortc_servers: list[IceServer] = []
        for item in server_config:
            if not isinstance(item, dict):
                raise HTTPException(status_code=503, detail="Voice ICE configuration invalid")
            urls = item.get("urls")
            if isinstance(urls, str):
                urls = [urls]
            if not isinstance(urls, list) or not urls or not all(
                isinstance(value, str) and value for value in urls
            ):
                raise HTTPException(status_code=503, detail="Voice ICE configuration invalid")

            # aiortc currently uses only the first supported TURN URI from an
            # RTCIceServer. Prefer UDP for Cloudflare TURN: TURN/TCP and
            # TURN/TLS were observed to behave one-way with aioice in this
            # topology, while UDP allocation itself works.
            urls = sorted(
                urls,
                key=lambda value: (
                    0
                    if (
                        value.startswith("turn:")
                        and ":3478" in value
                        and "?transport=tcp" not in value
                    )
                    else 1
                    if value.startswith("turn:") and "?transport=tcp" not in value
                    else 2
                    if value.startswith("turns:")
                    else 3
                    if "?transport=tcp" in value
                    else 4
                ),
            )
            aiortc_servers.append(
                IceServer(
                    urls=urls,
                    username=item.get("username"),
                    credential=item.get("credential"),
                )
            )
        return client_config, aiortc_servers

    async def generate_probe_turn_credentials(ttl: int) -> tuple[str, str]:
        key_id = os.environ.get("CLOUDFLARE_TURN_KEY_ID")
        api_token = os.environ.get("CLOUDFLARE_TURN_KEY_API_TOKEN")
        if not key_id or not api_token:
            raise HTTPException(status_code=503, detail="Voice relay is not configured")

        url = f"{CLOUDFLARE_TURN_API}/{key_id}/credentials/generate-ice-servers"
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as http:
                async with http.post(
                    url,
                    headers={"authorization": f"Bearer {api_token}"},
                    json={"ttl": max(60, min(ttl, SESSION_SECONDS))},
                ) as response:
                    payload = await response.json()
                    if response.status != 201:
                        raise RuntimeError(f"TURN credential HTTP {response.status}")
        except (aiohttp.ClientError, TimeoutError, RuntimeError) as error:
            raise HTTPException(
                status_code=503,
                detail="Voice relay credentials unavailable",
            ) from error

        servers = payload.get("iceServers") if isinstance(payload, dict) else None
        if not isinstance(servers, list):
            raise HTTPException(status_code=503, detail="Voice relay credentials invalid")
        for server in servers:
            if not isinstance(server, dict):
                continue
            username = server.get("username")
            credential = server.get("credential")
            if isinstance(username, str) and isinstance(credential, str):
                return username, credential
        raise HTTPException(status_code=503, detail="Voice relay credentials invalid")

    async def calls_request(method: str, path: str, payload: dict | None = None) -> dict:
        app_id = os.environ.get("CALLS_APP_ID", "").strip()
        app_secret = os.environ.get("CALLS_APP_SECRET", "").strip()
        if not app_id or not app_secret:
            raise HTTPException(status_code=503, detail="Voice SFU is not configured")
        url = f"https://rtc.live.cloudflare.com/v1/apps/{app_id}{path}"

        def sanitized_error_code(value: Any) -> str | None:
            if not isinstance(value, str):
                return None
            code = value.strip()
            if not 1 <= len(code) <= 64:
                return None
            if not all(
                character.isascii() and (character.isalnum() or character in "_-")
                for character in code
            ):
                return None
            return code

        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as http:
                async with http.request(
                    method,
                    url,
                    headers={"authorization": f"Bearer {app_secret}"},
                    json=payload,
                ) as response:
                    result = await response.json()
                    if response.status < 200 or response.status >= 300:
                        error_code = sanitized_error_code(
                            result.get("errorCode") if isinstance(result, dict) else None
                        )
                        logging.getLogger(__name__).warning(
                            "Voice SFU upstream error method=%s path=%s status=%s error_code=%s",
                            method,
                            path,
                            response.status,
                            error_code,
                        )
                        failure = RuntimeError(f"Realtime API HTTP {response.status}")
                        failure.sfu_status = response.status
                        failure.sfu_error_code = error_code
                        raise failure
        except (aiohttp.ClientError, TimeoutError) as error:
            logging.getLogger(__name__).warning(
                "Voice SFU request failed method=%s path=%s error=%s",
                method,
                path,
                error.__class__.__name__,
            )
            failure = HTTPException(status_code=503, detail="Voice SFU is unavailable")
            failure.sfu_status = None
            failure.sfu_error_code = None
            failure.sfu_outcome_uncertain = method.upper() in {"POST", "PUT", "PATCH", "DELETE"}
            raise failure from error
        except RuntimeError as error:
            logging.getLogger(__name__).warning(
                "Voice SFU request failed method=%s path=%s error=%s",
                method,
                path,
                error.__class__.__name__,
            )
            failure = HTTPException(status_code=503, detail="Voice SFU is unavailable")
            failure.sfu_status = getattr(error, "sfu_status", None)
            failure.sfu_error_code = getattr(error, "sfu_error_code", None)
            failure.sfu_outcome_uncertain = False
            raise failure from error
        if not isinstance(result, dict):
            raise HTTPException(status_code=503, detail="Voice SFU response is invalid")
        return result

    def sfu_attempt(owner_session_id: str) -> dict[str, Any]:
        attempt = sfu_attempts.get(owner_session_id)
        if attempt is None:
            attempt = {
                "lock": asyncio.Lock(),
                "closing": False,
                "closed": False,
                "sessions": set(),
                "cleanup_retry_deadline": 0.0,
                "uncertain_deadline": 0.0,
                "cleanup_retry_index": 0,
                "cleanup_retry_task": None,
            }
            sfu_attempts[owner_session_id] = attempt
        return attempt

    def register_sfu_session(calls_session_id: str, owner_session_id: str) -> None:
        existing_owner = sfu_sessions.get(calls_session_id)
        if existing_owner is not None and existing_owner != owner_session_id:
            raise HTTPException(status_code=409, detail="Voice SFU session ownership conflict")
        attempt = sfu_attempt(owner_session_id)
        if attempt["closing"] or attempt["closed"]:
            raise HTTPException(status_code=410, detail="Voice SFU attempt is closed")
        sfu_sessions[calls_session_id] = owner_session_id
        sfu_active_sessions.add(calls_session_id)
        attempt["sessions"].add(calls_session_id)

    def require_known_sfu_session(calls_session_id: str, claims: VoiceSessionClaims) -> None:
        if sfu_sessions.get(calls_session_id) != claims.session_id:
            raise HTTPException(status_code=404, detail="Voice SFU session not found")

    def mark_sfu_outcome_uncertain(owner_session_id: str) -> None:
        attempt = sfu_attempt(owner_session_id)
        fresh_deadline = time.monotonic() + SFU_UNCERTAIN_RECONCILE_SECONDS
        attempt["uncertain_deadline"] = max(
            float(attempt.get("uncertain_deadline") or 0.0),
            fresh_deadline,
        )
        # A new uncertain request deserves a fresh fast reconciliation cadence,
        # even if an earlier uncertainty was already backing off.
        attempt["cleanup_retry_index"] = 0

    def sfu_session_is_gone(error: BaseException) -> bool:
        return (
            getattr(error, "sfu_status", None) == 410
            and getattr(error, "sfu_error_code", None) == "session_error"
        )

    def close_result_complete(
        result: dict,
        collection: str,
        identifier: str,
        requested: set[Any],
    ) -> bool:
        items = result.get(collection)
        if not isinstance(items, list):
            return False
        completed = {
            item.get(identifier)
            for item in items
            if isinstance(item, dict)
            and item.get(identifier) in requested
            and item.get("errorCode") in {None, "close_track_error"}
        }
        return completed == requested

    async def close_sfu_session_resources(
        calls_session_id: str,
        owner_session_id: str,
    ) -> bool:
        try:
            state = await calls_request("GET", f"/sessions/{calls_session_id}")
        except Exception as error:
            if sfu_session_is_gone(error):
                return True
            if getattr(error, "sfu_outcome_uncertain", False):
                mark_sfu_outcome_uncertain(owner_session_id)
            logging.getLogger(__name__).warning(
                "Voice SFU cleanup inspect failed session=%s error=%s",
                calls_session_id,
                error.__class__.__name__,
            )
            return False

        channel_ids = {
                item.get("id")
                for item in state.get("dataChannels", [])
                if isinstance(item, dict)
                and isinstance(item.get("id"), int)
                and item.get("status") != "inactive"
        }
        channels_closed = not channel_ids
        if channel_ids:
            try:
                result = await calls_request(
                    "PUT",
                    f"/sessions/{calls_session_id}/datachannels/close",
                    {
                        "dataChannels": [
                            {"id": channel_id} for channel_id in sorted(channel_ids)
                        ]
                    },
                )
                channels_closed = close_result_complete(
                    result,
                    "dataChannels",
                    "id",
                    channel_ids,
                )
            except Exception as error:
                if sfu_session_is_gone(error):
                    return True
                if getattr(error, "sfu_outcome_uncertain", False):
                    mark_sfu_outcome_uncertain(owner_session_id)
                logging.getLogger(__name__).warning(
                    "Voice SFU data-channel cleanup failed session=%s error=%s",
                    calls_session_id,
                    error.__class__.__name__,
                )

        track_mids = {
                item.get("mid")
                for item in state.get("tracks", [])
                if isinstance(item, dict)
                and isinstance(item.get("mid"), str)
                and item.get("mid")
                and item.get("status") != "inactive"
        }
        tracks_closed = not track_mids
        if track_mids:
            try:
                result = await calls_request(
                    "PUT",
                    f"/sessions/{calls_session_id}/tracks/close",
                    {
                        "tracks": [{"mid": mid} for mid in sorted(track_mids)],
                        "force": True,
                    },
                )
                tracks_closed = close_result_complete(
                    result,
                    "tracks",
                    "mid",
                    track_mids,
                )
            except Exception as error:
                if sfu_session_is_gone(error):
                    return True
                if getattr(error, "sfu_outcome_uncertain", False):
                    mark_sfu_outcome_uncertain(owner_session_id)
                logging.getLogger(__name__).warning(
                    "Voice SFU track cleanup failed session=%s error=%s",
                    calls_session_id,
                    error.__class__.__name__,
                )
        return channels_closed and tracks_closed

    def schedule_sfu_reconciliation(owner_session_id: str) -> None:
        attempt = sfu_attempt(owner_session_id)
        existing = attempt.get("cleanup_retry_task")
        if isinstance(existing, asyncio.Task) and not existing.done():
            return
        deadline = max(
            float(attempt.get("cleanup_retry_deadline") or 0.0),
            float(attempt.get("uncertain_deadline") or 0.0),
        )
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return

        index = int(attempt.get("cleanup_retry_index") or 0)
        delay = SFU_UNCERTAIN_RECONCILE_DELAYS[min(index, len(SFU_UNCERTAIN_RECONCILE_DELAYS) - 1)]
        delay = min(delay, remaining)
        if delay == remaining:
            # Cross the uncertainty deadline decisively instead of scheduling a
            # near-zero follow-up because of event-loop timer precision.
            delay += 0.01
        attempt["cleanup_retry_index"] = index + 1

        async def reconcile_later() -> None:
            try:
                await asyncio.sleep(delay)
                current = asyncio.current_task()
                if attempt.get("cleanup_retry_task") is current:
                    attempt["cleanup_retry_task"] = None
                await cleanup_sfu_attempt(owner_session_id)
            finally:
                current = asyncio.current_task()
                if attempt.get("cleanup_retry_task") is current:
                    attempt["cleanup_retry_task"] = None

        task = asyncio.create_task(
            reconcile_later(),
            name=f"miithii-sfu-reconcile-{owner_session_id}",
        )
        attempt["cleanup_retry_task"] = task
        cleanup_tasks.add(task)
        task.add_done_callback(cleanup_tasks.discard)

    async def cleanup_sfu_attempt(
        owner_session_id: str,
        *,
        retired_event: asyncio.Event | None = None,
    ) -> None:
        attempt = sfu_attempt(owner_session_id)
        current_task = asyncio.current_task()
        tasks_to_cancel: list[asyncio.Task[Any]] = []

        async with attempt["lock"]:
            if attempt["closed"]:
                if retired_event is not None:
                    retired_event.set()
                return
            attempt["closing"] = True
            if not attempt["cleanup_retry_deadline"]:
                attempt["cleanup_retry_deadline"] = (
                    time.monotonic() + SFU_CLEANUP_RETRY_SECONDS
                )
            if retired_event is not None:
                # /sfu/leave only needs to wait until the current mutation has
                # settled and this attempt is retired from future mutations.
                # Resource reconciliation continues in this retained task.
                retired_event.set()
            session_ids = set(attempt["sessions"])
            unresolved_sessions = set(session_ids)

            # Cloudflare documents that a timed-out API mutation may still finish.
            # Reconcile twice before retiring the attempt so a late allocation that
            # appears immediately after the first inspection is closed as well.
            for reconciliation_pass in range(2):
                results = {
                    calls_session_id: await close_sfu_session_resources(
                        calls_session_id,
                        owner_session_id,
                    )
                    for calls_session_id in sorted(session_ids)
                }
                unresolved_sessions = {
                    calls_session_id
                    for calls_session_id, resolved in results.items()
                    if not resolved
                }
                if reconciliation_pass == 0 and session_ids:
                    await asyncio.sleep(SFU_CLEANUP_RECONCILE_DELAY_SECONDS)

            uncertainty_pending = time.monotonic() < float(
                attempt.get("uncertain_deadline") or 0.0
            )

            for calls_session_id in sorted(attempt["sessions"]):
                peer = sfu_pipecat_peers.pop(calls_session_id, None)
                if not peer:
                    continue
                for key in ("botTask", "inputTask"):
                    task = peer.get(key)
                    if (
                        isinstance(task, asyncio.Task)
                        and task is not current_task
                        and not task.done()
                    ):
                        tasks_to_cancel.append(task)
                for key in ("dataChannel", "serverEventsChannel"):
                    channel = peer.get(key)
                    close = getattr(channel, "close", None)
                    if callable(close):
                        try:
                            close()
                        except Exception:
                            pass
                connection = peer.get("connection")
                if isinstance(connection, CloudflareSFUConnection):
                    try:
                        await connection._close()
                    except Exception as error:
                        logging.getLogger(__name__).warning(
                            "Voice SFU peer cleanup failed session=%s error=%s",
                            calls_session_id,
                            error.__class__.__name__,
                        )

            for calls_session_id in attempt["sessions"] - unresolved_sessions:
                sfu_active_sessions.discard(calls_session_id)
            attempt["closed"] = not unresolved_sessions and not uncertainty_pending
            retry_pending = (
                time.monotonic() < float(attempt.get("cleanup_retry_deadline") or 0.0)
            )
            if (unresolved_sessions and retry_pending) or uncertainty_pending:
                schedule_sfu_reconciliation(owner_session_id)
            if unresolved_sessions or uncertainty_pending:
                logging.getLogger(__name__).warning(
                    "Voice SFU cleanup remains unresolved owner=%s sessions=%s uncertain=%s",
                    owner_session_id,
                    sorted(unresolved_sessions),
                    uncertainty_pending,
                )

        for task in tasks_to_cancel:
            task.cancel()
        if tasks_to_cancel:
            await asyncio.gather(*tasks_to_cancel, return_exceptions=True)

    def schedule_sfu_cleanup(
        owner_session_id: str,
        *,
        retired_event: asyncio.Event | None = None,
    ) -> asyncio.Task[None]:
        task = asyncio.create_task(
            cleanup_sfu_attempt(owner_session_id, retired_event=retired_event),
            name=f"miithii-sfu-cleanup-{owner_session_id}",
        )
        cleanup_tasks.add(task)
        task.add_done_callback(cleanup_tasks.discard)
        return task

    async def run_sfu_mutation(claims: VoiceSessionClaims, operation):
        attempt = sfu_attempt(claims.session_id)

        async def run_locked():
            async with attempt["lock"]:
                if attempt["closing"] or attempt["closed"]:
                    raise HTTPException(status_code=410, detail="Voice SFU attempt is closed")
                return await operation()

        mutation_task = asyncio.create_task(run_locked())
        try:
            return await asyncio.shield(mutation_task)
        except asyncio.CancelledError:
            # A native fetch can be aborted while Cloudflare still completes the
            # mutation. Let the server-side operation settle while it owns the
            # attempt lock, then retire every resource it recorded.
            try:
                await mutation_task
            except asyncio.CancelledError:
                mark_sfu_outcome_uncertain(claims.session_id)
            except Exception as error:
                if getattr(error, "sfu_outcome_uncertain", False):
                    mark_sfu_outcome_uncertain(claims.session_id)
            cleanup_task = schedule_sfu_cleanup(claims.session_id)
            try:
                await asyncio.shield(cleanup_task)
            except asyncio.CancelledError:
                pass
            raise
        except Exception as error:
            if getattr(error, "sfu_outcome_uncertain", False):
                mark_sfu_outcome_uncertain(claims.session_id)
            await cleanup_sfu_attempt(claims.session_id)
            raise

    async def sfu_mutation_request(
        claims: VoiceSessionClaims,
        method: str,
        path: str,
        payload: dict | None = None,
    ) -> dict:
        async def operation():
            return await calls_request(method, path, payload)

        return await run_sfu_mutation(claims, operation)

    def serialize_sfu_negotiation(handler):
        @wraps(handler)
        async def wrapped(*args, **kwargs):
            _token, claims = require_capability(kwargs.get("authorization"))

            async def operation():
                return await handler(*args, **kwargs)

            return await run_sfu_mutation(claims, operation)

        return wrapped

    if os.environ.get("MIITHII_TESTING", "").strip().lower() == "true":
        # A process-local test seam for lifecycle tests. It is never exposed as
        # an HTTP route and is absent from production unless explicitly enabled.
        web.state.sfu_lifecycle = {
            "calls_request": calls_request,
            "mark_uncertain": mark_sfu_outcome_uncertain,
            "register_session": register_sfu_session,
            "serialize_negotiation": serialize_sfu_negotiation,
            "sessions": sfu_sessions,
            "active_sessions": sfu_active_sessions,
            "attempts": sfu_attempts,
            "peers": sfu_pipecat_peers,
            "cleanup_tasks": cleanup_tasks,
        }

    def bearer_token(authorization: str | None) -> str:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Voice session required")
        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Voice session required")
        return token

    def require_capability(authorization: str | None) -> tuple[str, VoiceSessionClaims]:
        token = bearer_token(authorization)
        try:
            claims = verify_voice_session(token, os.environ["VOICE_RTC_TOKEN"])
        except (KeyError, ValueError) as error:
            raise HTTPException(status_code=401, detail="Invalid Voice session") from error
        return token, claims

    def require_cleanup_capability(
        authorization: str | None,
    ) -> tuple[str, VoiceSessionClaims]:
        """Verify a Voice capability for destructive cleanup only.

        Normal Voice routes use ``require_capability`` and reject immediately
        after ``exp``. Cleanup gets a bounded grace so a long-running call can
        still retire resources with its original signed capability.
        """

        token = bearer_token(authorization)
        now = int(time.time())
        try:
            parts = token.split(".")
            if len(parts) != 3:
                raise ValueError("Invalid voice session token")
            payload_segment = parts[1]
            padded = payload_segment + "=" * ((4 - len(payload_segment) % 4) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
            expires_at = payload.get("exp") if isinstance(payload, dict) else None
            if not isinstance(expires_at, int):
                raise ValueError("Voice session expired")
            if expires_at > now:
                verification_time = now
            else:
                if now - expires_at > SFU_CLEANUP_GRACE_SECONDS:
                    raise ValueError("Voice session cleanup grace expired")
                # Reuse the canonical verifier for signature, issuer, audience,
                # subject, language, thread, jti and nbf validation. Moving its
                # clock to the final valid second changes only the exp decision.
                verification_time = expires_at - 1
            claims = verify_voice_session(
                token,
                os.environ["VOICE_RTC_TOKEN"],
                now=verification_time,
            )
        except (KeyError, ValueError, TypeError, UnicodeError) as error:
            raise HTTPException(status_code=401, detail="Invalid Voice session") from error
        return token, claims

    def require_registered_session(
        session_id: str,
        authorization: str | None,
    ) -> tuple[str, VoiceSessionClaims, dict[str, Any]]:
        token, claims = require_capability(authorization)
        session = sessions.get(session_id)
        if (
            not session
            or claims.session_id != session_id
            or session.get("token") != token
            or session.get("language") != claims.language
        ):
            raise HTTPException(status_code=404, detail="Voice session not found")
        return token, claims, session

    @web.get("/health")
    async def health():
        return {
            "service": "miithii-voice",
            "status": "ok",
            "transport": "smallwebrtc",
            "relayConfigured": relay_is_configured(),
            "revision": os.environ.get("MIITHII_DEPLOY_REVISION", "unknown"),
        }

    @web.post("/sfu/start")
    async def sfu_start(
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        """Authenticate native SFU startup and mint short-lived client ICE config."""
        _token, claims = require_capability(authorization)
        if payload.get("transport") != "cloudflare-sfu":
            raise HTTPException(status_code=400, detail="Cloudflare SFU transport required")
        body = payload.get("body", {})
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Voice session body must be an object")
        language = body.get("language", claims.language)
        if language != claims.language:
            raise HTTPException(status_code=400, detail="Voice language does not match session")

        ttl = max(60, claims.expires_at - int(time.time()))
        client_ice_servers, _unused_aiortc_ice_servers = await get_ice_config(ttl)
        # This native SFU path is deliberately non-trickle: Android gathers a
        # complete local description before it submits SDP to Cloudflare. Port
        # 53 is an alternate TURN/STUN port that can sit unresolved long enough
        # to delay end-of-candidates, so keep the useful 3478/80/443 routes and
        # omit :53 for this contract.
        filtered_ice_servers: list[dict[str, Any]] = []
        for server in client_ice_servers:
            if not isinstance(server, dict):
                continue
            raw_urls = server.get("urls")
            urls = [raw_urls] if isinstance(raw_urls, str) else raw_urls
            if not isinstance(urls, list):
                continue
            safe_urls = []
            for value in urls:
                if not isinstance(value, str) or not value:
                    continue
                # Keep one fast direct-discovery route and two relay routes:
                # UDP 3478 for the common case, TLS 443 for restrictive mobile
                # networks. Avoid alternate/extra transports that only make a
                # non-trickle gather wait for candidates we do not need.
                if value.startswith("stun:") and ":3478" in value:
                    safe_urls.append(value)
                elif (
                    value.startswith("turn:")
                    and ":3478" in value
                    and "transport=udp" in value
                ):
                    safe_urls.append(value)
                elif (
                    value.startswith("turns:")
                    and ":443" in value
                    and "transport=tcp" in value
                ):
                    safe_urls.append(value)
            if not safe_urls:
                continue
            item: dict[str, Any] = {"urls": safe_urls}
            if isinstance(server.get("username"), str):
                item["username"] = server["username"]
            if isinstance(server.get("credential"), str):
                item["credential"] = server["credential"]
            filtered_ice_servers.append(item)
        if not filtered_ice_servers:
            filtered_ice_servers = [{"urls": [STUN_URL]}]
        return {
            "transport": "cloudflare-sfu",
            "sessionId": claims.session_id,
            "iceConfig": {"iceServers": filtered_ice_servers},
        }

    @web.post("/start")
    async def start(
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        token, claims = require_capability(authorization)
        if payload.get("transport", "webrtc") != "webrtc":
            raise HTTPException(status_code=400, detail="SmallWebRTC transport required")

        body = payload.get("body", {})
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Voice session body must be an object")
        language = body.get("language", claims.language)
        if language != claims.language:
            raise HTTPException(status_code=400, detail="Voice language does not match session")

        ttl = max(60, claims.expires_at - int(time.time()))
        client_ice_servers, aiortc_ice_servers = await get_ice_config(ttl)

        sessions[claims.session_id] = {
            "token": token,
            "language": claims.language,
            "thread_id": claims.thread_id,
            "webrtc_handler": SmallWebRTCRequestHandler(ice_servers=aiortc_ice_servers),
        }
        return {
            "sessionId": claims.session_id,
            "iceConfig": {"iceServers": client_ice_servers},
        }

    @web.post("/debug/turn/start")
    async def debug_turn_start(
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        mode = payload.get("mode", "tls")
        if mode not in {"tls", "udp"}:
            raise HTTPException(status_code=400, detail="TURN probe mode must be tls or udp")

        existing = turn_probes.pop(claims.session_id, None)
        if existing:
            transport = existing.get("transport")
            if isinstance(transport, TurnTransport):
                transport.close()

        ttl = max(60, claims.expires_at - int(time.time()))
        username, credential = await generate_probe_turn_credentials(ttl)
        receiver = TurnProbeReceiver()
        transport, _protocol = await create_turn_endpoint(
            lambda: receiver,
            ("turn.cloudflare.com", 443 if mode == "tls" else 3478),
            username=username,
            password=credential,
            ssl=True if mode == "tls" else None,
            transport="tcp" if mode == "tls" else "udp",
        )
        relay_address = transport.get_extra_info("sockname")
        if not relay_address:
            transport.close()
            raise HTTPException(status_code=503, detail="TURN probe allocation failed")
        turn_probes[claims.session_id] = {
            "transport": transport,
            "receiver": receiver,
            "mode": mode,
        }
        return {"relayAddress": [relay_address[0], relay_address[1]], "mode": mode}

    @web.post("/debug/turn/send")
    async def debug_turn_send(
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        probe = turn_probes.get(claims.session_id)
        if not probe:
            raise HTTPException(status_code=404, detail="TURN probe not found")
        peer = payload.get("peerAddress")
        if (
            not isinstance(peer, list)
            or len(peer) != 2
            or not isinstance(peer[0], str)
            or not isinstance(peer[1], int)
        ):
            raise HTTPException(status_code=400, detail="Invalid TURN probe peer address")
        transport = probe.get("transport")
        if not isinstance(transport, TurnTransport):
            raise HTTPException(status_code=503, detail="TURN probe transport unavailable")
        transport.sendto(b"modal-turn-probe", (peer[0], peer[1]))
        return {"status": "sent"}

    @web.post("/debug/turn/poll")
    async def debug_turn_poll(
        _payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        probe = turn_probes.get(claims.session_id)
        if not probe:
            raise HTTPException(status_code=404, detail="TURN probe not found")
        receiver = probe.get("receiver")
        if not isinstance(receiver, TurnProbeReceiver):
            raise HTTPException(status_code=503, detail="TURN probe receiver unavailable")
        try:
            data, source = await asyncio.wait_for(receiver.queue.get(), timeout=5)
        except TimeoutError:
            return {"received": False}
        return {
            "received": data == b"local-turn-probe",
            "sourceAddress": [source[0], source[1]],
        }

    @web.post("/sfu/sessions/new")
    @web.post("/debug/sfu/sessions/new")
    async def debug_sfu_session_new(
        _payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)

        async def create_session():
            result = await calls_request("POST", "/sessions/new")
            session_id = result.get("sessionId")
            if not isinstance(session_id, str) or not session_id:
                raise HTTPException(status_code=503, detail="Voice SFU session is invalid")
            register_sfu_session(session_id, claims.session_id)
            return result

        return await run_sfu_mutation(claims, create_session)

    def require_sfu_session(calls_session_id: str, claims: VoiceSessionClaims) -> None:
        if (
            sfu_sessions.get(calls_session_id) != claims.session_id
            or calls_session_id not in sfu_active_sessions
        ):
            raise HTTPException(status_code=404, detail="Voice SFU session not found")

    @web.post("/sfu/leave")
    async def sfu_leave(
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        """Retire every Cloudflare SFU resource owned by this Voice attempt."""
        _token, claims = require_cleanup_capability(authorization)
        client_session_id = payload.get("clientSessionId")
        modal_session_id = payload.get("modalSessionId")
        if not isinstance(client_session_id, str) or not client_session_id:
            raise HTTPException(status_code=400, detail="Voice SFU client session is required")
        if modal_session_id is not None and (
            not isinstance(modal_session_id, str) or not modal_session_id
        ):
            raise HTTPException(status_code=400, detail="Voice SFU Modal session is invalid")
        require_known_sfu_session(client_session_id, claims)
        if modal_session_id is not None:
            require_known_sfu_session(modal_session_id, claims)

        retired_event = asyncio.Event()
        schedule_sfu_cleanup(claims.session_id, retired_event=retired_event)
        try:
            await asyncio.shield(retired_event.wait())
        except asyncio.CancelledError:
            # The retained cleanup task still retires and reconciles the attempt
            # even if the native request is abandoned before the acknowledgment.
            raise
        return {"status": "closing"}

    @web.post("/sfu/sessions/{calls_session_id}/tracks/new")
    @web.post("/debug/sfu/sessions/{calls_session_id}/tracks/new")
    async def debug_sfu_tracks_new(
        calls_session_id: str,
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)
        tracks = payload.get("tracks", [])
        if not isinstance(tracks, list):
            raise HTTPException(status_code=400, detail="Voice SFU tracks are invalid")
        for track in tracks:
            remote_session_id = track.get("sessionId") if isinstance(track, dict) else None
            if remote_session_id:
                try:
                    require_sfu_session(remote_session_id, claims)
                except HTTPException as error:
                    raise HTTPException(
                        status_code=404,
                        detail="Voice SFU track session not found",
                    ) from error

        async def add_tracks():
            return await calls_request(
                "POST",
                f"/sessions/{calls_session_id}/tracks/new",
                payload,
            )

        return await run_sfu_mutation(claims, add_tracks)

    @web.put("/sfu/sessions/{calls_session_id}/renegotiate")
    @web.put("/debug/sfu/sessions/{calls_session_id}/renegotiate")
    async def debug_sfu_renegotiate(
        calls_session_id: str,
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)

        async def renegotiate_session():
            return await calls_request(
                "PUT",
                f"/sessions/{calls_session_id}/renegotiate",
                payload,
            )

        return await run_sfu_mutation(claims, renegotiate_session)

    @web.post("/sfu/sessions/{calls_session_id}/datachannels/establish")
    @web.post("/debug/sfu/sessions/{calls_session_id}/datachannels/establish")
    async def debug_sfu_datachannels_establish(
        calls_session_id: str,
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)

        async def establish_data_transport():
            return await calls_request(
                "POST",
                f"/sessions/{calls_session_id}/datachannels/establish",
                payload,
            )

        return await run_sfu_mutation(claims, establish_data_transport)

    @web.post("/sfu/sessions/{calls_session_id}/datachannels/new")
    @web.post("/debug/sfu/sessions/{calls_session_id}/datachannels/new")
    async def debug_sfu_datachannels_new(
        calls_session_id: str,
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)
        data_channels = payload.get("dataChannels", [])
        if not isinstance(data_channels, list):
            raise HTTPException(status_code=400, detail="Voice SFU data channels are invalid")
        for data_channel in data_channels:
            if not isinstance(data_channel, dict):
                raise HTTPException(status_code=400, detail="Voice SFU data channel is invalid")
            remote_session_id = data_channel.get("sessionId")
            if remote_session_id:
                try:
                    require_sfu_session(remote_session_id, claims)
                except HTTPException as error:
                    raise HTTPException(
                        status_code=404,
                        detail="Voice SFU data channel session not found",
                    ) from error

        async def add_data_channels():
            return await calls_request(
                "POST",
                f"/sessions/{calls_session_id}/datachannels/new",
                payload,
            )

        return await run_sfu_mutation(claims, add_data_channels)

    async def receive_sfu_probe_audio(peer: dict[str, Any]) -> None:
        connection = peer.get("connection")
        if not isinstance(connection, CloudflareSFUConnection):
            return
        track = connection.audio_input_track()
        if track is None:
            return
        deadline = time.monotonic() + 20
        try:
            while time.monotonic() < deadline and peer.get("inputFrames", 0) < 25:
                frame = await asyncio.wait_for(track.recv(), timeout=2)
                if frame is not None:
                    peer["inputFrames"] = peer.get("inputFrames", 0) + 1
                    peer["inputSamples"] = peer.get("inputSamples", 0) + int(
                        getattr(frame, "samples", 0)
                    )
        except (TimeoutError, asyncio.CancelledError):
            pass
        except Exception as error:
            peer["inputError"] = error.__class__.__name__

    @web.post("/sfu/pipecat-peer/start")
    @web.post("/debug/sfu/pipecat-peer/start")
    @serialize_sfu_negotiation
    async def debug_sfu_pipecat_peer_start(
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        """Prove Modal aiortc can publish and subscribe through Cloudflare SFU."""

        _token, claims = require_capability(authorization)
        remote_session_id = payload.get("remoteSessionId")
        remote_track_name = payload.get("remoteTrackName")
        if not isinstance(remote_session_id, str) or not isinstance(remote_track_name, str):
            raise HTTPException(status_code=400, detail="Voice SFU remote audio is invalid")
        require_sfu_session(remote_session_id, claims)

        created = await calls_request("POST", "/sessions/new")
        modal_session_id = created.get("sessionId")
        if not isinstance(modal_session_id, str) or not modal_session_id:
            raise HTTPException(status_code=503, detail="Voice SFU session is invalid")
        register_sfu_session(modal_session_id, claims.session_id)

        connection = CloudflareSFUConnection(connection_timeout_secs=30)
        run_bot_session = payload.get("runBot") is True
        peer = {
            "connection": connection,
            "inputFrames": 0,
            "inputSamples": 0,
            "botTrackName": None,
            "runBot": run_bot_session,
            "sessionToken": _token,
            "remoteSessionId": remote_session_id,
        }
        # Register the provisional aiortc peer immediately. If any later SFU
        # mutation fails or the request is cancelled, centralized cleanup can
        # close the local PeerConnection as well as its Cloudflare resources.
        sfu_pipecat_peers[modal_session_id] = peer
        bootstrap_audio = RawAudioTrack(sample_rate=48_000, auto_silence=True)
        output_transceiver = connection.pc.addTransceiver(bootstrap_audio, direction="sendonly")
        offer = await connection.pc.createOffer()
        await connection.pc.setLocalDescription(offer)
        if output_transceiver.mid is None:
            raise HTTPException(status_code=503, detail="Voice SFU output MID is unavailable")

        published = await calls_request(
            "POST",
            f"/sessions/{modal_session_id}/tracks/new",
            {
                "sessionDescription": {
                    "type": connection.pc.localDescription.type,
                    "sdp": connection.pc.localDescription.sdp,
                },
                "tracks": [
                    {
                        "location": "local",
                        "mid": output_transceiver.mid,
                        "trackName": bootstrap_audio.id,
                    }
                ],
            },
        )
        published_description = published.get("sessionDescription")
        published_tracks = published.get("tracks")
        if not isinstance(published_description, dict) or not isinstance(published_tracks, list):
            raise HTTPException(status_code=503, detail="Voice SFU publication is invalid")
        await connection.pc.setRemoteDescription(
            RTCSessionDescription(
                sdp=published_description["sdp"],
                type=published_description["type"],
            )
        )
        connection.bind_audio_output(output_transceiver)

        bot_track = next(
            (
                track
                for track in published_tracks
                if isinstance(track, dict) and isinstance(track.get("trackName"), str)
            ),
            None,
        )
        if bot_track is None:
            raise HTTPException(status_code=503, detail="Voice SFU bot track is invalid")
        peer["botTrackName"] = bot_track["trackName"]

        pulled = await calls_request(
            "POST",
            f"/sessions/{modal_session_id}/tracks/new",
            {
                "tracks": [
                    {
                        "location": "remote",
                        "sessionId": remote_session_id,
                        "trackName": remote_track_name,
                    }
                ]
            },
        )
        pulled_description = pulled.get("sessionDescription")
        pulled_tracks = pulled.get("tracks")
        if not isinstance(pulled_description, dict) or not isinstance(pulled_tracks, list):
            raise HTTPException(status_code=503, detail="Voice SFU subscription is invalid")
        await connection.pc.setRemoteDescription(
            RTCSessionDescription(
                sdp=pulled_description["sdp"],
                type=pulled_description["type"],
            )
        )
        subscribed_track = next(
            (track for track in pulled_tracks if isinstance(track, dict)),
            None,
        )
        input_mid = subscribed_track.get("mid") if subscribed_track else None
        input_transceiver = next(
            (
                transceiver
                for transceiver in connection.pc.getTransceivers()
                if input_mid is not None and str(transceiver.mid) == str(input_mid)
            ),
            None,
        )
        if input_transceiver is None:
            candidates = [
                transceiver
                for transceiver in connection.pc.getTransceivers()
                if transceiver is not output_transceiver
                and getattr(transceiver.receiver.track, "kind", None) == "audio"
            ]
            input_transceiver = candidates[-1] if candidates else None
        if input_transceiver is None:
            raise HTTPException(status_code=503, detail="Voice SFU input track is unavailable")
        connection.bind_audio_input(input_transceiver)

        answer = await connection.pc.createAnswer()
        await connection.pc.setLocalDescription(answer)
        await calls_request(
            "PUT",
            f"/sessions/{modal_session_id}/renegotiate",
            {
                "sessionDescription": {
                    "type": connection.pc.localDescription.type,
                    "sdp": connection.pc.localDescription.sdp,
                }
            },
        )
        connect_deadline = time.monotonic() + 20
        while (
            connection.pc.connectionState != "connected"
            and time.monotonic() < connect_deadline
        ):
            await asyncio.sleep(0.05)
        if connection.pc.connectionState != "connected":
            raise HTTPException(status_code=503, detail="Voice SFU Modal peer did not connect")

        if not run_bot_session:
            task = asyncio.create_task(
                receive_sfu_probe_audio(peer),
                name=f"miithii-sfu-probe-{modal_session_id}",
            )
            peer["inputTask"] = task
        return {
            "sessionId": modal_session_id,
            "trackName": bot_track["trackName"],
        }

    @web.post("/sfu/pipecat-peer/{calls_session_id}/status")
    @web.post("/debug/sfu/pipecat-peer/{calls_session_id}/status")
    async def debug_sfu_pipecat_peer_status(
        calls_session_id: str,
        _payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)
        peer = sfu_pipecat_peers.get(calls_session_id)
        if not peer:
            raise HTTPException(status_code=404, detail="Voice SFU Pipecat peer not found")
        connection = peer.get("connection")
        sfu_state = await calls_request("GET", f"/sessions/{calls_session_id}")
        client_state = (
            await calls_request("GET", f"/sessions/{peer['remoteSessionId']}")
            if peer.get("remoteSessionId")
            else {}
        )
        sfu_data_channels = []
        for item in sfu_state.get("dataChannels", []):
            if isinstance(item, dict):
                sfu_data_channels.append(
                    {
                        "location": item.get("location"),
                        "sessionId": item.get("sessionId"),
                        "dataChannelName": item.get("dataChannelName"),
                        "id": item.get("id"),
                        "status": item.get("status"),
                    }
                )
        return {
            "connectionState": connection.pc.connectionState if connection else "closed",
            "iceConnectionState": connection.pc.iceConnectionState if connection else "closed",
            "dataChannelState": (
                connection._data_channel.readyState
                if connection and connection._data_channel
                else "closed"
            ),
            "receivedPing": bool(connection and connection._last_received_time is not None),
            "inputFrames": peer.get("inputFrames", 0),
            "inputSamples": peer.get("inputSamples", 0),
            "inputError": peer.get("inputError"),
            "sfuDataChannels": sfu_data_channels,
            "clientDataChannels": [
                {
                    "location": item.get("location"),
                    "name": item.get("dataChannelName"),
                    "id": item.get("id"),
                    "status": item.get("status"),
                }
                for item in client_state.get("dataChannels", [])
                if isinstance(item, dict)
            ],
            "dataChannel": (
                connection.data_channel_debug_state()
                if isinstance(connection, CloudflareSFUConnection)
                else None
            ),
        }

    @web.post("/sfu/pipecat-peer/{calls_session_id}/datachannel/subscribe")
    @web.post("/debug/sfu/pipecat-peer/{calls_session_id}/datachannel/subscribe")
    @serialize_sfu_negotiation
    async def debug_sfu_pipecat_peer_subscribe_datachannel(
        calls_session_id: str,
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        """Attach the browser-published RTVI channel to the Modal aiortc peer."""

        token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)
        peer = sfu_pipecat_peers.get(calls_session_id)
        if not peer:
            raise HTTPException(status_code=404, detail="Voice SFU Pipecat peer not found")
        connection = peer.get("connection")
        if not isinstance(connection, CloudflareSFUConnection):
            raise HTTPException(status_code=503, detail="Voice SFU Pipecat peer unavailable")

        remote_session_id = payload.get("remoteSessionId")
        remote_channel_name = payload.get("remoteDataChannelName", "chat")
        if not isinstance(remote_session_id, str) or not isinstance(remote_channel_name, str):
            raise HTTPException(status_code=400, detail="Voice SFU data channel is invalid")
        require_sfu_session(remote_session_id, claims)

        established = await calls_request(
            "POST",
            f"/sessions/{calls_session_id}/datachannels/establish",
            {"dataChannel": {"location": "remote", "dataChannelName": "server-events"}},
        )
        established_description = established.get("sessionDescription")
        server_events = established.get("dataChannel") or established.get("datachannel")
        if not isinstance(established_description, dict) or not isinstance(server_events, dict):
            raise HTTPException(status_code=503, detail="Voice SFU data transport is invalid")
        server_events_id = server_events.get("id")
        if not isinstance(server_events_id, int):
            raise HTTPException(status_code=503, detail="Voice SFU data transport ID is invalid")

        await connection.pc.setRemoteDescription(
            RTCSessionDescription(
                sdp=established_description["sdp"],
                type=established_description["type"],
            )
        )
        connection.enable_cloudflare_sctp_compat()
        server_events_channel = connection.pc.createDataChannel(
            "server-events",
            negotiated=True,
            id=server_events_id,
        )
        answer = await connection.pc.createAnswer()
        await connection.pc.setLocalDescription(answer)
        await calls_request(
            "PUT",
            f"/sessions/{calls_session_id}/renegotiate",
            {
                "sessionDescription": {
                    "type": connection.pc.localDescription.type,
                    "sdp": connection.pc.localDescription.sdp,
                }
            },
        )

        subscribed = await calls_request(
            "POST",
            f"/sessions/{calls_session_id}/datachannels/new",
            {
                "dataChannels": [
                    {
                        "location": "remote",
                        "sessionId": remote_session_id,
                        "dataChannelName": remote_channel_name,
                        "ordered": True,
                        "waitForAck": True,
                        "canReply": True,
                    }
                ]
            },
        )
        subscribed_channels = subscribed.get("dataChannels")
        if not isinstance(subscribed_channels, list) or not subscribed_channels:
            raise HTTPException(status_code=503, detail="Voice SFU subscription channel is invalid")
        channel_id = subscribed_channels[0].get("id")
        if not isinstance(channel_id, int):
            raise HTTPException(status_code=503, detail="Voice SFU subscription ID is invalid")

        rtvi_channel = connection.pc.createDataChannel(
            remote_channel_name,
            negotiated=True,
            ordered=True,
            id=channel_id,
        )
        connection.attach_data_channel(rtvi_channel)
        peer["serverEventsChannel"] = server_events_channel
        peer["dataChannel"] = rtvi_channel
        peer["remoteSessionId"] = remote_session_id
        peer["remoteDataChannelName"] = remote_channel_name
        transport = None
        if peer.get("runBot") and not peer.get("botTask"):
            transport = SmallWebRTCTransport(
                webrtc_connection=connection,
                # The publication starts with a 48 kHz bootstrap track. aiortc
                # retains its Opus encoder across replaceTrack(), so the bot
                # track must use that same source rate.
                params=TransportParams(
                    audio_in_enabled=True,
                    audio_out_enabled=True,
                    audio_out_sample_rate=48_000,
                ),
            )
            peer["transport"] = transport
        await connection.connect()
        data_channel_deadline = time.monotonic() + 10.0
        while (
            rtvi_channel.readyState != "open"
            and time.monotonic() < data_channel_deadline
        ):
            await asyncio.sleep(0.05)
        if rtvi_channel.readyState != "open":
            raise HTTPException(
                status_code=503,
                detail="Voice SFU Pipecat data channel did not open",
            )
        # Cloudflare consumes the first subscriber message as its delivery ACK.
        # Send it only after the negotiated channel and subscription are live;
        # the Android publisher's first RTVI frame must remain application data.
        await asyncio.sleep(0.25)
        rtvi_channel.send("ack")
        logging.getLogger(__name__).info(
            "Voice SFU subscription acknowledged peer=%s channel_id=%s buffered=%s",
            calls_session_id,
            channel_id,
            rtvi_channel.bufferedAmount,
        )
        await asyncio.sleep(0.25)

        async def log_sfu_channel_state() -> None:
            await asyncio.sleep(3)
            try:
                client_state = await calls_request("GET", f"/sessions/{remote_session_id}")
                modal_state = await calls_request("GET", f"/sessions/{calls_session_id}")
                logging.getLogger(__name__).info(
                    "Voice SFU channel state client=%s modal=%s peer=%s",
                    [
                        {"name": item.get("dataChannelName"), "status": item.get("status")}
                        for item in client_state.get("dataChannels", [])
                    ],
                    [
                        {"name": item.get("dataChannelName"), "status": item.get("status")}
                        for item in modal_state.get("dataChannels", [])
                    ],
                    connection.data_channel_debug_state(),
                )
            except Exception as error:
                logging.getLogger(__name__).warning(
                    "Voice SFU channel state lookup failed: %s", error.__class__.__name__
                )

        asyncio.create_task(log_sfu_channel_state())
        if transport is not None and not peer.get("botTask"):
            runner_args = RunnerArguments(
                body={"language": claims.language},
                session_id=claims.session_id,
            )

            async def run_sfu_session() -> None:
                try:
                    await run_bot(transport, runner_args, session_token=token)
                finally:
                    await cleanup_sfu_attempt(claims.session_id)

            task = asyncio.create_task(
                run_sfu_session(),
                name=f"miithii-voice-sfu-{claims.session_id}",
            )
            peer["botTask"] = task
            bot_tasks.add(task)
            task.add_done_callback(bot_tasks.discard)
        return {"dataChannelName": remote_channel_name}

    @web.post("/sfu/pipecat-peer/{calls_session_id}/message")
    @web.post("/debug/sfu/pipecat-peer/{calls_session_id}/message")
    async def debug_sfu_pipecat_peer_message(
        calls_session_id: str,
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)
        peer = sfu_pipecat_peers.get(calls_session_id)
        connection = peer.get("connection") if peer else None
        if not isinstance(connection, CloudflareSFUConnection):
            raise HTTPException(status_code=404, detail="Voice SFU Pipecat peer not found")
        connection.send_app_message(
            {
                "label": "rtvi-ai",
                "type": "sfu-probe",
                "data": payload,
            }
        )
        await asyncio.sleep(0.1)
        return {
            "status": "sent",
            "dataChannel": connection.data_channel_debug_state(),
        }

    @web.post("/sessions/{session_id}/api/offer")
    async def offer(
        session_id: str,
        body: dict,
        authorization: str | None = Header(default=None),
    ):
        token, claims, session = require_registered_session(session_id, authorization)
        try:
            request = SmallWebRTCRequest.from_dict(dict(body))
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=400, detail="Invalid WebRTC offer") from error
        request_data = request.request_data if isinstance(request.request_data, dict) else {}
        requested_language = request_data.get("language")
        if requested_language and requested_language != claims.language:
            raise HTTPException(status_code=400, detail="Voice language does not match session")

        async def webrtc_connection_callback(connection: SmallWebRTCConnection):
            transport = SmallWebRTCTransport(
                webrtc_connection=connection,
                params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
            )
            runner_args = RunnerArguments(
                body={"language": claims.language},
                session_id=session_id,
            )

            async def run_session() -> None:
                try:
                    await run_bot(transport, runner_args, session_token=token)
                finally:
                    sessions.pop(session_id, None)
                    for peer_id, owner_session_id in list(peers.items()):
                        if owner_session_id == session_id:
                            peers.pop(peer_id, None)

            task = asyncio.create_task(run_session(), name=f"miithii-voice-{session_id}")
            bot_tasks.add(task)
            task.add_done_callback(bot_tasks.discard)

        handler = session.get("webrtc_handler")
        if not isinstance(handler, SmallWebRTCRequestHandler):
            raise HTTPException(status_code=503, detail="Voice peer handler unavailable")
        answer = await handler.handle_web_request(
            request=request,
            webrtc_connection_callback=webrtc_connection_callback,
        )
        if not answer or not answer.get("pc_id"):
            raise HTTPException(status_code=500, detail="Voice peer negotiation failed")
        peers[answer["pc_id"]] = session_id
        return answer

    @web.patch("/sessions/{session_id}/api/offer")
    async def ice_candidate(
        session_id: str,
        body: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, _claims, session = require_registered_session(session_id, authorization)
        try:
            pc_id = body["pc_id"]
            raw_candidates = body["candidates"]
            if not isinstance(pc_id, str) or not isinstance(raw_candidates, list):
                raise TypeError
            request = SmallWebRTCPatchRequest(
                pc_id=pc_id,
                candidates=[IceCandidate(**candidate) for candidate in raw_candidates],
            )
        except (KeyError, TypeError, ValueError) as error:
            raise HTTPException(status_code=400, detail="Invalid ICE candidates") from error
        if peers.get(request.pc_id) != session_id:
            raise HTTPException(status_code=404, detail="Voice peer not found")
        handler = session.get("webrtc_handler")
        if not isinstance(handler, SmallWebRTCRequestHandler):
            raise HTTPException(status_code=503, detail="Voice peer handler unavailable")
        await handler.handle_patch_request(request)
        return {"status": "success"}

    return web
