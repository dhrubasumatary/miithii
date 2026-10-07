from __future__ import annotations

import pytest

from miithii_agent.config import load_settings
from miithii_agent.policy import get_policy
from miithii_agent.voice_tts import build_voice_tts, tts_route


def test_elevenlabs_assamese_route_cannot_reach_bodo(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIITHII_ASSAMESE_TTS", "elevenlabs")
    monkeypatch.setenv("ELEVEN_API_KEY", "test-key")
    monkeypatch.setenv("MIITHII_ELEVEN_AS_VOICE_ID", "assamese-only")
    settings = load_settings()
    asm = tts_route(settings, get_policy("asm"), "standard")
    brx = tts_route(settings, get_policy("brx"), "standard")
    assert (asm.provider, asm.voice) == ("elevenlabs", "assamese-only")
    assert (brx.provider, brx.voice) == ("bodhan", get_policy("brx").voice)
    assert not settings.elevenlabs.ready_for("brx")


def test_enabled_assamese_route_fails_closed_without_voice(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIITHII_ASSAMESE_TTS", "elevenlabs")
    monkeypatch.setenv("ELEVEN_API_KEY", "test-key")
    monkeypatch.delenv("MIITHII_ELEVEN_AS_VOICE_ID", raising=False)
    with pytest.raises(RuntimeError, match="not ready"):
        tts_route(load_settings(), get_policy("asm"), "standard")


def test_standard_routes_to_bodhan_with_the_language_voice(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BODHAN_API_KEY", "test-key")
    settings = load_settings()

    route = tts_route(settings, get_policy("asm"), "standard")

    assert route.tier == "standard"
    assert route.provider == "bodhan"
    assert route.model == settings.bodhan.model
    # The voice comes from the language policy, never from the environment, so two
    # concurrent sessions in different languages cannot share a voice.
    assert route.voice == get_policy("asm").voice


def test_a_retired_tier_gets_no_route(monkeypatch: pytest.MonkeyPatch) -> None:
    """The router refuses rather than answering a retired tier with a Standard route.

    `tts_route` is reachable directly, not only through a validated room name, so it has to
    hold the same line. Returning a Standard route for a Premium request would hand the
    session a voice nobody asked for and log it as a Premium route.
    """
    monkeypatch.setenv("BODHAN_API_KEY", "test-key")
    settings = load_settings()

    with pytest.raises(RuntimeError, match="no TTS route for voice tier"):
        tts_route(settings, get_policy("asm"), "premium")  # type: ignore[arg-type]

    with pytest.raises(RuntimeError, match="no TTS route for voice tier"):
        build_voice_tts(settings, get_policy("asm"), "premium", http_session=None)  # type: ignore[arg-type]


@pytest.mark.parametrize("language", ["asm", "brx"])
def test_both_languages_build_a_standard_provider(
    monkeypatch: pytest.MonkeyPatch, language: str
) -> None:
    monkeypatch.setenv("BODHAN_API_KEY", "test-key")
    settings = load_settings()

    provider, route = build_voice_tts(settings, get_policy(language), "standard", http_session=None)

    assert route.provider == "bodhan"
    assert provider is not None


def test_settings_load_without_any_premium_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    """Loading settings must not require a Premium credential.

    It did before the tier was retired, which meant a Standard-only deployment could not start
    a session without secrets for a provider no tier routes to.
    """
    for name in (
        "ELEVEN_API_KEY",
        "ELEVENLABS_API_KEY",
        "MIITHII_ELEVEN_AS_VOICE_ID",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = load_settings()

    assert settings.elevenlabs.ready_for("asm") is False
    assert settings.elevenlabs.ready_for("brx") is False


def test_a_retired_voice_route_cannot_be_asked_for_a_voice_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in ("ELEVEN_API_KEY", "MIITHII_ELEVEN_AS_VOICE_ID"):
        monkeypatch.delenv(name, raising=False)

    settings = load_settings()

    with pytest.raises(RuntimeError, match="retired"):
        settings.elevenlabs.voice_for("asm")
