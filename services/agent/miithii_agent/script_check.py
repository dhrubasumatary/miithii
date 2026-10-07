"""Unicode-aware mechanical script checks for language-pack output.

The pack declares letter ranges. Punctuation is neutral by construction: danda is shared Indic
punctuation and must never make an Assamese reply look Devanagari just because U+0964 happens to
sit inside the Devanagari block.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class ScriptSpec:
    name: str
    native_ranges: tuple[tuple[int, int], ...]
    foreign_indic_ranges: tuple[tuple[int, int], ...]
    suspect_letters: tuple[str, ...] = ()


@dataclass(frozen=True)
class ScriptCheck:
    valid: bool
    expected: str
    has_expected_script: bool
    has_unexpected_indic_script: bool
    foreign_matches: tuple[str, ...]
    suspect_matches: tuple[str, ...] = ()
    expected_letters: int = 0
    foreign_indic_letters: int = 0
    latin_letters: int = 0
    total_letters: int = 0

    @property
    def foreign_indic_ratio(self) -> float:
        return self.foreign_indic_letters / self.total_letters if self.total_letters else 0.0

    @property
    def latin_ratio(self) -> float:
        return self.latin_letters / self.total_letters if self.total_letters else 0.0

    def describe(self) -> str:
        if self.valid:
            return "reply script matches the selected language"
        found = " ".join(self.foreign_matches) or "no expected script"
        return f"reply script violates the selected language: {found}"


def _in_ranges(char: str, ranges: tuple[tuple[int, int], ...]) -> bool:
    point = ord(char)
    return any(start <= point <= end for start, end in ranges)


def _is_letter(char: str) -> bool:
    return unicodedata.category(char).startswith("L")


def _is_latin_letter(char: str) -> bool:
    if not _is_letter(char):
        return False
    try:
        return "LATIN" in unicodedata.name(char)
    except ValueError:
        return False


def validate_reply_script(text: str, expected: ScriptSpec) -> ScriptCheck:
    content = text.strip()
    expected_letters = 0
    foreign_letters: list[str] = []
    latin_letters = 0
    total_letters = 0

    for char in content:
        if not _is_letter(char):
            continue
        total_letters += 1
        if _in_ranges(char, expected.native_ranges):
            expected_letters += 1
        elif _in_ranges(char, expected.foreign_indic_ranges):
            foreign_letters.append(char)
        elif _is_latin_letter(char):
            latin_letters += 1

    foreign = tuple(sorted(set(foreign_letters)))
    suspects = tuple(item for item in expected.suspect_letters if item and item in content)
    has_expected = expected_letters > 0
    # A punctuation/number-only string is script-neutral. Any reply containing letters must
    # contain the selected native script; this rejects an all-English answer while still
    # allowing natural English code-mixing around Assamese/Bodo words.
    valid = not foreign and (has_expected or total_letters == 0)
    return ScriptCheck(
        valid=valid,
        expected=expected.name,
        has_expected_script=has_expected,
        has_unexpected_indic_script=bool(foreign),
        foreign_matches=foreign,
        suspect_matches=suspects,
        expected_letters=expected_letters,
        foreign_indic_letters=len(foreign_letters),
        latin_letters=latin_letters,
        total_letters=total_letters,
    )


__all__ = ["ScriptCheck", "ScriptSpec", "validate_reply_script"]
