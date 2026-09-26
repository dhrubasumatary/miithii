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
import logging
import os
import time
from pathlib import Path
from typing import Any

import modal

SERVICE_DIR = Path(__file__).resolve().parent
SESSION_SECONDS = 20 * 60
STUN_URL = "stun:stun.l.google.com:19302"
CLOUDFLARE_TURN_API = "https://rtc.live.cloudflare.com/v1/turn/keys"

runtime_image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("ffmpeg")
    .pip_install(
        "aiohttp>=3.13,<4",
        "python-dotenv>=1,<2",
        "pipecat-ai[silero,webrtc]==1.10.0",
        "fastapi>=0.118,<1",
    )
    .add_local_file(str(SERVICE_DIR / "bot.py"), remote_path="/root/bot.py")
    .add_local_dir(str(SERVICE_DIR / "miithii_voice"), remote_path="/root/miithii_voice")
    .add_local_dir(str(SERVICE_DIR / "contracts"), remote_path="/root/contracts")
)

app = modal.App("miithii-voice")
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
    turn_probes: dict[str, dict[str, Any]] = {}
    sfu_sessions: dict[str, str] = {}
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
                        raise RuntimeError(f"Realtime API HTTP {response.status}: {result}")
        except (aiohttp.ClientError, TimeoutError, RuntimeError) as error:
            raise HTTPException(status_code=503, detail="Voice SFU is unavailable") from error
        if not isinstance(result, dict):
            raise HTTPException(status_code=503, detail="Voice SFU response is invalid")
        return result

    def require_capability(authorization: str | None) -> tuple[str, VoiceSessionClaims]:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Voice session required")
        token = authorization.split(" ", 1)[1].strip()
        try:
            claims = verify_voice_session(token, os.environ["VOICE_RTC_TOKEN"])
        except (KeyError, ValueError) as error:
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
        }

    @web.post("/sfu/start")
    async def sfu_start(
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        """Authenticate native SFU startup without exposing Cloudflare credentials."""
        _token, claims = require_capability(authorization)
        if payload.get("transport") != "cloudflare-sfu":
            raise HTTPException(status_code=400, detail="Cloudflare SFU transport required")
        body = payload.get("body", {})
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Voice session body must be an object")
        language = body.get("language", claims.language)
        if language != claims.language:
            raise HTTPException(status_code=400, detail="Voice language does not match session")
        return {
            "transport": "cloudflare-sfu",
            "sessionId": claims.session_id,
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
        result = await calls_request("POST", "/sessions/new")
        session_id = result.get("sessionId")
        if not isinstance(session_id, str) or not session_id:
            raise HTTPException(status_code=503, detail="Voice SFU session is invalid")
        sfu_sessions[session_id] = claims.session_id
        return result

    def require_sfu_session(calls_session_id: str, claims: VoiceSessionClaims) -> None:
        if sfu_sessions.get(calls_session_id) != claims.session_id:
            raise HTTPException(status_code=404, detail="Voice SFU session not found")

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
            if remote_session_id and sfu_sessions.get(remote_session_id) != claims.session_id:
                raise HTTPException(status_code=404, detail="Voice SFU track session not found")
        return await calls_request(
            "POST",
            f"/sessions/{calls_session_id}/tracks/new",
            payload,
        )

    @web.put("/sfu/sessions/{calls_session_id}/renegotiate")
    @web.put("/debug/sfu/sessions/{calls_session_id}/renegotiate")
    async def debug_sfu_renegotiate(
        calls_session_id: str,
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)
        return await calls_request(
            "PUT",
            f"/sessions/{calls_session_id}/renegotiate",
            payload,
        )

    @web.post("/sfu/sessions/{calls_session_id}/datachannels/establish")
    @web.post("/debug/sfu/sessions/{calls_session_id}/datachannels/establish")
    async def debug_sfu_datachannels_establish(
        calls_session_id: str,
        payload: dict,
        authorization: str | None = Header(default=None),
    ):
        _token, claims = require_capability(authorization)
        require_sfu_session(calls_session_id, claims)
        return await calls_request(
            "POST",
            f"/sessions/{calls_session_id}/datachannels/establish",
            payload,
        )

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
            if remote_session_id and sfu_sessions.get(remote_session_id) != claims.session_id:
                raise HTTPException(
                    status_code=404,
                    detail="Voice SFU data channel session not found",
                )
        return await calls_request(
            "POST",
            f"/sessions/{calls_session_id}/datachannels/new",
            payload,
        )

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
        sfu_sessions[modal_session_id] = claims.session_id

        connection = CloudflareSFUConnection(connection_timeout_secs=30)
        bootstrap_audio = RawAudioTrack(sample_rate=48_000, auto_silence=True)
        output_transceiver = connection.pc.addTransceiver(bootstrap_audio, direction="sendonly")
        offer = await connection.pc.createOffer()
        await connection.pc.setLocalDescription(offer)
        if output_transceiver.mid is None:
            await connection.pc.close()
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
            await connection.pc.close()
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
            await connection.pc.close()
            raise HTTPException(status_code=503, detail="Voice SFU bot track is invalid")

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
            await connection.pc.close()
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
            await connection.pc.close()
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
        connect_deadline = time.monotonic() + 10
        while (
            connection.pc.connectionState != "connected"
            and time.monotonic() < connect_deadline
        ):
            await asyncio.sleep(0.05)
        if connection.pc.connectionState != "connected":
            await connection.pc.close()
            raise HTTPException(status_code=503, detail="Voice SFU Modal peer did not connect")

        run_bot_session = payload.get("runBot") is True
        peer = {
            "connection": connection,
            "inputFrames": 0,
            "inputSamples": 0,
            "botTrackName": bot_track["trackName"],
            "dataChannelAckSent": False,
            "runBot": run_bot_session,
            "sessionToken": _token,
        }
        sfu_pipecat_peers[modal_session_id] = peer
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
            "dataChannelAckSent": peer.get("dataChannelAckSent", False),
            "sfuDataChannels": sfu_data_channels,
            "dataChannel": (
                connection.data_channel_debug_state()
                if isinstance(connection, CloudflareSFUConnection)
                else None
            ),
        }

    @web.post("/sfu/pipecat-peer/{calls_session_id}/datachannel/subscribe")
    @web.post("/debug/sfu/pipecat-peer/{calls_session_id}/datachannel/subscribe")
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

        def acknowledge_when_open() -> None:
            if rtvi_channel.readyState == "open":
                rtvi_channel.send("ack")
                peer["dataChannelAckSent"] = True

        @rtvi_channel.on("open")
        def on_rtvi_open():
            acknowledge_when_open()

        acknowledge_when_open()
        peer["serverEventsChannel"] = server_events_channel
        peer["dataChannel"] = rtvi_channel
        peer["remoteSessionId"] = remote_session_id
        peer["remoteDataChannelName"] = remote_channel_name
        transport = None
        if peer.get("runBot") and not peer.get("botTask"):
            transport = SmallWebRTCTransport(
                webrtc_connection=connection,
                params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
            )
            peer["transport"] = transport
        await connection.connect()
        if transport is not None and not peer.get("botTask"):
            runner_args = RunnerArguments(
                body={"language": claims.language},
                session_id=claims.session_id,
            )

            async def run_sfu_session() -> None:
                try:
                    await run_bot(transport, runner_args, session_token=token)
                finally:
                    sfu_pipecat_peers.pop(calls_session_id, None)
                    sfu_sessions.pop(calls_session_id, None)

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
