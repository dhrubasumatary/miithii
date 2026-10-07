"""Room names carry the server-owned session route, and every session gets its own room.

This module is the single place a room name and a language are related. The token issuer and
the agent worker both import it, so the two can never disagree about what a room means.

Two decisions live here, and both were forced by real problems.

**Unique room per session.** The first design issued one fixed room per language, so every
Assamese user shared ``miithii-voice-assamese``. Anyone could have joined it and published or
subscribed to another person's audio. That is not a theoretical concern for a room carrying
microphone streams, so rooms are now per session: ``miithii-<language>-<unique>``.

**The room name carries language and effective Voice tier.** One worker process serves every
session, so process-wide product state would leak between users. The room is per-session state
the worker can read on arrival, before any participant has joined.

An unrecognised room is refused rather than defaulted. Defaulting to Assamese is exactly the
bug this module exists to prevent.
"""

from __future__ import annotations

import re
import secrets
from dataclasses import dataclass

from .policy import SUPPORTED_LANGUAGES, language_aliases, normalize_language_id
from .tiers import SUPPORTED_VOICE_TIERS, VoiceTier, validate_voice_tier

ROOM_PREFIX = "miithii"
_ROOM_LANGUAGE_CODES = tuple(sorted(language_aliases(), key=len, reverse=True))
_ROOM_LANGUAGE_PATTERN = "|".join(re.escape(code) for code in _ROOM_LANGUAGE_CODES)

# New rooms are `miithii-<language>-<tier>-<unique>`. During the first rolling deployment we
# also accept the immediately preceding `miithii-<language>-<unique>` form as Standard so an
# already-issued room cannot be killed by a process replacement mid-session. New tokens never
# mint that compatibility form.
#
# The tier alternation deliberately still names `premium` even though that tier is retired.
# A room minted before the tier was retired must be *refused*, not downgraded to Standard, and
# matching it here is what lets `validate_voice_tier` fail with "premium has been retired"
# instead of the far less useful "this is not a Miithii voice room".
_ROOM_RE = re.compile(
    rf"^{ROOM_PREFIX}-({_ROOM_LANGUAGE_PATTERN})-(standard|premium)-"
    r"([A-Za-z0-9_-]{6,64})$"
)
_STANDARD_COMPAT_RE = re.compile(
    rf"^{ROOM_PREFIX}-({_ROOM_LANGUAGE_PATTERN})-([A-Za-z0-9_-]{{6,64}})$"
)

# Length limits LiveKit imposes on room names.
MAX_ROOM_NAME = 128


class UnknownRoomError(ValueError):
    """The room name does not encode a supported reply language."""


class UnknownLanguageError(ValueError):
    """The requested reply language is not supported."""


@dataclass(frozen=True)
class SessionRoute:
    """Server-owned routing state for one LiveKit room."""

    language: str
    voice_tier: VoiceTier


def new_room_name(language: str, voice_tier: str = "standard") -> str:
    """Return a fresh room name for one language × effective-tier session."""
    try:
        canonical = normalize_language_id(language)
    except RuntimeError:
        raise UnknownLanguageError(
            f"unsupported reply language {language!r}; "
            f"expected one of: {', '.join(SUPPORTED_LANGUAGES)}"
        ) from None
    tier = validate_voice_tier(voice_tier)
    name = f"{ROOM_PREFIX}-{canonical}-{tier}-{secrets.token_urlsafe(9)}"
    if len(name) > MAX_ROOM_NAME:  # pragma: no cover - token_urlsafe(9) is 12 chars
        raise UnknownRoomError("generated room name is too long")
    return name


def route_for_room(room_name: str) -> SessionRoute:
    """Return the server-owned session route encoded in a room, or refuse."""
    match = _ROOM_RE.match(room_name)
    if match is not None:
        return SessionRoute(
            language=normalize_language_id(match.group(1)),
            voice_tier=validate_voice_tier(match.group(2)),
        )

    compat = _STANDARD_COMPAT_RE.match(room_name)
    if compat is not None:
        return SessionRoute(language=normalize_language_id(compat.group(1)), voice_tier="standard")

    raise UnknownRoomError(
        f"room {room_name!r} is not a Miithii voice room; expected "
        f"{ROOM_PREFIX}-<{'|'.join(SUPPORTED_LANGUAGES)}>-<"
        f"{'|'.join(SUPPORTED_VOICE_TIERS)}>-<unique id>"
    )


def language_for_room(room_name: str) -> str:
    """Return the reply language a room is for, or refuse."""
    return route_for_room(room_name).language


def voice_tier_for_room(room_name: str) -> VoiceTier:
    """Return the effective product tier a room is for, or refuse."""
    return route_for_room(room_name).voice_tier


def is_voice_room(room_name: str) -> bool:
    """True when a room name looks like one of ours, without raising."""
    return _ROOM_RE.match(room_name) is not None or _STANDARD_COMPAT_RE.match(room_name) is not None


def validate_language(language: str) -> str:
    """Normalise and validate a requested reply language, or refuse."""
    try:
        return normalize_language_id(language)
    except RuntimeError:
        raise UnknownLanguageError(
            f"unsupported reply language {language!r}; "
            f"expected one of: {', '.join(SUPPORTED_LANGUAGES)}"
        ) from None


def room_pattern(language: str, voice_tier: str | None = None) -> str:
    """A glob for rooms that serve a language, optionally narrowed to one tier.

    Built from the known prefix rather than by splitting a generated room name. The unique
    segment is base64url and can itself contain a dash, so splitting on the last dash would
    silently return the wrong prefix roughly half the time.
    """
    try:
        canonical = normalize_language_id(language)
    except RuntimeError:
        raise UnknownLanguageError(
            f"unsupported reply language {language!r}; "
            f"expected one of: {', '.join(SUPPORTED_LANGUAGES)}"
        ) from None
    if voice_tier is None:
        return f"{ROOM_PREFIX}-{canonical}-*"
    tier = validate_voice_tier(voice_tier)
    return f"{ROOM_PREFIX}-{canonical}-{tier}-*"


__all__ = [
    "MAX_ROOM_NAME",
    "ROOM_PREFIX",
    "SUPPORTED_LANGUAGES",
    "UnknownLanguageError",
    "UnknownRoomError",
    "SessionRoute",
    "is_voice_room",
    "language_for_room",
    "new_room_name",
    "route_for_room",
    "room_pattern",
    "validate_language",
    "voice_tier_for_room",
]
