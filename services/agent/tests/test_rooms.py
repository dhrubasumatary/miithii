"""Session identity: a unique room per session, carrying its reply language.

The regression these cover is real. The first design issued one fixed room per language and
read the language from the process environment, so every Assamese user shared a room and a
Bodo user could have been answered in Assamese.
"""

from __future__ import annotations

import pytest

from miithii_agent.rooms import (
    MAX_ROOM_NAME,
    SUPPORTED_LANGUAGES,
    UnknownLanguageError,
    UnknownRoomError,
    is_voice_room,
    language_for_room,
    new_room_name,
    room_pattern,
    route_for_room,
    validate_language,
    voice_tier_for_room,
)
from miithii_agent.tiers import UnknownVoiceTierError


def test_new_rooms_encode_their_language() -> None:
    for language in SUPPORTED_LANGUAGES:
        name = new_room_name(language)
        assert language_for_room(name) == language
        assert voice_tier_for_room(name) == "standard"
        assert is_voice_room(name)


def test_new_rooms_encode_their_effective_voice_tier() -> None:
    name = new_room_name("brx", "standard")
    route = route_for_room(name)
    assert route.language == "brx"
    assert route.voice_tier == "standard"


def test_a_room_naming_a_retired_tier_is_refused_not_downgraded() -> None:
    """A Premium room minted before the retirement must not resolve to Standard.

    Downgrading it would put a Standard voice in a room the token issuer named as Premium,
    and every downstream log line about that session would say Standard while the user asked
    for something else. Refusing is the only outcome that tells the truth.
    """
    with pytest.raises(UnknownVoiceTierError):
        new_room_name("brx", "premium")

    # The room shape still parses, so the failure is about the tier and not about the format.
    stale = "miithii-brx-premium-abcdefgh"
    assert is_voice_room(stale) is True
    with pytest.raises(UnknownVoiceTierError):
        route_for_room(stale)


def test_every_session_gets_its_own_room() -> None:
    """The security property.

    A fixed room per language let any user join another user's session with publish rights.
    """
    names = {new_room_name("asm") for _ in range(200)}
    assert len(names) == 200


def test_room_ids_are_not_guessable() -> None:
    # Sequential ids would let one session be derived from another's name.
    names = {new_room_name("brx") for _ in range(50)}
    assert len(names) == 50
    for name in names:
        unique = name[len("miithii-brx-") :]
        assert len(unique) >= 8



def test_the_room_pattern_survives_a_dash_in_the_unique_segment() -> None:
    """The unique id is base64url and may contain a dash.

    Building a pattern by splitting a generated room name on the last dash returns the wrong
    prefix whenever the id itself contains one, which is most of the time.
    """
    assert room_pattern("asm") == "miithii-asm-*"
    assert room_pattern("as") == "miithii-asm-*"  # rolling alias canonicalises
    assert room_pattern("brx") == "miithii-brx-*"
    assert room_pattern("asm", "standard") == "miithii-asm-standard-*"
    for _ in range(200):
        name = new_room_name("asm")
        assert name.startswith("miithii-asm-")
        assert is_voice_room(name)


def test_the_room_pattern_refuses_an_unknown_language() -> None:
    with pytest.raises(UnknownLanguageError):
        room_pattern("fr")


def test_room_names_stay_within_the_length_limit() -> None:
    for language in SUPPORTED_LANGUAGES:
        assert len(new_room_name(language)) <= MAX_ROOM_NAME


def test_unknown_room_is_refused_not_defaulted() -> None:
    """Defaulting to Assamese is the bug this module prevents."""
    for bad in ("miithii-voice", "miithii-as", "random-room", "miithii-zz-abcdef123456", ""):
        with pytest.raises(UnknownRoomError):
            language_for_room(bad)


def test_foreign_rooms_are_recognisably_not_ours() -> None:
    assert is_voice_room("miithii-as-abcdef123456") is True
    assert is_voice_room("some-other-app-room") is False


def test_language_validation_normalises() -> None:
    assert validate_language("BRX") == "brx"
    assert validate_language(" as ") == "asm"
    assert validate_language(" ASM ") == "asm"


def test_unknown_language_is_refused() -> None:
    for bad in ("bn", "en", "", "bodo", "as1"):
        with pytest.raises(UnknownLanguageError):
            validate_language(bad)


def test_unknown_language_cannot_make_a_room() -> None:
    with pytest.raises(UnknownLanguageError):
        new_room_name("fr")


def test_unknown_voice_tier_cannot_make_a_room() -> None:
    with pytest.raises(UnknownVoiceTierError):
        new_room_name("as", "enterprise")


def test_pre_tier_room_is_standard_only_for_rolling_compatibility() -> None:
    route = route_for_room("miithii-as-abcdef123456")
    assert route.language == "asm"
    assert route.voice_tier == "standard"
