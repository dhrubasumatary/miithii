"""The probe fixtures must be written in the script the contract requires.

This is a regression test for a real mistake. The Bodo provider fixture was written in the
shared Assamese/Bengali block while the Bodo voice contract requires Devanagari, so every
"passing" Bodo probe was exercising the wrong script and proving nothing about the path the
product actually uses. A green probe result was being read as evidence it never was.

The script is asserted here rather than left to review, because a fixture that is wrong in
script is invisible in a transcript: it looks like plausible text.
"""

from __future__ import annotations

import pytest
from livekit import rtc

from miithii_agent.policy import get_policy
from miithii_agent.probe import FIXTURES
from miithii_agent.probe_turn import NON_SILENT_PEAK, PROMPTS, has_non_silent_pcm


@pytest.mark.parametrize("language", sorted(FIXTURES))
def test_fixture_is_in_the_scripts_its_contract_declares(language: str) -> None:
    policy = get_policy(language)
    check = policy.validate_reply_script(FIXTURES[language])
    assert check.valid is True, (
        f"the {language} probe fixture is not valid {policy.script}: {check.describe()}"
    )


def test_every_language_has_a_fixture() -> None:
    assert set(FIXTURES) == {"asm", "brx"}


@pytest.mark.parametrize("language", sorted(PROMPTS))
def test_turn_probe_prompt_uses_the_selected_language_script(language: str) -> None:
    policy = get_policy(language)
    assert policy.validate_reply_script(PROMPTS[language]).valid is True


def test_turn_probe_ignores_idle_pcm_and_detects_signal() -> None:
    frame = rtc.AudioFrame.create(sample_rate=48_000, num_channels=1, samples_per_channel=480)
    assert has_non_silent_pcm(frame) is False

    frame.data[12] = NON_SILENT_PEAK + 1
    assert has_non_silent_pcm(frame) is True


def test_bodo_fixture_is_devanagari_not_the_assamese_block() -> None:
    """The specific failure, pinned separately so the reason is obvious."""
    policy = get_policy("brx")
    assert policy.script == "devanagari"
    assert policy.validate_reply_script(FIXTURES["brx"]).has_expected_script is True


def test_assamese_fixture_is_not_devanagari() -> None:
    policy = get_policy("asm")
    assert policy.validate_reply_script(FIXTURES["asm"]).has_unexpected_indic_script is False


def test_fixtures_are_non_trivial() -> None:
    for language, text in FIXTURES.items():
        assert len(text) > 8, language
        assert any(char.isalpha() for char in text), language
