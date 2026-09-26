"""Probe Cloudflare TURN packet flow between this machine and Modal.

This bypasses aiortc, SDP, DTLS and Pipecat. A local aioice TURN allocation and
an authenticated temporary Modal TURN allocation exchange fixed probe payloads.
The 2x2 UDP/TLS matrix isolates TURN client transport from cross-network relay
forwarding without exposing provider credentials.
"""

from __future__ import annotations

import asyncio
import os
import secrets
from typing import Any

import aiohttp
from aioice.turn import TurnTransport, create_turn_endpoint

from miithii_voice.aioice_patch import apply_aioice_turn_data_indication_patch

API_URL = "https://api.miithii.in"
MODAL_URL = "https://dhrubasumatary--miithii-voice-connect-app.modal.run"


class Receiver(asyncio.DatagramProtocol):
    def __init__(self) -> None:
        self.queue: asyncio.Queue[tuple[bytes, tuple[str, int]]] = asyncio.Queue()

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        self.queue.put_nowait((data, addr))


async def json_post(
    http: aiohttp.ClientSession,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    async with http.post(url, headers=headers, json=body or {}) as response:
        payload = await response.json()
        if response.status >= 400:
            detail = payload.get("detail") if isinstance(payload, dict) else None
            raise RuntimeError(f"HTTP {response.status}: {detail or 'request failed'}")
        if not isinstance(payload, dict):
            raise RuntimeError("Expected JSON object response")
        return payload


def first_turn_credentials(ice_servers: Any) -> tuple[str, str]:
    if not isinstance(ice_servers, list):
        raise RuntimeError("Invalid ICE server list")
    for server in ice_servers:
        if not isinstance(server, dict):
            continue
        username = server.get("username")
        credential = server.get("credential")
        if isinstance(username, str) and isinstance(credential, str):
            return username, credential
    raise RuntimeError("TURN credentials missing")


async def create_local_turn(
    mode: str,
    username: str,
    credential: str,
) -> tuple[TurnTransport, Receiver]:
    receiver = Receiver()
    transport, _protocol = await create_turn_endpoint(
        lambda: receiver,
        ("turn.cloudflare.com", 443 if mode == "tls" else 3478),
        username=username,
        password=credential,
        ssl=True if mode == "tls" else None,
        transport="tcp" if mode == "tls" else "udp",
    )
    return transport, receiver


async def run_case(local_mode: str, modal_mode: str) -> bool:
    timeout = aiohttp.ClientTimeout(total=45)
    async with aiohttp.ClientSession(timeout=timeout) as http:
        admission = await json_post(
            http,
            f"{API_URL}/api/voice/session",
            headers={"x-miithii-install-id": f"cross_turn_{secrets.token_hex(18)}"},
            body={"language": "as"},
        )
        token = admission.get("token")
        if not isinstance(token, str):
            raise RuntimeError("Voice capability missing")
        headers = {"authorization": f"Bearer {token}"}

        start = await json_post(
            http,
            f"{MODAL_URL}/start",
            headers=headers,
            body={
                "transport": "webrtc",
                "enableDefaultIceServers": True,
                "body": {"language": "as"},
            },
        )
        username, credential = first_turn_credentials(
            start.get("iceConfig", {}).get("iceServers")
        )
        remote = await json_post(
            http,
            f"{MODAL_URL}/debug/turn/start",
            headers=headers,
            body={"mode": modal_mode},
        )
        relay = remote.get("relayAddress")
        if (
            not isinstance(relay, list)
            or len(relay) != 2
            or not isinstance(relay[0], str)
            or not isinstance(relay[1], int)
        ):
            raise RuntimeError("Modal relay address missing")
        remote_relay = (relay[0], relay[1])

        local_transport, local_receiver = await create_local_turn(
            local_mode,
            username,
            credential,
        )
        try:
            local_relay = local_transport.get_extra_info("sockname")
            if not local_relay:
                raise RuntimeError("Local relay allocation missing")

            local_transport.sendto(b"local-turn-probe", remote_relay)
            remote_poll = await json_post(
                http,
                f"{MODAL_URL}/debug/turn/poll",
                headers=headers,
            )
            local_to_modal = remote_poll.get("received") is True

            await json_post(
                http,
                f"{MODAL_URL}/debug/turn/send",
                headers=headers,
                body={"peerAddress": [local_relay[0], local_relay[1]]},
            )
            try:
                packet, _source = await asyncio.wait_for(
                    local_receiver.queue.get(),
                    timeout=8,
                )
                modal_to_local = packet == b"modal-turn-probe"
            except TimeoutError:
                modal_to_local = False
        finally:
            local_transport.close()
            await asyncio.sleep(0.2)

    ok = local_to_modal and modal_to_local
    print(
        f"local={local_mode} modal={modal_mode} "
        f"local_to_modal={local_to_modal} modal_to_local={modal_to_local} ok={ok}"
    )
    return ok


async def main() -> None:
    apply_aioice_turn_data_indication_patch()
    results = []
    matrix = (
        ("tls", "tls"),
        ("udp", "tls"),
        ("tls", "udp"),
        ("udp", "udp"),
    )
    only_local = os.environ.get("MIITHII_TURN_LOCAL_MODE")
    only_modal = os.environ.get("MIITHII_TURN_MODAL_MODE")
    for local_mode, modal_mode in matrix:
        if only_local and local_mode != only_local:
            continue
        if only_modal and modal_mode != only_modal:
            continue
        results.append(await run_case(local_mode, modal_mode))
    if results and all(results):
        print("CLOUDFLARE_TURN_CROSS_NETWORK_MATRIX_OK")
    elif results:
        raise SystemExit(1)
    else:
        raise RuntimeError("No TURN matrix cases selected")


if __name__ == "__main__":
    asyncio.run(main())
