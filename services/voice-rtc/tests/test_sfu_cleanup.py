import asyncio
import base64
import hashlib
import hmac
import importlib.util
import json
import os
import sys
import time
import types
import unittest
from pathlib import Path
from unittest import mock

import aiohttp
import httpx

from miithii_voice.cloudflare_sfu import CloudflareSFUConnection

SECRET = "voice-session-test-secret-0123456789abcdef"
APP_ID = "test-app"


def _segment(value: dict) -> str:
    raw = json.dumps(value, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _token(
    jti: str,
    *,
    issued_at: int | None = None,
    expires_at: int | None = None,
) -> str:
    now = int(time.time()) if issued_at is None else issued_at
    exp = now + 1200 if expires_at is None else expires_at
    header = _segment({"alg": "HS256", "typ": "JWT"})
    payload = _segment(
        {
            "iss": "miithii-api",
            "aud": "miithii-voice-rtc",
            "sub": "install:android_alpha_1234567890",
            "language": "brx",
            "threadId": f"voice-{jti}",
            "iat": now,
            "nbf": now - 5,
            "exp": exp,
            "jti": jti,
        }
    )
    unsigned = f"{header}.{payload}"
    signature = hmac.new(SECRET.encode(), unsigned.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{unsigned}.{encoded_signature}"


class _Image:
    @classmethod
    def debian_slim(cls, **_kwargs):
        return cls()

    def __getattr__(self, _name):
        return lambda *_args, **_kwargs: self


class _App:
    def __init__(self, _name):
        pass

    def function(self, **_kwargs):
        return lambda func: func


class _Secret:
    @classmethod
    def from_name(cls, _name):
        return cls()


def _load_modal_app():
    fake_modal = types.ModuleType("modal")
    fake_modal.Image = _Image
    fake_modal.App = _App
    fake_modal.Secret = _Secret
    fake_modal.asgi_app = lambda: (lambda func: func)

    source = Path(__file__).resolve().parents[1] / "modal_app.py"
    spec = importlib.util.spec_from_file_location("miithii_modal_app_test", source)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load modal_app.py")
    module = importlib.util.module_from_spec(spec)
    previous_modal = sys.modules.get("modal")
    sys.modules["modal"] = fake_modal
    try:
        spec.loader.exec_module(module)
    finally:
        if previous_modal is None:
            sys.modules.pop("modal", None)
        else:
            sys.modules["modal"] = previous_modal
    return module


class _ResponseContext:
    def __init__(self, backend, method, url, payload):
        self._backend = backend
        self._method = method
        self._url = url
        self._payload = payload
        self._response = None

    async def __aenter__(self):
        status, payload = await self._backend.handle(
            self._method,
            self._url,
            self._payload,
        )
        self._response = types.SimpleNamespace(status=status, json=lambda: None)

        async def response_json():
            return payload

        self._response.json = response_json
        return self._response

    async def __aexit__(self, *_args):
        return False


class _ClientSession:
    def __init__(self, backend, **_kwargs):
        self._backend = backend

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    def request(self, method, url, *, headers=None, json=None):
        del headers
        return _ResponseContext(self._backend, method, url, json)


class _CloudflareBackend:
    def __init__(self):
        self.sessions = {}
        self.calls = []
        self.next_session = 1
        self.block_next_tracks = False
        self.track_started = asyncio.Event()
        self.release_track = asyncio.Event()
        self.cleanup_observed = asyncio.Event()
        self.fail_next = None
        self.close_item_failures = {}
        self.close_item_error_codes = {}
        self.forced_responses = {}
        self.late_timeout_tracks = {}
        self.background_tasks = set()

    def add_session(self, session_id):
        self.sessions[session_id] = {"tracks": [], "dataChannels": []}

    def _path(self, url):
        return url.split(f"/apps/{APP_ID}", 1)[1]

    async def handle(self, method, url, payload):
        path = self._path(url)
        self.calls.append((method, path, payload))
        forced = self.forced_responses.get((method, path))
        if forced is not None:
            return forced
        if self.fail_next == (method, path):
            self.fail_next = None
            return 503, {"error": "sensitive-upstream-body"}

        if method == "POST" and path == "/sessions/new":
            session_id = f"cf-{self.next_session}"
            self.next_session += 1
            self.add_session(session_id)
            return 200, {"sessionId": session_id}

        parts = path.strip("/").split("/")
        if len(parts) < 2 or parts[0] != "sessions":
            return 404, {"error": "not found"}
        session_id = parts[1]
        state = self.sessions.get(session_id)
        if state is None:
            return 404, {"error": "session missing"}

        if method == "GET" and len(parts) == 2:
            return 200, {
                "tracks": [dict(item) for item in state["tracks"]],
                "dataChannels": [dict(item) for item in state["dataChannels"]],
            }

        suffix = "/".join(parts[2:])
        if method == "POST" and suffix == "tracks/new":
            late_delay = self.late_timeout_tracks.pop(path, None)
            if late_delay is not None:
                async def allocate_late_track():
                    await asyncio.sleep(late_delay)
                    for item in (payload or {}).get("tracks", []):
                        created = dict(item)
                        created.setdefault("mid", str(len(state["tracks"])))
                        created["status"] = "active"
                        state["tracks"].append(created)

                task = asyncio.create_task(allocate_late_track())
                self.background_tasks.add(task)
                task.add_done_callback(self.background_tasks.discard)
                raise TimeoutError("simulated lost response")
            if self.block_next_tracks:
                self.block_next_tracks = False
                self.track_started.set()
                await self.release_track.wait()
            tracks = []
            for item in (payload or {}).get("tracks", []):
                created = dict(item)
                created.setdefault("mid", str(len(state["tracks"])))
                created["status"] = "active"
                state["tracks"].append(created)
                tracks.append(dict(created))
            return 200, {"tracks": tracks}

        if method == "POST" and suffix == "datachannels/new":
            channels = []
            for item in (payload or {}).get("dataChannels", []):
                created = dict(item)
                created.setdefault("id", len(state["dataChannels"]) + 2)
                created["status"] = "active"
                state["dataChannels"].append(created)
                channels.append(dict(created))
            return 200, {"dataChannels": channels}

        if method == "PUT" and suffix == "datachannels/close":
            ids = {item["id"] for item in (payload or {}).get("dataChannels", [])}
            remaining_failures = self.close_item_failures.get(path, 0)
            if remaining_failures:
                self.close_item_failures[path] = remaining_failures - 1
                error_code = self.close_item_error_codes.get(path, "close_track_error")
                return 200, {
                    "dataChannels": [
                        {"id": value, "errorCode": error_code} for value in ids
                    ]
                }
            for item in state["dataChannels"]:
                if item.get("id") in ids:
                    item["status"] = "inactive"
            self._maybe_cleanup_observed()
            return 200, {"dataChannels": [{"id": value} for value in ids]}

        if method == "PUT" and suffix == "tracks/close":
            mids = {item["mid"] for item in (payload or {}).get("tracks", [])}
            remaining_failures = self.close_item_failures.get(path, 0)
            if remaining_failures:
                self.close_item_failures[path] = remaining_failures - 1
                error_code = self.close_item_error_codes.get(path, "close_track_error")
                return 200, {
                    "tracks": [
                        {"mid": value, "errorCode": error_code} for value in mids
                    ]
                }
            for item in state["tracks"]:
                if item.get("mid") in mids:
                    item["status"] = "inactive"
            self._maybe_cleanup_observed()
            return 200, {"tracks": [{"mid": value} for value in mids]}

        if method == "PUT" and suffix == "renegotiate":
            return 200, {}
        if method == "POST" and suffix == "datachannels/establish":
            return 200, {"dataChannel": {"id": 0}, "sessionDescription": {}}
        return 404, {"error": "unsupported fake operation"}

    def _maybe_cleanup_observed(self):
        resources = [
            item
            for state in self.sessions.values()
            for kind in ("tracks", "dataChannels")
            for item in state[kind]
        ]
        if resources and all(item.get("status") == "inactive" for item in resources):
            self.cleanup_observed.set()


class SFUCleanupTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.env = mock.patch.dict(
            os.environ,
            {
                "MIITHII_TESTING": "true",
                "VOICE_RTC_TOKEN": SECRET,
                "CALLS_APP_ID": APP_ID,
                "CALLS_APP_SECRET": "test-secret",
            },
        )
        self.env.start()
        module = _load_modal_app()
        module.SFU_CLEANUP_RECONCILE_DELAY_SECONDS = 0.01
        module.SFU_CLEANUP_RETRY_SECONDS = 0.16
        module.SFU_UNCERTAIN_RECONCILE_SECONDS = 0.16
        module.SFU_UNCERTAIN_RECONCILE_DELAYS = (0.02, 0.04, 0.08)
        self.module = module
        self.app = module.connect_app()
        self.backend = _CloudflareBackend()
        self.aiohttp_patch = mock.patch.object(
            aiohttp,
            "ClientSession",
            side_effect=lambda **kwargs: _ClientSession(self.backend, **kwargs),
        )
        self.aiohttp_patch.start()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://test",
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        if self.backend.background_tasks:
            await asyncio.gather(*list(self.backend.background_tasks), return_exceptions=True)
        self.aiohttp_patch.stop()
        self.env.stop()

    @staticmethod
    def _headers(jti):
        return {"authorization": f"Bearer {_token(jti)}"}

    async def _new_session(self, jti):
        response = await self.client.post(
            "/sfu/sessions/new",
            headers=self._headers(jti),
            json={},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["sessionId"]

    async def _wait_until(self, predicate, timeout=2):
        deadline = asyncio.get_running_loop().time() + timeout
        while not predicate():
            if asyncio.get_running_loop().time() >= deadline:
                self.fail("Timed out waiting for lifecycle condition")
            await asyncio.sleep(0.01)

    async def test_client_only_leave_closes_resources_and_is_idempotent(self):
        session_id = await self._new_session("attempt-client-only")
        headers = self._headers("attempt-client-only")
        track = await self.client.post(
            f"/sfu/sessions/{session_id}/tracks/new",
            headers=headers,
            json={"tracks": [{"location": "local", "mid": "0", "trackName": "mic"}]},
        )
        self.assertEqual(track.status_code, 200, track.text)
        channel = await self.client.post(
            f"/sfu/sessions/{session_id}/datachannels/new",
            headers=headers,
            json={"dataChannels": [{"location": "local", "dataChannelName": "chat"}]},
        )
        self.assertEqual(channel.status_code, 200, channel.text)

        leave = await self.client.post(
            "/sfu/leave",
            headers=headers,
            json={"clientSessionId": session_id},
        )
        self.assertEqual(leave.status_code, 200, leave.text)
        self.assertEqual(leave.json(), {"status": "closing"})
        await asyncio.wait_for(self.backend.cleanup_observed.wait(), timeout=2)

        close_paths = [path for method, path, _payload in self.backend.calls if method == "PUT"]
        self.assertLess(
            close_paths.index(f"/sessions/{session_id}/datachannels/close"),
            close_paths.index(f"/sessions/{session_id}/tracks/close"),
        )
        track_close = next(
            payload
            for method, path, payload in self.backend.calls
            if method == "PUT" and path == f"/sessions/{session_id}/tracks/close"
        )
        self.assertIs(track_close["force"], True)

        repeated = await self.client.post(
            "/sfu/leave",
            headers=headers,
            json={"clientSessionId": session_id},
        )
        self.assertEqual(repeated.status_code, 200, repeated.text)

    async def test_leave_rejects_cross_capability_session(self):
        session_id = await self._new_session("attempt-owner")
        response = await self.client.post(
            "/sfu/leave",
            headers=self._headers("attempt-other"),
            json={"clientSessionId": session_id},
        )
        self.assertEqual(response.status_code, 404, response.text)
        self.assertNotIn(
            f"/sessions/{session_id}/tracks/close",
            [path for _method, path, _payload in self.backend.calls],
        )

    async def test_expired_capability_is_rejected_by_normal_sfu_route(self):
        now = int(time.time())
        expired = _token(
            "attempt-expired-normal",
            issued_at=now - 1800,
            expires_at=now - 30,
        )
        response = await self.client.post(
            "/sfu/start",
            headers={"authorization": f"Bearer {expired}"},
            json={"transport": "cloudflare-sfu", "body": {"language": "brx"}},
        )
        self.assertEqual(response.status_code, 401, response.text)

    async def test_leave_accepts_same_owned_capability_within_cleanup_grace(self):
        now = int(time.time())
        jti = "attempt-expired-cleanup"
        session_id = "expired-cleanup-session"
        lifecycle = self.app.state.sfu_lifecycle
        lifecycle["register_session"](session_id, jti)
        self.backend.add_session(session_id)
        expired = _token(
            jti,
            issued_at=now - 1800,
            expires_at=now - 30,
        )

        response = await self.client.post(
            "/sfu/leave",
            headers={"authorization": f"Bearer {expired}"},
            json={"clientSessionId": session_id},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"status": "closing"})
        await self._wait_until(lambda: not lifecycle["cleanup_tasks"])
        self.assertTrue(lifecycle["attempts"][jti]["closed"])

    async def test_leave_rejects_capability_past_cleanup_grace(self):
        now = int(time.time())
        jti = "attempt-far-expired-cleanup"
        session_id = "far-expired-cleanup-session"
        lifecycle = self.app.state.sfu_lifecycle
        lifecycle["register_session"](session_id, jti)
        self.backend.add_session(session_id)
        far_expired = _token(
            jti,
            issued_at=now - 7200,
            expires_at=now - 3700,
        )

        response = await self.client.post(
            "/sfu/leave",
            headers={"authorization": f"Bearer {far_expired}"},
            json={"clientSessionId": session_id},
        )
        self.assertEqual(response.status_code, 401, response.text)
        self.assertIn(session_id, lifecycle["active_sessions"])

    async def test_leave_waits_for_inflight_mutation_then_closes_late_track(self):
        session_id = await self._new_session("attempt-race")
        headers = self._headers("attempt-race")
        self.backend.block_next_tracks = True
        mutation = asyncio.create_task(
            self.client.post(
                f"/sfu/sessions/{session_id}/tracks/new",
                headers=headers,
                json={
                    "tracks": [{"location": "local", "mid": "7", "trackName": "late-mic"}]
                },
            )
        )
        await asyncio.wait_for(self.backend.track_started.wait(), timeout=1)
        leave = asyncio.create_task(
            self.client.post(
                "/sfu/leave",
                headers=headers,
                json={"clientSessionId": session_id},
            )
        )
        await asyncio.sleep(0.05)
        self.assertFalse(leave.done())

        self.backend.release_track.set()
        mutation_response = await asyncio.wait_for(mutation, timeout=1)
        leave_response = await asyncio.wait_for(leave, timeout=1)
        self.assertEqual(mutation_response.status_code, 200, mutation_response.text)
        self.assertEqual(leave_response.status_code, 200, leave_response.text)
        await asyncio.wait_for(self.backend.cleanup_observed.wait(), timeout=2)
        self.assertEqual(self.backend.sessions[session_id]["tracks"][0]["status"], "inactive")

    async def test_leave_waits_across_entire_logical_negotiation(self):
        client_session_id = await self._new_session("attempt-logical")
        lifecycle = self.app.state.sfu_lifecycle
        between_steps = asyncio.Event()
        resume = asyncio.Event()
        modal_session_id = "logical-modal"
        connection_holder = {}

        async def fake_negotiation(*, authorization=None):
            del authorization
            lifecycle["register_session"](modal_session_id, "attempt-logical")
            self.backend.add_session(modal_session_id)
            self.backend.sessions[modal_session_id]["tracks"].append(
                {
                    "location": "local",
                    "mid": "0",
                    "trackName": "bot",
                    "status": "active",
                }
            )
            between_steps.set()
            await resume.wait()
            connection = CloudflareSFUConnection(connection_timeout_secs=1)
            connection_holder["connection"] = connection
            lifecycle["peers"][modal_session_id] = {"connection": connection}
            return {"ok": True}

        serialized = lifecycle["serialize_negotiation"](fake_negotiation)
        negotiation = asyncio.create_task(
            serialized(authorization=f"Bearer {_token('attempt-logical')}")
        )
        await asyncio.wait_for(between_steps.wait(), timeout=1)
        leave = asyncio.create_task(
            self.client.post(
                "/sfu/leave",
                headers=self._headers("attempt-logical"),
                json={"clientSessionId": client_session_id},
            )
        )
        await asyncio.sleep(0.05)
        self.assertFalse(leave.done())

        resume.set()
        self.assertEqual(await asyncio.wait_for(negotiation, timeout=1), {"ok": True})
        leave_response = await asyncio.wait_for(leave, timeout=1)
        self.assertEqual(leave_response.status_code, 200, leave_response.text)
        await self._wait_until(
            lambda: connection_holder["connection"].pc.connectionState == "closed"
        )
        self.assertNotIn(modal_session_id, lifecycle["active_sessions"])

    async def test_logical_negotiation_local_exception_runs_central_cleanup(self):
        client_session_id = await self._new_session("attempt-local-error")
        lifecycle = self.app.state.sfu_lifecycle
        modal_session_id = "local-error-modal"
        connection = CloudflareSFUConnection(connection_timeout_secs=1)

        async def failing_negotiation(*, authorization=None):
            del authorization
            lifecycle["register_session"](modal_session_id, "attempt-local-error")
            self.backend.add_session(modal_session_id)
            lifecycle["peers"][modal_session_id] = {"connection": connection}
            raise RuntimeError("local SDP failure")

        serialized = lifecycle["serialize_negotiation"](failing_negotiation)
        with self.assertRaisesRegex(RuntimeError, "local SDP failure"):
            await serialized(authorization=f"Bearer {_token('attempt-local-error')}")

        self.assertEqual(connection.pc.connectionState, "closed")
        self.assertNotIn(client_session_id, lifecycle["active_sessions"])
        self.assertNotIn(modal_session_id, lifecycle["active_sessions"])

    async def test_partial_close_error_auto_retries_after_one_leave(self):
        jti = "attempt-partial-close"
        session_id = await self._new_session(jti)
        headers = self._headers(jti)
        track = await self.client.post(
            f"/sfu/sessions/{session_id}/tracks/new",
            headers=headers,
            json={"tracks": [{"location": "local", "mid": "9", "trackName": "mic"}]},
        )
        self.assertEqual(track.status_code, 200, track.text)
        close_path = f"/sessions/{session_id}/tracks/close"
        self.backend.close_item_failures[close_path] = 2
        self.backend.close_item_error_codes[close_path] = "internal_error"

        first_leave = await self.client.post(
            "/sfu/leave",
            headers=headers,
            json={"clientSessionId": session_id},
        )
        self.assertEqual(first_leave.status_code, 200, first_leave.text)
        lifecycle = self.app.state.sfu_lifecycle
        await self._wait_until(lambda: not lifecycle["cleanup_tasks"], timeout=1)
        self.assertTrue(lifecycle["attempts"][jti]["closed"])
        self.assertNotIn(session_id, lifecycle["active_sessions"])
        self.assertEqual(self.backend.sessions[session_id]["tracks"][0]["status"], "inactive")

    async def test_persistent_cleanup_failure_stops_bounded_and_remains_unresolved(self):
        jti = "attempt-persistent-close-failure"
        session_id = await self._new_session(jti)
        headers = self._headers(jti)
        track = await self.client.post(
            f"/sfu/sessions/{session_id}/tracks/new",
            headers=headers,
            json={"tracks": [{"location": "local", "mid": "19", "trackName": "mic"}]},
        )
        self.assertEqual(track.status_code, 200, track.text)
        close_path = f"/sessions/{session_id}/tracks/close"
        self.backend.close_item_failures[close_path] = 1000
        self.backend.close_item_error_codes[close_path] = "internal_error"

        leave = await self.client.post(
            "/sfu/leave",
            headers=headers,
            json={"clientSessionId": session_id},
        )
        self.assertEqual(leave.status_code, 200, leave.text)
        lifecycle = self.app.state.sfu_lifecycle
        await self._wait_until(lambda: not lifecycle["cleanup_tasks"], timeout=1)

        attempt = lifecycle["attempts"][jti]
        self.assertFalse(attempt["closed"])
        self.assertIn(session_id, lifecycle["active_sessions"])
        close_calls = [
            call
            for call in self.backend.calls
            if call[0] == "PUT" and call[1] == close_path
        ]
        self.assertGreaterEqual(len(close_calls), 2)
        self.assertLess(len(close_calls), 20)

    async def test_later_uncertainty_refreshes_deadline_and_retry_cadence(self):
        jti = "attempt-refresh-uncertainty"
        lifecycle = self.app.state.sfu_lifecycle
        lifecycle["mark_uncertain"](jti)
        attempt = lifecycle["attempts"][jti]
        first_deadline = attempt["uncertain_deadline"]
        attempt["cleanup_retry_index"] = 3

        await asyncio.sleep(0.12)
        refreshed_at = time.monotonic()
        lifecycle["mark_uncertain"](jti)
        refreshed_deadline = attempt["uncertain_deadline"]

        self.assertGreater(refreshed_deadline, first_deadline)
        self.assertGreaterEqual(refreshed_deadline, refreshed_at + 0.14)
        self.assertEqual(attempt["cleanup_retry_index"], 0)

    async def test_uncertain_mutation_keeps_cleanup_open_until_delayed_reconciliation(self):
        jti = "attempt-uncertain-timeout"
        session_id = await self._new_session(jti)
        headers = self._headers(jti)
        mutation_path = f"/sessions/{session_id}/tracks/new"
        self.backend.late_timeout_tracks[mutation_path] = 0.06

        response = await self.client.post(
            f"/sfu{mutation_path}",
            headers=headers,
            json={"tracks": [{"location": "local", "mid": "11", "trackName": "late"}]},
        )
        self.assertEqual(response.status_code, 503, response.text)
        lifecycle = self.app.state.sfu_lifecycle
        self.assertFalse(lifecycle["attempts"][jti]["closed"])

        await self._wait_until(lambda: bool(self.backend.sessions[session_id]["tracks"]), timeout=1)
        await self._wait_until(lambda: not lifecycle["cleanup_tasks"], timeout=1)
        self.assertTrue(lifecycle["attempts"][jti]["closed"])
        self.assertEqual(self.backend.sessions[session_id]["tracks"][0]["status"], "inactive")

    async def test_cancelled_mutation_task_still_runs_retained_cleanup(self):
        jti = "attempt-cancelled-mutation-task"
        session_id = await self._new_session(jti)
        lifecycle = self.app.state.sfu_lifecycle

        async def cancelled_negotiation(*, authorization=None):
            del authorization
            raise asyncio.CancelledError

        serialized = lifecycle["serialize_negotiation"](cancelled_negotiation)
        with self.assertRaises(asyncio.CancelledError):
            await serialized(authorization=f"Bearer {_token(jti)}")

        self.assertFalse(lifecycle["attempts"][jti]["closed"])
        await self._wait_until(lambda: not lifecycle["cleanup_tasks"], timeout=1)
        self.assertTrue(lifecycle["attempts"][jti]["closed"])
        self.assertNotIn(session_id, lifecycle["active_sessions"])

    async def test_close_track_error_counts_as_already_closed(self):
        jti = "attempt-close-track-error"
        session_id = await self._new_session(jti)
        headers = self._headers(jti)
        track = await self.client.post(
            f"/sfu/sessions/{session_id}/tracks/new",
            headers=headers,
            json={"tracks": [{"location": "local", "mid": "12", "trackName": "mic"}]},
        )
        self.assertEqual(track.status_code, 200, track.text)
        close_path = f"/sessions/{session_id}/tracks/close"
        self.backend.close_item_failures[close_path] = 2

        leave = await self.client.post(
            "/sfu/leave",
            headers=headers,
            json={"clientSessionId": session_id},
        )
        self.assertEqual(leave.status_code, 200, leave.text)
        lifecycle = self.app.state.sfu_lifecycle
        await self._wait_until(lambda: not lifecycle["cleanup_tasks"])
        self.assertTrue(lifecycle["attempts"][jti]["closed"])
        self.assertNotIn(session_id, lifecycle["active_sessions"])

    async def test_top_level_error_code_is_preserved_and_not_found_is_not_session_gone(self):
        lifecycle = self.app.state.sfu_lifecycle
        for status in (404, 410):
            with self.subTest(status=status):
                jti = f"attempt-top-level-error-{status}"
                session_id = await self._new_session(jti)
                path = f"/sessions/{session_id}"
                self.backend.forced_responses[("GET", path)] = (
                    status,
                    {
                        "errorCode": "not_found",
                        "errorDescription": "sensitive upstream description",
                    },
                )

                with self.assertLogs(level="WARNING") as captured:
                    with self.assertRaises(Exception) as raised:
                        await lifecycle["calls_request"]("GET", path)
                self.assertEqual(getattr(raised.exception, "sfu_status", None), status)
                self.assertEqual(getattr(raised.exception, "sfu_error_code", None), "not_found")
                logs = "\n".join(captured.output)
                self.assertIn("error_code=not_found", logs)
                self.assertNotIn("sensitive upstream description", logs)

                leave = await self.client.post(
                    "/sfu/leave",
                    headers=self._headers(jti),
                    json={"clientSessionId": session_id},
                )
                self.assertEqual(leave.status_code, 200, leave.text)
                await self._wait_until(lambda: not lifecycle["cleanup_tasks"])
                self.assertFalse(lifecycle["attempts"][jti]["closed"])
                self.assertIn(session_id, lifecycle["active_sessions"])

    async def test_pre_bot_peer_leave_closes_pc_and_probe_task(self):
        client_session_id = await self._new_session("attempt-pre-bot")
        lifecycle = self.app.state.sfu_lifecycle
        modal_session_id = "modal-pre-bot"
        lifecycle["register_session"](modal_session_id, "attempt-pre-bot")
        self.backend.add_session(modal_session_id)
        self.backend.sessions[modal_session_id]["tracks"].append(
            {"location": "local", "mid": "0", "trackName": "bot", "status": "active"}
        )
        self.backend.sessions[modal_session_id]["dataChannels"].append(
            {"location": "local", "id": 4, "dataChannelName": "chat", "status": "active"}
        )
        connection = CloudflareSFUConnection(connection_timeout_secs=1)
        probe_task = asyncio.create_task(asyncio.sleep(30))
        lifecycle["peers"][modal_session_id] = {
            "connection": connection,
            "inputTask": probe_task,
            "remoteSessionId": client_session_id,
        }

        response = await self.client.post(
            "/sfu/leave",
            headers=self._headers("attempt-pre-bot"),
            json={
                "clientSessionId": client_session_id,
                "modalSessionId": modal_session_id,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        await asyncio.wait_for(self.backend.cleanup_observed.wait(), timeout=2)
        for _ in range(20):
            if probe_task.done() and connection.pc.connectionState == "closed":
                break
            await asyncio.sleep(0.02)
        self.assertTrue(probe_task.done())
        self.assertEqual(connection.pc.connectionState, "closed")
        self.assertNotIn(modal_session_id, lifecycle["active_sessions"])
        self.assertNotIn(client_session_id, lifecycle["active_sessions"])

    async def test_upstream_failure_logs_only_safe_request_metadata(self):
        session_id = await self._new_session("attempt-log")
        path = f"/sessions/{session_id}/tracks/new"
        self.backend.fail_next = ("POST", path)
        with self.assertLogs(level="WARNING") as captured:
            response = await self.client.post(
                f"/sfu{path}",
                headers=self._headers("attempt-log"),
                json={"tracks": [{"location": "local", "mid": "0", "trackName": "mic"}]},
            )
        self.assertEqual(response.status_code, 503, response.text)
        logs = "\n".join(captured.output)
        self.assertIn(f"method=POST path={path} status=503", logs)
        self.assertNotIn("sensitive-upstream-body", logs)


if __name__ == "__main__":
    unittest.main()
