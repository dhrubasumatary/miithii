"""What the TTS-aligned transcript actually is on the Bodhan route.

The app marks a sentence *spoken* only when LiveKit's TTS-aligned transcript says so, which
makes the transcript's construction a product contract rather than a provider detail. Nothing
in the suite pinned where those words come from, and the deployed logs carried a warning that
made it look like the answer might be "nowhere".

The warning is misleading, and the reason matters. `StreamAdapter` publishes a `TimedString`
carrying a sentence's own text immediately before that sentence's audio, and the timed
transcripts ride the audio frames downstream. So when a turn produces *no audio at all* - which
is what a provider refusal looks like - no frame carries a transcript, the aligned stream comes
back empty, and the framework falls back to the generated text. That fallback describes a
provider outage, not the shape of a successful turn.

These tests drive the real `StreamAdapter` over the real `BodhanTTS`, with the network stubbed
at the aiohttp session boundary, and read the timed transcripts off the emitted frames the same
way `voice.generation` does. They assert the contract the app depends on. They say nothing
about Bodhan's audio, its voices, or its latency.
"""

from __future__ import annotations

import asyncio
import json
import struct
from typing import Any

import pytest
from livekit.agents.tts import StreamAdapter
from livekit.agents.tts import tts as tts_module
from livekit.agents.types import APIConnectOptions

from miithii_agent.config import BodhanSettings, load_settings
from miithii_agent.policy import get_policy
from miithii_agent.sentences import MiithiiSentenceTokenizer, split_sentences
from miithii_agent.tts_bodhan import BodhanTTS
from miithii_agent.voice_tts import build_voice_tts

TIMED_TRANSCRIPT = tts_module.USERDATA_TIMED_TRANSCRIPT

# One second of 24 kHz mono PCM16 per sentence, so sentence start times are distinct and
# measurable rather than all zero.
PCM = b"\x00\x00" * 24_000

# Three sentences, because alignment that only ever has one step cannot be shown to advance.
REPLY = "প্ৰথম বাক্য। দ্বিতীয় বাক্য। তৃতীয় বাক্য।"
SENTENCES = split_sentences(REPLY)


def gate_pieces() -> list[str]:
    """What the gate actually hands to TTS, one accepted sentence per chunk.

    The first chunk is bare and every later chunk carries a leading space, because
    `miithii_agent.main` builds the chunks that way. The space is load-bearing: the tokenizer
    only accepts a boundary after a terminator when the next character is whitespace, so
    pushing stripped sentences instead would silently glue the whole reply into one request and
    make this file test a shape the agent never produces.
    """
    return [sentence if index == 0 else f" {sentence}" for index, sentence in enumerate(SENTENCES)]


def build_wav(pcm: bytes = PCM) -> bytes:
    fmt = struct.pack("<HHIIHH", 1, 1, 24_000, 48_000, 2, 16)
    body = b"WAVE" + b"fmt " + struct.pack("<I", len(fmt)) + fmt
    body += b"data" + struct.pack("<I", len(pcm)) + pcm
    return b"RIFF" + struct.pack("<I", len(body)) + body


def bodhan_settings() -> BodhanSettings:
    return BodhanSettings(
        api_key="test-key",
        base_url="https://api.bodhan.ai/v1",
        model="indic-speak",
        connect_timeout=5.0,
        read_timeout=5.0,
        total_timeout=10.0,
        max_response_bytes=8 * 1024 * 1024,
    )


class FakeResponse:
    def __init__(self, status: int, body: bytes) -> None:
        self.status = status
        self._body = body

    class _Content:
        def __init__(self, body: bytes) -> None:
            self._body = body

        async def iter_chunked(self, size: int):
            for index in range(0, len(self._body), size):
                yield self._body[index : index + size]

    @property
    def content(self) -> FakeResponse._Content:
        return self._Content(self._body)

    async def text(self) -> str:
        return self._body.decode("utf-8", errors="replace")

    async def __aenter__(self) -> FakeResponse:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None


