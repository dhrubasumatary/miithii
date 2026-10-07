"""Deterministic language gate between generation and every user-visible output path."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

from .policy import VoicePolicy, enforce_turn_budget
from .sentences import split_sentences, take_complete_sentences


class Verdict(str, Enum):
    ACCEPTED = "accepted"
    REPAIRED = "repaired"
    REJECTED = "rejected"


class Mood(str, Enum):
    HYPE = "hype"
    ROAST = "roast"
    SCOLD = "scold"
    SOFT = "soft"
    CRISIS = "crisis"
    NEUTRAL = "neutral"


class Rejection(str, Enum):
    EMPTY = "empty"
    MISSING_MOOD = "missing_mood"
    INVALID_MOOD = "invalid_mood"
    CONTROL_TOKEN = "control_token"
    WRONG_SCRIPT = "wrong_script"
    BLOCKLIST = "blocklist"
    OVER_TURN_BUDGET = "over_turn_budget"
    OVER_REQUEST_BUDGET = "over_request_budget"
    INCOMPLETE_SENTENCE = "incomplete_sentence"
    TRUNCATED = "truncated"
    GENERIC_ASSISTANT_INTRO = "generic_assistant_intro"


@dataclass(frozen=True)
class SpokenSentence:
    """The single canonical object from which display and synthesis text are derived."""

    id: str
    display: str
    tts: str
    mood: Mood
    lang_id: str
    pack_version: str


@dataclass(frozen=True)
class CheckResult:
    verdict: Verdict
    text: str
    rejections: tuple[Rejection, ...] = ()
    sentences: tuple[str, ...] = field(default_factory=tuple)
    spoken_sentences: tuple[SpokenSentence, ...] = field(default_factory=tuple)
    mood: Mood | None = None
    flags: tuple[str, ...] = field(default_factory=tuple)

    @property
    def speakable(self) -> bool:
        return self.verdict is not Verdict.REJECTED

    def describe(self) -> str:
        if self.speakable:
            mood = self.mood.value if self.mood else "none"
            return f"{self.verdict.value}: {len(self.sentences)} sentence(s), mood={mood}"
        return f"{self.verdict.value}: {', '.join(item.value for item in self.rejections)}"


_MOOD_RE = re.compile(r"^@mood:\s*([a-z]+)\s*$", re.IGNORECASE)
_ALT_MOOD_RE = re.compile(
    r"^[\(\[\{]?\s*(hype|roast|scold|soft|crisis|neutral)\s*[\)\]\}]?$",
    re.IGNORECASE,
)
_MOOD_PREFIX_RE = re.compile(
    r"^\s*(?:@mood:\s*(hype|roast|scold|soft|crisis|neutral)"
    r"|@(hype|roast|scold|soft|crisis|neutral)(?::|(?=\s))"
    r"|[\(\[\{]\s*(hype|roast|scold|soft|crisis|neutral)\s*[\)\]\}])\s*",
    re.IGNORECASE,
)
_CONTROL_HEADER_RE = re.compile(
    r"^\s*(?:@mood:\s*[^\s]+|@[a-z][a-z_-]{0,24}:?|[\(\[\{][^\)\]\}]{1,32}[\)\]\}])\s*$",
    re.IGNORECASE,
)
_MARKDOWN_RE = re.compile(r"(^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)|[*_`]{1,3}")
_PROVIDER_TOKEN_RE = re.compile(
    r"<\||\|>|@[a-z][a-z_-]{0,24}:|@(?:hype|roast|scold|soft|crisis|neutral)\b",
    re.IGNORECASE,
)
_GENERIC_ASSISTANT_INTRO_RE = re.compile(
    # The Assamese wording below was actually observed in a deployed probe and is a known
    # model-generated boilerplate failure, not a newly invented native-language translation.
    r"(?:মই\s+এটা\s+AI\s+সহায়ক|\bI\s+am\s+an?\s+AI\s+assistant\b)",
    re.IGNORECASE,
)
_BRACKETED_RE = re.compile(r"[\[\]{}]")
_EMOJI_RE = re.compile(
    "["
    "\U0001F1E6-\U0001F1FF"
    "\U0001F300-\U0001FAFF"
    "\U00002700-\U000027BF"
    "]"
)


def _parse_output(text: str) -> tuple[Mood | None, str, tuple[Rejection, ...]]:
    stripped = text.strip()
    if not stripped:
        return None, "", (Rejection.EMPTY,)

    prefix_mood, without_prefix = strip_mood_prefix(stripped)
    if prefix_mood is not None:
        body = without_prefix.strip()
        if not body:
            return prefix_mood, "", (Rejection.EMPTY,)
        return prefix_mood, body, ()

    first, separator, remainder = stripped.partition("\n")
    mood, mood_error = parse_mood_line(first)
    if mood_error is Rejection.MISSING_MOOD:
        # Mood is delivery metadata, not spoken-language correctness. Providers occasionally
        # omit the control line even when the reply itself is perfectly valid. A missing header
        # must never consume the one repair attempt or turn a usable reply into silence.
        return Mood.NEUTRAL, stripped, ()
    if mood_error is Rejection.INVALID_MOOD:
        # An unknown mood is equally non-fatal. Drop the control line and use the neutral
        # delivery path; the body still goes through every real language/safety check below.
        body = remainder.strip() if separator else ""
        if not body:
            return Mood.NEUTRAL, "", (Rejection.EMPTY,)
        return Mood.NEUTRAL, body, ()
    assert mood is not None
    body = remainder.strip() if separator else ""
    if not body:
        return mood, "", (Rejection.EMPTY,)
    return mood, body, ()


def parse_mood_line(line: str) -> tuple[Mood | None, Rejection | None]:
    """Parse the one control line without accepting any surrounding reply text."""
    stripped = line.strip()
    match = _MOOD_RE.fullmatch(stripped) or _ALT_MOOD_RE.fullmatch(stripped)
    if match is None:
        if _CONTROL_HEADER_RE.fullmatch(stripped):
            return None, Rejection.INVALID_MOOD
        return None, Rejection.MISSING_MOOD
    try:
        return Mood(match.group(1).lower()), None
    except ValueError:
        return None, Rejection.INVALID_MOOD


def strip_mood_prefix(text: str) -> tuple[Mood | None, str]:
    """Strip supported mood metadata even when the provider glues it to spoken text."""
    match = _MOOD_PREFIX_RE.match(text)
    if match is None:
        return None, text
    value = next((group for group in match.groups() if group is not None), None)
    if value is None:  # pragma: no cover - the regex always captures one supported mood
        return None, text
    return Mood(value.lower()), text[match.end() :]


def _has_control_artifact(text: str) -> bool:
    return bool(
        _PROVIDER_TOKEN_RE.search(text)
        or _MARKDOWN_RE.search(text)
        or _BRACKETED_RE.search(text)
        or _EMOJI_RE.search(text)
    )


def _blocklist_hits(text: str, policy: VoicePolicy) -> tuple[tuple[str, ...], bool]:
    flags: list[str] = []
    hard_reject = False
    folded = text.casefold()
    for entry in policy.blocklist:
        if entry.kind == "regex":
            try:
                matched = re.search(entry.pattern, text, flags=re.IGNORECASE) is not None
            except re.error as exc:
                raise RuntimeError(
                    f"invalid blocklist regex for {policy.language}: {entry.pattern!r}"
                ) from exc
        else:
            # Token boundaries are deliberately Unicode-aware through Python's \w behavior.
            matched = (
                re.search(rf"(?<!\w){re.escape(entry.pattern)}(?!\w)", folded, flags=re.IGNORECASE)
                is not None
            )
        if not matched:
            continue
        flags.append(f"block:{entry.pattern}:{entry.severity}:{entry.review_status}")
        hard_reject = hard_reject or entry.hard_reject
    return tuple(flags), hard_reject


def _make_spoken_sentences(
    sentences: tuple[str, ...], mood: Mood, policy: VoicePolicy
) -> tuple[SpokenSentence, ...]:
    return tuple(
        SpokenSentence(
            id=f"{policy.language}:{policy.version}:{index + 1}",
            display=sentence,
            tts=sentence,
            mood=mood,
            lang_id=policy.language,
            pack_version=policy.version,
        )
        for index, sentence in enumerate(sentences)
    )


def check_answer(
    text: str,
    policy: VoicePolicy,
    *,
    truncated: bool = False,
) -> CheckResult:
    """Parse the model envelope and validate canonical spoken text before display or TTS."""
    mood, body, parse_rejections = _parse_output(text)
    if parse_rejections:
        return CheckResult(Verdict.REJECTED, "", parse_rejections, mood=mood)
    assert mood is not None

    complete, tail = take_complete_sentences(body)
    if tail.strip():
        return CheckResult(
            Verdict.REJECTED,
            "",
            (Rejection.INCOMPLETE_SENTENCE,),
            mood=mood,
        )

    rejections: list[Rejection] = []
    flags: list[str] = []
    if truncated:
        rejections.append(Rejection.TRUNCATED)
    if _has_control_artifact(body):
        rejections.append(Rejection.CONTROL_TOKEN)
    if _GENERIC_ASSISTANT_INTRO_RE.search(body):
        rejections.append(Rejection.GENERIC_ASSISTANT_INTRO)

    script = policy.validate_reply_script(body)
    if (
        not script.valid or script.latin_ratio > policy.max_latin_ratio
    ):
        rejections.append(Rejection.WRONG_SCRIPT)
    if script.suspect_matches:
        flags.extend(f"suspect-letter:{item}" for item in script.suspect_matches)

    block_flags, hard_block = _blocklist_hits(body, policy)
    flags.extend(block_flags)
    if hard_block:
        rejections.append(Rejection.BLOCKLIST)

    usable = (
        tuple(complete)
        if truncated
        else tuple(
            sentence
            for sentence in complete
            if len(sentence) <= policy.max_request_chars
        )
    )
    if not usable:
        rejections.append(Rejection.OVER_REQUEST_BUDGET)

    if rejections:
        return CheckResult(
            Verdict.REJECTED,
            "",
            tuple(dict.fromkeys(rejections)),
            mood=mood,
            flags=tuple(flags),
        )

    trimmed, was_trimmed = enforce_turn_budget(" ".join(usable), policy)
    sentences = tuple(split_sentences(trimmed))
    if not sentences:
        return CheckResult(
            Verdict.REJECTED,
            "",
            (Rejection.OVER_TURN_BUDGET,),
            mood=mood,
            flags=tuple(flags),
        )

    verdict = Verdict.REPAIRED if was_trimmed else Verdict.ACCEPTED
    return CheckResult(
        verdict,
        trimmed,
        (),
        sentences,
        _make_spoken_sentences(sentences, mood, policy),
        mood,
        tuple(flags),
    )


def check_sentence(
    sentence: str,
    mood: Mood,
    policy: VoicePolicy,
    *,
    sentence_index: int,
) -> CheckResult:
    """Validate one complete streaming sentence using the same full-answer gate."""
    result = check_answer(f"@mood: {mood.value}\n{sentence}", policy)
    if not result.speakable:
        return result
    if len(result.sentences) != 1:
        return CheckResult(
            Verdict.REJECTED,
            "",
            (Rejection.CONTROL_TOKEN,),
            mood=mood,
            flags=result.flags,
        )
    spoken = SpokenSentence(
        id=f"{policy.language}:{policy.version}:{sentence_index}",
        display=result.text,
        tts=result.text,
        mood=mood,
        lang_id=policy.language,
        pack_version=policy.version,
    )
    return CheckResult(
        result.verdict,
        result.text,
        (),
        result.sentences,
        (spoken,),
        mood,
        result.flags,
    )


REPAIR_INSTRUCTION = (
    "That answer was rejected before it could be shown or spoken. Generate the turn again from "
    "scratch. Keep line 1 exactly in the required @mood format, then output only complete spoken "
    "sentences in the configured reply language. No markdown, emoji, JSON, lists, or stage "
    "directions. Do not apologise or mention this correction."
)


def build_repair_prompt(original: str, rejections: tuple[Rejection, ...]) -> str:
    del original
    reasons = ", ".join(item.value for item in rejections) or "policy violation"
    correction = (
        "\nDo not introduce yourself as an AI assistant or offer generic capabilities. "
        "Answer the user's actual question immediately, without volunteering your identity."
        if Rejection.GENERIC_ASSISTANT_INTRO in rejections
        else ""
    )
    return f"{REPAIR_INSTRUCTION}\nMechanical failure codes: {reasons}.{correction}"


def native_fallback(policy: VoicePolicy, mood: Mood = Mood.NEUTRAL) -> CheckResult | None:
    """Return a native-approved fallback if the pack has one; draft packs fail closed."""
    if not policy.fallback_lines:
        return None
    body = policy.fallback_lines[0]
    sentences = tuple(split_sentences(body))
    if not sentences:
        return None
    return CheckResult(
        Verdict.REPAIRED,
        body,
        (),
        sentences,
        _make_spoken_sentences(sentences, mood, policy),
        mood,
        ("native-fallback",),
    )


def chunk_text(chunk: object) -> str | None:
    if isinstance(chunk, str):
        return chunk
    delta = getattr(chunk, "delta", None)
    content = getattr(delta, "content", None)
    return content if isinstance(content, str) else None


def is_flush(chunk: object) -> bool:
    from livekit.agents import FlushSentinel

    return isinstance(chunk, FlushSentinel)


def was_truncated(chunk: object) -> bool:
    usage = getattr(chunk, "usage", None)
    finish = getattr(usage, "finish_reason", None) or getattr(chunk, "finish_reason", None)
    if isinstance(finish, str) and finish.lower() == "length":
        return True
    max_output = getattr(usage, "max_output_tokens", None) or getattr(usage, "max_tokens", None)
    output = getattr(usage, "output_tokens", None) or getattr(usage, "completion_tokens", None)
    return isinstance(max_output, int) and isinstance(output, int) and output >= max_output


__all__ = [
    "REPAIR_INSTRUCTION",
    "CheckResult",
    "Mood",
    "Rejection",
    "SpokenSentence",
    "Verdict",
    "build_repair_prompt",
    "check_answer",
    "check_sentence",
    "chunk_text",
    "is_flush",
    "native_fallback",
    "parse_mood_line",
    "strip_mood_prefix",
    "was_truncated",
]
