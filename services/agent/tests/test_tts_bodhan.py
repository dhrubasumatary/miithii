"""Bodhan TTS adapter behaviour.

The network is stubbed at the aiohttp session boundary so these tests assert the adapter's
contract: what it sends, what it refuses to play, and that a cancelled request emits nothing.
"""

from __future__ import annotations

import asyncio
import json
import struct
from typing import Any

import pytest
from livekit.agents import APIConnectionError, APIError, APIStatusError, APITimeoutError
from livekit.agents.types import APIConnectOptions

from miithii_agent.config import BodhanSettings
from miithii_agent.tts_bodhan import BodhanTiming, BodhanTTS

PCM = b"\x00\x00" * 24_000


def build_wav(pcm: bytes = PCM) -> bytes:
    fmt = struct.pack("<HHIIHH", 1, 1, 24_000, 48_000, 2, 16)
    body = b"WAVE" + b"fmt " + struct.pack("<I", len(fmt)) + fmt
    body += b"data" + struct.pack("<I", len(pcm)) + pcm
    return b"RIFF" + struct.pack("<I", len(body)) + body


def settings(**overrides: Any) -> BodhanSettings:
    base: dict[str, Any] = {
        "api_key": "test-key",
        "base_url": "https://api.bodhan.ai/v1",
        "model": "indic-speak",
        "connect_timeout": 5.0,
        "read_timeout": 5.0,
        "total_timeout": 10.0,
        "max_response_bytes": 8 * 1024 * 1024,
    }
    base.update(overrides)
    return BodhanSettings(**base)


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
        return FakeResponse._Content(self._body)

    async def text(self) -> str:
        return self._body.decode("utf-8", errors="replace")

    async def __aenter__(self) -> FakeResponse:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None


