from __future__ import annotations

import math
import unittest
from array import array

from pipecat.audio.utils import create_stream_resampler

from miithii_voice.cloudflare_pcm import (
    CLOUDFLARE_MAX_MESSAGE_BYTES,
    PacketDecodeError,
    cloudflare_pcm_to_pipeline_mono,
    decode_media_packet,
    encode_media_packet,
    mono_to_stereo_s16le,
    stereo_to_mono_s16le,
)


def _pcm16le(samples: list[int]) -> bytes:
    values = array("h", samples)
    # CI/production are little-endian. Keep the fixture portable for local checks.
    import sys

    if sys.byteorder != "little":
        values.byteswap()
    return values.tobytes()


class CloudflarePacketTests(unittest.TestCase):
    def test_known_packet_wire_encoding(self):
        encoded = encode_media_packet(
            b"\x01\x02",
            sequence_number=1,
            timestamp=300,
        )
        self.assertEqual(encoded, bytes.fromhex("080110ac022a020102"))

        decoded = decode_media_packet(encoded)
        self.assertEqual(decoded.sequence_number, 1)
        self.assertEqual(decoded.timestamp, 300)
        self.assertEqual(decoded.payload, b"\x01\x02")

    def test_ingest_packet_can_contain_payload_only(self):
        payload = b"\x10\x20\x30\x40"
        decoded = decode_media_packet(encode_media_packet(payload))
        self.assertEqual(decoded.sequence_number, 0)
        self.assertEqual(decoded.timestamp, 0)
        self.assertEqual(decoded.payload, payload)

    def test_unknown_fields_are_ignored(self):
        # Field 3 varint and field 6 length-delimited are not used by the media bridge.
        wire = bytes.fromhex("18072a026f6b320178")
        self.assertEqual(decode_media_packet(wire).payload, b"ok")

    def test_truncated_packet_is_rejected(self):
        with self.assertRaises(PacketDecodeError):
            decode_media_packet(bytes.fromhex("2a05dead"))

    def test_oversized_packet_is_rejected(self):
        with self.assertRaises(PacketDecodeError):
            decode_media_packet(bytes(CLOUDFLARE_MAX_MESSAGE_BYTES + 1))


class PCMConversionTests(unittest.IsolatedAsyncioTestCase):
    def test_stereo_downmix_and_mono_duplication(self):
        stereo = _pcm16le([1000, 3000, -2000, 2000, 32767, 32767])
        mono = stereo_to_mono_s16le(stereo)
        self.assertEqual(mono, _pcm16le([2000, 0, 32767]))
        self.assertEqual(
            mono_to_stereo_s16le(mono),
            _pcm16le([2000, 2000, 0, 0, 32767, 32767]),
        )

    async def test_48k_stereo_signal_survives_16k_mono_conversion(self):
        frames = 4_800  # 100 ms gives the streaming resampler enough history to emit output.
        left: list[int] = []
        for index in range(frames):
            sample = int(12_000 * math.sin(2 * math.pi * 440 * index / 48_000))
            left.extend((sample, sample))

        converted = await cloudflare_pcm_to_pipeline_mono(
            _pcm16le(left),
            resampler=create_stream_resampler(),
            target_sample_rate=16_000,
        )

        self.assertTrue(converted)
        self.assertEqual(len(converted) % 2, 0)
        samples = array("h")
        samples.frombytes(converted)
        self.assertGreater(max(abs(sample) for sample in samples), 1_000)
        # Streaming resamplers may retain a small tail, so assert scale rather than exact count.
        self.assertGreater(len(samples), 900)
        self.assertLess(len(samples), 1_700)

    def test_misaligned_stereo_payload_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "aligned"):
            stereo_to_mono_s16le(b"\x00\x01")
