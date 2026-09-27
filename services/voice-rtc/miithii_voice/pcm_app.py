from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any, Protocol
from urllib.parse import quote

import aiohttp
from fastapi import Body, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from loguru import logger
from pipecat.runner.types import RunnerArguments

from .cloudflare_pcm import (
    CLOUDFLARE_MAX_MESSAGE_BYTES,
    CloudflarePCMTransport,
    PacketDecodeError,
)
from .pcm_session import PCMSession, PCMSessionRegistry
from .session import VoiceSessionClaims, verify_voice_session

SESSION_SECONDS = 20 * 60
CLOUDFLARE_STUN_URL = "stun:stun.cloudflare.com:3478"
CLOUDFLARE_TURN_API = "https://rtc.live.cloudflare.com/v1/turn/keys"
PIPELINE_READY_TIMEOUT_SECONDS = 45.0

BotRunner = Callable[..., Awaitable[None]]
IceConfigProvider = Callable[[int], Awaitable[list[dict[str, Any]]]]


class RealtimeClient(Protocol):
    async def request(self, method: str, path: str, payload: dict | None = None) -> dict: ...


class CloudflareRealtimeClient:
    """Minimal authenticated client for Cloudflare Realtime SFU and adapter operations."""

    async def request(self, method: str, path: str, payload: dict | None = None) -> dict:
        app_id = _required_env("CALLS_APP_ID")
        app_secret = _required_env("CALLS_APP_SECRET")
        url = f"https://rtc.live.cloudflare.com/v1/apps/{app_id}{path}"
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
                        logger.warning(
                            "Realtime API failed method={} path={} status={}",
                            method,
                            path,
                            response.status,
                        )
                        raise RuntimeError(f"Realtime API HTTP {response.status}")
        except (aiohttp.ClientError, TimeoutError) as error:
            logger.warning(
                "Realtime API unavailable method={} path={} error={}",
                method,
                path,
                type(error).__name__,
            )
            raise RuntimeError("Realtime API unavailable") from error
        if not isinstance(result, dict):
            raise RuntimeError("Realtime API returned an invalid response")
        return result


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Voice session capability")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing Voice session capability")
    return token


def _authorize(authorization: str | None) -> tuple[VoiceSessionClaims, str]:
    token = _bearer_token(authorization)
    try:
        claims = verify_voice_session(token, _required_env("VOICE_RTC_TOKEN"))
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=401, detail="Invalid Voice session capability") from error
    return claims, token


def _websocket_base(request: Request) -> str:
    override = os.environ.get("MIITHII_PCM_PUBLIC_BASE_URL", "").strip().rstrip("/")
    if override:
        if override.startswith("https://"):
            return "wss://" + override.removeprefix("https://")
        if override.startswith("http://"):
            return "ws://" + override.removeprefix("http://")
        if not override.startswith(("ws://", "wss://")):
            raise RuntimeError("MIITHII_PCM_PUBLIC_BASE_URL must be an http(s) or ws(s) URL")
        return override

    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    forwarded_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    if not forwarded_host:
        raise RuntimeError("Request host is unavailable")
    scheme = "wss" if forwarded_proto in {"https", "wss"} else "ws"
    return f"{scheme}://{forwarded_host}"


def _session_description(value: Any, *, expected_type: str) -> dict[str, str]:
    if not isinstance(value, dict):
        raise HTTPException(status_code=400, detail="Voice session description is invalid")
    description_type = value.get("type")
    sdp = value.get("sdp")
    if description_type != expected_type or not isinstance(sdp, str) or not sdp:
        raise HTTPException(status_code=400, detail="Voice session description is invalid")
    if len(sdp) > 1_000_000:
        raise HTTPException(status_code=400, detail="Voice session description is too large")
    return {"type": description_type, "sdp": sdp}


