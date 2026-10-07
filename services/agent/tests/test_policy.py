"""The compiled language-pack contract as the Python agent consumes it."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from miithii_agent.policy import (
    SUPPORTED_LANGUAGES,
    clear_language_caches,
    default_language,
    get_policy,
    load_language_packs,
    normalize_language_id,
)


def test_registry_uses_canonical_iso_639_3_ids() -> None:
    assert SUPPORTED_LANGUAGES == ("asm", "brx")
    assert default_language() == "asm"
    assert normalize_language_id("as") == "asm"
    assert normalize_language_id(" ASM ") == "asm"


def test_provider_codes_are_endpoint_specific() -> None:
    assamese = get_policy("asm")
    bodo = get_policy("brx")
    assert assamese.provider_code("sarvam", "realtime-stt") == "as-IN"
    assert assamese.provider_code("bodhan", "speech") == "as"
    assert bodo.provider_code("sarvam", "realtime-stt") == "brx-IN"
    assert bodo.provider_code("bodhan", "speech") == "brx"
    with pytest.raises(RuntimeError, match="no provider code"):
        assamese.provider_code("sarvam", "batch-stt")


def test_language_specific_voice_and_budget_are_isolated() -> None:
    assamese = get_policy("asm")
    bodo = get_policy("brx")
    assert assamese.voice == "Prastuti"
    assert bodo.voice == "Gwrbw"
    assert assamese.max_turn_chars == 360
    assert bodo.max_turn_chars == 180
    assert assamese.generation_max_tokens == 512
    assert bodo.generation_max_tokens == 4096
    assert assamese.policy_hash != bodo.policy_hash


def test_prompts_share_persona_but_bind_one_reply_language() -> None:
    assamese = get_policy("asm")
    bodo = get_policy("brx")
    assert "You are Miithii" in assamese.system_prompt
    assert "You are Miithii" in bodo.system_prompt
    assert "Reply language: Assamese" in assamese.system_prompt
    assert "Reply language: Bodo" in bodo.system_prompt
    assert "Maintain person and address-level agreement in finite verbs." in assamese.system_prompt
    assert "NUMERALS AND CLASSIFIERS" not in assamese.system_prompt
    assert "NUMERALS AND CLASSIFIERS" in bodo.system_prompt
    assert "moi/mur/muk for I/my/me" not in bodo.system_prompt
    assert "Default address form: toi." in assamese.system_prompt
    assert assamese.system_prompt != bodo.system_prompt


def test_language_research_cannot_override_shared_identity_behavior() -> None:
    for language in ("asm", "brx"):
        prompt = get_policy(language).system_prompt
        assert 'A name question or an ordinary "who are you?" calls for your name' in prompt
        assert "should identify MIITHII as an AI companion" not in prompt
        assert "answer that question truthfully" in prompt
        assert "they are not reply exemplars" in prompt
        assert "Do not transliterate the whole reply into Latin letters" in prompt


def test_migrated_language_research_has_explicit_provenance() -> None:
    artifact = (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "language-packs"
        / "compiled"
        / "language-packs.json"
    )
    document = json.loads(artifact.read_text(encoding="utf-8"))
    for language, source_path in {
        "asm": "packages/language-core/src/profiles/assamese.ts",
        "brx": "packages/language-core/src/profiles/bodo.ts",
    }.items():
        source = document["languages"][language]["provenance"]["languageInstructions"]
        assert source == {
            "source": "historical-language-core",
            "sourceCommit": "88bc15a3aa9ae5e3f33b8cf979333adcdcc1d544",
            "sourcePath": source_path,
            "reviewStatus": "native-approved",
            "reviewer": "project-owner",
        }


def test_unreviewed_native_content_does_not_enter_runtime() -> None:
    for policy in load_language_packs().values():
        assert policy.review_status == "draft"
        assert policy.fallback_lines == ()
        assert policy.crisis_triggers == ()
        assert policy.crisis_spoken_resources == ()


def test_unknown_language_is_rejected_without_defaulting() -> None:
    with pytest.raises(RuntimeError, match="unsupported reply language"):
        get_policy("hi")


def test_runtime_rejects_a_tampered_compiled_artifact(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "language-packs"
        / "compiled"
        / "language-packs.json"
    )
    document = json.loads(source.read_text(encoding="utf-8"))
    document["languages"]["asm"]["version"] = "tampered"
    target = tmp_path / "language-packs.json"
    target.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setenv("MIITHII_LANGUAGE_PACKS_PATH", str(target))
    clear_language_caches()
    with pytest.raises(RuntimeError, match="contentHash"):
        load_language_packs()
