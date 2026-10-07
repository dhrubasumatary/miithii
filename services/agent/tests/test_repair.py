"""Building a corrective turn for the repair.

The repair path re-invokes the model with an extra instruction. Two things have to be right
for it to work: the corrective turn has to actually be added to the context, and the
instruction has to name what went wrong rather than vaguely asking for a retry.

The context API is keyword-only and takes the role and content directly - it does not accept
a ChatMessage and has no positional form. Guessing that wrong would crash on the first
repair, in production, on the exact turn that needed it.
"""

from __future__ import annotations

import pytest
from livekit.agents import llm

from miithii_agent.enforcement import Rejection, build_repair_prompt, check_answer
from miithii_agent.policy import get_policy


def test_a_corrective_turn_can_be_added_to_a_chat_context() -> None:
    """The real `add_message` shape, asserted so a wrong call fails here not in production."""
    context = llm.ChatContext(items=[llm.ChatMessage(role="user", content=["hello"])])
    repair = context.copy()
    repair.add_message(role="user", content="say it again in Assamese")

    assert len(repair.items) == len(context.items) + 1
    assert repair.items[-1].role == "user"
    # The original context must be untouched, or every later turn inherits the correction.
    assert len(context.items) == 1


def test_the_repair_instruction_names_the_failure() -> None:
    prompt = build_repair_prompt("anything", (Rejection.WRONG_SCRIPT,))
    assert "wrong_script" in prompt


def test_the_repair_instruction_names_every_failure() -> None:
    prompt = build_repair_prompt(
        "anything", (Rejection.WRONG_SCRIPT, Rejection.OVER_TURN_BUDGET)
    )
    assert "wrong_script" in prompt
    assert "over_turn_budget" in prompt


def test_the_repair_instruction_forbids_the_usual_escapes() -> None:
    prompt = build_repair_prompt("x", (Rejection.WRONG_SCRIPT,))
    lowered = prompt.lower()
    assert "markdown" in lowered
    assert "emoji" in lowered
    # It must not ask the model to discuss the failure; that produces meta-commentary.
    assert "apolog" in lowered


def test_a_repair_instruction_is_not_itself_a_valid_answer() -> None:
    """A correction must not be able to pass the gate it exists to satisfy.

    English repair text would be rejected for an Indic language, which is correct behaviour -
    the point is that the instruction is never mistaken for a reply.
    """
    prompt = build_repair_prompt("x", (Rejection.WRONG_SCRIPT,))
    assert check_answer(prompt, get_policy("as")).speakable is False


def test_an_empty_rejection_list_still_produces_a_usable_prompt() -> None:
    prompt = build_repair_prompt("x", ())
    assert "policy violation" in prompt
    assert prompt.strip()


@pytest.mark.parametrize(
    "rejection",
    [
        Rejection.EMPTY,
        Rejection.WRONG_SCRIPT,
        Rejection.OVER_TURN_BUDGET,
        Rejection.OVER_REQUEST_BUDGET,
    ],
)
def test_every_rejection_can_be_named(rejection: Rejection) -> None:
    assert rejection.value in build_repair_prompt("x", (rejection,))
