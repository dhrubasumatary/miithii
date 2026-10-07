"""Measure whether a reply is spoken to completion, not just whether it started.

The existing turn probe stops at the first non-silent sample, which answers "did audio arrive"
and nothing else. It cannot see the failure that actually matters: an agent that begins a reply
and is cut off before the last sentence. From a first-sample measurement a truncated reply and a
complete one look identical.

This probe watches the whole turn and reports what a listener would notice:

- how long the reply was expected to take to say, from the preview text the agent publishes
- how long the agent actually kept producing audio
- whether the tail of the preview text ever appeared in the aligned transcript

That last one is the honest test. The transcript is generated from what was really played, so a
reply cut off mid-sentence is missing its ending there even though the audio path reported
success throughout. Comparing the published text against the transcript is the only measurement
that distinguishes "spoke the whole thing" from "stopped early", and it is measurable without a
human listening.

It connects as a participant and sends a text turn, so it covers the deployed model, validation,
synthesis, LiveKit output and subscriber path while excluding live microphone and STT
endpointing. Speaking to the phone needs a human.

A silent microphone is published anyway. Sarvam's realtime endpoint kills a websocket that has
received no audio for 60 seconds, and a text-only participant sends none, so a probe that just
sat there would tear its own STT stream down every minute and make a provider outage the likely
reading of the result. The track carries no speech, so it changes nothing about what is being
measured - it only keeps the audio path open, exactly as the phone's does.

Usage::

    uv run --directory services/agent python -m miithii_agent.probe_turn
    PROBE_LANGUAGE=brx uv run --directory services/agent python -m miithii_agent.probe_turn
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field

import aiohttp
from livekit import rtc

from .probe import load_env
from .token import LANGUAGE_ATTRIBUTE, REQUESTED_TIER_ATTRIBUTE

ENDPOINT = "https://dhrubasumatary--miithii-livekit-agent-token.modal.run"
REPLY_TOPIC = "miithii.reply"
AGENT_NAME = "miithii-voice"

# Prompts chosen to force a multi-sentence reply, because a one-sentence reply cannot be cut off
# in an interesting place and would let a truncation bug pass unnoticed.
#
# Each prompt is in the script its language's contract requires. The Bodo one was checked
# deliberately: it is easy to write Assamese by reflex, and a Bodo probe written in the Bengali
# block proves nothing while looking entirely plausible in a transcript.
PROMPTS = {
    "asm": "আমি ইয়াৰ কা কৰিব লাগে? দুই-তিনিটা বাক্য বুলাওঁ।",
    "brx": "आं बेयावनो दं, मा बुंनो नागिरदों? दुगो-थिनिटा बाक्य बु।",
}

# LiveKit keeps the subscribed agent track alive with near-zero PCM before actual speech. A tiny
# peak threshold filters those idle frames. This is a probe boundary only; product audio is not
# gated or modified by it.
NON_SILENT_PEAK = 64

# Silence that ends the turn. Bodhan is a whole-file provider, so the gap between the last sample
# and the transcript's final word is not a streaming-provider boundary; anything longer than this
# means the agent has finished for this probe.
TURN_END_SILENCE = 2.5

# How long to wait for a turn that never produces any audio at all, which is what a refused answer
# looks like from the subscriber's side.
TURN_TIMEOUT = 90.0

# The silent track published to keep Sarvam's audio path open. It carries no speech, so the rate
# only has to be something the transport will accept.
SILENCE_SAMPLE_RATE = 24_000


def has_non_silent_pcm(frame: rtc.AudioFrame) -> bool:
    """Return true once a received PCM frame contains audible-level signal."""
    return any(abs(int(sample)) > NON_SILENT_PEAK for sample in frame.data)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class TurnMeasurement:
    """What one turn produced, from the subscriber's side."""

    preview_text: str = ""
    preview_complete: bool = False
    refusal: str | None = None
    repair_seen: bool = False
    transcript: str = ""
    first_audio_at: float | None = None
    last_audio_at: float | None = None
    spoken_seconds: float = 0.0
    audio_chunks: int = 0
    transcript_updates: list[str] = field(default_factory=list)


def coverage(preview: str, transcript: str) -> float:
    """Fraction of the published reply that the transcript actually contains.

    Measured as the longest common prefix over normalized text, which is the only comparison
    that stays honest: a word aligner may respell words and split Indic conjuncts, so an exact
    string comparison would report near-total divergence on a perfect turn.

    On the Bodhan route the two are expected to be identical, because the aligned transcript is
    the sentence text handed to synthesis. A shortfall here therefore means the transcript and
    the preview came from different text - a dropped sentence, a stale turn, or a replayed
    stream - and not a spelling difference worth ignoring.
    """
    expected = re.sub(r"\s+", "", normalize(preview))
    actual = re.sub(r"\s+", "", normalize(transcript))
    if not expected:
        return 1.0
    limit = min(len(expected), len(actual))
    matched = 0
    while matched < limit and expected[matched] == actual[matched]:
        matched += 1
    return matched / len(expected)


