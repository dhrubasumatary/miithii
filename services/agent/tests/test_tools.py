"""Session-scoped function tools.

These tools are built per session and bound to that session's language. They were once
module-level objects reading the process environment, and a lazily-imported symbol inside a
function body meant a broken import would not surface until the model actually called the
tool. So these tests invoke the callables rather than only constructing them.
"""

from __future__ import annotations

import pytest

from miithii_agent.tools import build_tools


def call(tool, **kwargs):  # noqa: ANN001, ANN201 - a FunctionTool is not a plain callable
    return tool(**kwargs)


def test_tools_are_built_per_session() -> None:
    assert len(build_tools("asm")) == 2


def test_each_session_gets_its_own_tool_objects() -> None:
    """Two sessions must not share tool state."""
    assamese = build_tools("asm")
    bodo = build_tools("brx")
    assert assamese[0] is not bodo[0]


def test_get_reply_language_reports_the_session_language() -> None:
    for language in ("asm", "brx"):
        tools = build_tools(language)
        result = call(tools[0])
        assert result["language"] == language
        # The tool reports what a person could act on. It deliberately does not expose a
        # provider locale, which is an internal addressing detail and means nothing to a model
        # choosing how to write.
        assert result["language_name"]
        assert result["script"] in {"bengali-assamese", "devanagari"}
        assert "locale" not in result


def test_two_sessions_report_different_languages() -> None:
    assamese = call(build_tools("asm")[0])
    bodo = call(build_tools("brx")[0])
    assert assamese["language"] != bodo["language"]
    assert assamese["script"] != bodo["script"]


def test_request_reply_language_is_callable() -> None:
    """The regression: this tool imported symbols that no longer existed.

    Constructing the tool set was not enough, because the bad import sat inside the function
    body and only blew up when the model called it.
    """
    result = call(build_tools("asm")[1], target="brx")
    assert result["requested_language"] == "brx"
    assert result["voice"] == "Gwrbw"
    assert result["requires_new_session"] is True
    # It reports what the app must do; it does not claim to have done it.
    assert result["applied"] is False


def test_request_reply_language_names_the_supported_set() -> None:
    result = call(build_tools("asm")[1], target="brx")
    assert set(result["supported_languages"]) == {"asm", "brx"}


def test_request_reply_language_rejects_an_unsupported_target() -> None:
    with pytest.raises(ValueError, match="unsupported reply language"):
        call(build_tools("asm")[1], target="fr")


def test_tools_carry_descriptions_for_the_model() -> None:
    for tool in build_tools("asm"):
        assert tool.info.name
        assert tool.info.description
