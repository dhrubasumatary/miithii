from __future__ import annotations

import pytest

from miithii_agent.tiers import UnknownVoiceTierError, resolve_voice_tier, validate_voice_tier


def test_voice_tier_validation_normalises_product_values() -> None:
    assert validate_voice_tier(" Standard ") == "standard"


def test_unknown_voice_tier_is_refused() -> None:
    with pytest.raises(UnknownVoiceTierError):
        validate_voice_tier("free")


def test_only_standard_is_served() -> None:
    assert resolve_voice_tier("standard").effective == "standard"


def test_a_retired_tier_is_refused_rather_than_downgraded() -> None:
    """Premium must fail loudly, not silently resolve to Standard.

    A client that asked for a tier it cannot have has to be told so. Downgrading it would
    issue a room named for a tier nobody is serving, and the session would answer in a voice
    the user did not choose while the app showed them a tier it had already retired.
    """
    with pytest.raises(UnknownVoiceTierError) as caught:
        validate_voice_tier("premium")
    assert "retired" in str(caught.value)


def test_premium_allowed_cannot_revive_a_retired_tier() -> None:
    """The entitlement knob stays inert until a real tier exists to entitle.

    `resolve_voice_tier` keeps the parameter so the seam does not change shape when a second
    tier returns. If it ever started honouring the flag, the retirement above would be one
    argument away from being undone by a caller that still passes the old value.
    """
    with pytest.raises(UnknownVoiceTierError):
        resolve_voice_tier("premium", premium_allowed=True)


def test_requested_and_effective_always_agree_while_one_tier_exists() -> None:
    result = resolve_voice_tier("standard")
    assert result.requested == result.effective == "standard"
