"""Text-first reply preview.

Bodhan is non-streaming and slow, so the audio for a sentence arrives well after the words
exist. Waiting for audio before showing text would make every reply feel broken. This
module publishes the generated text to the app as it is produced, on an application-owned
topic, so the screen can show a reply immediately while the audio catches up.

What the app still learns about speech comes from LiveKit's synchronized TTS transcript.
This topic deliberately carries generated text only, so a sentence can never be highlighted
as spoken because it merely finished generating.

Every message carries the identity of the turn that produced it. A client that receives a
late chunk after a reset, a language switch, or a reconnect can therefore drop it instead
of rendering it under whichever turn happens to be current on arrival.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any

from livekit import rtc

from .policy import normalize_language_id
from .turns import TurnId, TurnRegistry

if TYPE_CHECKING:  # pragma: no cover - import cycle avoidance
    from .enforcement import CheckResult

# Application-owned topic, deliberately separate from LiveKit's `lk.transcription` so the two
# never get confused: this one means "generated", that one means "being spoken".
REPLY_TOPIC = "miithii.reply"


class PreviewKind(str, Enum):
    START = "start"
    DELTA = "delta"
    END = "end"
    VERDICT = "verdict"
    REPAIR = "repair"


@dataclass(frozen=True)
class PreviewMessage:
    """One preview event, self-describing enough to be applied out of order safely."""

    session_id: str
    epoch: int
    turn_id: int
    revision: int
    sequence: int
    kind: str
    text: str
    language: str
    room_name: str
    shortened: bool = False

    def to_json(self) -> str:
        # Assamese and Bodo replies are not ASCII. Escaping them would make the payload
        # unreadable in logs and would inflate it several times over.
        return json.dumps(asdict(self), ensure_ascii=False)


class ReplyPreviewPublisher:
    """Publishes one turn's generated text, refusing to publish for a retired turn."""

    def __init__(
        self, room: rtc.Room, session_id: str, registry: TurnRegistry, *, language: str
    ) -> None:
        self._room = room
        self._session_id = session_id
        self._registry = registry
        self._sequence = 0
        self._language = normalize_language_id(language)

    @property
    def registry(self) -> TurnRegistry:
        return self._registry

    async def publish(
        self,
        turn_id: TurnId,
        kind: PreviewKind,
        text: str,
        revision: int = 0,
        *,
        shortened: bool = False,
    ) -> bool:
        """Send one preview event. Returns False when the turn can no longer be delivered."""
        if not self._registry.may_deliver(turn_id):
            return False
        message = PreviewMessage(
            session_id=self._session_id,
            epoch=turn_id.epoch,
            turn_id=turn_id.turn,
            revision=revision,
            sequence=self._next_sequence(),
            kind=kind.value,
            text=text,
            language=self._language,
            room_name=self._room.name,
            shortened=shortened,
        )
        participant = self._room.local_participant
        if participant is None:
            return False
        await participant.send_text(
            message.to_json(),
            topic=REPLY_TOPIC,
            attributes={
                "kind": kind.value,
                "epoch": str(turn_id.epoch),
                "turn": str(turn_id.turn),
            },
        )
        return True

    def _next_sequence(self) -> int:
        self._sequence += 1
        return self._sequence

    async def publish_verdict(self, turn_id: TurnId, result: CheckResult) -> bool:
        """Tell the app whether the answer is going to be spoken.

        The screen needs this to avoid showing a reply as delivered when the language gate
        refused it. Without it, a rejected answer is indistinguishable from a slow one, and a
        refused turn looks exactly like a hung app.

        A speakable verdict carries no text: the canonical words are already published, and
        repeating them here would be a second copy the app has to reconcile. A refused verdict
        carries the machine-readable reason instead, because the words themselves are never
        spoken and must not be presented as though they were.
        """
        return await self.publish(
            turn_id,
            PreviewKind.VERDICT,
            "" if result.speakable else ",".join(item.value for item in result.rejections),
            revision=0,
        )


def parse_preview(payload: str, *, expected_language: str | None = None) -> PreviewMessage | None:
    """Parse a preview event, returning None for anything malformed or foreign."""
    try:
        value: Any = json.loads(payload)
    except (TypeError, ValueError):
        return None
    if not isinstance(value, dict):
        return None

    required = {
        "session_id", "epoch", "turn_id", "revision", "sequence", "kind", "text",
        "language", "room_name",
    }
    if not required.issubset(value.keys()):
        return None

    if expected_language is not None and value["language"] != expected_language:
        return None

    try:
        return PreviewMessage(
            session_id=str(value["session_id"]),
            epoch=int(value["epoch"]),
            turn_id=int(value["turn_id"]),
            revision=int(value["revision"]),
            sequence=int(value["sequence"]),
            kind=str(value["kind"]),
            text=str(value["text"]),
            language=normalize_language_id(str(value["language"])),
            room_name=str(value["room_name"]),
            shortened=value.get("shortened") is True,
        )
    except (TypeError, ValueError, RuntimeError):
        return None


__all__ = [
    "REPLY_TOPIC",
    "PreviewKind",
    "PreviewMessage",
    "ReplyPreviewPublisher",
    "parse_preview",
]
