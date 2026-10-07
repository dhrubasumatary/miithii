"""The token endpoint, against LiveKit's standardized contract.

The contract is LiveKit's, not ours, so these tests assert the wire format the client SDKs
actually send and expect. Three properties are load-bearing beyond the format itself: a
caller cannot choose its room, the grants are audio-only, and ``room_config`` survives intact
because that is what dispatches the named agent.
"""

from __future__ import annotations

import base64
import json

import pytest

from miithii_agent.rooms import language_for_room, voice_tier_for_room
from miithii_agent.token import (
    EFFECTIVE_TIER_ATTRIBUTE,
    LANGUAGE_ATTRIBUTE,
    REQUESTED_TIER_ATTRIBUTE,
    TokenError,
    TokenRequest,
    build_token,
)


@pytest.fixture(autouse=True)
def _credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LIVEKIT_API_KEY", "APIkey")
    monkeypatch.setenv("LIVEKIT_API_SECRET", "secret-value-long-enough-for-hmac-sha256")
    monkeypatch.setenv("LIVEKIT_URL", "wss://example.livekit.cloud")


def decode_jwt_payload(token: str) -> dict:
    """Decode a JWT payload without verifying it, for asserting on its claims."""
    segment = token.split(".")[1]
    segment += "=" * (-len(segment) % 4)
    return json.loads(base64.urlsafe_b64decode(segment))


def test_response_matches_the_standard_shape() -> None:
    result = build_token(TokenRequest())
    assert set(result) == {"server_url", "participant_token"}
    assert result["server_url"] == "wss://example.livekit.cloud"
    assert result["participant_token"].count(".") == 2


def test_the_room_is_chosen_by_the_server() -> None:
    """A caller must not be able to name a room, including someone else's."""
    result = build_token(TokenRequest(room_name="someone-elses-room"))
    room = decode_jwt_payload(result["participant_token"])["video"]["room"]
    assert room != "someone-elses-room"
    assert language_for_room(room) == "asm"


def test_two_sessions_never_share_a_room() -> None:
    rooms = {
        decode_jwt_payload(build_token(TokenRequest())["participant_token"])["video"]["room"]
        for _ in range(25)
    }
    assert len(rooms) == 25


def test_requested_language_reaches_the_room() -> None:
    result = build_token(
        TokenRequest(participant_attributes={LANGUAGE_ATTRIBUTE: "brx"})
    )
    room = decode_jwt_payload(result["participant_token"])["video"]["room"]
    assert language_for_room(room) == "brx"


def test_the_served_tier_reaches_the_room_and_the_attributes() -> None:
    result = build_token(
        TokenRequest(participant_attributes={REQUESTED_TIER_ATTRIBUTE: "standard"})
    )
    claim = decode_jwt_payload(result["participant_token"])
    room = claim["video"]["room"]
    assert voice_tier_for_room(room) == "standard"
    assert claim["attributes"][REQUESTED_TIER_ATTRIBUTE] == "standard"
    assert claim["attributes"][EFFECTIVE_TIER_ATTRIBUTE] == "standard"