class FakeSession:
    """Replays one queued response per sentence and records what was asked for."""

    def __init__(self, *responses: FakeResponse) -> None:
        self.responses = list(responses)
        self.inputs: list[str] = []
        self.closed = False

    def post(self, url: str, **kwargs: Any) -> FakeResponse:
        del url
        payload = json.loads(kwargs["data"].decode("utf-8"))
        self.inputs.append(payload["input"])
        if not self.responses:
            raise AssertionError(
                f"Bodhan was asked for more sentences than the reply has: {payload['input']!r}"
            )
        return self.responses.pop(0)

    async def close(self) -> None:
        self.closed = True


def session_for(*, sentences: int = len(SENTENCES), fail_at: int | None = None) -> FakeSession:
    responses = [FakeResponse(200, build_wav()) for _ in range(sentences)]
    if fail_at is not None:
        responses[fail_at] = FakeResponse(500, b"upstream exploded")
    return FakeSession(*responses)


def make_adapter(session: FakeSession) -> StreamAdapter:
    """The same wrapper :mod:`miithii_agent.voice_tts` builds, built the same way."""
    return StreamAdapter(
        tts=BodhanTTS(  # type: ignore[arg-type]
            settings=bodhan_settings(),
            voice="Prastuti",
            lang="as",
            http_session=session,
        ),
        sentence_tokenizer=MiithiiSentenceTokenizer(),
    )


class Alignment:
    """What the framework reads off one synthesis, in the order it reads it."""

    def __init__(self) -> None:
        self.texts: list[str] = []
        self.start_times: list[float] = []
        # Frame each transcript was carried by, so ordering against audio is measured.
        self.frame_of: list[int] = []
        self.audio_seconds = 0.0

    @property
    def transcript(self) -> str:
        return "".join(self.texts)


async def _run(provider: StreamAdapter, pieces: list[str]) -> Alignment:
    alignment = Alignment()
    stream = provider.stream(
        conn_options=APIConnectOptions(max_retry=0, retry_interval=0.0, timeout=10.0)
    )
    async with stream:
        for piece in pieces:
            stream.push_text(piece)
        stream.end_input()

        frame_count = 0
        async for event in stream:
            frame_count += 1
            alignment.audio_seconds += event.frame.duration
            for timed in event.frame.userdata.get(TIMED_TRANSCRIPT, []):
                alignment.texts.append(str(timed))
                alignment.start_times.append(float(timed.start_time))
                alignment.frame_of.append(frame_count)
    return alignment


def drive(provider: StreamAdapter, session: FakeSession) -> Alignment:
    del session
    return asyncio.run(_run(provider, gate_pieces()))


def test_alignment_arrives_one_sentence_at_a_time() -> None:
    session = session_for()
    alignment = drive(make_adapter(session), session)

    assert alignment.texts == SENTENCES


def test_the_aligned_text_is_exactly_what_was_handed_to_synthesis() -> None:
    """The property the app's alignment rule was built to tolerate, and does not need to.

    `spokenPrefixLength` measures how far the two streams *agree*, because a provider word
    aligner respells and splits Indic conjuncts and the streams then diverge. On this route
    nothing respells anything: the timed transcript is the sentence the tokenizer produced, so
    the two streams are byte-identical and the measurement is an identity rather than a
    tolerance. It stays a measurement, because that is what keeps it honest if the route ever
    changes - but the reason it exists is not this provider.
    """
    session = session_for()
    alignment = drive(make_adapter(session), session)

    assert session.inputs == SENTENCES
    assert alignment.texts == session.inputs


def test_each_sentence_is_published_on_a_distinct_frame_before_the_next() -> None:
    """A sentence must not become claimable before audio exists to back it.

    The transcripts ride the frames the framework emits, so a strictly increasing frame index
    is the observable form of "each sentence arrives with its own audio, in order". A flat or
    repeated index would mean several sentences were announced by one frame of audio, and a
    sentence could be marked spoken on the strength of audio that never played.
    """
    session = session_for()
    alignment = drive(make_adapter(session), session)

    assert len(alignment.frame_of) == len(SENTENCES)
    assert alignment.frame_of == sorted(alignment.frame_of)
    assert len(set(alignment.frame_of)) == len(alignment.frame_of)


