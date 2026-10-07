"""The real LiveKit llm_node gates text before preview and speech."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

import pytest
from livekit.agents.voice.speech_handle import SpeechHandle

from miithii_agent import main as agent_main
from miithii_agent.main import MiithiiAgent
from miithii_agent.policy import get_policy

MODEL_ASSAMESE = "@mood: neutral\nঅসমীয়া।"
CANONICAL_ASSAMESE = "অসমীয়া।"


@dataclass
class StubChunk:
    content: str
    finish_reason: str | None = None
    delta: Any = None
    usage: Any = None

    def __post_init__(self) -> None:
        if self.delta is None:
            self.delta = type("Delta", (), {"content": self.content})()


@dataclass
class ScriptedLLM:
    answers: list[list[StubChunk]]
    calls: int = 0
    repair_answer: list[StubChunk] = field(default_factory=list)

    def __call__(self) -> AsyncIterator[StubChunk]:
        index = self.calls
        self.calls += 1
        chunks = self.answers[index] if index < len(self.answers) else self.repair_answer

        async def stream() -> AsyncIterator[StubChunk]:
            for chunk in chunks:
                yield chunk

        return stream()


class StubPublisher:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str, int]] = []
        self.shortened = False

    async def publish(
        self, turn_id: Any, kind: Any, text: str, revision: int = 0, *, shortened: bool = False,
    ) -> bool:
        if kind.value == "end":
            self.shortened = shortened
        self.messages.append((kind.value, text, revision))
        return True

    async def publish_verdict(self, turn_id: Any, result: Any) -> bool:
        from miithii_agent.preview import PreviewKind

        reason = "" if result.speakable else ",".join(item.value for item in result.rejections)
        return await self.publish(turn_id, PreviewKind.VERDICT, reason)

    def texts(self, kind: str) -> list[str]:
        return [text for name, text, _ in self.messages if name == kind]


@dataclass
class StubChatContext:
    added: list[str] = field(default_factory=list)

    def copy(self) -> StubChatContext:
        return StubChatContext(self.added)

    def add_message(self, *, role: str, content: str) -> None:
        del role
        self.added.append(content)


def build_agent(scripted: ScriptedLLM, publisher: StubPublisher) -> MiithiiAgent:
    agent = MiithiiAgent.__new__(MiithiiAgent)
    agent._activity = None
    agent._policy = get_policy("asm")
    agent._voice_tier = "standard"
    agent._turns = agent_main.TurnRegistry()
    agent._preview = publisher
    agent._timing = agent_main.TurnTimings()
    agent._turn_open = False
    agent._instructions = agent._policy.system_prompt
    agent._tools = []

    def fake_llm_node(_self: Any, _ctx: Any, _tools: Any, _settings: Any) -> Any:
        return scripted()

    agent_main.Agent.default.llm_node = staticmethod(fake_llm_node)  # type: ignore[attr-defined]
    return agent


def test_sdk_interruption_retires_captured_turn_without_cancelling_newer_turn(
    restore_default_llm_node: Any,
) -> None:
    async def run() -> None:
        publisher = StubPublisher()
        agent = build_agent(ScriptedLLM(answers=[[StubChunk(MODEL_ASSAMESE)]]), publisher)
        speech = SpeechHandle.create()
        agent._activity = SimpleNamespace(session=SimpleNamespace(current_speech=speech))
        stream = await agent.llm_node(StubChatContext(), [], None)
        retired = agent.turns.current
        speech.interrupt()
        assert [item async for item in stream] == []
        assert not agent.turns.may_deliver(retired)
        assert publisher.texts("delta") == []
        newer = agent.turns.begin_turn()
        agent._turn_open = True
        # Real SDK completion callbacks run after generation has stopped; delay it
        # until a new turn exists to reproduce the stale-callback failure mode.
        speech._mark_done()
        await asyncio.sleep(0)
        assert agent.turns.may_deliver(newer)
        assert agent._turn_open

    asyncio.run(run())


def test_generator_close_retires_partially_generated_turn(
    restore_default_llm_node: Any,
) -> None:
    async def run() -> None:
        agent = build_agent(ScriptedLLM(answers=[[StubChunk(MODEL_ASSAMESE)]]), StubPublisher())
        stream = await agent.llm_node(StubChatContext(), [], None)
        turn = agent.turns.current
        assert await anext(stream) == CANONICAL_ASSAMESE
        await stream.aclose()
        assert not agent.turns.may_deliver(turn)

    asyncio.run(run())


@pytest.fixture
def restore_default_llm_node() -> Any:
    original = agent_main.Agent.default.__dict__["llm_node"]
    yield
    agent_main.Agent.default.llm_node = original  # type: ignore[attr-defined]


async def collect(agent: MiithiiAgent) -> tuple[list[str], StubChatContext]:
    out: list[str] = []
    ctx = StubChatContext()
    stream = await agent.llm_node(ctx, [], None)  # type: ignore[arg-type]
    async for item in stream:  # type: ignore[union-attr]
        if isinstance(item, str):
            out.append(item)
    return out, ctx


def test_valid_answer_reaches_preview_and_speech_only_after_gate(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    spoken, _ = asyncio.run(
        collect(build_agent(ScriptedLLM(answers=[[StubChunk(MODEL_ASSAMESE)]]), publisher))
    )
    assert spoken == [CANONICAL_ASSAMESE]
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert "@mood" not in "".join(publisher.texts("delta"))


@pytest.mark.parametrize("mood", ["hype", "roast", "scold", "soft", "crisis", "neutral"])
def test_mood_classification_never_becomes_provider_markup(
    mood: str, restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    model_text = f"@mood: {mood}\n{CANONICAL_ASSAMESE}"
    spoken, _ = asyncio.run(
        collect(build_agent(ScriptedLLM(answers=[[StubChunk(model_text)]]), publisher))
    )
    assert spoken == [CANONICAL_ASSAMESE]
    assert all(type(piece) is str for piece in spoken)
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert not any(mark in "".join(spoken) for mark in "[]")


def test_missing_mood_does_not_trigger_repair_or_silence(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(answers=[[StubChunk(CANONICAL_ASSAMESE)]])
    spoken, ctx = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert scripted.calls == 1
    assert ctx.added == []
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]


def test_missing_mood_with_newline_streams_as_neutral_speech(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(answers=[[StubChunk("অসমীয়া।\n"), StubChunk("দ্বিতীয়টো।")]])
    spoken, _ = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == ["অসমীয়া।", " দ্বিতীয়টো।"]
    assert scripted.calls == 1


def test_loose_parenthesized_mood_never_reaches_preview_or_speech(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(answers=[[StubChunk(f"(neutral)\n{CANONICAL_ASSAMESE}")]])
    spoken, _ = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert "neutral" not in "".join(publisher.texts("delta"))


def test_inline_parenthesized_mood_does_not_trigger_repair(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(answers=[[StubChunk(f"(neutral) {CANONICAL_ASSAMESE}")]])
    spoken, _ = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert scripted.calls == 1


@pytest.mark.parametrize("header", ["@neutral:", "@neutral", "@soft", "@soft:"])
@pytest.mark.parametrize("split_at", range(1, 10))
def test_at_neutral_control_header_is_never_previewed_or_spoken(
    header: str, split_at: int, restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(answers=[[
        StubChunk(header[:split_at]), StubChunk(header[split_at:]),
        StubChunk(f"\n{CANONICAL_ASSAMESE}"),
    ]])
    spoken, _ = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert scripted.calls == 1


def test_at_neutral_inline_prefix_is_stripped_without_repair(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(answers=[[StubChunk(f"@neutral: {CANONICAL_ASSAMESE}")]])
    spoken, _ = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert scripted.calls == 1


def test_generic_assamese_assistant_intro_is_repaired_before_any_speech(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(
        answers=[[StubChunk("@mood: neutral\nমই এটা AI সহায়ক। মোক যিকোনো প্ৰশ্ন সুধিব পাৰা।")]],
        repair_answer=[StubChunk(MODEL_ASSAMESE)],
    )
    spoken, context = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert scripted.calls == 2
    assert len(context.added) == 1
    assert "generic_assistant_intro" in context.added[0]


def test_rejected_raw_generation_is_never_previewed(restore_default_llm_node: Any) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(
        answers=[[StubChunk("@mood: neutral\nTHIS MUST NEVER APPEAR.")]],
        repair_answer=[StubChunk("@mood: neutral\nALSO INVALID.")],
    )
    assert asyncio.run(collect(build_agent(scripted, publisher)))[0] == []
    assert publisher.texts("delta") == []
    assert publisher.texts("verdict") == ["wrong_script"]


def test_one_repair_can_replace_a_rejected_answer(restore_default_llm_node: Any) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(
        answers=[[StubChunk("@mood: neutral\nEnglish only.")]],
        repair_answer=[StubChunk(MODEL_ASSAMESE)],
    )
    spoken, ctx = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert scripted.calls == 2
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert len(ctx.added) == 1
    assert "wrong_script" in ctx.added[0]


def test_complete_sentences_stream_through_independently_after_the_header(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(
        answers=[
            [
                StubChunk("@mood: neutral\nঅসমীয়া।"),
                StubChunk(" দ্বিতীয়টো।"),
            ]
        ]
    )
    spoken, _ = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == ["অসমীয়া।", " দ্বিতীয়টো।"]
    assert publisher.texts("delta") == ["অসমীয়া।", " দ্বিতীয়টো।"]
    assert publisher.texts("end") == ["অসমীয়া। দ্বিতীয়টো।"]


@pytest.mark.parametrize("tail", [" This must never appear.", " অসমীয়া"])
def test_bad_later_sentence_is_dropped_without_rewriting_spoken_prefix(
    tail: str, restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(
        answers=[
            [
                StubChunk("@mood: neutral\nঅসমীয়া।"),
                StubChunk(tail),
            ]
        ],
        repair_answer=[StubChunk("@mood: neutral\nএইটোও চলিব নালাগে।")],
    )
    spoken, _ = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert scripted.calls == 1
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert publisher.texts("end") == [CANONICAL_ASSAMESE]
    assert publisher.shortened


def test_second_bad_generation_fails_closed_without_unreviewed_fallback(
    restore_default_llm_node: Any,
) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(
        answers=[[StubChunk("@mood: neutral\nEnglish.")]],
        repair_answer=[StubChunk("@mood: neutral\nStill English.")],
    )
    assert asyncio.run(collect(build_agent(scripted, publisher)))[0] == []
    assert scripted.calls == 2
    assert publisher.texts("delta") == []


def test_truncation_keeps_only_complete_sentences(restore_default_llm_node: Any) -> None:
    publisher = StubPublisher()
    scripted = ScriptedLLM(
        answers=[
            [
                StubChunk(MODEL_ASSAMESE),
                StubChunk(" এইটো আধা", finish_reason="length"),
            ]
        ],
    )
    spoken, _ = asyncio.run(collect(build_agent(scripted, publisher)))
    assert spoken == [CANONICAL_ASSAMESE]
    assert publisher.texts("delta") == [CANONICAL_ASSAMESE]
    assert "এইটো আধা" not in "".join(publisher.texts("delta"))
