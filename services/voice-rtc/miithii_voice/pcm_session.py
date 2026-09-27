from __future__ import annotations

import asyncio
import hmac
import secrets
import time
import uuid
from dataclasses import dataclass, field

from .cloudflare_pcm import CloudflarePCMTransport


@dataclass(slots=True)
class PCMSession:
    session_id: str
    owner_id: str
    language: str
    expires_at: int
    transport: CloudflarePCMTransport
    mic_token: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    bot_token: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    created_at: float = field(default_factory=time.time)
    state: str = "starting"
    close_reason: str | None = None
    closed_at: float | None = None
    bot_task: asyncio.Task[None] | None = None
    expiry_task: asyncio.Task[None] | None = None
    mutation_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    mic_endpoint: str | None = None
    bot_endpoint: str | None = None
    publisher_session_id: str | None = None
    publisher_mid: str | None = None
    publisher_answer: dict | None = None
    microphone_track_name: str = "microphone"
    mic_adapter_id: str | None = None
    bot_adapter_id: str | None = None
    bot_publisher_session_id: str | None = None
    bot_track_name: str = "miithii-bot"
    subscriber_session_id: str | None = None
    subscriber_mid: str | None = None
    subscriber_offer: dict | None = None
    subscriber_answered: bool = False

    def endpoint_token_matches(self, kind: str, token: str) -> bool:
        expected = self.mic_token if kind == "mic" else self.bot_token
        return hmac.compare_digest(expected, token)

    def status(self) -> dict[str, object]:
        return {
            "sessionId": self.session_id,
            "state": self.state,
            "language": self.language,
            "expiresAt": self.expires_at,
            "pipelineReady": self.transport.pipeline_ready,
            "micConnected": self.transport.mic_connected,
            "botConnected": self.transport.bot_connected,
            "publisherReady": self.publisher_answer is not None,
            "subscriberReady": self.subscriber_answered,
            "closeReason": self.close_reason,
        }


class PCMSessionRegistry:
    """Own one active PCM runtime session per signed Voice capability."""

    def __init__(self):
        self._sessions: dict[str, PCMSession] = {}
        self._active_by_owner: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def create(
        self,
        *,
        owner_id: str,
        language: str,
        expires_at: int,
        transport: CloudflarePCMTransport,
    ) -> tuple[PCMSession, bool]:
        async with self._lock:
            active_id = self._active_by_owner.get(owner_id)
            if active_id:
                active = self._sessions.get(active_id)
                if active and active.state not in {"closing", "closed"}:
                    return active, False
                self._active_by_owner.pop(owner_id, None)

            session = PCMSession(
                session_id=str(uuid.uuid4()),
                owner_id=owner_id,
                language=language,
                expires_at=expires_at,
                transport=transport,
            )
            self._sessions[session.session_id] = session
            self._active_by_owner[owner_id] = session.session_id
            return session, True

    async def get(self, session_id: str) -> PCMSession | None:
        async with self._lock:
            return self._sessions.get(session_id)

    async def get_owned(self, session_id: str, owner_id: str) -> PCMSession | None:
        session = await self.get(session_id)
        if session is None or not hmac.compare_digest(session.owner_id, owner_id):
            return None
        return session

    async def active_sessions(self) -> list[PCMSession]:
        async with self._lock:
            return [
                session
                for session in self._sessions.values()
                if session.state not in {"closing", "closed"}
            ]

    async def close(self, session: PCMSession, *, reason: str) -> bool:
        async with self._lock:
            if session.state in {"closing", "closed"}:
                return False
            session.state = "closing"
            if self._active_by_owner.get(session.owner_id) == session.session_id:
                self._active_by_owner.pop(session.owner_id, None)

        await session.transport.disconnect()

        current = asyncio.current_task()
        bot_task = session.bot_task
        if bot_task and bot_task is not current and not bot_task.done():
            try:
                await asyncio.wait_for(asyncio.shield(bot_task), timeout=2.0)
            except TimeoutError:
                bot_task.cancel()
                await asyncio.gather(bot_task, return_exceptions=True)

        expiry_task = session.expiry_task
        if expiry_task and expiry_task is not current and not expiry_task.done():
            expiry_task.cancel()
            await asyncio.gather(expiry_task, return_exceptions=True)

        async with self._lock:
            session.state = "closed"
            session.close_reason = reason
            session.closed_at = time.time()
        return True

    async def close_all(self, *, reason: str) -> None:
        async with self._lock:
            active = [s for s in self._sessions.values() if s.state not in {"closing", "closed"}]
        await asyncio.gather(*(self.close(session, reason=reason) for session in active))