def test_sentence_start_times_are_the_running_audio_offset() -> None:
    """Each sentence is timed from the audio already emitted ahead of it.

    One second of audio per sentence makes the expected starts 0.0, 1.0, 2.0. A flat sequence
    would mean the alignment carries no timing, and the app would be relying on arrival order
    while believing it was relying on playback position.
    """
    session = session_for()
    alignment = drive(make_adapter(session), session)

    assert alignment.start_times == [0.0, 1.0, 2.0]


def test_a_sentence_the_provider_never_produced_reaches_no_frame() -> None:
    """The gap between transcript and audio is real, and is the case that must not be claimed.

    The adapter publishes a sentence's text before requesting its audio, so a later failure can
    leave the transcript ahead of the audio. The first sentence still played, so it is still
    reported; the failed one contributes nothing, because no frame carried it.
    """
    session = session_for(fail_at=1)
    adapter = make_adapter(session)

    async def go() -> Alignment:
        alignment = Alignment()
        stream = adapter.stream(
            conn_options=APIConnectOptions(max_retry=0, retry_interval=0.0, timeout=10.0)
        )
        async with stream:
            for piece in gate_pieces():
                stream.push_text(piece)
            stream.end_input()
            try:
                async for event in stream:
                    alignment.audio_seconds += event.frame.duration
                    for timed in event.frame.userdata.get(TIMED_TRANSCRIPT, []):
                        alignment.texts.append(str(timed))
                        alignment.start_times.append(float(timed.start_time))
            except Exception:  # noqa: BLE001 - the provider failure is the subject
                pass
        return alignment

    alignment = asyncio.run(go())

    assert alignment.texts == SENTENCES[:1]
    assert alignment.audio_seconds == pytest.approx(1.0)


def test_a_turn_that_produces_no_audio_also_produces_no_alignment() -> None:
    """Why the deployed logs show a warning that looks like a missing feature.

    With no audio there is no frame to carry a timed transcript, so the aligned stream is empty
    and the framework falls back to the generated text. This is the shape of a provider
    outage, and it is worth pinning because it is the one case where the app cannot tell
    generated text from spoken text.
    """
    session = session_for(sentences=0)
    adapter = make_adapter(session)

    async def go() -> Alignment:
        alignment = Alignment()
        stream = adapter.stream(
            conn_options=APIConnectOptions(max_retry=0, retry_interval=0.0, timeout=10.0)
        )
        async with stream:
            for piece in gate_pieces():
                stream.push_text(piece)
            stream.end_input()
            try:
                async for event in stream:
                    alignment.audio_seconds += event.frame.duration
                    for timed in event.frame.userdata.get(TIMED_TRANSCRIPT, []):
                        alignment.texts.append(str(timed))
            except Exception:  # noqa: BLE001 - the refusal is the subject
                pass
        return alignment

    alignment = asyncio.run(go())

    assert alignment.texts == []
    assert alignment.audio_seconds == 0.0


def test_the_voice_route_advertises_alignment_to_the_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`use_tts_aligned_transcript` only takes effect if the provider claims alignment.

    Bodhan itself is a non-streaming provider and claims nothing. The claim belongs to the
    StreamAdapter the voice router wraps it in, so this goes through the real router: a router
    that stopped wrapping would silently downgrade every reply to generation-only text, and
    nothing in the app would report it.
    """
    monkeypatch.setenv("BODHAN_API_KEY", "test-key")
    provider, route = build_voice_tts(
        load_settings(),
        get_policy("asm"),
        "standard",
        http_session=FakeSession(),  # type: ignore[arg-type]
    )

    assert route.provider == "bodhan"
    assert provider.capabilities.aligned_transcript is True
    assert provider.capabilities.streaming is True
