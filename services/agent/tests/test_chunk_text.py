"""Reading the ``llm_node`` stream.

The framework's stream carries three different things and a gate has to tell them apart: a
bare string, a ``ChatChunk`` whose text lives at ``.delta.content``, and a ``FlushSentinel``
marking the end of generation.

A gate that only understands strings sees an empty answer on every turn and fails closed every
time. That is indistinguishable, from the outside, from a model that never replies - which is
exactly how it presented in the first live run.
"""

from __future__ import annotations

from dataclasses import dataclass

from livekit.agents import FlushSentinel

from miithii_agent.enforcement import chunk_text, is_flush


@dataclass
class FakeDelta:
    content: str | None = None


@dataclass
class FakeChunk:
    """Stands in for the framework's ChatChunk, which carries text at ``delta.content``."""

    delta: FakeDelta | None = None


def test_a_bare_string_is_content() -> None:
    assert chunk_text("নমস্কাৰ") == "নমস্কাৰ"
    assert chunk_text("") == ""


def test_a_chat_chunk_carries_its_text_at_delta_content() -> None:
    chunk = FakeChunk(delta=FakeDelta(content="আপুনি কেমন আছে?"))
    assert chunk_text(chunk) == "আপুনি কেমন আছে?"


def test_the_flush_sentinel_carries_no_text() -> None:
    # Reading the sentinel as content would corrupt the answer it terminates.
    assert chunk_text(FlushSentinel()) is None
    assert is_flush(FlushSentinel()) is True


def test_control_values_carry_no_text() -> None:
    assert chunk_text(FakeChunk(delta=None)) is None
    assert chunk_text(FakeChunk(delta=FakeDelta(content=None))) is None
    assert chunk_text(object()) is None
    assert chunk_text(None) is None


def test_content_is_not_mistaken_for_the_sentinel() -> None:
    assert is_flush("text") is False
    assert is_flush(FakeChunk(delta=FakeDelta(content="x"))) is False


def test_a_realistic_stream_reassembles_into_one_answer() -> None:
    """Exactly the shape the live agent produced."""
    stream: list[object] = [
        FakeChunk(delta=FakeDelta(content="আপুনি ")),
        FakeChunk(delta=FakeDelta(content="কেমন আছে?")),
        FakeChunk(delta=None),
        FlushSentinel(),
    ]
    text = "".join(part for chunk in stream if (part := chunk_text(chunk)) is not None)
    assert text == "আপুনি কেমন আছে?"
    assert sum(1 for chunk in stream if is_flush(chunk)) == 1
