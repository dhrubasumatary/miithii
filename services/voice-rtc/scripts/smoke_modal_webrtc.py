"""Prove a real SmallWebRTC peer can reach the deployed Modal container.

This deliberately uses the public Voice admission endpoint to obtain the same
short-lived capability as Android, but targets Modal's SmallWebRTC /start path
directly so production routing does not need to be changed before ICE is proven.
No capability or provider secret is printed.
"""

from __future__ import annotations

import asyncio
import os
import secrets

import aiohttp
from aiortc import (
    RTCConfiguration,
    RTCIceServer,
    RTCPeerConnection,
    RTCSessionDescription,
)
from aiortc.mediastreams import AudioStreamTrack

from miithii_voice.aioice_patch import apply_aioice_turn_data_indication_patch

API_URL = "https://api.miithii.in"
MODAL_URL = "https://dhrubasumatary--miithii-voice-connect-app.modal.run"
STUN_URL = "stun:stun.l.google.com:19302"
RELAY_ONLY = os.environ.get("MIITHII_SMOKE_RELAY_ONLY") == "1"

apply_aioice_turn_data_indication_patch()


def candidate_types(sdp: str) -> list[str]:
    kinds: list[str] = []
    for line in sdp.splitlines():
        if not line.startswith("a=candidate:") or " typ " not in line:
            continue
        kind = line.split(" typ ", 1)[1].split(" ", 1)[0].strip()
        if kind and kind not in kinds:
            kinds.append(kind)
    return kinds


def relay_only_sdp(sdp: str) -> str:
    """Keep only relay ICE candidates for TURN diagnostics.

    This is intentionally smoke-test-only. It helps distinguish TURN/auth
    failures from Cloudflare rejecting ChannelBind requests to private host
    candidates.
    """

    lines = []
    for line in sdp.splitlines():
        if line.startswith("a=candidate:") and " typ relay" not in line:
            continue
        lines.append(line)
    return "\r\n".join(lines) + "\r\n"


def parse_ice_servers(start: dict) -> list[RTCIceServer]:
    raw_servers = start.get("iceConfig", {}).get("iceServers", [])
    if not isinstance(raw_servers, list) or not raw_servers:
        return [RTCIceServer(urls=[STUN_URL])]

    parsed: list[RTCIceServer] = []
    for item in raw_servers:
        if not isinstance(item, dict):
            continue
        urls = item.get("urls")
        if isinstance(urls, str):
            urls = [urls]
        if not isinstance(urls, list) or not urls:
            continue
        parsed.append(
            RTCIceServer(
                urls=urls,
                username=item.get("username"),
                credential=item.get("credential"),
            )
        )
    if not parsed:
        raise RuntimeError("Modal /start returned no usable ICE servers")
    return parsed


async def mint_voice_session(http: aiohttp.ClientSession, language: str) -> str:
    install_id = f"smoke_{secrets.token_hex(18)}"
    async with http.post(
        f"{API_URL}/api/voice/session",
        headers={"x-miithii-install-id": install_id},
        json={"language": language},
    ) as response:
        payload = await response.json()
        if response.status != 200 or not isinstance(payload.get("token"), str):
            raise RuntimeError(f"Voice admission failed with HTTP {response.status}")
        return payload["token"]


async def wait_for_connected(pc: RTCPeerConnection, timeout: float = 20.0) -> None:
    if pc.connectionState == "connected":
        return
    connected = asyncio.Event()

    @pc.on("connectionstatechange")
    async def on_connectionstatechange() -> None:
        print(f"peer_connection_state={pc.connectionState}")
        if pc.connectionState == "connected":
            connected.set()
        elif pc.connectionState in {"failed", "closed"}:
            connected.set()

    await asyncio.wait_for(connected.wait(), timeout=timeout)
    if pc.connectionState != "connected":
        raise RuntimeError(f"WebRTC did not connect: state={pc.connectionState}")


async def main() -> None:
    language = "as"
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as http:
        token = await mint_voice_session(http, language)
        authorization = {"authorization": f"Bearer {token}"}

        async with http.post(
            f"{MODAL_URL}/start",
            headers=authorization,
            json={
                "transport": "webrtc",
                "enableDefaultIceServers": True,
                "body": {"language": language},
            },
        ) as response:
            start = await response.json()
            if response.status != 200 or not isinstance(start.get("sessionId"), str):
                detail = start.get("detail") if isinstance(start, dict) else None
                raise RuntimeError(
                    f"Modal /start failed with HTTP {response.status}: {detail or 'unknown error'}"
                )
            session_id = start["sessionId"]

        pc = RTCPeerConnection(RTCConfiguration(iceServers=parse_ice_servers(start)))
        channel = pc.createDataChannel("chat", ordered=True)
        channel_open = asyncio.Event()

        @channel.on("open")
        def on_open() -> None:
            print("data_channel=open")
            channel.send("ping: smoke")
            channel_open.set()

        # AudioStreamTrack produces a valid silent audio stream. This exercises
        # the real RTP/DTLS media path rather than proving only HTTP signalling.
        pc.addTrack(AudioStreamTrack())

        try:
            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            local = pc.localDescription
            if local is None:
                raise RuntimeError("Client produced no local description")
            offer_sdp = relay_only_sdp(local.sdp) if RELAY_ONLY else local.sdp
            print(f"client_candidate_types={','.join(candidate_types(offer_sdp)) or 'none'}")

            offer_url = f"{MODAL_URL}/sessions/{session_id}/api/offer"
            async with http.post(
                offer_url,
                headers=authorization,
                json={
                    "sdp": offer_sdp,
                    "type": local.type,
                    "pc_id": None,
                    "restart_pc": False,
                    "requestData": {"language": language},
                },
            ) as response:
                answer = await response.json()
                if response.status != 200:
                    detail = answer.get("detail") if isinstance(answer, dict) else None
                    raise RuntimeError(
                        f"Modal offer failed with HTTP {response.status}: "
                        f"{detail or 'unknown error'}"
                    )
            answer_sdp = relay_only_sdp(answer["sdp"]) if RELAY_ONLY else answer["sdp"]
            print(f"server_candidate_types={','.join(candidate_types(answer_sdp)) or 'none'}")

            await pc.setRemoteDescription(
                RTCSessionDescription(sdp=answer_sdp, type=answer["type"])
            )
            await wait_for_connected(pc)
            await asyncio.wait_for(channel_open.wait(), timeout=5)
            print("SMALLWEBRTC_MODAL_ICE_OK")
        finally:
            await pc.close()


if __name__ == "__main__":
    asyncio.run(main())
