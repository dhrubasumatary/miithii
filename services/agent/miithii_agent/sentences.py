"""Sentence boundaries shared by the language packs, agent TTS, and mobile display."""

from __future__ import annotations

import re

from livekit.agents.tokenize import BufferedSentenceStream, SentenceStream, SentenceTokenizer

from .policy import SegmentationRules, load_segmentation_rules

MIN_TOKEN_LEN = 12
MIN_CTX_LEN = 16

_DECIMAL = re.compile(r"\d+[.,]\d+")
_URL = re.compile(r"\bhttps?://\S+|\b[\w-]+(?:\.[\w-]+)+/\S*")
_TRAILING_WORD = re.compile(r"([A-Za-z][A-Za-z.]*)$")
_PLACEHOLDER = "\x00"


def _ends_with_abbreviation(head: str, rules: SegmentationRules) -> bool:
    match = _TRAILING_WORD.search(head.rstrip())
    if match is None:
        return False
    return match.group(1).lower().rstrip(".") in rules.abbreviations


def split_sentences_with(text: str, rules: SegmentationRules) -> list[str]:
    if not text.strip():
        return []

    hidden: list[str] = []
    protected = text
    for pattern in (_DECIMAL, _URL):

        def _hide(match: re.Match[str], _hidden: list[str] = hidden) -> str:
            _hidden.append(match.group(0))
            return f"{_PLACEHOLDER}{len(_hidden) - 1}{_PLACEHOLDER}"

        protected = pattern.sub(_hide, protected)

    sentences: list[str] = []
    start = 0
    for index, char in enumerate(protected):
        if char not in rules.terminators:
            continue

        end = index + 1
        while end < len(protected) and protected[end] in rules.closers:
            end += 1
        if char in ".!?" and _ends_with_abbreviation(protected[:index], rules):
            continue
        remainder = protected[end:]
        if remainder and not remainder[0].isspace():
            continue

        candidate = protected[start:end].strip()
        if candidate:
            sentences.append(candidate)
        start = end

    tail = protected[start:].strip()
    if tail:
        sentences.append(tail)

    placeholder = re.escape(_PLACEHOLDER)
    restore = re.compile(f"{placeholder}(\\d+){placeholder}")
    return [
        restore.sub(lambda match: hidden[int(match.group(1))], sentence)
        for sentence in sentences
    ]


def split_sentences(text: str) -> list[str]:
    return split_sentences_with(text, load_segmentation_rules())


def _sentence_is_complete(sentence: str, rules: SegmentationRules) -> bool:
    candidate = sentence.rstrip()
    while candidate and candidate[-1] in rules.closers:
        candidate = candidate[:-1].rstrip()
    return bool(candidate and candidate[-1] in rules.terminators)


def take_complete_sentences(text: str) -> tuple[list[str], str]:
    """Return complete sentences plus the still-streaming tail.

    ``split_sentences`` intentionally treats an unterminated tail as a sentence for static
    display. The realtime gate cannot do that: sending the tail to TTS would make a token-limit
    cutoff audible. This helper is the streaming counterpart and withholds the tail until its
    terminator arrives.
    """
    rules = load_segmentation_rules()
    parts = split_sentences_with(text, rules)
    if not parts:
        return [], text
    if _sentence_is_complete(parts[-1], rules):
        return parts, ""
    return parts[:-1], parts[-1]


class MiithiiSentenceTokenizer(SentenceTokenizer):
    def tokenize(self, text: str, *, language: str | None = None) -> list[str]:
        del language
        return split_sentences(text)

    def stream(self, *, language: str | None = None) -> SentenceStream:
        del language
        return BufferedSentenceStream(
            tokenizer=split_sentences,
            min_token_len=MIN_TOKEN_LEN,
            min_ctx_len=MIN_CTX_LEN,
        )


__all__ = [
    "MiithiiSentenceTokenizer",
    "split_sentences",
    "split_sentences_with",
    "take_complete_sentences",
]
