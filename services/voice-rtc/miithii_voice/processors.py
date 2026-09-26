from __future__ import annotations

from pipecat.frames.frames import (
    Frame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


class CompleteTurnSpeechGate(FrameProcessor):
    """Collapse any streamed LLM turn into one TTS input.

    Bodhan Indic-Speak is rate-limited per request. Miithii's language contract is
    deliberately a short complete spoken turn, so one assistant turn must map to one
    provider synthesis request. This gate keeps that invariant even if the brain becomes
    streaming later.
    """

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._start_frame: LLMFullResponseStartFrame | None = None
        self._parts: list[str] = []

    def _reset(self) -> None:
        self._start_frame = None
        self._parts.clear()

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if direction is FrameDirection.UPSTREAM:
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, InterruptionFrame):
            self._reset()
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, LLMFullResponseStartFrame):
            self._start_frame = frame
            self._parts.clear()
            return

        if isinstance(frame, LLMTextFrame) and self._start_frame is not None:
            self._parts.append(frame.text)
            return

        if isinstance(frame, LLMFullResponseEndFrame) and self._start_frame is not None:
            start = self._start_frame
            text = "".join(self._parts).strip()
            self._reset()
            await self.push_frame(start, direction)
            if text:
                # Do not truncate speech here. The brain owns delivery repair; exceeding
                # the signed language contract is an error the TTS service will surface.
                await self.push_frame(LLMTextFrame(text), direction)
            await self.push_frame(frame, direction)
            return

        await self.push_frame(frame, direction)
