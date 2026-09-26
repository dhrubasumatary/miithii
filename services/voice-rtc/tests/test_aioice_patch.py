import unittest

from aioice import stun
from aioice.turn import TurnClientUdpProtocol

from miithii_voice.aioice_patch import apply_aioice_turn_data_indication_patch


class _Receiver:
    def __init__(self):
        self.received = []

    def datagram_received(self, payload, peer_address):
        self.received.append((payload, peer_address))


class AioiceTurnPatchTests(unittest.TestCase):
    def test_turn_data_indication_is_delivered_to_receiver(self):
        apply_aioice_turn_data_indication_patch()

        protocol = TurnClientUdpProtocol(
            ("turn.cloudflare.com", 3478),
            username="username",
            password="credential",
            lifetime=600,
            channel_refresh_time=500,
        )
        receiver = _Receiver()
        protocol.receiver = receiver

        peer_address = ("203.0.113.10", 54321)
        payload = b"ice-binding-response"
        indication = stun.Message(
            message_method=stun.Method.DATA,
            message_class=stun.Class.INDICATION,
        )
        indication.attributes["XOR-PEER-ADDRESS"] = peer_address
        indication.attributes["DATA"] = payload

        protocol.datagram_received(bytes(indication), ("104.30.0.1", 3478))

        self.assertEqual(receiver.received, [(payload, peer_address)])


if __name__ == "__main__":
    unittest.main()

