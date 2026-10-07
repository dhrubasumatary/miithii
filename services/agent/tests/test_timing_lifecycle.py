"""Retired turns cannot acquire late provider or playback measurements."""

import asyncio
from types import SimpleNamespace

import pytest

from miithii_agent import main as agent_main
from miithii_agent.main import MiithiiAgent
from miithii_agent.timing import TurnTimings
from miithii_agent.tts_bodhan import BodhanTiming
from miithii_agent.turns import TurnRegistry


@pytest.mark.parametrize("boundary", ["interruption", "session_retired"])
def test_retired_turn_ignores_late_provider_and_playback_callbacks(boundary: str) -> None:
    agent = MiithiiAgent.__new__(MiithiiAgent)
    agent._turns = TurnRegistry()
    turn_id = agent._turns.begin_turn()
    agent._timing = TurnTimings(_start=100.0)
    agent._timing.mark_at("turn_committed", 100.0)
    agent._turn_open = True
    agent._policy = SimpleNamespace(language="asm")

    if boundary == "interruption":
        agent._on_user_interrupted()
    else:
        agent.retire_session()

    agent._on_tts_timing(
        BodhanTiming(
            request_started_at=101.0,
            response_headers_at=102.0,
            body_complete_at=103.0,
            audio_ready_at=104.0,
            provider_emitted_at=105.0,
            audio_seconds=1.0,
        )
    )
    agent._on_agent_state_changed(SimpleNamespace(new_state="speaking"))

    assert not agent._turns.may_deliver(turn_id)
    assert not agent._turn_open
    assert agent._timing.as_dict() == {"turn_committed": 0.0}


@pytest.mark.parametrize("boundary", ["close", "start_failure", "cancellation"])
def test_entrypoint_retires_work_at_real_session_boundaries(
    monkeypatch: pytest.MonkeyPatch, boundary: str
) -> None:
    agent = MiithiiAgent.__new__(MiithiiAgent)
    agent._turns = TurnRegistry()
    turn_id = agent._turns.begin_turn()
    agent._turn_open = True
    policy = SimpleNamespace(language="asm", version="draft", stt_locale="as-IN")
    settings = SimpleNamespace(
        llm=SimpleNamespace(provider="test", model="test", reasoning_effort=None),
        min_endpointing_delay=0.6,
        max_endpointing_delay=2.5,
    )

    class Session:
        closed = False
        def __init__(self, **_kwargs: object) -> None:
            self.handlers: dict[str, object] = {}

        def on(self, event: str, handler: object) -> None:
            from typing import get_args

            from livekit.agents.voice.events import EventTypes

            assert event in get_args(EventTypes), f"unsupported SDK event: {event}"
            self.handlers[event] = handler

        async def start(self, **_kwargs: object) -> None:
            if boundary == "start_failure":
                raise RuntimeError("start failed")
            if boundary == "cancellation":
                raise asyncio.CancelledError()
            self.handlers["close"](None)  # type: ignore[operator]
            assert not agent._turns.may_deliver(turn_id)

        async def aclose(self) -> None:
            assert not agent._turns.may_deliver(turn_id)
            Session.closed = True

    monkeypatch.setattr(agent_main, "load_settings", lambda: settings)
    monkeypatch.setattr(agent_main, "get_policy", lambda _language: policy)
    monkeypatch.setattr(agent_main, "MiithiiAgent", lambda *_a, **_k: agent)
    monkeypatch.setattr(agent_main, "AgentSession", Session)
    monkeypatch.setattr(agent_main, "build_stt", lambda *_a: None)
    monkeypatch.setattr(agent_main, "vad_for", lambda *_a: None)
    monkeypatch.setattr(agent_main, "build_llm", lambda *_a: None)
    monkeypatch.setattr(agent_main, "_shared_http_session", lambda: None)
    monkeypatch.setattr(
        agent_main,
        "build_voice_tts",
        lambda *_a, **_k: (
            None,
            SimpleNamespace(tier="standard", provider="test", model="test", voice="test"),
        ),
    )
    ctx = SimpleNamespace(
        room=SimpleNamespace(name="miithii-asm-standard-test"),
        job=SimpleNamespace(id="job-test"),
        proc=None,
    )
    if boundary == "close":
        asyncio.run(agent_main.entrypoint(ctx))
    elif boundary == "start_failure":
        with pytest.raises(RuntimeError, match="start failed"):
            asyncio.run(agent_main.entrypoint(ctx))
    else:
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(agent_main.entrypoint(ctx))
    assert not agent._turns.may_deliver(turn_id)
    assert not agent._turn_open
    assert Session.closed
