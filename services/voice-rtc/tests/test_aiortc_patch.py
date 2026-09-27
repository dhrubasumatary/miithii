import unittest
from unittest.mock import Mock

from aiortc.codecs.opus import (
    SAMPLE_RATE,
    SAMPLES_PER_FRAME,
    TIME_BASE,
    OpusDecoder,
    OpusEncoder,
)
from aiortc.jitterbuffer import JitterFrame
from av import AudioFrame
from av.error import EOFError as AVEOFError

from miithii_voice.aiortc_patch import apply_aiortc_opus_decoder_patch


class AiortcOpusPatchTests(unittest.TestCase):
    def test_empty_opus_payload_does_not_poison_decoder(self):
        apply_aiortc_opus_decoder_patch()

        source = AudioFrame(
            format="s16",
            layout="stereo",
            samples=SAMPLES_PER_FRAME,
        )
        source.sample_rate = SAMPLE_RATE
        source.pts = 0
        source.time_base = TIME_BASE
        source.planes[0].update(bytes(source.planes[0].buffer_size))

        encoder = OpusEncoder()
        packets, timestamp = encoder.encode(source)
        self.assertTrue(packets)

        decoder = OpusDecoder()
        before = decoder.decode(JitterFrame(data=packets[0], timestamp=timestamp))
        empty = decoder.decode(
            JitterFrame(data=b"", timestamp=timestamp + SAMPLES_PER_FRAME)
        )
        after = decoder.decode(
            JitterFrame(data=packets[0], timestamp=timestamp + 2 * SAMPLES_PER_FRAME)
        )

        self.assertTrue(before)
        self.assertEqual(empty, [])
        self.assertTrue(after)

    def test_patch_is_idempotent(self):
        apply_aiortc_opus_decoder_patch()
        patched_decode = OpusDecoder.decode

        apply_aiortc_opus_decoder_patch()

        self.assertIs(OpusDecoder.decode, patched_decode)

    def test_ffmpeg_error_resets_decoder_instead_of_escaping(self):
        apply_aiortc_opus_decoder_patch()
        decoder = OpusDecoder()
        failed_codec = Mock()
        failed_codec.decode.side_effect = AVEOFError(541478725, "End of file")
        decoder.codec = failed_codec

        decoded = decoder.decode(JitterFrame(data=b"bad-opus", timestamp=0))

        self.assertEqual(decoded, [])
        self.assertIsNot(decoder.codec, failed_codec)


if __name__ == "__main__":
    unittest.main()
