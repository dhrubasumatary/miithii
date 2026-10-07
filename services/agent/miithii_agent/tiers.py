"""Product-level Voice tier selection.

The client is allowed to request a tier. It is never allowed to choose a provider, model or
voice. This module is deliberately tiny because future billing/entitlement should replace one
policy decision here rather than changing the realtime pipeline.

**Premium is retired.** There is exactly one tier now, so the tier is a one-member set rather
than no concept at all. That is a deliberate choice over deleting the type: the tier is carried
in the room name, published as two participant attributes, resolved by the token issuer, and
consumed by the TTS router. Removing the *concept* would mean editing all five of those, and the
next person to add a tier would have to rebuild the whole seam instead of filling it in.

To bring Premium back, in order:

1. ``VoiceTier`` and ``SUPPORTED_VOICE_TIERS`` below.
2. ``voice_tts.tts_route`` and a ``_build_elevenlabs`` beside ``_build_bodhan``.
3. ``token.issue`` stops passing ``premium_allowed=False``.

Nothing in :mod:`rooms`, :mod:`main`, or the app needs to change. ``rooms`` already parses the
tier segment, and the app already sends ``miithii.requested_voice_tier`` when a tier is chosen.

A room naming a tier that is not in ``SUPPORTED_VOICE_TIERS`` is **refused**, not downgraded. A
client that asks for a retired tier and silently gets a different one would be told it was
granted something it was not.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

VoiceTier = Literal["standard"]
SUPPORTED_VOICE_TIERS: tuple[VoiceTier, ...] = ("standard",)

# Retired tiers, kept only so the error message can name what was asked for.
RETIRED_VOICE_TIERS: tuple[str, ...] = ("premium",)


class UnknownVoiceTierError(ValueError):
    """The requested product tier is not supported."""


@dataclass(frozen=True)
class VoiceTierResolution:
    """Server-owned result of a client's tier request."""

    requested: VoiceTier
    effective: VoiceTier


def validate_voice_tier(value: str) -> VoiceTier:
    normalized = (value or "").strip().lower()
    if normalized in RETIRED_VOICE_TIERS:
        raise UnknownVoiceTierError(
            f"voice tier {value!r} has been retired; only "
            f"{', '.join(SUPPORTED_VOICE_TIERS)} is available"
        )
    if normalized not in SUPPORTED_VOICE_TIERS:
        raise UnknownVoiceTierError(
            f"unsupported voice tier {value!r}; expected one of: "
            f"{', '.join(SUPPORTED_VOICE_TIERS)}"
        )
    return normalized  # type: ignore[return-value]


def resolve_voice_tier(
    requested: str,
    *,
    participant_identity: str | None = None,
    premium_allowed: bool = False,
) -> VoiceTierResolution:
    """Resolve requested -> effective tier.

    This is the entitlement seam. When billing exists it is the one place that should ask
    whether ``participant_identity`` may use a given tier for this session/turn. Nothing after
    this function needs to know how that entitlement was decided.

    ``premium_allowed`` is retained so the parameter list does not change shape when a second
    tier returns. It is deliberately **not** consulted today: there is nothing left for it to
    enable, and honouring it would mean a retired tier resolving to a live one.
    """

    del participant_identity  # reserved for the future entitlement resolver
    del premium_allowed  # no retired tier is reachable to enable
    tier = validate_voice_tier(requested)
    return VoiceTierResolution(requested=tier, effective=tier)


__all__ = [
    "RETIRED_VOICE_TIERS",
    "SUPPORTED_VOICE_TIERS",
    "UnknownVoiceTierError",
    "VoiceTier",
    "VoiceTierResolution",
    "resolve_voice_tier",
    "validate_voice_tier",
]
