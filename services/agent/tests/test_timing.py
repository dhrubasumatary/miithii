"""Turn timing, and specifically that every logged boundary says what it really measures.

An earlier version rebased a provider-relative timestamp onto `user_end`. Because synthesis
begins only after generation ends, that made the turn metric report Bodhan's own delay alone -
2162ms for a turn that really took 8.2s. It also called response headers "first audio". Both
names looked plausible, which is exactly why they were dangerous.

A second failure mode is guarded here too: a missing measurement must print as missing. A
zero reads as impossibly fast and hides the regression the instrument exists to catch.
"""

from __future__ import annotations

import time

from miithii_agent.timing import TurnTimings, format_turn


def build_realistic_turn() -> TurnTimings:
    """The shape of a real turn: ~6s to first token, then ~2s of synthesis."""
    turn = TurnTimings()
    turn.marks["turn_committed"] = 0.0
    turn.marks["llm_first"] = 6059.0
    turn.marks["llm_complete"] = 6400.0
    turn.marks["canonical_ready"] = 6420.0
    turn.marks["tts_request"] = 6450.0
    turn.marks["tts_headers"] = 6400.0 + 2162.0
    turn.marks["tts_body"] = 8620.0
    turn.marks["tts_ready"] = 8635.0
    turn.marks["tts_provider_emit"] = 8640.0
    turn.marks["agent_speaking"] = 8685.0
    return turn


def test_agent_to_speak_latency_crosses_all_agent_stages() -> None:
    line = format_turn(build_realistic_turn(), "as")
    assert "AGENT_TO_SPEAK=8685ms" in line


def test_agent_to_speak_latency_is_not_just_provider_headers() -> None:
    """The exact regression.

    Rebasing provider header time onto the turn boundary would report ~2.1s for this same turn.
    """
    turn = build_realistic_turn()
    provider_to_headers = turn.span("tts_request", "tts_headers")
    agent_to_speak = turn.span("turn_committed", "agent_speaking")
    assert provider_to_headers == 2112.0
    assert agent_to_speak == 8685.0
    assert agent_to_speak > provider_to_headers * 3


def test_the_dominant_stage_is_named() -> None:
    line = format_turn(build_realistic_turn(), "brx")
    assert "turn_committed->llm_first=6059ms" in line
    assert "llm_first->llm_complete=341ms" in line
    assert "tts_request->tts_headers=2112ms" in line
    assert "tts_request->tts_body=2170ms" in line
    assert "tts_provider_emit->agent_speaking=45ms" in line


def test_a_missing_measurement_prints_missing_not_zero() -> None:
    turn = TurnTimings()
    turn.marks["turn_committed"] = 0.0
    turn.marks["llm_first"] = 100.0
    line = format_turn(turn, "as")
    assert "AGENT_TO_SPEAK=missing(agent_speaking)" in line
    assert "AGENT_TO_SPEAK=0ms" not in line


def test_an_empty_turn_reports_missing_not_zero() -> None:
    assert "AGENT_TO_SPEAK=missing(agent_speaking)" in format_turn(TurnTimings(), "as")


def test_the_language_is_always_named() -> None:
    assert "language=brx" in format_turn(build_realistic_turn(), "brx")


def test_first_sentence_can_reach_synthesis_before_generation_finishes() -> None:
    turn = build_realistic_turn()
    turn.marks["canonical_ready"] = 6200.0
    turn.marks["llm_complete"] = 9000.0
    line = format_turn(turn, "asm")
    assert "llm_first->canonical_ready=141ms" in line
    assert "llm_complete->canonical_ready" not in line


def test_marks_are_recorded_once() -> None:
    turn = TurnTimings()
    turn.mark("agent_speaking")
    turn.mark("agent_speaking")
    assert len(turn.marks) == 1


def test_absolute_provider_timestamp_is_rebased_on_the_turn_clock() -> None:
    turn = TurnTimings(_start=100.0)
    turn.mark_at("tts_request", 106.25)
    assert turn.marks["tts_request"] == 6250.0


def test_marks_are_monotonic() -> None:
    turn = TurnTimings()
    time.sleep(0.01)
    turn.mark("a")
    time.sleep(0.01)
    turn.mark("b")
    assert turn.marks["b"] >= turn.marks["a"]
