"""Text-first preview publishing.

The preview is generated text, never speech. These tests pin that distinction, the
identifiers the app needs to reject stale work, and the refusal to publish for a retired
turn.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from miithii_agent.enforcement import CheckResult, Rejection, Verdict
from miithii_agent.preview import (
    REPLY_TOPIC,
    PreviewKind,
    PreviewMessage,
    ReplyPreviewPublisher,
    parse_preview,
)
from miithii_agent.turns import TurnRegistry


class FakeParticipant:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_text(
        self,
        text: str,
        *,
        topic: str = "",
        attributes: dict[str, str] | None = None,
        **_: Any,
    ) -> Any:
        self.sent.append({"text": text, "topic": topic, "attributes": attributes})


class FakeRoom:
    name = "miithii-asm-standard-test01"

    def __init__(self) -> None:
        self.local_participant = FakeParticipant()


def publisher(session_id: str = "s1") -> tuple[ReplyPreviewPublisher, FakeRoom, TurnRegistry]:
    room = FakeRoom()
    registry = TurnRegistry()
    return ReplyPreviewPublisher(room, session_id, registry, language="asm"), room, registry


def payloads(room: FakeRoom) -> list[PreviewMessage]:
    parsed = [parse_preview(entry["text"]) for entry in room.local_participant.sent]
    assert all(message is not None for message in parsed)
    return [message for message in parsed if message is not None]


def test_publishes_to_the_application_topic() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    assert asyncio.run(pub.publish(turn, PreviewKind.DELTA, "নমস্কাৰ।")) is True
    assert room.local_participant.sent[0]["topic"] == REPLY_TOPIC


def test_preview_topic_is_not_the_transcription_topic() -> None:
    """Generated text and spoken text must never share a topic."""
    assert REPLY_TOPIC != "lk.transcription"


def test_shortened_end_preserves_only_accepted_words_and_outcome() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    asyncio.run(pub.publish(turn, PreviewKind.END, "accepted prefix", shortened=True))
    message = payloads(room)[0]
    assert message.shortened is True
    assert message.text == "accepted prefix"
    assert message.kind == "end"


def test_message_carries_full_turn_identity() -> None:
    pub, room, registry = publisher("session-7")
    turn = registry.begin_turn()
    asyncio.run(pub.publish(turn, PreviewKind.DELTA, "আপুনি", revision=2))
    message = payloads(room)[0]
    assert message.session_id == "session-7"
    assert message.epoch == turn.epoch
    assert message.turn_id == turn.turn
    assert message.revision == 2
    assert message.kind == "delta"
    assert message.text == "আপুনি"


def test_sequence_increases_monotonically() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()

    async def go() -> None:
        for _ in range(4):
            await pub.publish(turn, PreviewKind.DELTA, "x")

    asyncio.run(go())
    sequences = [message.sequence for message in payloads(room)]
    assert sequences == sorted(sequences)
    assert len(set(sequences)) == len(sequences)


def test_a_speakable_verdict_carries_no_text() -> None:
    """The canonical words were already published. A second copy is one more thing to reconcile.

    The app replaces rather than appends, so repeating them here would either duplicate the
    reply or silently do nothing - depending on which side of a protocol change you were on.
    """
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    asyncio.run(
        pub.publish_verdict(turn, CheckResult(Verdict.ACCEPTED, "নমস্কাৰ। আপুনি কেমন আছে?"))
    )

    message = payloads(room)[0]
    assert message.kind == "verdict"
    assert message.text == ""
    # Never a revision: a revision tells the app to replace its text, which is not what this
    # message means.
    assert message.revision == 0


def test_a_refused_verdict_carries_the_reason_not_the_words() -> None:
    """The screen has to be able to say why nothing was spoken.

    The refused words are never spoken, so they must not be presented as though they were. The
    reason is what the app renders in place of a reply.
    """
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    result = CheckResult(
        Verdict.REJECTED,
        "wrong script",
        rejections=(Rejection.WRONG_SCRIPT, Rejection.TRUNCATED),
    )
    asyncio.run(pub.publish_verdict(turn, result))

    message = payloads(room)[0]
    assert message.kind == "verdict"
    assert message.text == "wrong_script,truncated"
    assert "wrong script" not in message.text


def test_indic_text_is_not_escaped() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    asyncio.run(pub.publish(turn, PreviewKind.DELTA, "বরʼ সুস্বাগতম"))
    raw = room.local_participant.sent[0]["text"]
    # Assamese/Bodo script must survive as real characters, not \\u escapes.
    assert "বরʼ" in raw
    assert "\\u" not in raw


def test_retired_turn_is_not_published() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    registry.advance_epoch()
    assert asyncio.run(pub.publish(turn, PreviewKind.DELTA, "stale")) is False
    assert room.local_participant.sent == []


def test_cancelled_turn_is_not_published() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    registry.cancel(turn)
    assert asyncio.run(pub.publish(turn, PreviewKind.DELTA, "cancelled")) is False
    assert room.local_participant.sent == []


def test_new_turn_after_reset_is_published() -> None:
    pub, room, registry = publisher()
    stale = registry.begin_turn()
    registry.advance_epoch()
    fresh = registry.begin_turn()
    asyncio.run(pub.publish(stale, PreviewKind.DELTA, "old"))
    asyncio.run(pub.publish(fresh, PreviewKind.DELTA, "new"))
    messages = payloads(room)
    assert [message.text for message in messages] == ["new"]
    assert messages[0].epoch == fresh.epoch


def test_kind_is_carried_in_attributes_for_fast_filtering() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    asyncio.run(pub.publish(turn, PreviewKind.END, "done"))
    attributes = room.local_participant.sent[0]["attributes"]
    assert attributes is not None
    assert attributes["kind"] == "end"
    assert attributes["turn"] == str(turn.turn)


def test_missing_participant_is_handled() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    room.local_participant = None  # type: ignore[assignment]
    assert asyncio.run(pub.publish(turn, PreviewKind.DELTA, "x")) is False


@pytest.mark.parametrize(
    "payload",
    [
        "",
        "not json",
        "[]",
        "{}",
        '{"session_id": "s"}',
        '{"session_id": "s", "epoch": "x", "turn_id": 1, "revision": 0,'
        ' "sequence": 0, "kind": "delta", "text": "t"}',
    ],
)
def test_malformed_payloads_parse_to_none(payload: str) -> None:
    assert parse_preview(payload) is None


def test_round_trip_preserves_indic_text() -> None:
    message = PreviewMessage(
        session_id="s",
        language="asm",
        room_name="miithii-asm-standard-test01",
        epoch=1,
        turn_id=2,
        revision=0,
        sequence=3,
        kind="delta",
        text="অসমীয়া আৰু বৰ্গমাই",
    )
    parsed = parse_preview(message.to_json())
    assert parsed == message


def test_assamese_preview_is_refused_by_bodo_session() -> None:
    pub, room, registry = publisher()
    turn = registry.begin_turn()
    asyncio.run(pub.publish(turn, PreviewKind.DELTA, "fixture"))
    raw = room.local_participant.sent[0]["text"]
    assert parse_preview(raw, expected_language="brx") is None
    accepted = parse_preview(raw, expected_language="asm")
    assert accepted is not None
    assert accepted.language == "asm"
    assert accepted.room_name == room.name
