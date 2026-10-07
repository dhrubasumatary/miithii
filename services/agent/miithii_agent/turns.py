"""Turn identity and the stale-work guard.

Reset, language switch, Stop/Start, reconnect and app backgrounding all retire the current
turn. Every async operation captures its identity *when it starts* and re-checks it before
it can affect playback. Binding a late result to whichever turn happens to be current on
arrival is how interrupted audio gets replayed under a new turn's label, so that is the one
thing this module exists to prevent.

The rule is monotonic: an identifier is only ever compared against a session's current
value, and cancellation is terminal.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class DeliveryState(str, Enum):
    """What the app is allowed to claim about a sentence of generated text."""

    GENERATED = "generated"
    ACCEPTED = "accepted"
    SPEAKING = "speaking"
    SPOKEN = "spoken"
    INTERRUPTED = "interrupted"
    FAILED = "failed"

    @property
    def is_terminal(self) -> bool:
        return self in (DeliveryState.SPOKEN, DeliveryState.INTERRUPTED, DeliveryState.FAILED)


# Only these transitions are legal. Anything else is a bug that would let the UI claim
# speech happened when it did not, so it is refused rather than tolerated.
_ALLOWED_TRANSITIONS: dict[DeliveryState, frozenset[DeliveryState]] = {
    DeliveryState.GENERATED: frozenset(
        {DeliveryState.ACCEPTED, DeliveryState.INTERRUPTED, DeliveryState.FAILED}
    ),
    DeliveryState.ACCEPTED: frozenset(
        {DeliveryState.SPEAKING, DeliveryState.INTERRUPTED, DeliveryState.FAILED}
    ),
    DeliveryState.SPEAKING: frozenset(
        {DeliveryState.SPOKEN, DeliveryState.INTERRUPTED, DeliveryState.FAILED}
    ),
    DeliveryState.SPOKEN: frozenset(),
    DeliveryState.INTERRUPTED: frozenset(),
    DeliveryState.FAILED: frozenset(),
}


@dataclass(frozen=True)
class TurnId:
    """Immutable identity for one generated answer.

    ``epoch`` changes whenever the session boundary changes; ``turn`` increments within an
    epoch. A value from a retired epoch can never be current again, because epochs only
    move forward.
    """

    epoch: int
    turn: int

    def __str__(self) -> str:
        return f"{self.epoch}.{self.turn}"


@dataclass
class TurnRegistry:
    """Tracks the current turn for one session and refuses retired work."""

    epoch: int = 0
    _current_turn: int = 0
    _cancelled: set[TurnId] = field(default_factory=set)
    _state: dict[TurnId, DeliveryState] = field(default_factory=dict)

    def advance_epoch(self) -> int:
        """Retire the current epoch. Used by reset, language switch, and reconnect.

        The epoch moves forward first, so anything still tagged with the epoch that just
        ended is by definition stale. Entries for the new epoch cannot exist yet, which is
        what makes dropping the old ones safe and what bounds memory: only live work is kept.
        """
        retired = self.epoch
        self.epoch = retired + 1
        self._current_turn = 0
        # Bound memory: no retired turn can ever be current again, so its record is dead.
        self._cancelled = {tid for tid in self._cancelled if tid.epoch != retired}
        self._state = {tid: value for tid, value in self._state.items() if tid.epoch != retired}
        return self.epoch

    def begin_turn(self) -> TurnId:
        self._current_turn += 1
        turn_id = TurnId(epoch=self.epoch, turn=self._current_turn)
        self._state[turn_id] = DeliveryState.GENERATED
        return turn_id

    @property
    def current(self) -> TurnId:
        return TurnId(epoch=self.epoch, turn=self._current_turn)

    def cancel(self, turn_id: TurnId) -> None:
        """Cancellation is terminal and applies to the whole turn, not one sentence."""
        self._cancelled.add(turn_id)
        self._state[turn_id] = DeliveryState.INTERRUPTED

    def is_cancelled(self, turn_id: TurnId) -> bool:
        return turn_id in self._cancelled

    def is_current(self, turn_id: TurnId) -> bool:
        """True only for work belonging to the live turn of the live epoch."""
        return turn_id == self.current and not self.is_cancelled(turn_id)

    def may_deliver(self, turn_id: TurnId) -> bool:
        """Gate for anything that would add audio or advance on-screen speech state."""
        return self.is_current(turn_id)

    def state(self, turn_id: TurnId) -> DeliveryState:
        return self._state.get(turn_id, DeliveryState.INTERRUPTED)

    def set_state(self, turn_id: TurnId, value: DeliveryState) -> bool:
        """Advance delivery state, refusing illegal or stale transitions."""
        if not self.is_current(turn_id):
            return False
        current = self._state.get(turn_id, DeliveryState.GENERATED)
        if current.is_terminal:
            # Text that was interrupted, failed, or already spoken is never relabelled.
            return False
        if value not in _ALLOWED_TRANSITIONS[current]:
            return False
        self._state[turn_id] = value
        return True


__all__ = ["DeliveryState", "TurnId", "TurnRegistry"]
