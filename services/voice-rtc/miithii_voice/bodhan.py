from __future__ import annotations

import json
import time
from collections.abc import AsyncGenerator

import aiohttp
from loguru import logger
from pipecat.frames.frames import ErrorFrame, Frame, TranscriptionFrame
from pipecat.services.settings import STTSettings, TTSSettings
from pipecat.services.stt_service import SegmentedSTTService
from pipecat.services.tts_service import TTSService
from pipecat.utils.time import time_now_iso8601

from .contracts import VoiceContract

BODHAN_BASE_URL = "https://api.bodhan.ai/v1"


class BodhanSTTService(SegmentedSTTService):
    """File-style Bodhan STT fed by Pipecat's VAD-segmented WAV utterances."""

    def __init__(
        self,
        *,
        api_key: str,
        session: aiohttp.ClientSession,
        base_url: str = BODHAN_BASE_URL,
        **kwargs,
    ) -> None:
        # User speech can be any language. Do not bind STT to the selected reply language.
        super().__init__(
            settings=STTSettings(
                model="indic-transcribe",
                # Bodhan detects the speaker's language. Reply-language selection
                # must never constrain speech recognition.
                language=None,
            ),
            **kwargs,
        )
        self._api_key = api_key
        self._session = session
        self._base_url = base_url.rstrip("/")

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame | None]:
        started = time.perf_counter()
        try:
            await self.start_processing_metrics()
            form = aiohttp.FormData()
            form.add_field("model", "indic-transcribe")
            form.add_field("file", audio, filename="utterance.wav", content_type="audio/wav")
            headers = {"Authorization": f"Bearer {self._api_key}"}
            timeout = aiohttp.ClientTimeout(total=35)

            async with self._session.post(
                f"{self._base_url}/audio/transcriptions",
                data=form,
                headers=headers,
                timeout=timeout,
            ) as response:
                if response.status != 200:
                    detail = (await response.text())[:500]
                    yield ErrorFrame(error=f"Bodhan STT failed ({response.status}): {detail}")
                    return
                result = await response.json()

            text = str(result.get("text") or "").strip()
            if not text:
                return

            logger.info(
                "voice_stage stage=stt ms={} chars={}",
                round((time.perf_counter() - started) * 1000),
                len(text),
            )
            yield TranscriptionFrame(
                text=text,
                user_id="",
                timestamp=time_now_iso8601(),
                result=result,
                finalized=True,
            )
        except TimeoutError as error:
            yield ErrorFrame(error="Bodhan STT timed out", exception=error)
        except aiohttp.ClientError as error:
            yield ErrorFrame(error=f"Bodhan STT unavailable: {error}", exception=error)


class BodhanTTSService(TTSService):
    """Bodhan TTS that streams WAV response bytes into Pipecat audio frames."""

    def __init__(
        self,
        *,
        api_key: str,
        contract: VoiceContract,
        session: aiohttp.ClientSession,
        base_url: str = BODHAN_BASE_URL,
        **kwargs,
    ) -> None:
        super().__init__(
            sample_rate=24_000,
            settings=TTSSettings(
                model="indic-speak",
                voice=contract.voice,
                language=contract.language,
            ),
            **kwargs,
        )
        self._api_key = api_key
        self._contract = contract
        self._session = session
        self._base_url = base_url.rstrip("/")

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None]:
        started = time.perf_counter()
        text = text.strip()
        if not text:
            return
        if len(text) > self._contract.max_input_chars:
            yield ErrorFrame(
                error=(
                    f"Miithii brain returned {len(text)} characters for "
                    f"{self._contract.language}; voice contract allows "
                    f"{self._contract.max_input_chars}"
                )
            )
            return

        payload = {
            "model": "indic-speak",
            "input": text,
            "voice": self._contract.voice,
            "instructions": json.dumps({"lang": self._contract.language}),
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        timeout = aiohttp.ClientTimeout(total=40)

        try:
            async with self._session.post(
                f"{self._base_url}/audio/speech",
                json=payload,
                headers=headers,
                timeout=timeout,
            ) as response:
                if response.status != 200:
                    detail = (await response.text())[:500]
                    yield ErrorFrame(error=f"Bodhan TTS failed ({response.status}): {detail}")
                    return

                await self.start_tts_usage_metrics(text)
                first_audio = True
                async for frame in self._stream_audio_frames_from_iterator(
                    response.content.iter_chunked(self.chunk_size),
                    strip_wav_header=True,
                    context_id=context_id,
                ):
                    if first_audio:
                        first_audio = False
                        logger.info(
                            "voice_stage stage=tts_first_audio ms={} chars={} language={}",
                            round((time.perf_counter() - started) * 1000),
                            len(text),
                            self._contract.language,
                        )
                        await self.stop_ttfb_metrics()
                    yield frame
        except TimeoutError as error:
            yield ErrorFrame(error="Bodhan TTS timed out", exception=error)
        except aiohttp.ClientError as error:
            yield ErrorFrame(error=f"Bodhan TTS unavailable: {error}", exception=error)