def _required_string(value: Any, *, field: str, max_length: int = 128) -> str:
    if not isinstance(value, str) or not value or len(value) > max_length:
        raise HTTPException(status_code=400, detail=f"Voice {field} is invalid")
    return value


def _first_track(result: dict, *, operation: str) -> dict:
    tracks = result.get("tracks")
    if not isinstance(tracks, list) or not tracks or not isinstance(tracks[0], dict):
        raise RuntimeError(f"Realtime {operation} response is invalid")
    track = tracks[0]
    if track.get("errorCode"):
        raise RuntimeError(f"Realtime {operation} failed")
    return track


def _adapter_identity(result: dict, *, operation: str) -> tuple[str, str | None]:
    track = _first_track(result, operation=operation)
    adapter_id = track.get("adapterId")
    session_id = track.get("sessionId")
    if not isinstance(adapter_id, str) or not adapter_id:
        raise RuntimeError(f"Realtime {operation} adapter is invalid")
    if session_id is not None and (not isinstance(session_id, str) or not session_id):
        raise RuntimeError(f"Realtime {operation} session is invalid")
    return adapter_id, session_id


async def mint_client_ice_config(ttl: int) -> list[dict[str, Any]]:
    """Mint TURN only for the phone->Cloudflare SFU peer; no server-side ICE exists."""

    key_id = os.environ.get("CLOUDFLARE_TURN_KEY_ID", "").strip()
    api_token = os.environ.get("CLOUDFLARE_TURN_KEY_API_TOKEN", "").strip()
    if not key_id and not api_token:
        return [{"urls": [CLOUDFLARE_STUN_URL]}]
    if not key_id or not api_token:
        raise RuntimeError("Voice client relay is misconfigured")

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
    except (aiohttp.ClientError, TimeoutError) as error:
        raise RuntimeError("Voice client relay credentials unavailable") from error

    servers = payload.get("iceServers") if isinstance(payload, dict) else None
    if not isinstance(servers, list) or not servers:
        raise RuntimeError("Voice client relay credentials invalid")
    for server in servers:
        if not isinstance(server, dict):
            raise RuntimeError("Voice client relay credentials invalid")
        urls = server.get("urls")
        if isinstance(urls, str):
            urls = [urls]
        if not isinstance(urls, list) or not urls or not all(
            isinstance(value, str) and value for value in urls
        ):
            raise RuntimeError("Voice client relay credentials invalid")
    return servers


def _start_payload(
    session: PCMSession,
    request: Request,
    ice_servers: list[dict[str, Any]],
) -> dict:
    base = _websocket_base(request)
    session_path = f"/pcm/media/{session.session_id}"
    session.mic_endpoint = f"{base}{session_path}/mic?token={quote(session.mic_token, safe='')}"
    session.bot_endpoint = f"{base}{session_path}/bot?token={quote(session.bot_token, safe='')}"
    return {
        "voiceSessionId": session.session_id,
        "iceConfig": {"iceServers": ice_servers},
    }


async def _close_cloudflare_resources(realtime: RealtimeClient, session: PCMSession) -> None:
    """Best-effort retirement of every Cloudflare resource owned by one PCM session."""

    async with session.mutation_lock:
        for attribute in ("mic_adapter_id", "bot_adapter_id"):
            adapter_id = getattr(session, attribute)
            if not adapter_id:
                continue
            try:
                result = await realtime.request(
                    "POST",
                    "/adapters/websocket/close",
                    {"tracks": [{"adapterId": adapter_id}]},
                )
                closed = _first_track(result, operation="adapter cleanup")
                if closed.get("adapterId") != adapter_id:
                    raise RuntimeError("Realtime adapter cleanup response is invalid")
                setattr(session, attribute, None)
            except RuntimeError as error:
                logger.warning(
                    "PCM adapter cleanup failed session={} adapter={} error={}",
                    session.session_id,
                    attribute,
                    type(error).__name__,
                )

        track_resources = (
            (session.publisher_session_id, session.publisher_mid),
            (session.subscriber_session_id, session.subscriber_mid),
        )
        for calls_session_id, mid in track_resources:
            if not calls_session_id or not mid:
                continue
            try:
                await realtime.request(
                    "PUT",
                    f"/sessions/{calls_session_id}/tracks/close",
                    {"tracks": [{"mid": mid}], "force": True},
                )
                if calls_session_id == session.publisher_session_id:
                    session.publisher_mid = None
                if calls_session_id == session.subscriber_session_id:
                    session.subscriber_mid = None
            except RuntimeError as error:
                logger.warning(
                    "PCM track cleanup failed session={} calls_session={} error={}",
                    session.session_id,
                    calls_session_id,
                    type(error).__name__,
                )


