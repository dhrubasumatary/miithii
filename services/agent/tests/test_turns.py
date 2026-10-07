"""Turn identity and the stale-work guard.

These tests encode the rule that interrupted or retired work can never re-enter playback or
advance on-screen speech state.
"""

from __future__ import annotations

from miithii_agent.turns import DeliveryState, TurnRegistry


def test_first_turn_is_current() -> None:
    registry = TurnRegistry()
    turn = registry.begin_turn()
    assert registry.is_current(turn)
    assert registry.may_deliver(turn)
    assert registry.state(turn) is DeliveryState.GENERATED


def test_turn_counter_advances() -> None:
    registry = TurnRegistry()
    first = registry.begin_turn()
    second = registry.begin_turn()
    assert first != second
    assert registry.is_current(second)
    assert not registry.is_current(first)


def test_cancellation_is_terminal() -> None:
    registry = TurnRegistry()
    turn = registry.begin_turn()
    registry.cancel(turn)
    assert registry.is_cancelled(turn)
    assert not registry.may_deliver(turn)
    assert registry.state(turn) is DeliveryState.INTERRUPTED


def test_cancelled_turn_cannot_be_relabelled_as_spoken() -> None:
    registry = TurnRegistry()
    turn = registry.begin_turn()
    registry.cancel(turn)
    assert not registry.set_state(turn, DeliveryState.SPOKEN)
    assert registry.state(turn) is DeliveryState.INTERRUPTED


def test_advanced_epoch_retires_previous_turn() -> None:
    registry = TurnRegistry()
    turn = registry.begin_turn()
    registry.advance_epoch()
    assert not registry.is_current(turn)
    assert not registry.may_deliver(turn)


def test_stale_epoch_work_is_refused_after_reset() -> None:
    registry = TurnRegistry()
    old = registry.begin_turn()
    registry.advance_epoch()
    new = registry.begin_turn()
    # A late event captured against the old turn must not be attributed to the new one.
    assert not registry.may_deliver(old)
    assert registry.may_deliver(new)
    assert not registry.set_state(old, DeliveryState.SPEAKING)


def test_epochs_only_move_forward() -> None:
    registry = TurnRegistry()
    seen = []
    for _ in range(5):
        seen.append(registry.begin_turn())
        registry.advance_epoch()
    epochs = [turn.epoch for turn in seen]
    assert epochs == sorted(epochs)
    assert len(set(epochs)) == len(epochs)


def test_advancing_an_epoch_does_not_forget_a_retired_cancellation() -> None:
    """Dropping a cancellation must never make retired work deliverable again."""
    registry = TurnRegistry()
    turn = registry.begin_turn()
    registry.cancel(turn)
    assert not registry.may_deliver(turn)

    # The record is memory-bounded away, but the turn is still refused, because the epoch it
    # belonged to can never be current again. Cancellation is terminal.
    registry.advance_epoch()
    registry.advance_epoch()
    assert not registry.may_deliver(turn)
    assert not registry.is_current(turn)
    assert not registry.set_state(turn, DeliveryState.ACCEPTED)


def test_advancing_an_epoch_prunes_that_epoch_and_keeps_the_new_one() -> None:
    """Pruning compares against the epoch that just retired, not the one replacing it."""
    registry = TurnRegistry()
    retired = registry.begin_turn()
    registry.set_state(retired, DeliveryState.ACCEPTED)

    registry.advance_epoch()
    fresh = registry.begin_turn()
    registry.set_state(fresh, DeliveryState.ACCEPTED)

    # The new epoch's own entry is intact and still current.
    assert registry.state(fresh) is DeliveryState.ACCEPTED
    assert registry.may_deliver(fresh)

    # The previous epoch's entry is gone from the bounded map. `state()` falls back to
    # INTERRUPTED for anything it no longer knows, which is the same answer an unknown turn
    # has always got, and is the safe one: an entry that cannot be resolved is never reported
    # as speech that happened.
    registry.advance_epoch()
    assert registry.state(retired) is DeliveryState.INTERRUPTED
    assert registry.state(fresh) is DeliveryState.INTERRUPTED
    assert not registry.may_deliver(retired)
    assert not registry.may_deliver(fresh)


def test_cancelling_the_live_turn_blocks_late_delivery() -> None:
    """What the interruption handler relies on: once cancelled, nothing more is delivered."""
    registry = TurnRegistry()
    turn = registry.begin_turn()
    assert registry.may_deliver(turn)

    registry.cancel(turn)
    assert registry.is_cancelled(turn)
    assert not registry.may_deliver(turn)
    assert registry.state(turn) is DeliveryState.INTERRUPTED
    # The next turn is unaffected by its predecessor being cancelled.
    assert registry.may_deliver(registry.begin_turn())


def test_spoken_turn_cannot_be_reopened() -> None:
    registry = TurnRegistry()
    turn = registry.begin_turn()
    assert registry.set_state(turn, DeliveryState.ACCEPTED)
    assert registry.set_state(turn, DeliveryState.SPEAKING)
    assert registry.set_state(turn, DeliveryState.SPOKEN)
    assert not registry.set_state(turn, DeliveryState.SPEAKING)
    assert registry.state(turn) is DeliveryState.SPOKEN


def test_generated_turn_cannot_jump_straight_to_spoken() -> None:
    registry = TurnRegistry()
    turn = registry.begin_turn()
    # Speaking must be observed before it can be claimed as done.
    assert registry.set_state(turn, DeliveryState.ACCEPTED)
    assert not registry.set_state(turn, DeliveryState.SPOKEN)
    assert registry.state(turn) is DeliveryState.ACCEPTED


def test_state_advances_through_the_delivery_path() -> None:
    registry = TurnRegistry()
    turn = registry.begin_turn()
    for state in (
        DeliveryState.ACCEPTED,
        DeliveryState.SPEAKING,
        DeliveryState.SPOKEN,
    ):
        assert registry.set_state(turn, state)
    assert registry.state(turn) is DeliveryState.SPOKEN


def test_cancellation_prunes_retired_epochs() -> None:
    registry = TurnRegistry()
    old = registry.begin_turn()
    registry.cancel(old)
    registry.advance_epoch()
    # Retired cancellations are dropped so the registry cannot grow without bound.
    assert not registry.is_cancelled(old)


def test_two_registries_do_not_share_state() -> None:
    """Language policy must not leak between sessions."""
    first = TurnRegistry()
    second = TurnRegistry()
    turn_a = first.begin_turn()
    turn_b = second.begin_turn()
    first.cancel(turn_a)
    assert second.may_deliver(turn_b)
    assert not second.is_cancelled(turn_b)
