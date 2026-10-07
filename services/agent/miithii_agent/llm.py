"""The LLM leg.

The brief left this as an open decision: call Gemini from the agent, or route it through
the ``api.miithii.in`` Worker. The answer is to call it from the agent, and this module
exists so the choice is explicit rather than incidental.

Routing through the Worker would add a network hop to every turn and pull that Worker's
authentication, quota and memory behaviour into a realtime conversation. Both providers
here are reached directly from the agent on Modal:

- ``aiml``    - the production baseline: Gemini 2.5 Flash through AIMLAPI.
- ``google``  - direct Gemini, retained as an explicit measurement/fallback route.

The provider is a setting, not a code branch, so the same agent can be measured on both
without a rewrite.
"""

from __future__ import annotations

from typing import Any

from livekit.agents import llm
from livekit.agents.llm import LLM as _LLM

from .config import LlmSettings
from .policy import VoicePolicy


def _build_google(settings: LlmSettings, policy: VoicePolicy) -> _LLM:
    from livekit.plugins.google import LLM as GoogleLLM

    return GoogleLLM(
        model=settings.model,
        api_key=settings.google_api_key,
        temperature=settings.temperature,
        max_output_tokens=policy.generation_max_tokens,
    )


def _build_aiml(settings: LlmSettings, policy: VoicePolicy) -> _LLM:
    from livekit.plugins.openai import LLM as OpenAICompatLLM

    # AIMLAPI is OpenAI-compatible; the model ID names the upstream Gemini route.
    #
    # The generation cap is spelled differently on purpose. The Google plugin takes
    # `max_output_tokens`; the OpenAI-compatible plugin takes `max_completion_tokens` and
    # rejects the other name outright. This is exactly the sort of thing only a live call
    # catches, because both signatures look plausible in isolation.
    options: dict[str, Any] = {
        "model": settings.model,
        "api_key": settings.aiml_api_key,
        "base_url": settings.aiml_base_url,
        "temperature": settings.temperature,
        "max_completion_tokens": policy.generation_max_tokens,
    }
    # Reasoning is switched off deliberately, and this is the single biggest latency and
    # correctness lever found by measurement.
    #
    # Measured through this gateway: with reasoning on, the model consumed the output budget
    # thinking and returned `finish_reason=length` with the answer cut off mid-sentence after
    # ~38 characters, at 4-9 seconds to first token. With it off, replies complete at ~1 second.
    if settings.reasoning_effort:
        options["reasoning_effort"] = settings.reasoning_effort
    return OpenAICompatLLM(**options)


def build_llm(settings: LlmSettings, policy: VoicePolicy) -> _LLM:
    """Construct the configured LLM for one reply language.

    ``policy.generation_max_tokens`` is applied here rather than in the prompt so the
    language-pack delivery budget is the only place a generation cap is defined.
    """
    if not settings.enabled:
        raise RuntimeError(
            "the Miithii LLM leg has no credential; set GOOGLE_API_KEY or AIMLAPI_API_KEY"
        )

    builder = _build_google if settings.provider == "google" else _build_aiml
    instance = builder(settings, policy)
    if not isinstance(instance, llm.LLM):  # pragma: no cover - guards a plugin regression
        raise RuntimeError(f"{type(instance).__name__} is not a LiveKit LLM")
    return instance
