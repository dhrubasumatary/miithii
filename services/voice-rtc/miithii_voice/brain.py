from __future__ import annotations

import time
import uuid
from collections.abc import Mapping
from typing import Any

import aiohttp
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
)
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import LLMService
from pipecat.services.settings import LLMSettings

from .contracts import VoiceContract


def _plain_messages(context: LLMContext) -> list[dict[str, str]]:
    """Keep only text user/assistant history accepted by Miithii's API contract."""
    messages: list[dict[str, str]] = []
    for raw in context.get_messages():
        if not isinstance(raw, Mapping):
            continue
        role = raw.get("role")
        content = raw.get("content")
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue
        content = content.strip()
        if content:
            messages.append({"role": role, "content": content[:4000]})
    return messages[-40:]


class MiithiiBrainService(LLMService):
    """Pipecat LLM stage backed by Miithii's existing policy-enforcing API."""

    def __init__(
        self,
        *,
        session: aiohttp.ClientSession,
        api_url: str,
        authorization: str = "",
        contract: VoiceContract | None = None,
        thread_id: str | None = None,
        scoped_session: bool = False,
        **kwargs,
    ) -> None:
        # Miithii's Cloudflare brain owns generation policy. These settings
        # describe this custom service to Pipecat and deliberately mark fields
        # that are not runtime-updatable here as unsupported rather than leaving
        # them as NOT_GIVEN (which Pipecat 1.10 treats as a service bug).
        super().__init__(
            settings=LLMSettings(
                model="miithii",
                system_instruction=None,
                temperature=None,
                max_tokens=None,
                top_p=None,
                top_k=None,
                frequency_penalty=None,
                presence_penalty=None,
                seed=None,
                filter_incomplete_user_turns=None,
                user_turn_completion_config=None,
            ),
            **kwargs,
        )
        self._session = session
        self._api_url = api_url.rstrip("/")
        self._authorization = authorization
        self._contract = contract
        self._thread_id = thread_id
        self._scoped_session = scoped_session

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, LLMContextFrame):
            await self._process_context(frame.context)
        else:
            await self.push_frame(frame, direction)

    async def _process_context(self, context: LLMContext) -> None:
        started = time.perf_counter()
        turn_id = str(uuid.uuid4())
        body: dict[str, Any] = {"turnId": turn_id, "messages": _plain_messages(context)}
        if not self._scoped_session:
            if self._contract is None or self._thread_id is None:
                raise RuntimeError("Legacy Clerk bridge requires a voice contract and thread id")
            body.update(
                {
                    "model": "miithii",
                    "stream": False,
                    "responseMode": "voice",
                    "language": self._contract.language,
                    "threadId": self._thread_id,
                    "max_tokens": self._contract.generation_max_tokens,
                    "temperature": 0.62,
                }
            )

        await self.push_frame(LLMFullResponseStartFrame())
        await self.start_processing_metrics()
        await self.start_ttfb_metrics()
        try:
            timeout = aiohttp.ClientTimeout(total=50)
            headers = {"Content-Type": "application/json"}
            if self._authorization:
                headers["Authorization"] = self._authorization
            async with self._session.post(
                f"{self._api_url}/v1/chat/completions",
                json=body,
                headers=headers,
                timeout=timeout,
            ) as response:
                payload = await response.json(content_type=None)
                if response.status != 200:
                    error = payload.get("error") if isinstance(payload, dict) else None
                    if isinstance(error, dict):
                        message = str(
                            error.get("message") or error.get("code") or "Miithii brain failed"
                        )
                    else:
                        message = str(error or "Miithii brain failed")
                    await self.push_error(f"Miithii brain failed ({response.status}): {message}")
                    return

            await self.stop_ttfb_metrics()
            choices = payload.get("choices") if isinstance(payload, dict) else None
            content = ""
            if isinstance(choices, list) and choices:
                message = choices[0].get("message") if isinstance(choices[0], dict) else None
                if isinstance(message, dict):
                    content = str(message.get("content") or "").strip()

            if not content:
                await self.push_error("Miithii brain returned an empty voice reply")
                return

            # The Cloudflare brain has already applied voice length repair and script
            # validation. Keeping this as one frame lets the downstream speech gate make
            # exactly one Bodhan TTS request for the complete spoken turn.
            logger.info(
                "voice_stage stage=brain ms={} chars={}",
                round((time.perf_counter() - started) * 1000),
                len(content),
            )
            await self.push_frame(LLMTextFrame(content))
        except TimeoutError as error:
            await self.push_error("Miithii brain timed out", exception=error)
        except aiohttp.ClientError as error:
            await self.push_error(f"Miithii brain unavailable: {error}", exception=error)
        finally:
            await self.stop_processing_metrics()
            await self.push_frame(LLMFullResponseEndFrame())
