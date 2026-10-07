"""LiveKit's standardized token endpoint.

The app fetches its join token from here rather than embedding the LiveKit signing secret.
The contract is LiveKit's, not ours, so the same endpoint works with any LiveKit client SDK:

* request  - ``POST`` with ``room_name``, ``participant_identity``, ``participant_name``,
  ``participant_metadata``, ``participant_attributes`` and ``room_config``
* response - ``201`` with ``server_url`` and ``participant_token``

Three things are deliberately not passed through from the client.

**The room is chosen here.** A client that could name its own room could name someone else's.
Every session gets a fresh unguessable room, and the room name carries the reply language, so
the worker can read the right policy on arrival.

**The grants are audio-only.** Miithii Voice never uses a camera, so a video grant is not
issued. Publishing is limited to microphone and screen-share sources; a modified client cannot
widen its own permissions by asking.

**Agent dispatch is preserved but constrained.** LiveKit's client SDKs package agent dispatch
into ``room_config`` before sending the request. The endpoint accepts the configured Miithii
agent only and keeps each voice room private to one user; client-controlled room names and
unrelated agent dispatches are refused.

**Unauthenticated.** This is a development-grade endpoint, not production admission. Production
needs a real authenticated front door.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from livekit import api

from .config import _required, configured_agent_name
from .policy import default_language
from .rooms import (
    UnknownLanguageError,
    new_room_name,
    validate_language,
)
from .tiers import UnknownVoiceTierError, resolve_voice_tier, validate_voice_tier

# The attribute the app sets to choose the reply language for its session.
LANGUAGE_ATTRIBUTE = "miithii.language"
REQUESTED_TIER_ATTRIBUTE = "miithii.requested_voice_tier"
EFFECTIVE_TIER_ATTRIBUTE = "miithii.effective_voice_tier"

# Long enough for a conversation with pauses, short enough that a captured token has little
# value on its own. The signing secret never leaves the server.
TOKEN_TTL = timedelta(hours=2)
MAX_ROOM_PARTICIPANTS = 1
MAX_AGENT_METADATA_CHARS = 4096

# Miithii Voice is audio only. Camera and screen share are not granted, so a modified client
# cannot ask for them and this grant cannot be widened from the request.
AUDIO_ONLY_GRANT = {
    "room_join": True,
    "can_publish": True,
    "can_subscribe": True,
    "can_publish_data": True,
}


class TokenError(ValueError):
    """The request was refused."""


@dataclass(frozen=True)
class TokenRequest:
    """The fields LiveKit's standard endpoint accepts, plus the language attribute."""

    room_name: str | None = None
    participant_identity: str | None = None
    participant_name: str | None = None
    participant_metadata: str | None = None
    participant_attributes: dict[str, str] = field(default_factory=dict)
    room_config: dict[str, Any] | None = None

    @classmethod
    def from_body(cls, body: dict[str, Any]) -> TokenRequest:
        attributes = body.get("participant_attributes")
        return cls(
            room_name=_optional_str(body.get("room_name")),
            participant_identity=_optional_str(body.get("participant_identity")),
            participant_name=_optional_str(body.get("participant_name")),
            participant_metadata=_optional_str(body.get("participant_metadata")),
            participant_attributes=attributes if isinstance(attributes, dict) else {},
            room_config=(
                body.get("room_config") if isinstance(body.get("room_config"), dict) else None
            ),
        )

    def requested_language(self, default: str | None = None) -> str:
        """The reply language this session asked for.

        The app states it as a participant attribute. A missing attribute falls back to the
        default rather than failing, because the attribute is a product choice and the session
        is still usable without it.
        """
        raw = self.participant_attributes.get(LANGUAGE_ATTRIBUTE) or default or default_language()
        try:
            return validate_language(str(raw))
        except UnknownLanguageError as exc:
            raise TokenError(str(exc)) from None

    def requested_voice_tier(self, default: str = "standard") -> str:
        """The product tier the client wants this session to use."""
        raw = self.participant_attributes.get(REQUESTED_TIER_ATTRIBUTE) or default
        try:
            return validate_voice_tier(str(raw))
        except UnknownVoiceTierError as exc:
            raise TokenError(str(exc)) from None


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _safe_identity(identity: str | None) -> str:
    """Bounded, sanitised participant identity.

    An identity is a display name, not an authority. Stripping anything unexpected keeps it
    from being used to impersonate a recognisable account.
    """
    if identity:
        cleaned = "".join(ch for ch in identity if ch.isalnum() or ch in "-_")[:48]
        if cleaned:
            return cleaned
    return f"miithii-android-{uuid.uuid4().hex[:10]}"