def main() -> int:  # noqa: C901 - a probe reads best as one linear narrative
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

    load_env()
    language = os.environ.get("PROBE_LANGUAGE", "asm")
    voice_tier = os.environ.get("PROBE_TIER", "standard")
    if language not in PROMPTS:
        raise RuntimeError(f"PROBE_LANGUAGE must be one of {sorted(PROMPTS)}, got {language!r}")

    async def mint() -> tuple[str, str]:
        body = {
            "participant_identity": "completeness-probe",
            "participant_name": "Completeness Probe",
            "participant_attributes": {
                LANGUAGE_ATTRIBUTE: language,
                REQUESTED_TIER_ATTRIBUTE: voice_tier,
            },
            "room_config": {"agents": [{"agentName": AGENT_NAME, "metadata": "{}"}]},
        }
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=120)) as session:
            async with session.post(ENDPOINT, json=body) as response:
                response.raise_for_status()
                payload = await response.json()
        return payload["server_url"], payload["participant_token"]

    async def run() -> int:
        server_url, token = await mint()
        room = rtc.Room()
        measurement = TurnMeasurement()
        loop = asyncio.get_running_loop()
        turn_finished: asyncio.Future[None] = loop.create_future()
        agent_ready: asyncio.Future[None] = loop.create_future()
        background: set[asyncio.Task[None]] = set()

        def handle_preview(chunk: str) -> None:
            try:
                message = json.loads(chunk)
            except ValueError:
                return
            kind = message.get("kind")
            if kind == "start":
                measurement.preview_text = ""
                measurement.preview_complete = False
                measurement.refusal = None
            elif kind == "delta":
                if int(message.get("revision", 0)) > 0:
                    measurement.preview_text = message.get("text", "")
                else:
                    measurement.preview_text += message.get("text", "")
            elif kind == "repair":
                measurement.repair_seen = True
            elif kind == "verdict":
                text = (message.get("text") or "").strip()
                measurement.refusal = text or None
                if measurement.refusal and not turn_finished.done():
                    turn_finished.set_result(None)
            elif kind == "end":
                measurement.preview_text = message.get("text", "") or measurement.preview_text
                measurement.preview_complete = True
                # END means generation is complete, not speech. Bodhan can still be synthesizing
                # for several seconds after this arrives, so ending the probe here disconnects
                # the room before audio can play and creates a false "no audience" result.

        def read_stream(reader: object, apply: object, *_args: object) -> None:
            """Drain a text stream in the background; a closed stream is not an error here."""

            async def read() -> None:
                try:
                    async for chunk in reader:  # type: ignore[attr-defined]
                        apply(chunk)
                except Exception:
                    pass

            task = asyncio.create_task(read())
            background.add(task)
            task.add_done_callback(background.discard)

        def read_transcription_stream(reader: object, *_args: object) -> None:
            """Collect one complete LiveKit transcript stream as one played segment."""

            async def read() -> None:
                parts: list[str] = []
                try:
                    async for chunk in reader:  # type: ignore[attr-defined]
                        text = decode_transcription(chunk)
                        if text:
                            parts.append(text)
                except Exception:
                    return
                segment = "".join(parts).strip()
                if not segment:
                    return
                measurement.transcript_updates.append(segment)
                measurement.transcript = " ".join(measurement.transcript_updates)

            task = asyncio.create_task(read())
            background.add(task)
            task.add_done_callback(background.discard)

        # The Python SDK spells these in snake_case and passes the sender's identity as a second
        # argument; the TypeScript client uses camelCase and does not.
        room.register_text_stream_handler(
            REPLY_TOPIC, lambda reader, _identity: read_stream(reader, handle_preview)
        )
        room.register_text_stream_handler("lk.transcription", read_transcription_stream)

        async def publish_silence() -> None:
            """Keep the provider's audio path open without contributing any speech."""
            source = rtc.AudioSource(SILENCE_SAMPLE_RATE, 1)
            track = rtc.LocalAudioTrack.create_audio_track("probe-silence", source)
            options = rtc.TrackPublishOptions()
            options.source = rtc.TrackSource.SOURCE_MICROPHONE
            try:
                await room.local_participant.publish_track(track, options)
                frame = rtc.AudioFrame.create(SILENCE_SAMPLE_RATE, 1, SILENCE_SAMPLE_RATE // 50)
                while True:
                    await source.capture_frame(frame)
                    await asyncio.sleep(0.02)
            finally:
                await source.aclose()

        async def watch_audio(track: rtc.RemoteAudioTrack) -> None:
            stream = rtc.AudioStream(track)
            try:
                async for event in stream:
                    now = time.perf_counter()
                    if measurement.first_audio_at is not None and (
                        now - measurement.last_audio_at  # type: ignore[operator]
                        > TURN_END_SILENCE
                    ):
                        if not turn_finished.done():
                            turn_finished.set_result(None)
                        return
                    if not has_non_silent_pcm(event.frame):
                        continue
                    if measurement.first_audio_at is None:
                        measurement.first_audio_at = now
                    else:
                        measurement.spoken_seconds += max(now - measurement.last_audio_at, 0)  # type: ignore[operator]
                    measurement.last_audio_at = now
                    measurement.audio_chunks += 1
            finally:
                await stream.aclose()

        @room.on("participant_connected")
        def on_participant_connected(_participant: rtc.RemoteParticipant) -> None:
            if not agent_ready.done():
                agent_ready.set_result(None)

        @room.on("track_subscribed")
        def on_track_subscribed(
            track: rtc.Track,
            _publication: rtc.RemoteTrackPublication,
            _participant: rtc.RemoteParticipant,
        ) -> None:
            if isinstance(track, rtc.RemoteAudioTrack):
                task = asyncio.create_task(watch_audio(track))
                background.add(task)
                task.add_done_callback(background.discard)

        try:
            await room.connect(server_url, token)
            task = asyncio.create_task(publish_silence())
            background.add(task)
            task.add_done_callback(background.discard)
            if room.remote_participants and not agent_ready.done():
                agent_ready.set_result(None)
            await asyncio.wait_for(agent_ready, timeout=30)
            print(f"language={language} tier={voice_tier} room={room.name}")
            print(f"remote participants: {[p.identity for p in room.remote_participants.values()]}")

            prompt = PROMPTS[language]
            sent_at = time.perf_counter()
            await room.local_participant.send_text(
                prompt, topic="lk.chat", attributes={LANGUAGE_ATTRIBUTE: language}
            )
            print(f"sent: {prompt!r}")

            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(turn_finished, timeout=TURN_TIMEOUT)
            elapsed = (time.perf_counter() - sent_at) * 1000

            if measurement.refusal:
                print(f"GATE REFUSED this answer: {measurement.refusal}")
                print("That is a fail-closed refusal, not a truncation. Re-ask to exercise audio.")
                return 2

            if measurement.audio_chunks == 0:
                print("NO AUDIENCE. Nothing was played before the turn ended or timed out.")
                print(f"turn wall clock:            {elapsed:.0f}ms")
                print(f"preview complete:           {measurement.preview_complete}")
                print(f"repair attempted:           {measurement.repair_seen}")
                print(f"published reply:            {normalize(measurement.preview_text)!r}")
                print(f"spoken transcript:          {normalize(measurement.transcript)!r}")
                return 1

            covered = coverage(measurement.preview_text, measurement.transcript)
            print()
            print("--- turn measurement ---")
            print(f"turn wall clock:            {elapsed:.0f}ms")
            print(f"first non-silent audio:     "
                  f"{(measurement.first_audio_at - sent_at) * 1000:.0f}ms"  # type: ignore[operator]
                  if measurement.first_audio_at
                  else "first non-silent audio:     never")
            print(f"audible time:               {measurement.spoken_seconds:.2f}s")
            print(f"non-silent chunks:          {measurement.audio_chunks}")
            print(f"preview complete:           {measurement.preview_complete}")
            print(f"repair attempted:           {measurement.repair_seen}")
            print(f"transcript updates:         {len(measurement.transcript_updates)}")
            print()
            print(f"published reply:  {normalize(measurement.preview_text)!r}")
            print(f"spoken transcript: {normalize(measurement.transcript)!r}")
            print()
            print(f"transcript coverage: {covered * 100:.1f}%")

            if covered >= 0.98:
                print("PASS: the transcript contains the whole published reply.")
                return 0
            if covered >= 0.5:
                print("PARTIAL: the reply was cut off partway through.")
                return 3
            print("FAIL: the transcript does not contain the published reply.")
            return 4
        finally:
            for task in tuple(background):
                task.cancel()
            if background:
                await asyncio.gather(*background, return_exceptions=True)
            with contextlib.suppress(Exception):
                room.unregister_text_stream_handler(REPLY_TOPIC)
            with contextlib.suppress(Exception):
                room.unregister_text_stream_handler("lk.transcription")
            await room.disconnect()

    return asyncio.run(run())


def decode_transcription(chunk: str) -> str:
    """Read one `lk.transcription` chunk, which is JSON only when the server asked for it."""
    try:
        value = json.loads(chunk)
    except ValueError:
        return chunk
    if isinstance(value, dict) and isinstance(value.get("text"), str):
        return value["text"]
    return chunk


if __name__ == "__main__":
    raise SystemExit(main())
