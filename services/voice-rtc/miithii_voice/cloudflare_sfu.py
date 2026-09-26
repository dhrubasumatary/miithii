from __future__ import annotations

import json
import time
from typing import Any

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
            logger.debug("Cloudflare SFU data channel is open")
            self._flush_message_queue()

        @channel.on("message")
        async def on_message(message):
            try:
                if isinstance(message, str) and message.startswith("ping"):
                    self._last_received_time = time.time()
                    return

                json_message = json.loads(message)
                if not isinstance(json_message, dict):
                    raise ValueError("Data channel message must be a JSON object")

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

