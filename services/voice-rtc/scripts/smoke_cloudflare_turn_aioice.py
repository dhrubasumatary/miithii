"""Probe Cloudflare relay-to-relay packet flow through aioice only.

This intentionally bypasses aiortc, SDP, DTLS and Pipecat. It obtains two
independent short-lived TURN credentials through the normal Miithii session
bootstrap, allocates two aioice TURN transports, and sends one datagram in each
direction.
"""

from __future__ import annotations

import asyncio
import secrets

import aiohttp
from aioice.turn import create_turn_endpoint

from miithii_voice.aioice_patch import apply_aioice_turn_data_indication_patch

API_URL = "https://api.miithii.in"
MODAL_URL = "https://dhrubasumatary--miithii-voice-connect-app.modal.run"
TURN_HOST = "turn.cloudflare.com"
TURN_PORT = 443


class Receiver(asyncio.DatagramProtocol):
    def __init__(self) -> None:
        self.queue: asyncio.Queue[tuple[bytes, tuple[str, int]]] = asyncio.Queue()

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        self.queue.put_nowait((data, addr))


async def get_turn_credentials(http: aiohttp.ClientSession) -> tuple[str, str]:
    install_id = f"aioice_smoke_{secrets.token_hex(18)}"
    async with http.post(
        f"{API_URL}/api/voice/session",
        headers={"x-miithii-install-id": install_id},
        json={"language": "as"},
    ) as response:
        response.raise_for_status()
        admission = await response.json()

    async with http.post(
        f"{MODAL_URL}/start",
        headers={"authorization": f"Bearer {admission['token']}"},
        json={
            "transport": "webrtc",
            "enableDefaultIceServers": True,
            "body": {"language": "as"},
        },
    ) as response:
        response.raise_for_status()
        start = await response.json()

    for server in start["iceConfig"]["iceServers"]:
        if server.get("username") and server.get("credential"):
            return server["username"], server["credential"]
    raise RuntimeError("TURN credentials missing from start response")


async def main() -> None:
    apply_aioice_turn_data_indication_patch()
    timeout = aiohttp.ClientTimeout(total=15)
    async with aiohttp.ClientSession(timeout=timeout) as http:
        credentials_a, credentials_b = await asyncio.gather(
            get_turn_credentials(http),
            get_turn_credentials(http),
        )

    receiver_a = Receiver()
    receiver_b = Receiver()
    transport_a, _ = await create_turn_endpoint(
        lambda: receiver_a,
        (TURN_HOST, TURN_PORT),
        username=credentials_a[0],
        password=credentials_a[1],
        ssl=True,
        transport="tcp",
    )
    transport_b, _ = await create_turn_endpoint(
        lambda: receiver_b,
        (TURN_HOST, TURN_PORT),
        username=credentials_b[0],
        password=credentials_b[1],
        ssl=True,
        transport="tcp",
    )

    try:
        relay_a = transport_a.get_extra_info("sockname")
        relay_b = transport_b.get_extra_info("sockname")
        if not relay_a or not relay_b:
            raise RuntimeError("TURN relay allocation missing")

        transport_a.sendto(b"from-a", relay_b)
        transport_b.sendto(b"from-b", relay_a)
        packet_a, packet_b = await asyncio.gather(
            asyncio.wait_for(receiver_a.queue.get(), timeout=10),
            asyncio.wait_for(receiver_b.queue.get(), timeout=10),
        )
        if packet_a[0] != b"from-b" or packet_b[0] != b"from-a":
            raise RuntimeError("TURN relay payload mismatch")
        print("AIOICE_CLOUDFLARE_TURN_RELAY_OK")
    finally:
        transport_a.close()
        transport_b.close()
        await asyncio.sleep(0.2)


if __name__ == "__main__":
    asyncio.run(main())