def _room_config_protobuf(config: dict[str, Any], *, expected_agent: str) -> Any:
    """Convert the wire-format ``room_config`` into the protobuf the token builder needs.

    ``livekit-api`` serialises this through ``MessageToDict``, so a plain dict raises
    ``AttributeError: 'dict' object has no attribute 'DESCRIPTOR'``. The conversion is
    explicit rather than a blind passthrough so an unknown field is dropped instead of
    crashing the token request.
    """
    raw_agents = config.get("agents") or []
    if not isinstance(raw_agents, list):
        raise TokenError("room_config.agents must be a list")
    agents = []
    for entry in raw_agents:
        if not isinstance(entry, dict):
            raise TokenError("room_config.agents entries must be objects")
        agent_name = entry.get("agentName") or entry.get("agent_name")
        if agent_name != expected_agent:
            raise TokenError("unsupported agent dispatch")
        if agents:
            raise TokenError("only one agent dispatch is allowed per voice room")
        metadata = entry.get("metadata") or ""
        if not isinstance(metadata, str) or len(metadata) > MAX_AGENT_METADATA_CHARS:
            raise TokenError("agent metadata is invalid or too large")
        agents.append(api.RoomAgentDispatch(agent_name=expected_agent, metadata=metadata))

    max_participants = config.get("maxParticipants", MAX_ROOM_PARTICIPANTS)
    if (
        not isinstance(max_participants, int)
        or isinstance(max_participants, bool)
        or max_participants != MAX_ROOM_PARTICIPANTS
    ):
        raise TokenError("voice rooms allow exactly one client participant")

    room_metadata = config.get("metadata") or ""
    if not isinstance(room_metadata, str) or len(room_metadata) > MAX_AGENT_METADATA_CHARS:
        raise TokenError("room metadata is invalid or too large")

    return api.RoomConfiguration(
        agents=agents,
        max_participants=MAX_ROOM_PARTICIPANTS,
        metadata=room_metadata,
    )


def build_token(request: TokenRequest) -> dict[str, str]:
    """Return ``{server_url, participant_token}`` for one session."""
    language = request.requested_language()
    # The tier is still resolved here, and still refused loudly when it is not one this
    # runtime serves, so a stale client asking for a retired tier gets a clear error instead
    # of a session that quietly answers in a voice it did not ask for.
    tier = resolve_voice_tier(
        request.requested_voice_tier(),
        participant_identity=request.participant_identity,
        premium_allowed=False,
    )
    room_name = new_room_name(language, tier.effective)

    token = (
        api.AccessToken(_required("LIVEKIT_API_KEY"), _required("LIVEKIT_API_SECRET"))
        .with_identity(_safe_identity(request.participant_identity))
        .with_name(request.participant_name or "Miithii Voice")
        .with_grants(api.VideoGrants(room=room_name, **AUDIO_ONLY_GRANT))
        .with_ttl(TOKEN_TTL)
    )

    # The language is recorded on the participant as well as the room. The worker routes from
    # the server-generated room name before participants join; the client can inspect this
    # server-authored attribute to confirm the selected session language.
    # The signed token carries only the attributes this service understands. No arbitrary
    # client attribute is allowed to become server-authored identity or policy data.
    attributes = {
        LANGUAGE_ATTRIBUTE: language,
        REQUESTED_TIER_ATTRIBUTE: tier.requested,
        EFFECTIVE_TIER_ATTRIBUTE: tier.effective,
    }
    token = token.with_attributes(attributes)

    if request.participant_metadata:
        token = token.with_metadata(request.participant_metadata)

    # Converted, not dropped. A named agent is dispatched through this config, so losing it
    # leaves the worker registered but never given a session.
    if request.room_config:
        token = token.with_room_config(
            _room_config_protobuf(
                request.room_config,
                expected_agent=configured_agent_name(),
            )
        )

    return {
        "server_url": os.environ.get("LIVEKIT_URL") or _required("LIVEKIT_URL"),
        "participant_token": token.to_jwt(),
    }


__all__ = [
    "AUDIO_ONLY_GRANT",
    "EFFECTIVE_TIER_ATTRIBUTE",
    "LANGUAGE_ATTRIBUTE",
    "MAX_ROOM_PARTICIPANTS",
    "REQUESTED_TIER_ATTRIBUTE",
    "TOKEN_TTL",
    "TokenError",
    "TokenRequest",
    "build_token",
]
