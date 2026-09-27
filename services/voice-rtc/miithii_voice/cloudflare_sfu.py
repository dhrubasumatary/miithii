from __future__ import annotations

import asyncio
import json
import time
from struct import pack, unpack_from
from typing import Any

from aiortc.rtcsctptransport import DATA_CHANNEL_ACK, DATA_CHANNEL_OPEN, WEBRTC_DCEP
from loguru import logger
from pipecat.transports.smallwebrtc.connection import (
    SIGNALLING_TYPE,
    SmallWebRTCConnection,
    SmallWebRTCTrack,
)


class CloudflareSFUConnection(SmallWebRTCConnection):
    """Adapt Pipecat's SmallWebRTC transport to a Cloudflare SFU peer.

    Pipecat's stock ``SmallWebRTCConnection`` assumes one peer-to-peer audio
    transceiver that is both the input and output path. Cloudflare Realtime's
    SFU is cleaner when Miithii publishes bot audio on one transceiver and
    subscribes to the Android microphone on another. This adapter keeps the
    mature Pipecat audio framing/client lifecycle while making those two media
    paths explicit.

    Signalling is intentionally *not* implemented here. ``modal_app.py`` owns
    the authenticated Cloudflare Calls API exchange and binds the resulting
    transceivers / negotiated data channel to this object.
    """

    _AUDIO_INPUT_TRACK_KEY = "cloudflare-sfu-audio-input"

    def __init__(self, connection_timeout_secs: int = 60):
        # The remote WebRTC peer is Cloudflare itself, so Modal does not need a
        # STUN/TURN configuration for this connection. Cloudflare's SDP supplies
        # the ICE details required by aiortc during normal offer/answer exchange.
        super().__init__(ice_servers=None, connection_timeout_secs=connection_timeout_secs)
        self._audio_input_transceiver = None
        self._audio_output_transceiver = None
        self._data_channel_received_messages = 0
        self._data_channel_received_bytes = 0
        self._data_channel_sent_messages = 0
        self._data_channel_sent_bytes = 0
        self._data_channel_last_send_buffered_before = None
        self._data_channel_last_send_buffered_after = None
        self._duplicate_dcep_opens: list[dict[str, Any]] = []
        self._sctp_compat_enabled = False

    def _start_data_channel_timeout(self) -> None:
        """Allow SFU signaling to finish before Pipecat disables message delivery.

        Pipecat's direct-peer default is ten seconds after ICE connects. The SFU
        route still has to subscribe to audio, establish SCTP, and allocate the
        remote channel after that point. Our signaling endpoint separately
        checks that the channel opens; this timer only bounds the queue if the
        client abandons signaling.
        """

        async def timeout_handler() -> None:
            await asyncio.sleep(60)
            if not self._data_channel or self._data_channel.readyState != "open":
                logger.warning("Cloudflare SFU data channel did not open within 60s")
                self._outgoing_messages_queue.clear()
                self._data_channel_enabled = False

        self._data_channel_timeout_task = asyncio.create_task(timeout_handler())

    def bind_audio_input(self, transceiver: Any) -> None:
        """Use ``transceiver`` as the Android microphone subscription."""
        old_track = self._track_map.pop(self._AUDIO_INPUT_TRACK_KEY, None)
        if old_track:
            old_track.stop()
        self._audio_input_transceiver = transceiver

    def bind_audio_output(self, transceiver: Any) -> None:
        """Use ``transceiver`` as the bot audio publication."""
        self._audio_output_transceiver = transceiver

    def audio_input_track(self):
        cached = self._track_map.get(self._AUDIO_INPUT_TRACK_KEY)
        if cached:
            return cached

        transceiver = self._audio_input_transceiver
        receiver = getattr(transceiver, "receiver", None) if transceiver else None
        if receiver is None:
            logger.warning("Cloudflare SFU audio input transceiver is not bound")
            return None

        track = SmallWebRTCTrack(receiver)
        self._track_map[self._AUDIO_INPUT_TRACK_KEY] = track
        return track

    def replace_audio_track(self, track) -> None:
        """Replace only the bot-audio publication track, without renegotiation."""
        transceiver = self._audio_output_transceiver
        sender = getattr(transceiver, "sender", None) if transceiver else None
        if sender is None:
            logger.warning("Cloudflare SFU audio output transceiver is not bound")
            return
        sender.replaceTrack(track)

    def video_input_track(self):
        return None

    def screen_video_input_track(self):
        return None

    def attach_data_channel(self, channel) -> None:
        """Attach a negotiated Cloudflare data channel to Pipecat's RTVI path.

        Cloudflare data channels are negotiated out of band and therefore do
        not emit aiortc's normal ``datachannel`` event. Wire the same behavior
        that ``SmallWebRTCConnection`` installs for an in-band peer channel.
        """
        self._data_channel = channel
        self._data_channel_enabled = True

        @channel.on("open")
        async def on_open():
            logger.debug(
                "Cloudflare SFU data channel open label={} id={} negotiated={} ordered={}",
                getattr(channel, "label", None),
                getattr(channel, "id", None),
                getattr(channel, "negotiated", None),
                getattr(channel, "ordered", None),
            )
            self._flush_message_queue()

        @channel.on("message")
        async def on_message(message):
            try:
                self._data_channel_received_messages += 1
                self._data_channel_received_bytes += len(
                    message.encode("utf-8") if isinstance(message, str) else message
                )
                if isinstance(message, str) and message.startswith("ping"):
                    self._last_received_time = time.time()
                    return

                json_message = json.loads(message)
                if not isinstance(json_message, dict):
                    raise ValueError("Data channel message must be a JSON object")

                logger.debug(
                    "Cloudflare SFU app-message received type={} label={} connected={}",
                    json_message.get("type"),
                    json_message.get("label"),
                    self.is_connected(),
                )
                if json_message.get("type") == SIGNALLING_TYPE and json_message.get("message"):
                    self._handle_signalling_message(json_message["message"])
                elif self.is_connected():
                    await self._call_event_handler("app-message", json_message)
                else:
                    logger.debug("SFU client not connected. Queuing app-message.")
                    self._pending_app_messages.append(json_message)
            except Exception as error:
                logger.error("Error parsing Cloudflare SFU data channel message: {}", error)

        # aiortc negotiated channels can already be open by the time the adapter
        # receives them, in which case no future ``open`` event will fire.
        if channel.readyState == "open":
            self._flush_message_queue()

    def enable_cloudflare_sctp_compat(self) -> None:
        """Tolerate Cloudflare's duplicate DCEP OPEN for negotiated channels.

        Cloudflare allocates an endpoint-specific negotiated stream ID, but its
        SFU currently also emits a DCEP OPEN for that stream. Chromium accepts
        this. aiortc 1.15 asserts when an OPEN arrives for an already-registered
        negotiated stream, which tears down DTLS/SCTP. Keep the negotiated
        channel required by the Cloudflare API and acknowledge only a matching
        duplicate OPEN.
        """
        if self._sctp_compat_enabled:
            return
        sctp = self.pc.sctp
        if sctp is None:
            raise RuntimeError("SCTP transport is not initialized")
        original_receive = sctp._data_channel_receive

        async def receive(stream_id: int, pp_id: int, data: bytes) -> None:
            if pp_id == WEBRTC_DCEP and len(data) >= 12 and data[0] == DATA_CHANNEL_OPEN:
                existing = sctp._data_channels.get(stream_id)
                if existing is not None:
                    _, _, _, _, label_length, _ = unpack_from("!BBHLHH", data)
                    label = data[12 : 12 + label_length].decode("utf-8")
                    if label == existing.label:
                        self._duplicate_dcep_opens.append({"id": stream_id, "label": label})
                        existing._setReadyState("open")
                        sctp._data_channel_queue.append(
                            (existing, WEBRTC_DCEP, pack("!B", DATA_CHANNEL_ACK))
                        )
                        await sctp._data_channel_flush()
                        logger.debug(
                            "Ignored duplicate Cloudflare DCEP OPEN label={} id={}",
                            label,
                            stream_id,
                        )
                        return
            await original_receive(stream_id, pp_id, data)

        sctp._data_channel_receive = receive
        self._sctp_compat_enabled = True

    def send_app_message(self, message: Any):
        """Send RTVI JSON while recording content-free DataChannel metadata."""
        channel = self._data_channel
        message_type = message.get("type") if isinstance(message, dict) else type(message).__name__
        message_label = message.get("label") if isinstance(message, dict) else None
        if channel and channel.readyState == "open":
            payload = json.dumps(message)
            self._data_channel_last_send_buffered_before = getattr(
                channel, "bufferedAmount", None
            )
            channel.send(payload)
            self._data_channel_last_send_buffered_after = getattr(
                channel, "bufferedAmount", None
            )
            self._data_channel_sent_messages += 1
            self._data_channel_sent_bytes += len(payload.encode("utf-8"))
            logger.debug(
                "Cloudflare SFU app-message sent "
                "type={} label={} bytes={} channel={} id={} state={}",
                message_type,
                message_label,
                len(payload.encode("utf-8")),
                getattr(channel, "label", None),
                getattr(channel, "id", None),
                getattr(channel, "readyState", None),
            )
            return
        logger.debug(
            "Cloudflare SFU app-message queued type={} label={} channel_state={}",
            message_type,
            message_label,
            getattr(channel, "readyState", None) if channel else None,
        )
        super().send_app_message(message)

    def data_channel_debug_state(self) -> dict[str, Any]:
        """Return safe transport metadata without SDP, credentials, or message contents."""
        channel = self._data_channel
        sctp = self.pc.sctp
        dtls = sctp.transport if sctp else None
        association_state = getattr(sctp, "_association_state", None) if sctp else None
        if hasattr(association_state, "name"):
            association_state = association_state.name
        elif association_state is not None:
            association_state = str(association_state)
        return {
            "label": getattr(channel, "label", None) if channel else None,
            "id": getattr(channel, "id", None) if channel else None,
            "readyState": getattr(channel, "readyState", None) if channel else None,
            "negotiated": getattr(channel, "negotiated", None) if channel else None,
            "ordered": getattr(channel, "ordered", None) if channel else None,
            "bufferedAmount": getattr(channel, "bufferedAmount", None) if channel else None,
            "sctpState": getattr(sctp, "state", None) if sctp else None,
            "sctpAssociationState": association_state,
            "dtlsState": getattr(dtls, "state", None) if dtls else None,
            "dtlsRole": getattr(dtls, "_role", None) if dtls else None,
            "receivedMessages": self._data_channel_received_messages,
            "receivedBytes": self._data_channel_received_bytes,
            "sentMessages": self._data_channel_sent_messages,
            "sentBytes": self._data_channel_sent_bytes,
            "lastSendBufferedBefore": self._data_channel_last_send_buffered_before,
            "lastSendBufferedAfter": self._data_channel_last_send_buffered_after,
            "duplicateDcepOpens": list(self._duplicate_dcep_opens),
        }
