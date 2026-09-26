from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

ISSUER = "miithii-api"
AUDIENCE = "miithii-voice-rtc"


@dataclass(frozen=True)
class VoiceSessionClaims:
    principal: str
    language: str
    thread_id: str
    expires_at: int
    session_id: str


def _decode_segment(value: str) -> dict:
    padded = value + "=" * ((4 - len(value) % 4) % 4)
    raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    payload = json.loads(raw.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Voice session payload must be an object")
    return payload


def verify_voice_session(token: str, secret: str, now: int | None = None) -> VoiceSessionClaims:
    if len(secret) < 32:
        raise ValueError("VOICE_RTC_TOKEN must be at least 32 characters")
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid voice session token")

    header = _decode_segment(parts[0])
    claims = _decode_segment(parts[1])
    if header.get("alg") != "HS256" or header.get("typ") != "JWT":
        raise ValueError("Invalid voice session signature type")

    expected = hmac.new(
        secret.encode("utf-8"),
        f"{parts[0]}.{parts[1]}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    padded_signature = parts[2] + "=" * ((4 - len(parts[2]) % 4) % 4)
    try:
        signature = base64.urlsafe_b64decode(padded_signature.encode("ascii"))
    except (ValueError, TypeError) as error:
        raise ValueError("Invalid voice session signature") from error
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid voice session signature")

    current = int(time.time()) if now is None else now
    if claims.get("iss") != ISSUER or claims.get("aud") != AUDIENCE:
        raise ValueError("Invalid voice session scope")
    expires_at = claims.get("exp")
    if not isinstance(expires_at, int) or expires_at <= current:
        raise ValueError("Voice session expired")
    not_before = claims.get("nbf")
    if isinstance(not_before, int) and not_before > current + 5:
        raise ValueError("Voice session not active")

    principal = claims.get("sub")
    language = claims.get("language")
    thread_id = claims.get("threadId")
    session_id = claims.get("jti")
    if not isinstance(principal, str) or not (
        principal.startswith("clerk:") or principal.startswith("install:")
    ):
        raise ValueError("Invalid voice session subject")
    if language not in {"as", "brx"}:
        raise ValueError("Invalid voice session language")
    if not isinstance(thread_id, str) or not thread_id or len(thread_id) > 128:
        raise ValueError("Invalid voice session thread")
    if not all(character.isalnum() or character in "_-" for character in thread_id):
        raise ValueError("Invalid voice session thread")
    if not isinstance(session_id, str) or not session_id:
        raise ValueError("Invalid voice session id")

    return VoiceSessionClaims(
        principal=principal,
        language=language,
        thread_id=thread_id,
        expires_at=expires_at,
        session_id=session_id,
    )
