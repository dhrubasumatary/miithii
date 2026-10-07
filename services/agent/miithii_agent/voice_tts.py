"""Server-owned Voice tier -> concrete TTS provider routing.

Product code talks about a tier, never a provider. Provider/model/voice names live here so a
tier can move to a different synthesizer later without changing the app, LiveKit transport,
language policy, or the entitlement seam.

Standard uses Bodhan for Bodo and either Bodhan or explicitly configured ElevenLabs v4
for Assamese. Selection stays server-owned and immutable for a session.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from livekit.agents.tts import TTS

from .config import Settings
from .policy import VoicePolicy
from .sentences import MiithiiSentenceTokenizer
from .tiers import VoiceTier
from .tts_bodhan import BodhanTiming, BodhanTTS

TtsProvider = Literal["bodhan", "elevenlabs"]


@dataclass(frozen=True)
class TtsRoute:
    tier: VoiceTier
    provider: TtsProvider
    model: str
    voice: str


def tts_route(settings: Settings, policy: VoicePolicy, voice_tier: VoiceTier) -> TtsRoute:
    """Resolve one product tier to the current server-side provider route.

    The tier has already been validated by :func:`miithii_agent.tiers.validate_voice_tier`
    before it reaches the room, so this function does not re-check it. An unrecognised tier
    still cannot land here with a live route: it would have been refused at the room name.
    """
    if voice_tier != "standard":
        # Unreachable through the room, and raising here keeps a direct caller from receiving a
        # Standard route for a tier it did not ask for.
        raise RuntimeError(
            f"no TTS route for voice tier {voice_tier!r}; "
            "this build serves only 'standard' (Bodhan)"
        )

    if policy.language == "asm" and settings.elevenlabs.assamese_enabled:
        if settings.elevenlabs.model not in {"eleven_v4", "eleven_v4_turbo"}:
            raise RuntimeError("Assamese ElevenLabs route requires a verified v4-family model")
        return TtsRoute(
            tier=voice_tier,
            provider="elevenlabs",
            model=settings.elevenlabs.model,
            voice=settings.elevenlabs.voice_for("asm"),
        )

    return TtsRoute(
        tier=voice_tier,
        provider="bodhan",
        model=settings.bodhan.model,
        voice=policy.voice,
    )


def _build_bodhan(
    settings: Settings,
    policy: VoicePolicy,
    *,
    http_session,  # noqa: ANN001 - aiohttp session is owned by main's process cache
    on_timing: Callable[[BodhanTiming], None] | None,
) -> TTS:
    from livekit.agents.tts import StreamAdapter

    provider = BodhanTTS(
        settings=settings.bodhan,
        voice=policy.voice,
        lang=policy.bodhan_lang,
        http_session=http_session,
    )
    provider.on_timing = on_timing
    return StreamAdapter(
        tts=provider,
        sentence_tokenizer=MiithiiSentenceTokenizer(),
    )


def build_voice_tts(
    settings: Settings,
    policy: VoicePolicy,
    voice_tier: VoiceTier,
    *,
    http_session,
    on_bodhan_timing: Callable[[BodhanTiming], None] | None = None,
) -> tuple[TTS, TtsRoute]:
    """Build the provider selected for this session's effective product tier."""
    route = tts_route(settings, policy, voice_tier)
    if route.provider == "elevenlabs":
        from livekit.plugins import elevenlabs

        return elevenlabs.TTS(
            api_key=settings.elevenlabs.api_key,
            voice_id=route.voice,
            model=route.model,
            language=policy.provider_code("elevenlabs", "speech"),
            encoding="pcm_24000",
            preferred_alignment="original",
            sync_alignment=True,
            word_tokenizer=MiithiiSentenceTokenizer(),
            http_session=http_session,
        ), route
    return (
        _build_bodhan(
            settings,
            policy,
            http_session=http_session,
            on_timing=on_bodhan_timing,
        ),
        route,
    )


__all__ = ["TtsProvider", "TtsRoute", "build_voice_tts", "tts_route"]
