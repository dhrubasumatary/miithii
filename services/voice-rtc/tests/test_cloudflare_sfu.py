import json
import unittest
from unittest.mock import AsyncMock, Mock

from miithii_voice.cloudflare_sfu import CloudflareSFUConnection


class _FakeTrack:
    kind = "audio"

    async def recv(self):
        return None

    def stop(self):
        pass


class _FakeReceiver:
    def __init__(self):
        self.track = _FakeTrack()
        self._enabled = False


class _FakeChannel:
    def __init__(self, ready_state="connecting"):
        self.readyState = ready_state
        self.handlers = {}
        self.sent = []

    def on(self, event):
        def register(handler):
            self.handlers[event] = handler
            return handler

        return register

    def send(self, message):
        self.sent.append(message)


class CloudflareSFUConnectionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.connection = CloudflareSFUConnection()

    async def asyncTearDown(self):
        await self.connection.pc.close()

    async def test_explicit_audio_transceivers_split_input_and_output(self):
        receiver = _FakeReceiver()
        output_sender = Mock()
        input_transceiver = Mock(receiver=receiver)
        output_transceiver = Mock(sender=output_sender)

        self.connection.bind_audio_input(input_transceiver)
        self.connection.bind_audio_output(output_transceiver)

        wrapped_input = self.connection.audio_input_track()
        replacement = _FakeTrack()
        self.connection.replace_audio_track(replacement)

        self.assertIs(wrapped_input._track, receiver.track)
        output_sender.replaceTrack.assert_called_once_with(replacement)

    async def test_negotiated_data_channel_delivers_rtvi_messages(self):
        channel = _FakeChannel(ready_state="open")
        self.connection.is_connected = Mock(return_value=True)
        self.connection._call_event_handler = AsyncMock()
        self.connection.attach_data_channel(channel)

        payload = {"label": "rtvi-ai", "type": "client-ready", "data": {}}
        await channel.handlers["message"](json.dumps(payload))

        self.connection._call_event_handler.assert_awaited_once_with("app-message", payload)

    async def test_negotiated_data_channel_flushes_queued_messages(self):
        channel = _FakeChannel()
        self.connection.send_app_message({"type": "queued"})
        self.connection.attach_data_channel(channel)

        channel.readyState = "open"
        await channel.handlers["open"]()

        self.assertEqual(channel.sent, [json.dumps({"type": "queued"})])

    async def test_ping_updates_liveness_without_emitting_app_message(self):
        channel = _FakeChannel(ready_state="open")
        self.connection._call_event_handler = AsyncMock()
        self.connection.attach_data_channel(channel)

        await channel.handlers["message"]("ping: 123")

        self.assertIsNotNone(self.connection._last_received_time)
        self.connection._call_event_handler.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
