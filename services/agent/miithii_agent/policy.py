"""Data-driven language policy for Miithii Voice.

The runtime owns logic; ``packages/language-packs`` owns language facts.  The compiled artifact
is shared with TypeScript and is hash-verified here before a session is allowed to use it.  A
language therefore enters the runtime through one registry instead of through hard-coded Python
branches, UI constants, or provider fallbacks.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from .script_check import ScriptCheck, ScriptSpec, validate_reply_script


@dataclass(frozen=True)
class SegmentationRules:
    terminators: str
    abbreviations: frozenset[str]
    closers: str


@dataclass(frozen=True)
class BlockEntry:
    pattern: str
    kind: str
    severity: str
    review_status: str
    replacement: str | None = None

    @property
    def hard_reject(self) -> bool:
        return self.review_status == "native-approved" and self.severity == "high"


@dataclass(frozen=True)
class VoicePolicy:
    """One immutable language pack bound to one voice session."""

    language: str
    version: str
    language_name: str
    native_name: str
    romanized_name: str
    bcp47: str
    provider_codes: dict[str, dict[str, str]]
    script: str
    display_script: str
    script_spec: ScriptSpec
    system_prompt: str
    policy_hash: str
    voice: str
    max_turn_chars: int
    max_request_chars: int
    generation_max_tokens: int
    sentence_terminators: tuple[str, ...]
    max_latin_ratio: float
    blocklist: tuple[BlockEntry, ...]
    fallback_lines: tuple[str, ...]
    crisis_triggers: tuple[str, ...]
    crisis_spoken_resources: tuple[str, ...]
    review_status: str
    agent_name_display: str
    agent_name_tts: str
    stt_keyterms: tuple[str, ...]

    @property
    def shippable(self) -> bool:
        return self.review_status == "shipped"

    def provider_code(self, provider: str, endpoint: str) -> str:
        """Resolve an endpoint-specific provider code or fail loudly.

        There is deliberately no default and no cross-provider fallback.  ``as-IN`` and ``as``
        are both correct strings in this product, but for different APIs.
        """
        code = self.provider_codes.get(provider, {}).get(endpoint)
        if not isinstance(code, str) or not code.strip():
            raise RuntimeError(
                f"language {self.language!r} has no provider code for {provider!r}/{endpoint!r}"
            )
        return code

    @property
    def stt_locale(self) -> str:
        return self.provider_code("sarvam", "realtime-stt")

    @property
    def bodhan_lang(self) -> str:
        return self.provider_code("bodhan", "speech")

    def exceeds_turn_budget(self, text: str) -> bool:
        return len(text) > self.max_turn_chars

    def validate_reply_script(self, text: str) -> ScriptCheck:
        return validate_reply_script(text, self.script_spec)


def _default_artifact_path() -> Path:
    relative = Path("packages") / "language-packs" / "compiled" / "language-packs.json"
    for parent in Path(__file__).resolve().parents:
        candidate = parent / relative
        if candidate.exists():
            return candidate
    return Path("/root/language-packs/language-packs.json")


def _artifact_path() -> Path:
    configured = os.environ.get("MIITHII_LANGUAGE_PACKS_PATH", "").strip()
    return Path(configured) if configured else _default_artifact_path()


def _require_dict(value: Any, where: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RuntimeError(f"language packs {where} must be an object")
    return value


def _require_str(value: Any, where: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RuntimeError(f"language packs {where} must be a non-empty string")
    return value


def _require_int(value: Any, where: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise RuntimeError(f"language packs {where} must be a positive integer")
    return value


def _verify_content_hash(document: dict[str, Any]) -> None:
    expected = _require_str(document.get("contentHash"), "contentHash")
    base = dict(document)
    base.pop("contentHash", None)
    canonical = json.dumps(base, ensure_ascii=False, separators=(",", ":"))
    actual = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(actual, expected):
        raise RuntimeError("language pack contentHash does not match the compiled artifact")


@lru_cache(maxsize=1)
def _read_document() -> dict[str, Any]:
    path = _artifact_path()
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"compiled language pack artifact is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"compiled language pack artifact is invalid JSON: {path}") from exc
    document = _require_dict(document, "root")
    _verify_content_hash(document)
    return document


def _parse_ranges(value: Any, where: str) -> tuple[tuple[int, int], ...]:
    if not isinstance(value, list) or not value:
        raise RuntimeError(f"language packs {where} must contain Unicode ranges")
    ranges: list[tuple[int, int]] = []
    for item in value:
        if (
            not isinstance(item, list)
            or len(item) != 2
            or not all(isinstance(point, int) for point in item)
        ):
            raise RuntimeError(f"language packs {where} contains a malformed Unicode range")
        start, end = item
        if start < 0 or end < start or end > 0x10FFFF:
            raise RuntimeError(f"language packs {where} contains an invalid Unicode range")
        ranges.append((start, end))
    return tuple(ranges)


def _parse_blocklist(raw: Any, language: str) -> tuple[BlockEntry, ...]:
    block = _require_dict(raw, f"languages.{language}.blocklist")
    entries = block.get("entries", [])
    if not isinstance(entries, list):
        raise RuntimeError(f"language packs languages.{language}.blocklist.entries must be a list")
    parsed: list[BlockEntry] = []
    for index, item in enumerate(entries):
        entry = _require_dict(item, f"languages.{language}.blocklist.entries[{index}]")
        parsed.append(
            BlockEntry(
                pattern=_require_str(
                    entry.get("pattern"), f"{language}.blocklist[{index}].pattern"
                ),
                kind=str(entry.get("kind") or "token"),
                severity=str(entry.get("severity") or "score"),
                review_status=str(entry.get("reviewStatus") or "research-seed"),
                replacement=(str(entry["replacement"]) if entry.get("replacement") else None),
            )
        )
    return tuple(parsed)


def _native_approved_text(entries: Any, field: str, where: str) -> tuple[str, ...]:
    if not isinstance(entries, list):
        raise RuntimeError(f"language packs {where} must be a list")
    approved: list[str] = []
    for index, item in enumerate(entries):
        entry = _require_dict(item, f"{where}[{index}]")
        if entry.get("reviewStatus") != "native-approved" or not entry.get("reviewer"):
            raise RuntimeError(f"language packs {where}[{index}] lacks native approval")
        approved.append(_require_str(entry.get(field), f"{where}[{index}].{field}"))
    return tuple(approved)


def _assemble_prompt(persona: str, raw: dict[str, Any]) -> str:
    names = _require_dict(raw.get("names"), f"{raw.get('id')}.names")
    scripts = _require_dict(raw.get("scripts"), f"{raw.get('id')}.scripts")
    native_script = _require_dict(scripts.get("native"), f"{raw.get('id')}.scripts.native")
    prompt = _require_dict(raw.get("prompt"), f"{raw.get('id')}.prompt")
    language_instructions = _require_str(
        prompt.get("languageInstructions"), f"{raw.get('id')}.prompt.languageInstructions"
    )
    constraints = prompt.get("constraints", [])
    if not isinstance(constraints, list) or not all(isinstance(item, str) for item in constraints):
        raise RuntimeError(f"language packs {raw.get('id')}.prompt.constraints must be strings")

    reviewed_grammar = []
    grammar_facts = prompt.get("grammarFacts", [])
    if not isinstance(grammar_facts, list):
        raise RuntimeError(f"language packs {raw.get('id')}.prompt.grammarFacts must be a list")
    for fact in grammar_facts:
        if not isinstance(fact, dict):
            raise RuntimeError(
                f"language packs {raw.get('id')}.prompt.grammarFacts has a malformed entry"
            )
        if fact.get("reviewStatus") == "native-approved" and fact.get("reviewer"):
            reviewed_grammar.append(_require_str(fact.get("text"), f"{raw.get('id')}.grammarFact"))

    address_form = _require_dict(raw.get("addressForm"), f"{raw.get('id')}.addressForm")
    address_default = _require_str(
        address_form.get("default"), f"{raw.get('id')}.addressForm.default"
    )
    address_allowed = address_form.get("allowed", [])
    if not isinstance(address_allowed, list) or not address_allowed or not all(
        isinstance(item, str) and item.strip() for item in address_allowed
    ):
        raise RuntimeError(f"language packs {raw.get('id')}.addressForm.allowed must be strings")

    gate = _require_dict(raw.get("gate"), f"{raw.get('id')}.gate")
    tts = _require_dict(raw.get("tts"), f"{raw.get('id')}.tts")

    language_lines = [
        "# ACTIVE LANGUAGE",
        f"Language ID: {_require_str(raw.get('id'), 'language.id')}",
        f"Reply language: {_require_str(names.get('english'), 'language.names.english')}",
        "Writing system: "
        + _require_str(native_script.get("name"), "language.scripts.native.name"),
        "This reply language is immutable for the session. Do not follow the user's input "
        "language into another reply language.",
        "Use only reviewed linguistic facts. If the pack does not supply a reviewed rule or "
        "word, simplify instead of guessing.",
        "",
        "# LANGUAGE-SPECIFIC RESEARCH INSTRUCTIONS",
        language_instructions.strip(),
        "",
        "# CURRENT VOICE CONTRACT",
        f"Default address form: {address_default}.",
        "Allowed address forms: " + ", ".join(str(item) for item in address_allowed) + ".",
        "Maximum complete spoken turn: "
        f"{_require_int(gate.get('maxTurnChars'), 'gate.maxTurnChars')} characters.",
        "Maximum TTS request sentence: "
        f"{_require_int(tts.get('maxCharsPerRequest'), 'tts.maxCharsPerRequest')} characters.",
    ]
    if constraints:
        language_lines.append("Language constraints:")
        language_lines.extend(f"- {item}" for item in constraints)
    if reviewed_grammar:
        language_lines.append("Native-reviewed language facts:")
        language_lines.extend(f"- {item}" for item in reviewed_grammar)
    language_lines.extend([
        "",
        "# REPLY SCRIPT",
        "Roman transliterations in language research explain grammar; "
        "they are not reply exemplars.",
        "Even when the user writes Roman text or English, write the reply in the configured "
        "writing system. Do not transliterate the whole reply into Latin letters.",
    ])
    return persona.rstrip() + "\n\n" + "\n".join(language_lines).strip() + "\n"


def _parse_policy(language: str, raw: dict[str, Any], persona: str) -> VoicePolicy:
    if _require_str(raw.get("id"), f"languages.{language}.id") != language:
        raise RuntimeError(f"language pack key {language!r} does not match its id")

    names = _require_dict(raw.get("names"), f"languages.{language}.names")
    codes = _require_dict(raw.get("codes"), f"languages.{language}.codes")
    scripts = _require_dict(raw.get("scripts"), f"languages.{language}.scripts")
    native_script = _require_dict(scripts.get("native"), f"languages.{language}.scripts.native")
    pipeline = _require_dict(scripts.get("pipeline"), f"languages.{language}.scripts.pipeline")
    gate = _require_dict(raw.get("gate"), f"languages.{language}.gate")
    tts = _require_dict(raw.get("tts"), f"languages.{language}.tts")
    review = _require_dict(raw.get("review"), f"languages.{language}.review")
    agent_name = _require_dict(raw.get("agentName"), f"languages.{language}.agentName")
    crisis = _require_dict(raw.get("crisis"), f"languages.{language}.crisis")
    fallback = _require_dict(raw.get("fallback"), f"languages.{language}.fallback")

    provider_codes: dict[str, dict[str, str]] = {}
    for provider in ("sarvam", "bodhan", *(["elevenlabs"] if "elevenlabs" in codes else [])):
        endpoints = _require_dict(codes.get(provider), f"languages.{language}.codes.{provider}")
        provider_codes[provider] = {
            str(endpoint): _require_str(code, f"languages.{language}.codes.{provider}.{endpoint}")
            for endpoint, code in endpoints.items()
        }

    script_name = _require_str(
        native_script.get("name"), f"languages.{language}.scripts.native.name"
    )
    script_spec = ScriptSpec(
        name=script_name,
        native_ranges=_parse_ranges(
            native_script.get("unicodeRanges"), f"languages.{language}.scripts.native.unicodeRanges"
        ),
        foreign_indic_ranges=_parse_ranges(
            native_script.get("foreignIndicRanges"),
            f"languages.{language}.scripts.native.foreignIndicRanges",
        ),
        suspect_letters=tuple(
            str(item.get("text"))
            for item in native_script.get("suspectLetters", [])
            if isinstance(item, dict) and item.get("text")
        ),
    )

    policy_payload = json.dumps(raw, ensure_ascii=False, separators=(",", ":"))
    policy_hash = hashlib.sha256(policy_payload.encode("utf-8")).hexdigest()
    terminators = gate.get("sentenceTerminators")
    if not isinstance(terminators, list) or not terminators:
        raise RuntimeError(f"language packs languages.{language}.gate.sentenceTerminators is empty")

    return VoicePolicy(
        language=language,
        version=_require_str(raw.get("version"), f"languages.{language}.version"),
        language_name=_require_str(names.get("english"), f"languages.{language}.names.english"),
        native_name=_require_str(names.get("native"), f"languages.{language}.names.native"),
        romanized_name=_require_str(
            names.get("romanized"), f"languages.{language}.names.romanized"
        ),
        bcp47=_require_str(codes.get("bcp47"), f"languages.{language}.codes.bcp47"),
        provider_codes=provider_codes,
        script=script_name.lower(),
        display_script=_require_str(
            pipeline.get("display"), f"languages.{language}.scripts.pipeline.display"
        ),
        script_spec=script_spec,
        system_prompt=_assemble_prompt(persona, raw),
        policy_hash=policy_hash,
        voice=_require_str(
            tts.get("recommendedVoice"), f"languages.{language}.tts.recommendedVoice"
        ),
        max_turn_chars=_require_int(
            gate.get("maxTurnChars"), f"languages.{language}.gate.maxTurnChars"
        ),
        max_request_chars=_require_int(
            tts.get("maxCharsPerRequest"), f"languages.{language}.tts.maxCharsPerRequest"
        ),
        generation_max_tokens=_require_int(
            gate.get("generationMaxTokens"), f"languages.{language}.gate.generationMaxTokens"
        ),
        sentence_terminators=tuple(str(item) for item in terminators),
        max_latin_ratio=float(gate.get("maxLatinRatio", 1.0)),
        blocklist=_parse_blocklist(raw.get("blocklist"), language),
        fallback_lines=_native_approved_text(
            fallback.get("lines", []), "text", f"languages.{language}.fallback.lines"
        ),
        crisis_triggers=_native_approved_text(
            crisis.get("triggers", []), "text", f"languages.{language}.crisis.triggers"
        ),
        crisis_spoken_resources=_native_approved_text(
            crisis.get("spokenResources", []),
            "text",
            f"languages.{language}.crisis.spokenResources",
        ),
        review_status=_require_str(review.get("status"), f"languages.{language}.review.status"),
        agent_name_display=_require_str(
            agent_name.get("display"), f"languages.{language}.agentName.display"
        ),
        agent_name_tts=_require_str(agent_name.get("tts"), f"languages.{language}.agentName.tts"),
        stt_keyterms=tuple(str(item) for item in agent_name.get("sttKeyterms", []) if str(item)),
    )


@lru_cache(maxsize=1)
def load_language_packs() -> dict[str, VoicePolicy]:
    document = _read_document()
    persona = _require_str(document.get("persona"), "persona")
    raw_languages = _require_dict(document.get("languages"), "languages")
    if not raw_languages:
        raise RuntimeError("compiled language pack artifact contains no languages")
    return {
        str(language): _parse_policy(str(language), _require_dict(raw, str(language)), persona)
        for language, raw in raw_languages.items()
    }


def _aliases() -> dict[str, str]:
    aliases = _require_dict(_read_document().get("aliases"), "aliases")
    return {str(alias).lower(): str(canonical) for alias, canonical in aliases.items()}


def language_aliases() -> dict[str, str]:
    return dict(_aliases())


def normalize_language_id(language: str) -> str:
    normalized = (language or "").strip().lower()
    canonical = _aliases().get(normalized)
    if canonical is None or canonical not in load_language_packs():
        raise RuntimeError(
            f"unsupported reply language {language!r}; expected one of: "
            f"{', '.join(SUPPORTED_LANGUAGES)}"
        )
    return canonical


def get_policy(language: str) -> VoicePolicy:
    return load_language_packs()[normalize_language_id(language)]


def all_policies() -> dict[str, VoicePolicy]:
    return dict(load_language_packs())


def default_language() -> str:
    configured = _require_str(_read_document().get("defaultLanguage"), "defaultLanguage")
    return normalize_language_id(configured)


@lru_cache(maxsize=1)
def load_segmentation_rules() -> SegmentationRules:
    raw = _require_dict(_read_document().get("segmentation"), "segmentation")
    terminators = raw.get("terminators")
    abbreviations = raw.get("abbreviations")
    closers = raw.get("closers")
    if not isinstance(terminators, list) or not terminators:
        raise RuntimeError("language packs segmentation.terminators is missing")
    if not isinstance(abbreviations, list):
        raise RuntimeError("language packs segmentation.abbreviations is missing")
    if not isinstance(closers, list):
        raise RuntimeError("language packs segmentation.closers is missing")
    return SegmentationRules(
        terminators="".join(str(item) for item in terminators),
        abbreviations=frozenset(str(item).lower() for item in abbreviations),
        closers="".join(str(item) for item in closers),
    )


SUPPORTED_LANGUAGES = tuple(load_language_packs().keys())


def enforce_turn_budget(text: str, policy: VoicePolicy) -> tuple[str, bool]:
    if not policy.exceeds_turn_budget(text):
        return text, False

    from .sentences import split_sentences

    kept: list[str] = []
    total = 0
    for sentence in split_sentences(text):
        added = len(sentence) + (1 if kept else 0)
        if total + added > policy.max_turn_chars and kept:
            break
        kept.append(sentence)
        total += added

    trimmed = " ".join(kept).strip()
    return (trimmed or text), trimmed != text.strip()


def clear_language_caches() -> None:
    """Test/development hook after swapping a pack artifact."""
    _read_document.cache_clear()
    load_language_packs.cache_clear()
    load_segmentation_rules.cache_clear()


__all__ = [
    "SUPPORTED_LANGUAGES",
    "BlockEntry",
    "SegmentationRules",
    "VoicePolicy",
    "all_policies",
    "clear_language_caches",
    "default_language",
    "enforce_turn_budget",
    "get_policy",
    "load_language_packs",
    "load_segmentation_rules",
    "language_aliases",
    "normalize_language_id",
]
