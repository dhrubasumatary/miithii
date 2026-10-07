"""Environment-driven settings for the Miithii voice runtime.

Every provider credential is read here and nowhere else, so a missing or malformed
value fails once at startup instead of mid-turn while a user is waiting on audio.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

LlmProvider = Literal["google", "aiml"]

DEFAULT_BODHAN_BASE_URL = "https://api.bodhan.ai/v1"
DEFAULT_BODHAN_MODEL = "indic-speak"
DEFAULT_ELEVEN_MODEL = "eleven_v4_turbo"
DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash"
DEFAULT_AIML_MODEL = "google/gemini-2.5-flash"
DEFAULT_AGENT_NAME = "miithii-voice"


def _text(name: str, default: str = "") -> str:
    value = os.environ.get(name, "").strip()
    return value or default


def configured_agent_name() -> str:
    """One normalized dispatch name shared by the worker and token allowlist."""
    return _text("MIITHII_AGENT_NAME", DEFAULT_AGENT_NAME)


def _number(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a number, got {raw!r}") from exc


def _integer(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer, got {raw!r}") from exc


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required for the Miithii voice runtime")
    return value


@dataclass(frozen=True)
class SarvamSettings:
    api_key: str
    min_silence_ms: int
    min_speech_ms: int
    sample_rate: int

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)


@dataclass(frozen=True)
class BodhanSettings:
    api_key: str
    base_url: str
    model: str
    connect_timeout: float
    read_timeout: float
    total_timeout: float
    max_response_bytes: int

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    @property
    def speech_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/audio/speech"


@dataclass(frozen=True)
class ElevenLabsSettings:
    """Explicit Assamese-only Standard route. Premium tier remains retired.

    Credentials and voice are optional while the route is disabled; an enabled route
    refuses to start without them. Bodo never becomes eligible through these settings.
    """

    api_key: str = ""
    model: str = DEFAULT_ELEVEN_MODEL
    assamese_voice_id: str = ""
    assamese_enabled: bool = False

    def ready_for(self, language: str) -> bool:
        """Whether the explicit Assamese route has its required credentials."""
        return (
            language == "asm"
            and self.assamese_enabled
            and bool(self.api_key and self.assamese_voice_id)
        )

    def voice_for(self, language: str) -> str:
        if self.ready_for(language):
            return self.assamese_voice_id
        raise RuntimeError(
            "Premium Voice is retired; Assamese Standard ElevenLabs route "
            f"is not ready for {language!r}"
        )


@dataclass(frozen=True)
class LlmSettings:
    provider: LlmProvider
    model: str
    google_api_key: str
    aiml_api_key: str
    aiml_base_url: str
    temperature: float
    max_output_tokens: int | None
    reasoning_effort: str

    @property
    def enabled(self) -> bool:
        if self.provider == "google":
            return bool(self.google_api_key)
        return bool(self.aiml_api_key)


@dataclass(frozen=True)
class VadSettings:
    """Silero VAD, used only for barge-in.

    Kept separate from :class:`SarvamSettings` on purpose. Sarvam decides when a turn ends and
    Silero decides when the user interrupts the agent; they are different thresholds tuned on
    different evidence, and coupling them would make one change silently move the other.
    """

    min_silence: float
    min_speech: float
    sample_rate: int


@dataclass(frozen=True)
class Settings:
    agent_name: str
    sarvam: SarvamSettings
    vad: VadSettings
    bodhan: BodhanSettings
    elevenlabs: ElevenLabsSettings
    llm: LlmSettings
    min_endpointing_delay: float
    max_endpointing_delay: float

    @property
    def ready(self) -> bool:
        """True when every leg of the voice pipeline has a credential."""
        return self.sarvam.enabled and self.bodhan.enabled and self.llm.enabled


def _llm_provider() -> LlmProvider:
    raw = _text("MIITHII_LLM_PROVIDER", "aiml").lower()
    if raw not in ("google", "aiml"):
        raise RuntimeError(f"MIITHII_LLM_PROVIDER must be 'google' or 'aiml', got {raw!r}")
    return raw  # type: ignore[return-value]


def load_settings() -> Settings:
    provider = _llm_provider()
    if provider == "google":
        llm = LlmSettings(
            provider=provider,
            model=_text("MIITHII_LLM_MODEL", DEFAULT_GOOGLE_MODEL),
            google_api_key=_text("GOOGLE_API_KEY"),
            aiml_api_key="",
            aiml_base_url="",
            temperature=_number("MIITHII_LLM_TEMPERATURE", 0.7),
            max_output_tokens=_integer("MIITHII_LLM_MAX_OUTPUT_TOKENS", 0) or None,
            reasoning_effort=_text("MIITHII_REASONING_EFFORT", "none"),
        )
    else:
        llm = LlmSettings(
            provider=provider,
            model=_text("MIITHII_LLM_MODEL", DEFAULT_AIML_MODEL),
            google_api_key="",
            aiml_api_key=_text("AIMLAPI_API_KEY"),
            aiml_base_url=_text("AIMLAPI_BASE_URL", "https://api.aimlapi.com/v1"),
            temperature=_number("MIITHII_LLM_TEMPERATURE", 0.7),
            max_output_tokens=_integer("MIITHII_LLM_MAX_OUTPUT_TOKENS", 0) or None,
            reasoning_effort=_text("MIITHII_REASONING_EFFORT", "none"),
        )

    return Settings(
        agent_name=configured_agent_name(),
        sarvam=SarvamSettings(
            api_key=_text("SARVAM_API_KEY"),
            min_silence_ms=_integer("SARVAM_MIN_SILENCE_MS", 700),
            min_speech_ms=_integer("SARVAM_MIN_SPEECH_MS", 200),
            sample_rate=_integer("SARVAM_SAMPLE_RATE", 16000),
        ),
        vad=VadSettings(
            min_silence=_number("SILERO_MIN_SILENCE", 0.35),
            min_speech=_number("SILERO_MIN_SPEECH", 0.05),
            # LiveKit delivers room audio at 16 kHz, which is one of the two rates Silero
            # supports. Resampling here would cost latency for no benefit.
            sample_rate=16000,
        ),
        bodhan=BodhanSettings(
            api_key=_text("BODHAN_API_KEY"),
            base_url=_text("BODHAN_BASE_URL", DEFAULT_BODHAN_BASE_URL),
            model=_text("BODHAN_MODEL", DEFAULT_BODHAN_MODEL),
            connect_timeout=_number("BODHAN_CONNECT_TIMEOUT", 10.0),
            read_timeout=_number("BODHAN_READ_TIMEOUT", 30.0),
            total_timeout=_number("BODHAN_TOTAL_TIMEOUT", 45.0),
            max_response_bytes=_integer("BODHAN_MAX_RESPONSE_BYTES", 8 * 1024 * 1024),
        ),
        elevenlabs=ElevenLabsSettings(
            # LiveKit's official plugin uses ELEVEN_API_KEY. Accept ElevenLabs' more common
            # documentation spelling too so a local developer does not have to duplicate it.
            api_key=_text("ELEVEN_API_KEY") or _text("ELEVENLABS_API_KEY"),
            model=_text("MIITHII_ELEVEN_MODEL", DEFAULT_ELEVEN_MODEL),
            assamese_voice_id=_text("MIITHII_ELEVEN_AS_VOICE_ID"),
            assamese_enabled=_text("MIITHII_ASSAMESE_TTS", "bodhan") == "elevenlabs",
        ),
        llm=llm,
        min_endpointing_delay=_number("MIITHII_MIN_ENDPOINTING_DELAY", 0.6),
        max_endpointing_delay=_number("MIITHII_MAX_ENDPOINTING_DELAY", 2.5),
    )


def require_ready() -> Settings:
    """Load settings and fail fast if the runtime cannot serve a real turn."""
    settings = load_settings()
    if not settings.ready:
        missing = []
        if not settings.sarvam.enabled:
            missing.append("SARVAM_API_KEY")
        if not settings.llm.enabled:
            missing.append(
                "GOOGLE_API_KEY" if settings.llm.provider == "google" else "AIMLAPI_API_KEY"
            )
        if not settings.bodhan.enabled:
            missing.append("BODHAN_API_KEY")
        raise RuntimeError(
            f"Miithii voice runtime is not configured, missing: {', '.join(missing)}"
        )
    return settings
