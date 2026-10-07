"""Function tools, bound to one session.

LiveKit's ``function_tool`` replaces the tool surface Pipecat offered, so the model keeps tool
calling without the previous glue layer.

Two things make these safe. They are **inert** - none can mutate shared configuration, spend
money, start a call, or reach the network. And they are **per session**: the tools are built by
a factory that closes over the session's language, because the language is per-session state read
from the room. A module-level tool reading the process environment would report one language to
every session at once, which is the bug this shape exists to prevent.
"""

from __future__ import annotations

from typing import Any, Literal

from livekit.agents import function_tool

LanguageCode = Literal["asm", "brx"]


def build_tools(language: str) -> list[Any]:
    """Build the tool set for a session in ``language``."""

    @function_tool
    def get_reply_language() -> dict[str, Any]:
        """Report which language Miithii is currently replying in."""
        from .policy import get_policy

        policy = get_policy(language)
        return {
            "language": policy.language,
            "language_name": policy.language_name,
            "script": policy.script,
            "display_script": policy.display_script,
        }

    @function_tool
    def request_reply_language(target: LanguageCode) -> dict[str, Any]:
        """Ask Miithii to switch the language it replies in.

        This does not switch anything by itself. The app owns the session boundary: it ends the
        current session and starts a new one, because the reply language is bound to the
        agent's policy, LLM and TTS voice for the life of a session, and because each session
        gets its own room.

        The new session binds STT, language policy, and TTS to the selected language pack.
        """
        from .policy import get_policy
        from .rooms import (
            SUPPORTED_LANGUAGES,
            UnknownLanguageError,
            room_pattern,
            validate_language,
        )

        try:
            language = validate_language(str(target))
        except UnknownLanguageError as exc:
            raise ValueError(str(exc)) from None

        policy = get_policy(language)
        return {
            "requested_language": language,
            "language_name": policy.language_name,
            "script": policy.script,
            "voice": policy.voice,
            # Stating the room pattern keeps the switch honest: the app cannot be told to
            # switch and then silently keep the old language.
            "next_room_name_pattern": room_pattern(language),
            "supported_languages": list(SUPPORTED_LANGUAGES),
            "requires_new_session": True,
            "applied": False,
        }

    return [get_reply_language, request_reply_language]


__all__ = ["LanguageCode", "build_tools"]
