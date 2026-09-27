from __future__ import annotations

import unittest

from miithii_voice.cloudflare_pcm import CloudflarePCMTransport
from miithii_voice.pcm_session import PCMSessionRegistry


class FakeSocket:
    def __init__(self):
        self.sent: list[bytes] = []
        self.closed: list[int] = []

    async def send_bytes(self, data: bytes) -> None:
        self.sent.append(data)

    async def close(self, code: int = 1000) -> None:
        self.closed.append(code)


class PCMSessionLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_registry_allows_one_active_session_per_signed_capability(self):
        registry = PCMSessionRegistry()
        first_transport = CloudflarePCMTransport()
        session, created = await registry.create(
            owner_id="voice-jti-1",
            language="as",
            expires_at=4_000_000_000,
            transport=first_transport,
        )
        self.assertTrue(created)

        duplicate_transport = CloudflarePCMTransport()
        duplicate, created = await registry.create(
            owner_id="voice-jti-1",
            language="as",
            expires_at=4_000_000_000,
            transport=duplicate_transport,
        )
        self.assertFalse(created)
        self.assertIs(duplicate, session)
        self.assertIs(session.transport, first_transport)

        self.assertIsNone(await registry.get_owned(session.session_id, "other-jti"))
        self.assertIs(await registry.get_owned(session.session_id, "voice-jti-1"), session)

        await duplicate_transport.disconnect()
        await registry.close(session, reason="test")

    async def test_close_is_idempotent_and_records_reason(self):
        registry = PCMSessionRegistry()
        session, _ = await registry.create(
            owner_id="voice-jti-close",
            language="brx",
            expires_at=4_000_000_000,
            transport=CloudflarePCMTransport(),
        )

        self.assertTrue(await registry.close(session, reason="control-plane-close"))
        self.assertFalse(await registry.close(session, reason="second-close"))
        self.assertEqual(session.state, "closed")
        self.assertEqual(session.close_reason, "control-plane-close")
        self.assertIsNotNone(session.closed_at)

    async def test_reconnect_replaces_socket_without_stale_detach_clobbering_new_one(self):
        transport = CloudflarePCMTransport()
        old = FakeSocket()
        new = FakeSocket()

        await transport.attach_mic(old)
        await transport.attach_mic(new)
        self.assertEqual(old.closed, [1012])
        self.assertTrue(transport.mic_connected)

        await transport.detach_mic(old)
        self.assertTrue(transport.mic_connected)
        await transport.detach_mic(new)
        self.assertFalse(transport.mic_connected)
        await transport.disconnect()

    async def test_bot_packets_go_only_to_current_socket(self):
        transport = CloudflarePCMTransport()
        old = FakeSocket()
        new = FakeSocket()
        await transport.attach_bot(old)
        await transport.attach_bot(new)

        self.assertTrue(await transport.send_bot_packet(b"packet"))
        self.assertEqual(old.sent, [])
        self.assertEqual(new.sent, [b"packet"])
        await transport.disconnect()
        self.assertEqual(new.closed, [1000])

    async def test_endpoint_tokens_are_direction_scoped(self):
        registry = PCMSessionRegistry()
        session, _ = await registry.create(
            owner_id="voice-jti-token",
            language="as",
            expires_at=4_000_000_000,
            transport=CloudflarePCMTransport(),
        )
        self.assertTrue(session.endpoint_token_matches("mic", session.mic_token))
        self.assertTrue(session.endpoint_token_matches("bot", session.bot_token))
        self.assertFalse(session.endpoint_token_matches("mic", session.bot_token))
        self.assertFalse(session.endpoint_token_matches("bot", session.mic_token))
        await registry.close(session, reason="test")