async def _run_and_reap_session(
    registry: PCMSessionRegistry,
    session: PCMSession,
    bot_runner: BotRunner,
    session_token: str,
    realtime: RealtimeClient,
) -> None:
    runner_args = RunnerArguments(
        body={"language": session.language},
        session_id=session.session_id,
    )
    try:
        await bot_runner(session.transport, runner_args, session_token=session_token)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("PCM bot session failed session={}", session.session_id)
    finally:
        await _close_cloudflare_resources(realtime, session)
        await registry.close(session, reason="bot-ended")


async def _expire_session(
    registry: PCMSessionRegistry,
    session: PCMSession,
    realtime: RealtimeClient,
) -> None:
    delay = max(0.0, session.expires_at - time.time())
    await asyncio.sleep(delay)
    await _close_cloudflare_resources(realtime, session)
    await registry.close(session, reason="capability-expired")


async def _await_pipeline_ready(session: PCMSession) -> None:
    bot_task = session.bot_task
    if bot_task is None:
        raise RuntimeError("Voice pipeline task was not started")
    ready_task = asyncio.create_task(session.transport.wait_pipeline_ready())
    try:
        done, _ = await asyncio.wait(
            {ready_task, bot_task},
            timeout=PIPELINE_READY_TIMEOUT_SECONDS,
            return_when=asyncio.FIRST_COMPLETED,
        )
        if ready_task in done:
            session.state = "active"
            return
        if bot_task in done:
            exception = bot_task.exception()
            if exception:
                raise RuntimeError("Voice pipeline failed during startup") from exception
            raise RuntimeError("Voice pipeline ended during startup")
        raise TimeoutError("Voice pipeline startup timed out")
    finally:
        if not ready_task.done():
            ready_task.cancel()
            await asyncio.gather(ready_task, return_exceptions=True)