class FakeSession:
    """Records requests and replays queued responses."""

    def __init__(self, *responses: FakeResponse) -> None:
        self.responses = list(responses)
        self.calls: list[dict[str, Any]] = []
        self.closed = False

    def post(self, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append({"url": url, **kwargs})
        if not self.responses:
            raise AssertionError("FakeSession received an unexpected request")
        return self.responses.pop(0)

    async def close(self) -> None:
        self.closed = True


class Result:
    """What one synthesis attempt produced."""

    def __init__(self, pcm: bytes, error: BaseException | None) -> None:
        self.pcm = pcm
        self.error = error

    @property
    def emitted_audio(self) -> bool:
        return bool(self.pcm)


def make_tts(session: FakeSession, **overrides: Any) -> BodhanTTS:
    async def go() -> BodhanTTS:
        return BodhanTTS(
            settings=settings(**overrides),
            voice="Prastuti",
            lang="as",
            http_session=session,  # type: ignore[arg-type]
        )

    return asyncio.run(go())


def synthesize(tts: BodhanTTS, text: str) -> Result:
    """Run one non-streaming synthesis the way the LiveKit framework does.

    ``ChunkedStream`` starts its own task on construction, so the adapter must be driven
    through the stream's event channel rather than by calling ``_run`` directly.
    """

    async def go() -> Result:
        stream = tts.synthesize(
            text,
            # No retries: the fake session holds exactly one queued response, and a retry
            # would mask the behaviour under test.
            conn_options=APIConnectOptions(max_retry=0, retry_interval=0.0, timeout=10.0),
        )
        pcm = b""
        try:
            async for event in stream:
                pcm += bytes(event.frame.data)
        except BaseException as exc:  # noqa: BLE001 - the error is the assertion subject
            return Result(pcm, exc)
        return Result(pcm, stream.exception)

    return asyncio.run(go())


def test_request_targets_the_speech_endpoint() -> None:
    session = FakeSession(FakeResponse(200, build_wav()))
    result = synthesize(make_tts(session), "নমস্কাৰ।")
    assert result.error is None
    assert session.calls[0]["url"] == "https://api.bodhan.ai/v1/audio/speech"


def test_request_body_carries_model_input_voice_and_lang() -> None:
    session = FakeSession(FakeResponse(200, build_wav()))
    result = synthesize(make_tts(session), "নমস্কাৰ।")
    assert result.error is None

    payload = json.loads(session.calls[0]["data"].decode("utf-8"))
    assert payload["model"] == "indic-speak"
    assert payload["input"] == "নমস্কাৰ।"
    assert payload["voice"] == "Prastuti"


def test_language_travels_in_instructions_as_a_json_string() -> None:
    """Bodhan requires `instructions` to be a JSON string carrying `lang`.

    A top-level `lang` field is not part of the contract and is ignored by the gateway, so
    its absence here would be a 422 on every single request.
    """
    session = FakeSession(FakeResponse(200, build_wav()))
    result = synthesize(make_tts(session), "নমস্কাৰ।")
    assert result.error is None

    payload = json.loads(session.calls[0]["data"].decode("utf-8"))
    assert "lang" not in payload
    assert isinstance(payload["instructions"], str)
    # Nested: the field itself is a JSON document, not an object.
    assert json.loads(payload["instructions"]) == {"lang": "as"}


def test_optional_style_is_included_only_when_set() -> None:
    session = FakeSession(FakeResponse(200, build_wav()))
    result = synthesize(make_tts(session), "নমস্কাৰ।")
    assert result.error is None
    payload = json.loads(session.calls[0]["data"].decode("utf-8"))
    assert "style" not in json.loads(payload["instructions"])


def test_style_is_forwarded_when_configured() -> None:
    session = FakeSession(FakeResponse(200, build_wav()))
    tts = make_tts(session)
    tts.update_options(style="news")
    result = synthesize(tts, "খবৰ।")
    assert result.error is None
    payload = json.loads(session.calls[0]["data"].decode("utf-8"))
    assert json.loads(payload["instructions"]) == {"lang": "as", "style": "news"}


def test_bodo_voice_and_lang_code_are_independent() -> None:
    session = FakeSession(FakeResponse(200, build_wav()))
    tts = make_tts(session)
    tts.update_options(voice="Gwrbw", lang="brx")
    result = synthesize(tts, "নমস্কাৰ।")
    assert result.error is None

    payload = json.loads(session.calls[0]["data"].decode("utf-8"))
    assert payload["voice"] == "Gwrbw"
    assert json.loads(payload["instructions"]) == {"lang": "brx"}


def test_authorization_header_is_sent() -> None:
    session = FakeSession(FakeResponse(200, build_wav()))
    result = synthesize(make_tts(session), "প্ৰশ্ন।")
    assert result.error is None
    assert session.calls[0]["headers"]["Authorization"] == "Bearer test-key"


def test_valid_audio_is_emitted() -> None:
    session = FakeSession(FakeResponse(200, build_wav()))
    result = synthesize(make_tts(session), "এটা বাক্য।")
    assert result.error is None
    # The emitter consumes the RIFF container, so only the PCM payload reaches the track.
    assert result.pcm == PCM


def test_timing_reports_observable_provider_and_emission_boundaries() -> None:
    session = FakeSession(FakeResponse(200, build_wav()))
    tts = make_tts(session)
    samples: list[BodhanTiming] = []
    tts.on_timing = samples.append

    result = synthesize(tts, "এটা বাক্য।")

    assert result.error is None
    assert len(samples) == 1
    sample = samples[0]
    assert sample.request_started_at <= sample.response_headers_at
    assert sample.response_headers_at <= sample.body_complete_at
    assert sample.body_complete_at <= sample.audio_ready_at
    assert sample.audio_ready_at <= sample.provider_emitted_at
    assert sample.audio_seconds == 1.0


def test_truncated_body_emits_nothing() -> None:
    session = FakeSession(FakeResponse(200, build_wav()[:-100]))
    result = synthesize(make_tts(session), "এটা বাক্য।")
    assert isinstance(result.error, APIError)
    assert not result.error.retryable
    assert not result.emitted_audio


def test_non_wav_body_emits_nothing() -> None:
    session = FakeSession(FakeResponse(200, b'{"error":"nope"}'))
    result = synthesize(make_tts(session), "এটা বাক্য।")
    assert isinstance(result.error, APIError)
    assert not result.emitted_audio


def test_empty_body_emits_nothing() -> None:
    session = FakeSession(FakeResponse(200, b""))
    result = synthesize(make_tts(session), "এটা বাক্য।")
    assert isinstance(result.error, APIError)
    assert not result.emitted_audio


def test_oversize_body_is_refused_before_buffering() -> None:
    session = FakeSession(FakeResponse(200, build_wav(b"\x00\x00" * 40_000)))
    result = synthesize(make_tts(session, max_response_bytes=1024), "এটা বাক্য।")
    assert isinstance(result.error, APIError)
    assert "ceiling" in str(result.error)
    assert not result.emitted_audio


@pytest.mark.parametrize(
    ("status", "fragment", "retryable"),
    [
        (401, "rejected the API key", False),
        (403, "rejected the API key", False),
        (400, "request failed", False),
        (429, "rate limit", True),
        (500, "unavailable", True),
        (503, "unavailable", True),
    ],
)
def test_status_codes_map_to_typed_errors(status: int, fragment: str, retryable: bool) -> None:
    session = FakeSession(FakeResponse(status, b"provider detail"))
    result = synthesize(make_tts(session), "এটা বাক্য।")
    assert isinstance(result.error, APIStatusError)
    assert result.error.status_code == status
    assert fragment in str(result.error)
    assert result.error.retryable is retryable
    assert not result.emitted_audio


@pytest.mark.parametrize(
    "detail",
    [
        '{"error":{"message":"ExceededBudget: User=abc over budget. '
        'Spend=\u20b910.0008, Budget=\u20b910.0","type":"budget_exceeded","code":"429"}}',
        "insufficient_quota",
        "Quota exceeded for this project",
    ],
)
def test_exhausted_budget_429_is_not_retried(detail: str) -> None:
    """An exhausted account budget must fail the turn immediately.

    Bodhan reports this with the same 429 as a real throttle, so the status code alone sends
    the agent into three futile attempts and roughly four seconds of silence per sentence. The
    refusal cannot be retried away, so it must not be marked retryable.
    """
    session = FakeSession(FakeResponse(429, detail.encode("utf-8")))
    result = synthesize(make_tts(session), "এটা বাক্য।")
    assert isinstance(result.error, APIStatusError)
    assert result.error.status_code == 429
    assert result.error.retryable is False
    assert "budget is exhausted" in str(result.error)
    assert not result.emitted_audio


def test_plain_429_is_still_retried() -> None:
    """A throttle with no budget marker keeps the derived retryable default.

    This is the case retrying actually helps, so the budget fix must not swallow it.
    """
    session = FakeSession(FakeResponse(429, b"slow down"))
    result = synthesize(make_tts(session), "এটা বাক্য।")
    assert isinstance(result.error, APIStatusError)
    assert result.error.retryable is True
    assert "rate limit" in str(result.error)


def test_network_failure_is_retryable() -> None:
    import aiohttp

    class Boom(FakeSession):
        def post(self, url: str, **kwargs: Any) -> FakeResponse:
            raise aiohttp.ClientConnectionError("connection reset")

    result = synthesize(make_tts(Boom()), "এটা বাক্য।")
    assert isinstance(result.error, APIConnectionError)
    assert not result.emitted_audio


def test_timeout_is_reported_as_a_timeout() -> None:

    class Slow(FakeSession):
        def post(self, url: str, **kwargs: Any) -> FakeResponse:
            raise TimeoutError

    result = synthesize(make_tts(Slow()), "এটা বাক্য।")
    assert isinstance(result.error, APITimeoutError)
    assert not result.emitted_audio


def test_missing_key_is_rejected_at_construction() -> None:
    async def go() -> None:
        BodhanTTS(settings=settings(api_key=""), voice="Prastuti", lang="as")

    with pytest.raises(ValueError, match="BODHAN_API_KEY"):
        asyncio.run(go())


def test_cancellation_emits_nothing_afterwards() -> None:
    """A cancelled turn must not produce audio, even once the body has arrived."""

    async def scenario() -> list[bytes]:
        session = FakeSession(FakeResponse(200, build_wav()))
        tts = BodhanTTS(
            settings=settings(),
            voice="Prastuti",
            lang="as",
            http_session=session,  # type: ignore[arg-type]
        )
        stream = tts.synthesize(
            "এটা বাক্য।",
            conn_options=APIConnectOptions(max_retry=0, retry_interval=0.0, timeout=10.0),
        )
        pcm = bytearray()
        consumer = asyncio.create_task(_drain(stream, pcm))
        await asyncio.sleep(0)
        stream._synthesize_task.cancel()
        consumer.cancel()
        try:
            await consumer
        except asyncio.CancelledError:
            pass
        await asyncio.sleep(0.01)
        return bytes(pcm)

    assert asyncio.run(scenario()) == b""


async def _drain(stream: Any, sink: bytearray) -> None:
    async for event in stream:
        sink += bytes(event.frame.data)


def test_shared_session_is_reused_across_sentences() -> None:
    session = FakeSession(FakeResponse(200, build_wav()), FakeResponse(200, build_wav()))
    tts = make_tts(session)
    first = synthesize(tts, "প্ৰথম বাক্য।")
    second = synthesize(tts, "দ্বিতীয় বাক্য।")
    assert first.error is None
    assert second.error is None
    assert len(session.calls) == 2
    # The adapter must not open a second connection for the second sentence.
    assert tts._session is session
