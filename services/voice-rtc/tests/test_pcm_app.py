from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from miithii_voice.pcm_app import create_pcm_app

VOICE_SECRET = "pcm-server-test-secret-0123456789abcdef"


def _segment(value: dict) -> str:
    raw = json.dumps(value, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _voice_token(*, session_id: str = "pcm-owner-1", language: str = "brx") -> str:
    now = int(time.time())
    header = _segment({"alg": "HS256", "typ": "JWT"})
    payload = _segment(
        {
            "iss": "miithii-api",
            "aud": "miithii-voice-rtc",
            "sub": "install:pcm_test_device",
            "language": language,
            "threadId": "pcm-test-thread",
            "iat": now,
            "nbf": now - 1,
            "exp": now + 600,
            "jti": session_id,
        }
    )
    unsigned = f"{header}.{payload}"
    signature = hmac.new(VOICE_SECRET.encode(), unsigned.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{unsigned}.{encoded_signature}"


class FakeRealtimeClient:
    def __init__(self, *, fail_bot_adapter: bool = False):
        self.calls: list[tuple[str, str, dict | None]] = []
        self.sessions_created = 0
        self.fail_bot_adapter = fail_bot_adapter

    async def request(self, method: str, path: str, payload: dict | None = None) -> dict:
        self.calls.append((method, path, payload))
        if method == "POST" and path == "/sessions/new":
            self.sessions_created += 1
            session_id = "publisher-sfu" if self.sessions_created == 1 else "subscriber-sfu"
            return {"sessionId": session_id}
        if method == "POST" and path == "/sessions/publisher-sfu/tracks/new":
            return {
                "sessionDescription": {"type": "answer", "sdp": "sfu-publisher-answer"},
                "tracks": [{"mid": "audio-mid-7", "trackName": "microphone"}],
            }
        if method == "POST" and path == "/adapters/websocket/new":
            track = (payload or {}).get("tracks", [{}])[0]
            if track.get("location") == "remote":
                return {
                    "tracks": [
                        {
                            "adapterId": "mic-adapter",
                            "trackName": "microphone",
                            "sessionId": "publisher-sfu",
                        }
                    ]
                }
            if self.fail_bot_adapter:
                raise RuntimeError("bot adapter failed")
            return {
                "tracks": [
                    {
                        "adapterId": "bot-adapter",
                        "trackName": "miithii-bot",
                        "sessionId": "bot-publisher-sfu",
                    }
                ]
            }
        if method == "POST" and path == "/sessions/subscriber-sfu/tracks/new":
            return {
                "sessionDescription": {"type": "offer", "sdp": "sfu-subscriber-offer"},
                "tracks": [{"mid": "subscriber-mid-4", "trackName": "miithii-bot"}],
            }
        if method == "PUT" and path == "/sessions/subscriber-sfu/renegotiate":
            return {}
        if method == "POST" and path == "/adapters/websocket/close":
            adapter_id = (payload or {})["tracks"][0]["adapterId"]
            return {"tracks": [{"adapterId": adapter_id, "bytesProcessed": 1000}]}
        if method == "PUT" and path.endswith("/tracks/close"):
            return {"tracks": []}
        raise AssertionError(f"unexpected Realtime call: {method} {path} {payload}")


async def fake_ice_config(_ttl: int) -> list[dict]:
    return [{"urls": ["stun:stun.cloudflare.com:3478"]}]


async def fake_bot_runner(transport, _runner_args, *, session_token=None):
    del session_token
    disconnected = asyncio.Event()

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(_transport, _client):
        disconnected.set()

    # The production runner reaches these through BaseInput/BaseOutput StartFrame setup.
    await transport._mark_pipeline_part_ready()
    await transport._mark_pipeline_part_ready()
    await disconnected.wait()


class PCMAppContractTests(unittest.TestCase):
    def setUp(self):
        self.realtime = FakeRealtimeClient()
        self.env = patch.dict(
            os.environ,
            {
                "VOICE_RTC_TOKEN": VOICE_SECRET,
                "MIITHII_PCM_PUBLIC_BASE_URL": "https://voice-pcm.example.test",
            },
            clear=False,
        )
        self.env.start()
        self.addCleanup(self.env.stop)
        self.app = create_pcm_app(
            bot_runner=fake_bot_runner,
            realtime_client=self.realtime,
            ice_config_provider=fake_ice_config,
        )
        self.client_context = TestClient(self.app)
        self.client = self.client_context.__enter__()
        self.addCleanup(self.client_context.__exit__, None, None, None)
        self.token = _voice_token()
        self.headers = {"authorization": f"Bearer {self.token}"}

    def _start(self) -> dict:
        response = self.client.post(
            "/pcm/start",
            headers=self.headers,
            json={"language": "brx"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_full_control_contract_keeps_adapter_credentials_private(self):
        started = self._start()
        self.assertEqual(
            set(started),
            {"voiceSessionId", "iceConfig"},
        )
        self.assertEqual(
            started["iceConfig"],
            {"iceServers": [{"urls": ["stun:stun.cloudflare.com:3478"]}]},
        )
        self.assertNotIn("token", json.dumps(started).lower())
        self.assertNotIn("endpoint", json.dumps(started).lower())
        voice_session_id = started["voiceSessionId"]

        missing_mid = self.client.post(
            f"/pcm/{voice_session_id}/publish",
            headers=self.headers,
            json={"sessionDescription": {"type": "offer", "sdp": "phone-offer"}},
        )
        self.assertEqual(missing_mid.status_code, 400, missing_mid.text)

        published = self.client.post(
            f"/pcm/{voice_session_id}/publish",
            headers=self.headers,
            json={
                "mid": "audio-mid-7",
                "sessionDescription": {"type": "offer", "sdp": "phone-offer"},
            },
        )
        self.assertEqual(published.status_code, 200, published.text)
        self.assertEqual(
            published.json(),
            {
                "sessionDescription": {"type": "answer", "sdp": "sfu-publisher-answer"},
                "botPublication": {
                    "sessionId": "bot-publisher-sfu",
                    "trackName": "miithii-bot",
                },
            },
        )

        publisher_track_call = next(
            call for call in self.realtime.calls if call[1] == "/sessions/publisher-sfu/tracks/new"
        )
        self.assertEqual(publisher_track_call[2]["tracks"][0]["mid"], "audio-mid-7")
        self.assertEqual(
            publisher_track_call[2]["sessionDescription"],
            {"type": "offer", "sdp": "phone-offer"},
        )

        adapter_calls = [
            call for call in self.realtime.calls if call[:2] == ("POST", "/adapters/websocket/new")
        ]
        self.assertEqual(len(adapter_calls), 2)
        microphone_adapter = adapter_calls[0][2]["tracks"][0]
        bot_adapter = adapter_calls[1][2]["tracks"][0]
        self.assertEqual(microphone_adapter["location"], "remote")
        self.assertEqual(microphone_adapter["outputCodec"], "pcm")
        self.assertIn("/pcm/media/", microphone_adapter["endpoint"])
        self.assertIn("?token=", microphone_adapter["endpoint"])
        self.assertEqual(bot_adapter["location"], "local")
        self.assertEqual(bot_adapter["inputCodec"], "pcm")
        self.assertNotIn("mode", bot_adapter)

        subscribed = self.client.post(
            f"/pcm/{voice_session_id}/subscribe",
            headers=self.headers,
            json={"botPublication": published.json()["botPublication"]},
        )
        self.assertEqual(subscribed.status_code, 200, subscribed.text)
        self.assertEqual(
            subscribed.json(),
            {
                "subscriberSessionId": "subscriber-sfu",
                "sessionDescription": {"type": "offer", "sdp": "sfu-subscriber-offer"},
            },
        )

        answered = self.client.post(
            f"/pcm/{voice_session_id}/subscribe-answer",
            headers=self.headers,
            json={
                "subscriberSessionId": "subscriber-sfu",
                "sessionDescription": {"type": "answer", "sdp": "phone-answer"},
            },
        )
        self.assertEqual(answered.status_code, 200, answered.text)
        renegotiate = next(
            call
            for call in self.realtime.calls
            if call[1] == "/sessions/subscriber-sfu/renegotiate"
        )
        self.assertEqual(
            renegotiate[2],
            {"sessionDescription": {"type": "answer", "sdp": "phone-answer"}},
        )

        stopped = self.client.post(
            f"/pcm/{voice_session_id}/stop",
            headers=self.headers,
            json={},
        )
        self.assertEqual(stopped.status_code, 200, stopped.text)
        cleanup_paths = [path for _method, path, _payload in self.realtime.calls]
        self.assertIn("/adapters/websocket/close", cleanup_paths)
        self.assertIn("/sessions/publisher-sfu/tracks/close", cleanup_paths)
        self.assertIn("/sessions/subscriber-sfu/tracks/close", cleanup_paths)

    def test_partial_publication_failure_retires_owned_resources(self):
        realtime = FakeRealtimeClient(fail_bot_adapter=True)
        app = create_pcm_app(
            bot_runner=fake_bot_runner,
            realtime_client=realtime,
            ice_config_provider=fake_ice_config,
        )
        with TestClient(app) as client:
            started_response = client.post(
                "/pcm/start",
                headers=self.headers,
                json={"language": "brx"},
            )
            self.assertEqual(started_response.status_code, 200, started_response.text)
            voice_session_id = started_response.json()["voiceSessionId"]
            failed = client.post(
                f"/pcm/{voice_session_id}/publish",
                headers=self.headers,
                json={
                    "mid": "audio-mid-7",
                    "sessionDescription": {"type": "offer", "sdp": "phone-offer"},
                },
            )
            self.assertEqual(failed.status_code, 503, failed.text)

            cleanup_paths = [path for _method, path, _payload in realtime.calls]
            self.assertIn("/adapters/websocket/close", cleanup_paths)
            self.assertIn("/sessions/publisher-sfu/tracks/close", cleanup_paths)
            status = client.get(
                f"/pcm/{voice_session_id}/status",
                headers=self.headers,
            )
            self.assertEqual(status.status_code, 404, status.text)


if __name__ == "__main__":
    unittest.main()