def create_pcm_app(
    *,
    bot_runner: BotRunner | None = None,
    realtime_client: RealtimeClient | None = None,
    ice_config_provider: IceConfigProvider = mint_client_ice_config,
) -> FastAPI:
    if bot_runner is None:
        from bot import run_bot

        bot_runner = run_bot

    registry = PCMSessionRegistry()
    realtime = realtime_client or CloudflareRealtimeClient()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        yield
        sessions = await registry.active_sessions()
        await asyncio.gather(
            *(_close_cloudflare_resources(realtime, session) for session in sessions)
        )
        await registry.close_all(reason="server-shutdown")

    web = FastAPI(title="Miithii Voice PCM", docs_url=None, redoc_url=None, lifespan=lifespan)
    web.state.pcm_registry = registry

    @web.get("/health")
    async def health():
        return {
            "service": "miithii-voice",
            "status": "ok",
            "transport": "cloudflare-websocket-pcm",
            "revision": os.environ.get("MIITHII_DEPLOY_REVISION", "dev"),
        }

    @web.post("/pcm/start")
    async def pcm_start(
        request: Request,
        body: Annotated[dict[str, Any] | None, Body()] = None,
        authorization: str | None = Header(default=None),
    ):
        claims, token = _authorize(authorization)
        requested_language = (body or {}).get("language")
        if requested_language is not None and requested_language != claims.language:
            raise HTTPException(status_code=403, detail="Voice session language mismatch")

        transport = CloudflarePCMTransport(name=f"pcm-{claims.session_id}")
        session, created = await registry.create(
            owner_id=claims.session_id,
            language=claims.language,
            expires_at=claims.expires_at,
            transport=transport,
        )
        if not created:
            await transport.disconnect()

        if created:
            session.bot_task = asyncio.create_task(
                _run_and_reap_session(registry, session, bot_runner, token, realtime),
                name=f"miithii-pcm-bot-{session.session_id}",
            )
            session.expiry_task = asyncio.create_task(
                _expire_session(registry, session, realtime),
                name=f"miithii-pcm-expiry-{session.session_id}",
            )

        try:
            if session.state == "starting":
                await _await_pipeline_ready(session)
            remaining = max(60, claims.expires_at - int(time.time()))
            ice_servers = await ice_config_provider(remaining)
        except (RuntimeError, TimeoutError) as error:
            await registry.close(session, reason="start-failed")
            raise HTTPException(status_code=503, detail=str(error)) from error

        return _start_payload(session, request, ice_servers)

    async def require_owned_session(
        session_id: str,
        authorization: str | None,
    ) -> PCMSession:
        claims, _ = _authorize(authorization)
        session = await registry.get_owned(session_id, claims.session_id)
        if session is None or session.state in {"closing", "closed"}:
            raise HTTPException(status_code=404, detail="PCM session not found")
        return session

    @web.post("/pcm/{session_id}/publish")
    async def pcm_publish(
        session_id: str,
        body: Annotated[dict[str, Any], Body()],
        authorization: str | None = Header(default=None),
    ):
        session = await require_owned_session(session_id, authorization)
        mid = _required_string(body.get("mid"), field="publisher mid", max_length=32)
        offer = _session_description(body.get("sessionDescription"), expected_type="offer")

        failure: Exception | None = None
        async with session.mutation_lock:
            if session.publisher_answer is not None:
                return {
                    "sessionDescription": session.publisher_answer,
                    "botPublication": {
                        "sessionId": session.bot_publisher_session_id,
                        "trackName": session.bot_track_name,
                    },
                }
            if not session.mic_endpoint or not session.bot_endpoint:
                raise HTTPException(status_code=503, detail="PCM media endpoints are unavailable")

            try:
                created = await realtime.request("POST", "/sessions/new")
                calls_session_id = _required_string(
                    created.get("sessionId"), field="publisher session id"
                )
                session.publisher_session_id = calls_session_id
                session.publisher_mid = mid

                published = await realtime.request(
                    "POST",
                    f"/sessions/{calls_session_id}/tracks/new",
                    {
                        "sessionDescription": offer,
                        "tracks": [
                            {
                                "location": "local",
                                "mid": mid,
                                "trackName": session.microphone_track_name,
                            }
                        ],
                    },
                )
                answer = _session_description(
                    published.get("sessionDescription"), expected_type="answer"
                )
                _first_track(published, operation="microphone publication")

                mic_adapter = await realtime.request(
                    "POST",
                    "/adapters/websocket/new",
                    {
                        "tracks": [
                            {
                                "location": "remote",
                                "sessionId": calls_session_id,
                                "trackName": session.microphone_track_name,
                                "endpoint": session.mic_endpoint,
                                "outputCodec": "pcm",
                            }
                        ]
                    },
                )
                session.mic_adapter_id, _ = _adapter_identity(
                    mic_adapter, operation="microphone adapter"
                )

                bot_adapter = await realtime.request(
                    "POST",
                    "/adapters/websocket/new",
                    {
                        "tracks": [
                            {
                                "location": "local",
                                "trackName": session.bot_track_name,
                                "endpoint": session.bot_endpoint,
                                "inputCodec": "pcm",
                            }
                        ]
                    },
                )
                session.bot_adapter_id, bot_publisher_session_id = _adapter_identity(
                    bot_adapter, operation="bot adapter"
                )
                if bot_publisher_session_id is None:
                    raise RuntimeError("Realtime bot adapter publisher session is invalid")
                session.bot_publisher_session_id = bot_publisher_session_id
                session.publisher_answer = answer
            except (RuntimeError, HTTPException) as error:
                logger.warning(
                    "PCM publication failed session={} error={}",
                    session.session_id,
                    type(error).__name__,
                )
                failure = error

        if failure is not None:
            await _close_cloudflare_resources(realtime, session)
            await registry.close(session, reason="publication-failed")
            raise HTTPException(status_code=503, detail="Voice publication failed") from failure

        return {
            "sessionDescription": session.publisher_answer,
            "botPublication": {
                "sessionId": session.bot_publisher_session_id,
                "trackName": session.bot_track_name,
            },
        }

    @web.post("/pcm/{session_id}/subscribe")
    async def pcm_subscribe(
        session_id: str,
        body: Annotated[dict[str, Any], Body()],
        authorization: str | None = Header(default=None),
    ):
        session = await require_owned_session(session_id, authorization)
        publication = body.get("botPublication")
        if not isinstance(publication, dict):
            raise HTTPException(status_code=400, detail="Voice bot publication is invalid")
        publication_session_id = _required_string(
            publication.get("sessionId"), field="bot publication session id"
        )
        publication_track_name = _required_string(
            publication.get("trackName"), field="bot publication track name"
        )
        if (
            publication_session_id != session.bot_publisher_session_id
            or publication_track_name != session.bot_track_name
        ):
            raise HTTPException(status_code=403, detail="Voice bot publication is not owned")

        failure = None
        async with session.mutation_lock:
            if session.subscriber_offer is None:
                try:
                    created = await realtime.request("POST", "/sessions/new")
                    subscriber_session_id = _required_string(
                        created.get("sessionId"), field="subscriber session id"
                    )
                    session.subscriber_session_id = subscriber_session_id
                    subscribed = await realtime.request(
                        "POST",
                        f"/sessions/{subscriber_session_id}/tracks/new",
                        {
                            "tracks": [
                                {
                                    "location": "remote",
                                    "sessionId": publication_session_id,
                                    "trackName": publication_track_name,
                                }
                            ]
                        },
                    )
                    offer = _session_description(
                        subscribed.get("sessionDescription"), expected_type="offer"
                    )
                    track = _first_track(subscribed, operation="bot subscription")
                    session.subscriber_mid = _required_string(
                        track.get("mid"), field="subscriber mid", max_length=32
                    )
                    session.subscriber_offer = offer
                except (RuntimeError, HTTPException) as error:
                    logger.warning(
                        "PCM subscription failed session={} error={}",
                        session.session_id,
                        type(error).__name__,
                    )
                    failure = error

        if failure is not None:
            await _close_cloudflare_resources(realtime, session)
            await registry.close(session, reason="subscription-failed")
            raise HTTPException(status_code=503, detail="Voice subscription failed") from failure

        return {
            "subscriberSessionId": session.subscriber_session_id,
            "sessionDescription": session.subscriber_offer,
        }

    @web.post("/pcm/{session_id}/subscribe-answer")
    async def pcm_subscribe_answer(
        session_id: str,
        body: Annotated[dict[str, Any], Body()],
        authorization: str | None = Header(default=None),
    ):
        session = await require_owned_session(session_id, authorization)
        subscriber_session_id = _required_string(
            body.get("subscriberSessionId"), field="subscriber session id"
        )
        answer = _session_description(body.get("sessionDescription"), expected_type="answer")
        if subscriber_session_id != session.subscriber_session_id:
            raise HTTPException(status_code=403, detail="Voice subscriber session is not owned")

        failure = None
        async with session.mutation_lock:
            if not session.subscriber_answered:
                try:
                    await realtime.request(
                        "PUT",
                        f"/sessions/{subscriber_session_id}/renegotiate",
                        {"sessionDescription": answer},
                    )
                    session.subscriber_answered = True
                except RuntimeError as error:
                    failure = error
        if failure is not None:
            # A lost renegotiation response has an unknown outcome and is not safe to retry.
            # Retire the whole attempt; the device can start a fresh Voice session.
            await _close_cloudflare_resources(realtime, session)
            await registry.close(session, reason="renegotiation-failed")
            raise HTTPException(status_code=503, detail="Voice subscription failed") from failure
        return {"status": "ok"}

    @web.get("/pcm/{session_id}/status")
    async def pcm_status(
        session_id: str,
        authorization: str | None = Header(default=None),
    ):
        session = await require_owned_session(session_id, authorization)
        return session.status()

    @web.post("/pcm/{session_id}/stop")
    async def pcm_close(
        session_id: str,
        _body: Annotated[dict[str, Any] | None, Body()] = None,
        authorization: str | None = Header(default=None),
    ):
        claims, _ = _authorize(authorization)
        session = await registry.get_owned(session_id, claims.session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="PCM session not found")
        await _close_cloudflare_resources(realtime, session)
        await registry.close(session, reason="control-plane-close")
        return {"status": "closed", "voiceSessionId": session_id}

    async def resolve_websocket_session(
        websocket: WebSocket,
        session_id: str,
        kind: str,
        token: str,
    ) -> PCMSession | None:
        session = await registry.get(session_id)
        if (
            session is None
            or session.state in {"closing", "closed"}
            or session.expires_at <= int(time.time())
            or not session.endpoint_token_matches(kind, token)
        ):
            await websocket.close(code=4401)
            return None
        return session

    @web.websocket("/pcm/media/{session_id}/mic")
    async def pcm_mic(websocket: WebSocket, session_id: str, token: str = ""):
        session = await resolve_websocket_session(websocket, session_id, "mic", token)
        if session is None:
            return
        await websocket.accept()
        await session.transport.attach_mic(websocket)
        try:
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    break
                data = message.get("bytes")
                if data is None:
                    await websocket.close(code=1003)
                    break
                if len(data) > CLOUDFLARE_MAX_MESSAGE_BYTES:
                    await websocket.close(code=1009)
                    break
                try:
                    await session.transport.push_mic_packet(data)
                except (PacketDecodeError, ValueError):
                    logger.warning("Rejected malformed PCM packet session={}", session.session_id)
                    await websocket.close(code=1003)
                    break
        except WebSocketDisconnect:
            pass
        finally:
            await session.transport.detach_mic(websocket)

    @web.websocket("/pcm/media/{session_id}/bot")
    async def pcm_bot(websocket: WebSocket, session_id: str, token: str = ""):
        session = await resolve_websocket_session(websocket, session_id, "bot", token)
        if session is None:
            return
        await websocket.accept()
        await session.transport.attach_bot(websocket)
        try:
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    break
                # Cloudflare buffer-mode ingest is receive-only from its point of view.
                # Any client-to-server payload on this socket indicates a contract error.
                if message.get("bytes") is not None or message.get("text") is not None:
                    await websocket.close(code=1003)
                    break
        except WebSocketDisconnect:
            pass
        finally:
            await session.transport.detach_bot(websocket)
            # Cloudflare does not reconnect ingest adapters. A terminal bot-side
            # WebSocket disconnect therefore makes this attempt unusable; retire
            # its Cloudflare resources instead of leaving a live-but-silent bot.
            if session.state not in {"closing", "closed"} and not session.transport.closed:
                await _close_cloudflare_resources(realtime, session)
                await registry.close(session, reason="bot-media-disconnected")

    return web


def configure_runtime_logging() -> None:
    logging.basicConfig(level=logging.INFO)
