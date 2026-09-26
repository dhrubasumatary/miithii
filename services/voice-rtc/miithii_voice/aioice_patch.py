"""Compatibility fixes for the aioice version bundled with Pipecat 1.10.

aioice 0.10.2 drops TURN DATA INDICATION packets. In a relay-to-relay
topology (Android/browser TURN <-> Modal TURN) that makes otherwise-valid ICE
checks time out after TURN ChannelBind succeeds. Upstream issue:
https://github.com/aiortc/aioice/issues/110

Remove this module once aioice ships equivalent DATA INDICATION support and
Pipecat's dependency range includes that release.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def apply_aioice_turn_data_indication_patch() -> None:
    """Teach aioice to decode and deliver RFC 5766 DATA INDICATION packets."""

    from aioice import stun
    from aioice.turn import TurnClientMixin, is_channel_data

    if "DATA" not in stun.ATTRIBUTES_BY_NAME:
        entry = (0x0013, "DATA", stun.pack_bytes, stun.unpack_bytes)
        stun.ATTRIBUTES.append(entry)
        stun.ATTRIBUTES_BY_TYPE[entry[0]] = entry
        stun.ATTRIBUTES_BY_NAME[entry[1]] = entry

    if getattr(TurnClientMixin, "_miithii_data_indication_patch", False):
        return

    original_datagram_received = TurnClientMixin.datagram_received

    def datagram_received(self: Any, data: bytes | str, addr: tuple[str, int]) -> None:
        raw = data if isinstance(data, bytes) else data.encode()

        if not is_channel_data(raw):
            try:
                message = stun.parse_message(raw)
            except ValueError:
                message = None

            if (
                message is not None
                and message.message_class == stun.Class.INDICATION
                and message.message_method == stun.Method.DATA
            ):
                peer_address = message.attributes.get("XOR-PEER-ADDRESS")
                payload = message.attributes.get("DATA")
                if (
                    self.receiver is not None
                    and isinstance(peer_address, tuple)
                    and isinstance(payload, bytes)
                ):
                    if not getattr(self, "_miithii_logged_data_indication", False):
                        logger.info("aioice TURN DATA INDICATION compatibility path active")
                        self._miithii_logged_data_indication = True
                    self.receiver.datagram_received(payload, peer_address)
                return

        original_datagram_received(self, data, addr)

    TurnClientMixin.datagram_received = datagram_received
    TurnClientMixin._miithii_data_indication_patch = True
