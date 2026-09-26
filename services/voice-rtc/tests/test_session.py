import base64
import hashlib
import hmac
import json
import unittest

from miithii_voice.session import verify_voice_session


def _segment(value: dict) -> str:
    raw = json.dumps(value, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _token(secret: str, *, exp: int = 2_000, subject: str = "clerk:user_test") -> str:
    header = _segment({"alg": "HS256", "typ": "JWT"})
    payload = _segment(
        {
            "iss": "miithii-api",
            "aud": "miithii-voice-rtc",
            "sub": subject,
            "language": "brx",
            "threadId": "voice-session-1",
            "iat": 1_000,
            "nbf": 995,
            "exp": exp,
            "jti": "session-1",
        }
    )
    unsigned = f"{header}.{payload}"
    signature = hmac.new(secret.encode(), unsigned.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{unsigned}.{encoded_signature}"


class VoiceSessionTests(unittest.TestCase):
    def test_scoped_session_is_verified_and_carries_language(self):
        secret = "voice-session-test-secret-0123456789abcdef"
        claims = verify_voice_session(_token(secret), secret, now=1_100)
        self.assertEqual(claims.principal, "clerk:user_test")
        self.assertEqual(claims.language, "brx")
        self.assertEqual(claims.thread_id, "voice-session-1")

    def test_install_scoped_session_is_supported(self):
        secret = "voice-session-test-secret-0123456789abcdef"
        claims = verify_voice_session(
            _token(secret, subject="install:android_alpha_1234567890"), secret, now=1_100
        )
        self.assertEqual(claims.principal, "install:android_alpha_1234567890")

    def test_tampered_or_expired_session_is_rejected(self):
        secret = "voice-session-test-secret-0123456789abcdef"
        token = _token(secret)
        with self.assertRaisesRegex(ValueError, "signature"):
            verify_voice_session(f"{token[:-1]}x", secret, now=1_100)
        with self.assertRaisesRegex(ValueError, "expired"):
            verify_voice_session(_token(secret, exp=1_050), secret, now=1_100)


if __name__ == "__main__":
    unittest.main()
