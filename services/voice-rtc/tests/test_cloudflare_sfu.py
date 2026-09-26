import json
import unittest
from struct import pack
from unittest.mock import AsyncMock, Mock

from aiortc.rtcsctptransport import DATA_CHANNEL_OPEN, WEBRTC_DCEP

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
        self.label = "chat"
        self.id = 7
        self.negotiated = True
        self.ordered = True
        self.bufferedAmount = 0
        self.handlers = {}
        self.sent = []

    def on(self, event):
        def register(handler):
            self.handlers[event] = handler
            return handler

        return register

    def send(self, message):
        self.bufferedAmount += len(message.encode("utf-8"))
        self.sent.append(message)
        self.bufferedAmount = 0


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

    async def test_send_app_message_records_safe_channel_metadata(self):
        channel = _FakeChannel(ready_state="open")
        self.connection.attach_data_channel(channel)

        self.connection.send_app_message(
            {"label": "rtvi-ai", "type": "server-ready", "data": {}}
        )
        state = self.connection.data_channel_debug_state()

        self.assertEqual(len(channel.sent), 1)
        self.assertEqual(state["label"], "chat")
        self.assertEqual(state["id"], 7)
        self.assertEqual(state["readyState"], "open")
        self.assertEqual(state["sentMessages"], 1)
        self.assertGreater(state["sentBytes"], 0)
        self.assertEqual(state["lastSendBufferedBefore"], 0)

    async def test_duplicate_cloudflare_dcep_open_does_not_close_negotiated_channel(self):
        channel = self.connection.pc.createDataChannel(
            "server-events",
            negotiated=True,
            ordered=True,
            id=1,
        )
        self.connection.enable_cloudflare_sctp_compat()
        label = b"server-events"
        dcep_open = pack("!BBHLHH", DATA_CHANNEL_OPEN, 0, 0, 0, len(label), 0) + label

        await self.connection.pc.sctp._data_channel_receive(1, WEBRTC_DCEP, dcep_open)

        self.assertIs(self.connection.pc.sctp._data_channels[1], channel)
        self.assertEqual(
            self.connection.data_channel_debug_state()["duplicateDcepOpens"],
            [{"id": 1, "label": "server-events"}],
        )


if __name__ == "__main__":
    unittest.main()
