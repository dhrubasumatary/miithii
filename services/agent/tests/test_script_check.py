"""Unicode script enforcement from language-pack ranges."""

from __future__ import annotations

from miithii_agent.policy import get_policy


def test_assamese_danda_is_neutral_punctuation() -> None:
    check = get_policy("asm").validate_reply_script("নমস্কাৰ।")
    assert check.valid is True
    assert check.has_unexpected_indic_script is False


def test_bodo_danda_is_neutral_punctuation() -> None:
    assert get_policy("brx").validate_reply_script("आं बेयावनो दं।").valid is True


def test_cross_script_leakage_is_rejected() -> None:
    assert get_policy("asm").validate_reply_script("आं बेयावनो दं।").valid is False
    assert get_policy("brx").validate_reply_script("নমস্কাৰ।").valid is False


def test_latin_only_reply_is_rejected_but_code_mix_can_be_scored() -> None:
    assert get_policy("asm").validate_reply_script("Hello there").valid is False
    mixed = get_policy("asm").validate_reply_script("নমস্কাৰ hello।")
    assert mixed.valid is True
    assert 0 < mixed.latin_ratio < 1


def test_assamese_bengali_tell_is_flagged_without_fake_language_detection() -> None:
    check = get_policy("asm").validate_reply_script("রাতি কথা।")
    assert check.valid is True
    assert "র" in check.suspect_matches


def test_same_script_hindi_is_not_misrepresented_as_detectable_by_unicode() -> None:
    # Bodo and Hindi share Devanagari. Word-level native-reviewed blocklists/evals handle this;
    # a Unicode gate cannot honestly claim to identify the language.
    assert get_policy("brx").validate_reply_script("मैं ठीक हूँ।").valid is True


def test_punctuation_only_output_is_script_neutral() -> None:
    assert get_policy("asm").validate_reply_script("।।।").valid is True
    assert get_policy("brx").validate_reply_script("123 ...").valid is True
