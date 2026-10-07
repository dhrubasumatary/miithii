"""Probe the deployed token endpoint the way the LiveKit client SDK actually calls it.

The point is to exercise the wire contract end to end, not the local implementation: a POST
with the fields `TokenSourceEndpoint` sends, and a response carrying the agent dispatch the
worker needs. A token that builds locally but is refused by the deployed service proves
nothing.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os

import aiohttp

from .probe import load_env

ENDPOINT = "https://dhrubasumatary--miithii-livekit-agent-token.modal.run"
AGENT_NAME = "miithii-voice"


def claims(token: str) -> dict:
    segment = token.split(".")[1]
    segment += "=" * (-len(segment) % 4)
    return json.loads(base64.urlsafe_b64decode(segment))


async def request(session: aiohttp.ClientSession, body: dict) -> tuple[int, dict]:
    async with session.post(ENDPOINT, json=body) as response:
        try:
            return response.status, await response.json()
        except Exception:  # noqa: BLE001
            return response.status, {"raw": "unparseable"}


async def main() -> None:
    load_env()
    livekit_url = os.environ["LIVEKIT_URL"]
    failures = 0

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=600)) as session:
        print(f"POST {ENDPOINT}\n")

        # 1. Exactly what TokenSourceEndpoint sends: room config carrying agent dispatch,
        #    plus the participant attributes that carry the reply language.
        for language in ("asm", "brx"):
            body = {
                "room_name": "ignored-by-server",
                "participant_identity": f"probe-{language}",
                "participant_name": "Probe",
                "participant_attributes": {"miithii.language": language},
                "room_config": {
                    "agents": [{"agentName": AGENT_NAME, "metadata": "{}"}],
                    "maxParticipants": 1,
                },
            }
            status, payload = await request(session, body)
            ok = status == 201 and "participant_token" in payload and "server_url" in payload
            failures += 0 if ok else 1
            print(f"[{language}] HTTP {status} {'OK' if ok else 'FAIL'}")
            if not ok:
                print(f"    payload: {str(payload)[:300]}")
                continue

            assert payload["server_url"] == livekit_url, payload["server_url"]
            claim = claims(payload["participant_token"])
            room = claim["video"]["room"]
            agents = claim.get("roomConfig", {}).get("agents", [])
            print(f"    room            {room}")
            print(f"    language attr   {claim.get('attributes', {}).get('miithii.language')}")
            print(f"    agent dispatch  {agents[0]['agentName'] if agents else 'MISSING'}")
            print(f"    maxParticipants {claim.get('roomConfig', {}).get('maxParticipants')}")
            print(
                f"    video granted   {'canPublishVideo' in claim['video']}"
            )

            if not agents or agents[0]["agentName"] != AGENT_NAME:
                print("    FAIL: no agent dispatch - the worker would never be given a session")
                failures += 1
            if claim.get("attributes", {}).get("miithii.language") != language:
                print("    FAIL: language did not reach the token")
                failures += 1

        # 2. Each session must get its own room.
        rooms = set()
        for index in range(4):
            _, payload = await request(
                session, {"participant_attributes": {"miithii.language": "asm"}}
            )
            if "participant_token" in payload:
                rooms.add(claims(payload["participant_token"])["video"]["room"])
        unique = len(rooms) == 4
        failures += 0 if unique else 1
        print(f"\n[unique rooms] {len(rooms)}/4 distinct -> {'OK' if unique else 'FAIL'}")

        # 3. An unsupported language must be refused, not silently defaulted.
        status, payload = await request(
            session, {"participant_attributes": {"miithii.language": "fr"}}
        )
        refused = status == 400
        failures += 0 if refused else 1
        verdict = "OK" if refused else "FAIL"
        print(f"[bad language]  HTTP {status} -> {verdict}: {str(payload)[:120]}")

    print(f"\n{'all token endpoint checks passed' if not failures else f'{failures} FAILED'}")
    return failures


if __name__ == "__main__":
    raise SystemExit(1 if asyncio.run(main()) else 0)
