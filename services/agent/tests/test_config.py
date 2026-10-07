"""Configuration parsing and fail-fast behaviour.

A missing or malformed credential must fail at startup, not mid-turn while a user waits on
audio.
"""

from __future__ import annotations

import pytest

from miithii_agent.config import (
    DEFAULT_BODHAN_BASE_URL,
    load_settings,
    require_ready,
)

ALL_KEYS = (
    "SARVAM_API_KEY",
    "BODHAN_API_KEY",
    "GOOGLE_API_KEY",
    "AIMLAPI_API_KEY",
    "MIITHII_LLM_PROVIDER",
    "MIITHII_LLM_MODEL",
    "BODHAN_BASE_URL",
    "BODHAN_MAX_RESPONSE_BYTES",
    "SARVAM_MIN_SILENCE_MS",
)


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ALL_KEYS:
        monkeypatch.delenv(key, raising=False)


def test_defaults_when_nothing_is_configured() -> None:
    settings = load_settings()
    assert settings.ready is False
    assert settings.bodhan.base_url == DEFAULT_BODHAN_BASE_URL


def test_ready_when_every_leg_has_a_credential(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SARVAM_API_KEY", "s")
    monkeypatch.setenv("BODHAN_API_KEY", "b")
    monkeypatch.setenv("AIMLAPI_API_KEY", "a")
    settings = require_ready()
    assert settings.ready is True
    assert settings.llm.provider == "aiml"
    assert settings.llm.model == "google/gemini-2.5-flash"


def test_require_ready_names_the_missing_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SARVAM_API_KEY", "s")
    with pytest.raises(RuntimeError) as excinfo:
        require_ready()
    message = str(excinfo.value)
    assert "BODHAN_API_KEY" in message
    assert "AIMLAPI_API_KEY" in message


def test_aiml_provider_requires_the_aiml_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SARVAM_API_KEY", "s")
    monkeypatch.setenv("BODHAN_API_KEY", "b")
    monkeypatch.setenv("MIITHII_LLM_PROVIDER", "aiml")
    monkeypatch.setenv("AIMLAPI_API_KEY", "a")
    settings = require_ready()
    assert settings.llm.provider == "aiml"
    assert settings.llm.enabled is True


def test_aiml_provider_ignores_a_google_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """A Google key must not be accepted when the AIMLAPI route is selected."""
    monkeypatch.setenv("SARVAM_API_KEY", "s")
    monkeypatch.setenv("BODHAN_API_KEY", "b")
    monkeypatch.setenv("MIITHII_LLM_PROVIDER", "aiml")
    monkeypatch.setenv("GOOGLE_API_KEY", "g")
    settings = load_settings()
    assert settings.llm.enabled is False


def test_unknown_provider_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIITHII_LLM_PROVIDER", "anthropic")
    with pytest.raises(RuntimeError, match="MIITHII_LLM_PROVIDER"):
        load_settings()


def test_language_is_not_process_wide_configuration() -> None:
    settings = load_settings()
    assert not hasattr(settings, "stt_language")
    assert not hasattr(settings, "reply_language")


def test_numeric_settings_are_parsed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BODHAN_MAX_RESPONSE_BYTES", "2048")
    monkeypatch.setenv("SARVAM_MIN_SILENCE_MS", "900")
    settings = load_settings()
    assert settings.bodhan.max_response_bytes == 2048
    assert settings.sarvam.min_silence_ms == 900


def test_invalid_number_fails_loudly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BODHAN_MAX_RESPONSE_BYTES", "lots")
    with pytest.raises(RuntimeError, match="BODHAN_MAX_RESPONSE_BYTES"):
        load_settings()


def test_speech_url_is_built_from_the_base() -> None:
    settings = load_settings()
    assert settings.bodhan.speech_url == "https://api.bodhan.ai/v1/audio/speech"


def test_blank_values_fall_back_to_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BODHAN_BASE_URL", "")
    settings = load_settings()
    assert settings.bodhan.base_url == DEFAULT_BODHAN_BASE_URL


def test_custom_bodhan_base_url_is_respected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BODHAN_BASE_URL", "https://proxy.internal/v1/")
    settings = load_settings()
    assert settings.bodhan.speech_url == "https://proxy.internal/v1/audio/speech"
