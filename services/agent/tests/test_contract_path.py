"""The compiled language-pack artifact must resolve both in-repo and in Modal."""

from __future__ import annotations

from pathlib import Path

import pytest

from miithii_agent import policy


def _source_artifact() -> Path:
    return (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "language-packs"
        / "compiled"
        / "language-packs.json"
    )


def test_default_path_finds_the_compiled_pack_in_repo() -> None:
    resolved = policy._default_artifact_path()
    assert resolved.name == "language-packs.json"
    assert resolved.exists()


def test_configured_path_does_not_evaluate_fallback(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    target = tmp_path / "language-packs.json"
    target.write_bytes(_source_artifact().read_bytes())
    monkeypatch.setenv("MIITHII_LANGUAGE_PACKS_PATH", str(target))

    def explode() -> Path:
        raise AssertionError("fallback ran despite configured language-pack path")

    monkeypatch.setattr(policy, "_default_artifact_path", explode)
    assert policy._artifact_path() == target


def test_configured_pack_loads_and_hash_verifies(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    target = tmp_path / "language-packs.json"
    target.write_bytes(_source_artifact().read_bytes())
    monkeypatch.setenv("MIITHII_LANGUAGE_PACKS_PATH", str(target))
    policy.clear_language_caches()
    assert set(policy.load_language_packs()) == {"asm", "brx"}


def test_blank_configuration_uses_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIITHII_LANGUAGE_PACKS_PATH", "   ")
    assert policy._artifact_path().name == "language-packs.json"
