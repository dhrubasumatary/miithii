"""Bodhan AI TTS as a LiveKit non-streaming TTS provider.

Bodhan is the only provider found with real Assamese and Bodo voices, and it answers a
synthesis request with one complete ``audio/wav`` body rather than a stream. The LiveKit
voice pipeline wraps a non-streaming provider in ``StreamAdapter`` exactly once, so this
module deliberately exposes only ``synthesize()`` and never wraps itself.

The response is validated by :mod:`miithii_agent.wav` before any audio is emitted, so a
truncated or malformed body produces silence rather than a clipped reply.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import time
from collections.abc import Callable
from dataclasses import dataclass, replace

import aiohttp
from livekit.agents import (
    APIConnectionError,
    APIConnectOptions,
    APIError,
    APIStatusError,
    APITimeoutError,
    tts,
)
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS

from .config import BodhanSettings
from .wav import DEFAULT_MAX_PCM_BYTES, WavError, parse_wav

SAMPLE_RATE = 24_000
NUM_CHANNELS = 1
REQUEST_ID = "bodhan_speech"

@dataclass(frozen=True)
class BodhanTiming:
    """Monotonic timing points for one Bodhan synthesis request.

    Absolute ``perf_counter`` values are passed to the owning agent so every point can be
    placed on the same turn clock without guessing when the provider request started.
    """

    request_started_at: float
    response_headers_at: float
    body_complete_at: float
    audio_ready_at: float
    provider_emitted_at: float
    audio_seconds: float


TimingCallback = Callable[[BodhanTiming], None]


@dataclass(frozen=True)
class _TTSOptions:
    voice: str
    lang: str
    style: str | None = None


class BodhanTTS(tts.TTS):
    """Non-streaming Bodhan speech synthesis."""

    def __init__(
        self,
        *,
        settings: BodhanSettings,
        voice: str,
        lang: str,
        style: str | None = None,
        http_session: aiohttp.ClientSession | None = None,
    ) -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=SAMPLE_RATE,
            num_channels=NUM_CHANNELS,
        )
        if not settings.enabled:
            raise ValueError("BodhanTTS requires BODHAN_API_KEY")

        self._settings = settings
        self._opts = _TTSOptions(voice=voice, lang=lang, style=style)
        # One session per agent process keeps connections warm across sentences. A provider
        # that opens a socket per sentence would pay the handshake on every request.
        self._session = http_session
        self._owns_session = http_session is None
        self._lock = asyncio.Lock()
        # Optional per-turn timing sink, supplied by the agent that owns this session.
        self.on_timing: TimingCallback | None = None

    @property
    def voice(self) -> str:
        return self._opts.voice

    @property
    def lang(self) -> str:
        return self._opts.lang

    def update_options(
        self,
        *,
        voice: str | None = None,
        lang: str | None = None,
        style: str | None = None,
    ) -> None:
        if voice is not None:
            self._opts = replace(self._opts, voice=voice)
        if lang is not None:
            self._opts = replace(self._opts, lang=lang)
        if style is not None:
            self._opts = replace(self._opts, style=style)

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(
                connect=self._settings.connect_timeout,
                sock_read=self._settings.read_timeout,
                total=self._settings.total_timeout,
            )
            connector = aiohttp.TCPConnector(limit=16, limit_per_host=8)
            self._session = aiohttp.ClientSession(timeout=timeout, connector=connector)
            self._owns_session = True
        return self._session

    def synthesize(
        self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> tts.ChunkedStream:
        return ChunkedStream(
            tts=self,
            input_text=text,
            conn_options=conn_options,
            session=self._session,
        )

    async def aclose(self) -> None:
        if self._owns_session and self._session is not None and not self._session.closed:
            with contextlib.suppress(Exception):
                await self._session.close()
        self._session = None


class ChunkedStream(tts.ChunkedStream):
    """Collects one complete Bodhan response, then emits validated PCM."""

    def __init__(
        self,
        *,
        tts: BodhanTTS,
        input_text: str,
        conn_options: APIConnectOptions,
        session: aiohttp.ClientSession | None,
    ) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._bodhan: BodhanTTS = tts
        self._opts = replace(tts._opts)
        self._session = session

    def _payload(self) -> dict[str, object]:
        # Verified against Bodhan's API reference: `instructions` is required and carries the
        # language as a JSON *string*, e.g. '{"lang": "as"}'. A top-level `lang` field is not
        # part of the contract and is ignored by the gateway.
        instructions: dict[str, object] = {"lang": self._opts.lang}
        if self._opts.style:
            instructions["style"] = self._opts.style
        return {
            "model": self._bodhan._settings.model,
            "input": self.input_text,
            "voice": self._opts.voice,
            "instructions": json.dumps(instructions, ensure_ascii=False),
        }

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        settings = self._bodhan._settings
        payload = json.dumps(self._payload(), ensure_ascii=False).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {settings.api_key}",
            "Content-Type": "application/json",
            "Accept": "audio/wav",
        }
        started = time.perf_counter()
        response_headers_at: float | None = None
        body_complete_at: float | None = None

        # A hard deadline independent of the client's retry budget: Bodhan is documented to
        # be slow, and an unbounded wait holds the whole turn open.
        deadline = self._conn_options.timeout
        timeout = aiohttp.ClientTimeout(
            connect=settings.connect_timeout,
            sock_read=settings.read_timeout,
            total=min(settings.total_timeout, deadline) if deadline else settings.total_timeout,
        )

        try:
            async with self._bodhan._lock:
                session = await self._bodhan._ensure_session()
                self._session = session
                async with session.post(
                    settings.speech_url,
                    data=payload,
                    headers=headers,
                    timeout=timeout,
                ) as response:
                    if response_headers_at is None:
                        response_headers_at = time.perf_counter()
                    if response.status != 200:
                        detail = await self._bounded_error_text(response)
                        raise _status_error(response.status, detail)

                    body = await self._bounded_body(response)
                    body_complete_at = time.perf_counter()

            parsed = parse_wav(
                body,
                expect_sample_rate=SAMPLE_RATE,
                expect_channels=NUM_CHANNELS,
                max_pcm_bytes=min(settings.max_response_bytes, DEFAULT_MAX_PCM_BYTES),
            )
            audio_ready_at = time.perf_counter()
        except WavError as exc:
            # A malformed or truncated body is a deterministic failure, so it must never be
            # retried: a retry would burn a turn's latency to produce the same broken audio.
            raise APIError(
                f"Bodhan returned unusable audio: {exc}",
                retryable=False,
            ) from None
        except TimeoutError:
            raise APITimeoutError() from None
        except aiohttp.ClientError as exc:
            raise APIConnectionError(f"Bodhan request failed: {exc}") from None

        # Nothing is emitted before the body above is fully validated, so a cancellation or a
        # malformed response leaves the emitter untouched rather than half-played.
        #
        # The original container is pushed, not the header-stripped PCM: the emitter decodes
        # `audio/wav` as a RIFF container, so handing it bare PCM would fail to decode. The
        # parser's job here is to prove the body is complete and correctly formatted before
        # a single frame is committed.
        output_emitter.initialize(
            request_id=REQUEST_ID,
            sample_rate=parsed.sample_rate,
            num_channels=parsed.num_channels,
            mime_type="audio/wav",
            stream=False,
        )
        output_emitter.push(body)
        output_emitter.flush()
        provider_emitted_at = time.perf_counter()

        # Reported so a turn can be measured end to end. Bodhan is the longest single stage in
        # the pipeline, so a regression here is the one a user feels first.
        if self._bodhan.on_timing is not None:
            # Successful synthesis necessarily set both values above. Keeping the fallback to
            # the nearest later timestamp makes this callback robust to a future aiohttp shape
            # change without manufacturing a provider duration from another turn anchor.
            self._bodhan.on_timing(
                BodhanTiming(
                    request_started_at=started,
                    response_headers_at=response_headers_at or body_complete_at or audio_ready_at,
                    body_complete_at=body_complete_at or audio_ready_at,
                    audio_ready_at=audio_ready_at,
                    provider_emitted_at=provider_emitted_at,
                    audio_seconds=parsed.duration_seconds,
                )
            )


    async def _bounded_body(self, response: aiohttp.ClientResponse) -> bytes:
        """Read the body, refusing to buffer more than the configured ceiling."""
        limit = min(self._bodhan._settings.max_response_bytes, DEFAULT_MAX_PCM_BYTES)
        chunks: list[bytes] = []
        total = 0
        async for chunk in response.content.iter_chunked(64 * 1024):
            total += len(chunk)
            if total > limit:
                raise APIError(
                    f"Bodhan response exceeded the {limit} byte ceiling",
                    retryable=False,
                )
            chunks.append(chunk)
        return b"".join(chunks)

    async def _bounded_error_text(self, response: aiohttp.ClientResponse) -> str:
        try:
            text = await response.text()
        except Exception:  # noqa: BLE001 - the body is best effort diagnostics only
            return ""
        return text[:500]


#: Substrings that mark a refusal no retry inside the current turn can clear. Matched
#: case-insensitively against the provider body, which is the only place the distinction
#: exists: both kinds come back as the same HTTP status.
_BUDGET_EXHAUSTED_MARKERS = (
    "budget_exceeded",
    "exceededbudget",
    "over budget",
    "quota_exceeded",
    "quota exceeded",
    "insufficient_quota",
)


def _budget_exhausted(detail: str) -> bool:
    lowered = detail.lower()
    return any(marker in lowered for marker in _BUDGET_EXHAUSTED_MARKERS)


def _status_error(status: int, detail: str) -> APIStatusError:
    """Map a provider HTTP status onto LiveKit's typed error.

    ``APIStatusError`` derives retryability from the status code, so a 5xx or 429 is retried
    while a 401 or 400 is not.

    A 429 is the one status where the code alone cannot decide. Bodhan answers 429 both for a
    genuine throttle, which a retry clears, and for an exhausted account budget, which no
    retry in this turn can clear. Retrying the second kind spends the user's silence to
    reproduce the same refusal: it burned three attempts and about four seconds per sentence
    before failing the turn anyway, and because the turn then ends with no audio the phone has
    nothing to report but a wait, so the failure presents as the app hanging on "ANSWERING"
    rather than as a voice that is out of credit. The body decides when it says so, and a
    plain 429 keeps the derived default.
    """
    if status in (401, 403):
        message = "Bodhan rejected the API key"
    elif status == 429:
        if _budget_exhausted(detail):
            return APIStatusError(
                "Bodhan speech budget is exhausted, so this turn has no voice: "
                "top up the Bodhan account to speak again"
                + (f": {detail}" if detail else ""),
                status_code=status,
                body=detail or None,
                retryable=False,
            )
        message = "Bodhan rate limit reached"
    elif status >= 500:
        message = f"Bodhan is unavailable ({status})"
    else:
        message = f"Bodhan request failed ({status})"
    if detail:
        message = f"{message}: {detail}"
    return APIStatusError(message, status_code=status, body=detail or None)


__all__ = [
    "BodhanTiming",
    "BodhanTTS",
    "ChunkedStream",
    "NUM_CHANNELS",
    "SAMPLE_RATE",
]
