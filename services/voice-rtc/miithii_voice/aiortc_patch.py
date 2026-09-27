"""Compatibility fixes for aiortc's Opus decoder.

aiortc 1.15.0 passes zero-length RTP payloads to PyAV's Opus decoder. PyAV
interprets an empty packet as an end-of-stream flush, so the next real Opus
packet raises EOFError and aiortc's decoder worker dies permanently.

Remove this patch once aiortc guards empty Opus payloads (or otherwise recovers
the decoder) in the version used by Miithii.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def apply_aiortc_opus_decoder_patch() -> None:
    """Keep empty or malformed Opus RTP packets from killing audio decode."""

    from aiortc.codecs.opus import OpusDecoder
    from av import FFmpegError

    if getattr(OpusDecoder, "_miithii_empty_payload_patch", False):
        return

    original_init = OpusDecoder.__init__
    original_decode = OpusDecoder.decode

    def decode(self: Any, encoded_frame: Any):
        if not encoded_frame.data:
            if not getattr(self, "_miithii_logged_empty_payload", False):
                logger.warning("Ignoring empty Opus RTP payload before PyAV decode")
                self._miithii_logged_empty_payload = True
            return []

        try:
            return original_decode(self, encoded_frame)
        except FFmpegError as exc:
            # A decoder error must not terminate aiortc's decoder worker. Reset
            # libopus and drop this one packet so the next RTP packet can decode.
            logger.warning(
                "Resetting aiortc Opus decoder after %s",
                type(exc).__name__,
            )
            original_init(self)
            return []

    OpusDecoder.decode = decode
    OpusDecoder._miithii_empty_payload_patch = True
