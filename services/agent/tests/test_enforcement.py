"""Deterministic output gate for the data-driven language packs."""

from __future__ import annotations

from miithii_agent.enforcement import Mood, Rejection, Verdict, build_repair_prompt, check_answer
from miithii_agent.policy import get_policy

ASSAMESE = "অসমীয়া।"
BODO = "बरʼ।"


def wrapped(text: str, mood: str = "neutral") -> str:
    return f"@mood: {mood}\n{text}"


def test_valid_assamese_is_unwrapped_before_display_and_tts() -> None:
    result = check_answer(wrapped(ASSAMESE), get_policy("asm"))
    assert result.speakable is True
    assert result.text == ASSAMESE
    assert result.mood is Mood.NEUTRAL
    assert result.spoken_sentences[0].display == ASSAMESE
    assert result.spoken_sentences[0].tts == ASSAMESE
    assert result.spoken_sentences[0].lang_id == "asm"


def test_valid_bodo_is_accepted() -> None:
    result = check_answer(wrapped(BODO, "soft"), get_policy("brx"))
    assert result.speakable is True
    assert result.mood is Mood.SOFT


def test_missing_mood_defaults_to_neutral_without_blocking_valid_speech() -> None:
    result = check_answer(ASSAMESE, get_policy("asm"))
    assert result.speakable is True
    assert result.text == ASSAMESE
    assert result.mood is Mood.NEUTRAL


def test_invalid_mood_defaults_to_neutral_and_control_line_is_not_spoken() -> None:
    result = check_answer(wrapped(ASSAMESE, "dramatic"), get_policy("asm"))
    assert result.speakable is True
    assert result.text == ASSAMESE
    assert result.mood is Mood.NEUTRAL


def test_loose_parenthesized_mood_is_stripped_not_spoken() -> None:
    result = check_answer(f"(neutral)\n{ASSAMESE}", get_policy("asm"))
    assert result.speakable is True
    assert result.text == ASSAMESE
    assert result.mood is Mood.NEUTRAL


def test_inline_mood_prefix_is_stripped_before_language_validation() -> None:
    for answer in (
        f"(neutral) {ASSAMESE}",
        f"[soft] {ASSAMESE}",
        f"@mood: hype {ASSAMESE}",
        f"@neutral: {ASSAMESE}",
        f"@soft:\n{ASSAMESE}",
        f"@neutral\n{ASSAMESE}",
        f"@soft {ASSAMESE}",
    ):
        result = check_answer(answer, get_policy("asm"))
        assert result.speakable is True
        assert result.text == ASSAMESE
        assert "neutral" not in result.text


def test_cross_script_and_latin_only_replies_are_rejected() -> None:
    assert Rejection.WRONG_SCRIPT in check_answer(wrapped(BODO), get_policy("asm")).rejections
    assert Rejection.WRONG_SCRIPT in check_answer(wrapped(ASSAMESE), get_policy("brx")).rejections
    result = check_answer(wrapped("Hello there."), get_policy("asm"))
    assert Rejection.WRONG_SCRIPT in result.rejections


def test_control_artifacts_are_caught_before_speech() -> None:
    for text in (
        "অসমীয়া [soft]।",
        "অসমীয়া 😅।",
        "অসমীয়া **ok**।",
        "অসমীয়া <|speaker|>।",
        "অসমীয়া @neutral:।",
        "অসমীয়া @neutral।",
        "অসমীয়া @soft।",
    ):
        result = check_answer(wrapped(text), get_policy("asm"))
        assert Rejection.CONTROL_TOKEN in result.rejections


def test_observed_generic_assamese_ai_intro_is_rejected_before_speech() -> None:
    # Exact Assamese model output observed in a deployed production-path probe.
    result = check_answer(wrapped("মই এটা AI সহায়ক। মোক যিকোনো প্ৰশ্ন সুধিব পাৰা।"), get_policy("asm"))
    assert result.speakable is False
    assert Rejection.GENERIC_ASSISTANT_INTRO in result.rejections
    repair = build_repair_prompt("", result.rejections)
    assert "without volunteering your identity" in repair


def test_truncation_is_never_spoken() -> None:
    result = check_answer(wrapped(ASSAMESE), get_policy("asm"), truncated=True)
    assert result.speakable is False
    assert Rejection.TRUNCATED in result.rejections


def test_overlong_turn_is_trimmed_only_at_sentence_boundaries() -> None:
    policy = get_policy("asm")
    answer = " ".join([ASSAMESE] * 80)
    result = check_answer(wrapped(answer), policy)
    assert result.speakable is True
    assert result.verdict is Verdict.REPAIRED
    assert len(result.text) <= policy.max_turn_chars
    assert result.text.endswith("।")


def test_one_sentence_over_provider_limit_is_refused_whole() -> None:
    policy = get_policy("asm")
    oversized = "অ" * (policy.max_request_chars + 1) + "।"
    result = check_answer(wrapped(oversized), policy)
    assert result.speakable is False
    assert Rejection.OVER_REQUEST_BUDGET in result.rejections


def test_research_seed_suspect_letter_is_flagged_not_hard_rejected() -> None:
    result = check_answer(wrapped("রাতি।"), get_policy("asm"))
    assert result.speakable is True
    assert "suspect-letter:র" in result.flags


def test_repair_prompt_names_the_mechanical_failure() -> None:
    result = check_answer(wrapped("Hello."), get_policy("asm"))
    prompt = build_repair_prompt("Hello.", result.rejections)
    assert "wrong_script" in prompt
    assert "@mood" in prompt