def test_a_retired_tier_request_is_refused_rather_than_served(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A stale client asking for Premium gets an error, not a Standard session.

    The old behaviour resolved Premium to Standard when the provider was unconfigured, on the
    reasoning that a downgrade is friendlier than a failure. It is not: the app had already
    shown the user a Premium selection, and the session it got back was Standard. A clear
    error is the only response that leaves the user able to act.
    """
    monkeypatch.setenv("ELEVEN_API_KEY", "test-key")
    monkeypatch.setenv("MIITHII_ELEVEN_AS_VOICE_ID", "as-voice")
    with pytest.raises(TokenError, match="retired"):
        build_token(
            TokenRequest(participant_attributes={REQUESTED_TIER_ATTRIBUTE: "premium"})
        )


def test_missing_voice_tier_defaults_to_standard() -> None:
    result = build_token(TokenRequest())
    claim = decode_jwt_payload(result["participant_token"])
    assert voice_tier_for_room(claim["video"]["room"]) == "standard"


def test_unsupported_voice_tier_is_refused() -> None:
    with pytest.raises(TokenError, match="unsupported voice tier"):
        build_token(
            TokenRequest(participant_attributes={REQUESTED_TIER_ATTRIBUTE: "ultra"})
        )


def test_client_cannot_spoof_effective_voice_tier() -> None:
    result = build_token(
        TokenRequest(
            participant_attributes={
                REQUESTED_TIER_ATTRIBUTE: "standard",
                EFFECTIVE_TIER_ATTRIBUTE: "premium",
            }
        )
    )
    claim = decode_jwt_payload(result["participant_token"])
    assert claim["attributes"][EFFECTIVE_TIER_ATTRIBUTE] == "standard"


def test_language_is_also_recorded_on_the_participant() -> None:
    result = build_token(
        TokenRequest(participant_attributes={LANGUAGE_ATTRIBUTE: "brx"})
    )
    attributes = decode_jwt_payload(result["participant_token"]).get("attributes", {})
    assert attributes.get(LANGUAGE_ATTRIBUTE) == "brx"


def test_unknown_client_attributes_are_not_signed_into_the_token() -> None:
    result = build_token(
        TokenRequest(
            participant_attributes={
                LANGUAGE_ATTRIBUTE: "brx",
                "miithii.admin": "true",
                "unbounded.client.data": "ignored",
            }
        )
    )
    attributes = decode_jwt_payload(result["participant_token"]).get("attributes", {})
    assert set(attributes) == {
        LANGUAGE_ATTRIBUTE,
        REQUESTED_TIER_ATTRIBUTE,
        EFFECTIVE_TIER_ATTRIBUTE,
    }
    assert attributes[LANGUAGE_ATTRIBUTE] == "brx"


def test_an_unsupported_language_is_refused() -> None:
    with pytest.raises(TokenError, match="unsupported reply language"):
        build_token(TokenRequest(participant_attributes={LANGUAGE_ATTRIBUTE: "fr"}))


def test_a_missing_language_falls_back_to_the_default() -> None:
    room = decode_jwt_payload(build_token(TokenRequest())["participant_token"])["video"]["room"]
    assert language_for_room(room) == "asm"


def test_grants_are_audio_only() -> None:
    video = decode_jwt_payload(build_token(TokenRequest())["participant_token"])["video"]
    assert video.get("roomJoin") is True
    assert video.get("canPublish") is True
    assert video.get("canSubscribe") is True
    # A voice product never uses a camera, so no video grant is issued at all. The claim simply
    # has no key for it, which is stronger than setting it to false.
    assert "canPublishVideo" not in video
    assert "canPublishScreenShare" not in video


def test_room_config_survives_into_the_token() -> None:
    """Agent dispatch lives here.

    A named agent only receives a session if the client SDK's `room_config` survives, because
    the SDK packages `agent_name` into it. Dropping it leaves the worker registered but never
    dispatched a session.
    """
    room_config = {
        "agents": [{"agentName": "miithii-voice", "metadata": "{}"}],
        "maxParticipants": 1,
    }
    result = build_token(TokenRequest(room_config=room_config))
    claim = decode_jwt_payload(result["participant_token"])["roomConfig"]
    assert claim["agents"][0]["agentName"] == "miithii-voice"
    assert claim["maxParticipants"] == 1


def test_no_room_config_means_no_dispatch_claim() -> None:
    claim = decode_jwt_payload(build_token(TokenRequest())["participant_token"])
    assert "roomConfig" not in claim or not claim["roomConfig"]


def test_agent_dispatch_config_reaches_the_token() -> None:
    body = TokenRequest.from_body(
        {
            "room_name": "ignored-by-us",
            "participant_identity": "probe",
            "participant_name": "Probe",
            "participant_attributes": {LANGUAGE_ATTRIBUTE: "asm"},
            "room_config": {"agents": [{"agentName": "miithii-voice"}]},
        }
    )
    claim = decode_jwt_payload(build_token(body)["participant_token"])
    assert claim["roomConfig"]["agents"][0]["agentName"] == "miithii-voice"
    # The identity claim is `sub`, per the LiveKit token spec.
    assert claim["sub"] == "probe"
    assert claim["name"] == "Probe"


def test_arbitrary_agent_dispatch_is_refused() -> None:
    with pytest.raises(TokenError, match="unsupported agent dispatch"):
        build_token(
            TokenRequest(room_config={"agents": [{"agentName": "other-agent"}]})
        )


def test_only_one_miithii_agent_dispatch_is_allowed() -> None:
    with pytest.raises(TokenError, match="only one agent dispatch"):
        build_token(
            TokenRequest(
                room_config={
                    "agents": [
                        {"agentName": "miithii-voice"},
                        {"agentName": "miithii-voice"},
                    ]
                }
            )
        )


def test_agent_allowlist_uses_the_configured_dispatch_name(monkeypatch) -> None:
    monkeypatch.setenv("MIITHII_AGENT_NAME", "miithii-staging")
    result = build_token(
        TokenRequest(room_config={"agents": [{"agentName": "miithii-staging"}]})
    )
    claim = decode_jwt_payload(result["participant_token"])
    assert claim["roomConfig"]["agents"][0]["agentName"] == "miithii-staging"


def test_blank_configured_dispatch_name_uses_the_worker_default(monkeypatch) -> None:
    monkeypatch.setenv("MIITHII_AGENT_NAME", "  ")
    result = build_token(
        TokenRequest(room_config={"agents": [{"agentName": "miithii-voice"}]})
    )
    claim = decode_jwt_payload(result["participant_token"])
    assert claim["roomConfig"]["agents"][0]["agentName"] == "miithii-voice"


@pytest.mark.parametrize("max_participants", [0, 2, 100, True, "1"])
def test_voice_room_cannot_expand_client_participant_limit(max_participants) -> None:
    with pytest.raises(TokenError, match="exactly one client participant"):
        build_token(TokenRequest(room_config={"maxParticipants": max_participants}))


def test_voice_room_defaults_to_one_client_participant() -> None:
    result = build_token(
        TokenRequest(room_config={"agents": [{"agentName": "miithii-voice"}]})
    )
    room_config = decode_jwt_payload(result["participant_token"])["roomConfig"]
    assert room_config["maxParticipants"] == 1


def test_identity_is_generated_when_absent() -> None:
    claim = decode_jwt_payload(build_token(TokenRequest())["participant_token"])
    assert claim["sub"]


def test_identity_is_sanitised_and_bounded() -> None:
    claim = decode_jwt_payload(
        build_token(TokenRequest(participant_identity="<script>alert(1)</script>"))[
            "participant_token"
        ]
    )
    identity = claim["sub"]
    assert "<" not in identity and ">" not in identity
    assert len(identity) <= 48


def test_identity_that_sanitises_to_nothing_is_replaced() -> None:
    claim = decode_jwt_payload(
        build_token(TokenRequest(participant_identity="<<<>>>"))["participant_token"]
    )
    assert claim["sub"].startswith("miithii-android-")


def test_secret_never_appears_in_the_response() -> None:
    result = build_token(TokenRequest())
    assert "secret-value-long-enough-for-hmac-sha256" not in result["participant_token"]


def test_from_body_tolerates_a_sparse_request() -> None:
    request = TokenRequest.from_body({})
    assert request.room_name is None
    assert request.room_config is None
    assert request.participant_attributes == {}


def test_from_body_ignores_a_malformed_room_config() -> None:
    request = TokenRequest.from_body({"room_config": "not-an-object"})
    assert request.room_config is None
