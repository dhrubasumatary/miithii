"""Does a quiet session die, or only a session receiving no audio at all?

The handover recorded a 60-second Sarvam inactivity timeout as "a session left in silence for a
minute dies". That conflates two different rooms, and the difference decides whether the phone
is at risk at all:

- A participant that publishes a microphone sends continuous PCM, silence included, so the
  provider's idle timer keeps resetting and never fires. This is the phone.
- A participant that publishes no audio at all sends nothing, so the provider sees no audio for
  60s and kills the socket. This is a text-only client: the turn probe, a terminal, a
  headless check.

So the question is measurable rather than arguable. This probe holds a room open past the
provider's idle timeout and then asks the agent something, so "the session survived" is a
demonstrated fact rather than an absence of log lines. It runs the comparison twice, with and
without a published microphone, and prints both.

It deliberately does not measure speech, because a silent PCM track proves the audio path is
open without claiming anything about recognition quality.

Usage::

    uv run --directory services/agent python -m miithii_agent.probe_idle
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import sys
import time

import aiohttp
from livekit import rtc

from .probe import load_env
from .token import LANGUAGE_ATTRIBUTE, REQUESTED_TIER_ATTRIBUTE

ENDPOINT = "https://dhrubasumatary--miithii-livekit-agent-token.modal.run"
REPLY_TOPIC = "miithii.reply"
AGENT_NAME = "miithii-voice"

LANGUAGE = "asm"

# The provider's own limit is 60s, so the idle window has to clear it with room to spare before
# any claim about surviving it means anything.
IDLE_SECONDS = 80.0

# A reply costs one Sarvam turn and one model call. It is the cheapest way to prove the agent
# is still serving, and it does not require Bodhan: the answer is delivered on the preview
# stream whether or not synthesis is possible.
PROMPT = "আমি ইয়াৰ কা কৰিব লাগে? দুই-তিনিটা বাক্য বুলাওঁ।"

# How long to wait for that answer before declaring the session unable to answer.
ANSWER_TIMEOUT = 60.0

# LiveKit keeps a subscribed agent track alive with near-zero PCM, so publishing a microphone
# costs almost nothing and says nothing about whether the provider saw audio.
SILENCE_SAMPLE_RATE = 24_000


async def mint(identity: str) -> tuple[str, str]:
    body = {
        "participant_identity": identity,
        "participant_name": "Idle Probe",
        "participant_attributes": {
            LANGUAGE_ATTRIBUTE: LANGUAGE,
            REQUESTED_TIER_ATTRIBUTE: "standard",
        },
        "room_config": {"agents": [{"agentName": AGENT_NAME, "metadata": "{}"}]},
    }
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=120)) as session:
        async with session.post(ENDPOINT, json=body) as response:
            response.raise_for_status()
            payload = await response.json()
    return payload["server_url"], payload["participant_token"]


async def attempt(*, publish_microphone: bool) -> dict[str, object]:
    identity = "idle-probe-mic" if publish_microphone else "idle-probe-silent"
    server_url, token = await mint(identity)

    room = rtc.Room()
    source: rtc.AudioSource | None = None
    background: set[asyncio.Task[None]] = set()
    answered = asyncio.get_running_loop().create_future()
    preview = {"text": "", "complete": False}

    def handle_preview(chunk: str) -> None:
        try:
            message = json.loads(chunk)
        except ValueError:
            return
        kind = message.get("kind")
        if kind == "delta":
            if int(message.get("revision", 0)) > 0:
                preview["text"] = message.get("text", "")
            else:
                preview["text"] += message.get("text", "")
        elif kind == "end":
            preview["text"] = message.get("text", "") or preview["text"]
            preview["complete"] = True
            if not answered.done():
                answered.set_result(None)
        elif kind == "verdict" and (message.get("text") or "").strip():
            if not answered.done():
                answered.set_result(None)

    def read_stream(reader: object, *_args: object) -> None:
        async def read() -> None:
            try:
                async for chunk in reader:  # type: ignore[attr-defined]
                    handle_preview(chunk)
            except Exception:  # noqa: BLE001 - a closed stream is not a failure here
                return

        task = asyncio.create_task(read())
        background.add(task)
        task.add_done_callback(background.discard)

    room.register_text_stream_handler(REPLY_TOPIC, read_stream)

    try:
        await room.connect(server_url, token)

        if publish_microphone:
            source = rtc.AudioSource(SILENCE_SAMPLE_RATE, 1)
            track = rtc.LocalAudioTrack.create_audio_track("idle-probe-mic", source)
            options = rtc.TrackPublishOptions()
            options.source = rtc.TrackSource.SOURCE_MICROPHONE
            await room.local_participant.publish_track(track, options)

        print(f"  connected, idling {IDLE_SECONDS:.0f}s "
              f"(microphone {'published' if publish_microphone else 'not published'})...")
        await asyncio.sleep(IDLE_SECONDS)

        agent_present = len(room.remote_participants) > 0
        print(f"  agent still in the room after the idle window: {agent_present}")

        await room.local_participant.send_text(
            PROMPT, topic="lk.chat", attributes={LANGUAGE_ATTRIBUTE: LANGUAGE}
        )

        started = time.perf_counter()
        with contextlib.suppress(asyncio.TimeoutError):
            await asyncio.wait_for(answered, timeout=ANSWER_TIMEOUT)
        waited = time.perf_counter() - started
        got = answered.done() and bool(str(preview["text"]).strip())

        return {
            "microphone": publish_microphone,
            "agent_present": agent_present,
            "answered": got,
            "seconds_to_answer": round(waited, 1),
            "text": str(preview["text"]).strip()[:120],
        }
    finally:
        for task in tuple(background):
            task.cancel()
        if background:
            await asyncio.gather(*background, return_exceptions=True)
        with contextlib.suppress(Exception):
            room.unregister_text_stream_handler(REPLY_TOPIC)
        with contextlib.suppress(Exception):
            await room.disconnect()


async def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    load_env()

    which = (os.environ.get("PROBE_CASE") or "both").lower()
    if which not in ("both", "mic", "silent"):
        raise RuntimeError(f"PROBE_CASE must be both, mic or silent, got {which!r}")
    cases = {
        "both": (False, True),
        "silent": (False,),
        "mic": (True,),
    }[which]

    results = []
    for publish in cases:
        print(f"\n=== microphone {'published' if publish else 'not published'} ===")
        result = await attempt(publish_microphone=publish)
        results.append(result)
        print(f"  answered: {result['answered']} after {result['seconds_to_answer']}s")
        print(f"  reply: {result['text']!r}")

    print("\n--- idle-session measurement ---")
    for result in results:
        print(
            f"microphone={str(result['microphone']):<5} "
            f"agent_present={str(result['agent_present']):<5} "
            f"answered={str(result['answered']):<5} "
            f"after {result['seconds_to_answer']}s"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
