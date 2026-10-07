"""Per-stage turn timing.

The product is judged on how a turn *feels*, and that is a latency number nobody has measured
end to end yet. Every provider has been timed in isolation - Bodhan alone is 1.4-2.4s to first
byte - but the number a user experiences is the sum, plus the parts nobody profiled: token
fetch, connect, STT endpoint detection, and first audio.

These timings are component-local and monotonic. No clock is compared across devices, because
device clocks drift and a subtraction between two of them would manufacture a number that
looks real and is not.

The stage boundaries mirror where the framework already hands control back:

    token          request -> response headers
    connect        room connect requested -> connected
    turn_committed LiveKit has committed the user's turn and is about to run the LLM
    llm_first      first generated token observed by the Miithii gate
    llm_complete   final generated token observed by the Miithii gate
    canonical_ready validated canonical text is ready for synthesis
    tts_request    Bodhan HTTP request starts
    tts_headers    Bodhan response headers arrive
    tts_body       the complete WAV response body has arrived
    tts_ready      the complete WAV has passed Miithii validation
    tts_provider_emit validated audio has left the Bodhan provider adapter
    agent_speaking LiveKit reports playout has started for the agent

``turn_committed`` is intentionally *not* named ``user_end``. LiveKit documents the hook used
for it as the point where the user's turn is complete and the LLM is about to respond. That is
a useful agent-side anchor, but it is not proof of the physical microphone speech-end. Likewise,
``tts_provider_emit`` is deliberately provider-local. The Bodhan provider sits inside LiveKit's
``StreamAdapter``, so its inner emitter is still upstream of the session audio output. The
``agent_speaking`` mark comes from LiveKit's agent-state transition, which is driven by the first
playback-start event for captured output audio. It is the strongest server-side first-audio boundary
available without pretending to know when the Android speaker physically became audible.
"""

from __future__ import annotations

import time
from collections import OrderedDict
from dataclasses import dataclass, field


@dataclass
class TurnTimings:
    """Component-local durations for one turn, in milliseconds."""

    marks: OrderedDict[str, float] = field(default_factory=OrderedDict)
    _start: float = field(default_factory=time.perf_counter)

    @property
    def started_at(self) -> float:
        """Absolute monotonic start time for rejecting stale provider callbacks."""
        return self._start

    def mark(self, stage: str) -> None:
        """Record the elapsed time from the turn's start to `stage`."""
        if stage not in self.marks:
            self.marks[stage] = round((time.perf_counter() - self._start) * 1000, 1)

    def mark_at(self, stage: str, when: float) -> None:
        """Record an absolute ``perf_counter`` timestamp on this turn's clock."""
        if stage not in self.marks:
            self.marks[stage] = round((when - self._start) * 1000, 1)

    def span(self, earlier: str, later: str) -> float | None:
        """Duration between two recorded stages, if both are present."""
        if earlier in self.marks and later in self.marks:
            return round(self.marks[later] - self.marks[earlier], 1)
        return None

    def summary(self) -> str:
        return " ".join(f"{stage}={value:.0f}" for stage, value in self.marks.items())

    def as_dict(self) -> dict[str, float]:
        return dict(self.marks)


def describe(turn: TurnTimings) -> str:
    """A single line suitable for a log, with the spans a human actually feels."""
    parts = [f"{stage}={value:.0f}ms" for stage, value in turn.marks.items()]
    for earlier, later in (("turn_committed", "agent_speaking"),):
        span = turn.span(earlier, later)
        if span is not None:
            parts.append(f"{earlier}->{later}={span:.0f}ms")
    return " ".join(parts)


__all__ = ["TurnTimings", "describe"]


def format_turn(timings: TurnTimings, language: str) -> str:
    """One truthful agent-side latency line per turn.

    ``AGENT_TO_SPEAK`` starts when LiveKit commits the user turn and ends when LiveKit reports
    agent playout has started. It deliberately does not claim physical microphone speech-end or
    Android speaker audibility; those boundaries need client-side evidence.

    Anything still missing is printed as `missing` rather than as zero. A zero reads as
    impossibly fast and would hide the very regression this exists to catch.
    """
    parts = [f"{stage}={value:.0f}ms" for stage, value in timings.marks.items()]

    agent_to_speak = timings.span("turn_committed", "agent_speaking")
    parts.append(
        f"AGENT_TO_SPEAK={agent_to_speak:.0f}ms"
        if agent_to_speak is not None
        else "AGENT_TO_SPEAK=missing(agent_speaking)"
    )

    # Generation and synthesis overlap after the first accepted sentence. Measure the time
    # until that sentence is ready from the first token, rather than pretending canonical
    # text waits for the entire response: that serial assumption produced negative spans.
    for earlier, later in (
        ("turn_committed", "llm_first"),
        ("llm_first", "llm_complete"),
        ("llm_first", "canonical_ready"),
        ("canonical_ready", "tts_request"),
        ("tts_request", "tts_headers"),
        ("tts_request", "tts_body"),
        ("tts_body", "tts_ready"),
        ("tts_ready", "tts_provider_emit"),
        ("tts_provider_emit", "agent_speaking"),
    ):
        span = timings.span(earlier, later)
        label = f"{earlier}->{later}"
        parts.append(f"{label}={span:.0f}ms" if span is not None else f"{label}=missing")

    return f"turn language={language} " + " ".join(parts)
