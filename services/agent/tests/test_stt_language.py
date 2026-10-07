"""Sarvam realtime STT is explicitly bound to the immutable session language."""

from __future__ import annotations

import pytest

from miithii_agent.config import load_settings
from miithii_agent.main import build_stt
from miithii_agent.policy import get_policy


def _options(stt: object) -> str:
    return str(getattr(stt, "_opts", stt))


def test_assamese_and_bodo_sessions_get_distinct_bcp47_stt_codes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SARVAM_API_KEY", "key")
    settings = load_settings()
    assamese = _options(build_stt(settings, get_policy("asm")))
    bodo = _options(build_stt(settings, get_policy("brx")))
    assert "as-IN" in assamese
    assert "brx-IN" in bodo
    assert assamese != bodo


def test_stt_uses_fast_codemix_realtime_options(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SARVAM_API_KEY", "key")
    rendered = _options(build_stt(load_settings(), get_policy("asm")))
    assert "fast" in rendered
    assert "codemix" in rendered


def test_removed_process_wide_language_override_cannot_change_a_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SARVAM_API_KEY", "key")
    monkeypatch.setenv("MIITHII_STT_LANGUAGE", "hi-IN")
    rendered = _options(build_stt(load_settings(), get_policy("brx")))
    assert "brx-IN" in rendered
    assert "hi-IN" not in rendered


def test_no_keyword_is_passed_that_the_installed_sarvam_plugin_does_not_accept() -> None:
    """Dead configuration is worse than a known limit, because it looks like a fix.

    The provider kills an idle websocket with a fatal `inactivity_timeout` after 60s of no
    audio, and it is tempting to reach for a parameter that looks like it would tune that. The
    installed 1.8.3 plugin has no such parameter, so passing one raises at session start - or
    worse, gets added commented out and remembered as working.

    The keywords are read from the call site rather than from a hand-kept list, so a parameter
    added later is checked without anyone having to remember to add it here.
    """
    import ast
    import inspect
    from pathlib import Path

    from livekit.plugins.sarvam import STTRealtime

    import miithii_agent.main as main_module

    tree = ast.parse(Path(main_module.__file__).read_text(encoding="utf-8"))
    calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "STTRealtime"
    ]
    assert len(calls) == 1, "expected exactly one STTRealtime construction site"
    passed = {keyword.arg for keyword in calls[0].keywords if keyword.arg is not None}

    accepted = set(inspect.signature(STTRealtime.__init__).parameters)
    accepted.discard("self")

    assert passed, "build_stt stopped configuring the plugin; that is a behaviour change"
    assert passed <= accepted, f"unsupported Sarvam options: {sorted(passed - accepted)}"
