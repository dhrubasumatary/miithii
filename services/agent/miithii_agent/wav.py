"""RIFF/WAVE parsing for the Bodhan response body.

Bodhan answers a synthesis request with a complete ``audio/wav`` body. The provider does
not split long input and occasionally returns a truncated or malformed body, so the audio
is validated before a single frame reaches LiveKit. Everything here is pure: it takes
bytes and either returns validated PCM or raises.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

WAVE_FORMAT_PCM = 0x0001
WAVE_FORMAT_EXTENSIBLE = 0xFFFE

# A PCM16 mono 24 kHz body of this size is already far longer than the ~30s of speech the
# provider is asked for. The ceiling exists so a runaway response cannot exhaust memory.
DEFAULT_MAX_PCM_BYTES = 16 * 1024 * 1024


class WavError(ValueError):
    """Raised when a response body is not complete, valid PCM audio."""


@dataclass(frozen=True)
class WavData:
    pcm: bytes
    sample_rate: int
    num_channels: int
    sample_width: int
    duration_seconds: float


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise WavError(message)


def _parse_chunk_header(body: bytes, offset: int) -> tuple[bytes, int, int]:
    _require(offset + 8 <= len(body), "truncated RIFF chunk header")
    chunk_id = body[offset : offset + 4]
    (size,) = struct.unpack_from("<I", body, offset + 4)
    return chunk_id, size, offset + 8


def parse_wav(
    body: bytes,
    *,
    expect_sample_rate: int | None = 24_000,
    expect_channels: int | None = 1,
    max_pcm_bytes: int = DEFAULT_MAX_PCM_BYTES,
) -> WavData:
    """Parse a RIFF/WAVE body into validated PCM16 audio.

    ``expect_sample_rate``/``expect_channels`` pin the format Bodhan documents
    (PCM16, 24 kHz, mono). A mismatch is an error rather than something to resample,
    because resampling would hide a provider regression behind plausible audio.
    """
    _require(len(body) >= 12, "response body is too short to be a RIFF file")
    _require(body[0:4] == b"RIFF", "response body is not a RIFF container")
    _require(body[8:12] == b"WAVE", "RIFF container is not WAVE")

    (riff_size,) = struct.unpack_from("<I", body, 4)
    # The RIFF size counts everything after the first 8 bytes. A body shorter than its own
    # declared size is the signature of a truncated transfer.
    _require(
        len(body) >= riff_size + 8,
        f"truncated RIFF body: declared {riff_size + 8} bytes, received {len(body)}",
    )

    offset = 12
    fmt: tuple[int, int, int, int] | None = None
    pcm: bytes | None = None

    while offset + 8 <= len(body):
        chunk_id, size, data_offset = _parse_chunk_header(body, offset)
        # Chunks are word aligned: an odd size is followed by one pad byte.
        chunk_end = data_offset + size
        _require(chunk_end <= len(body), f"truncated {chunk_id!r} chunk")

        if chunk_id == b"fmt ":
            _require(size >= 16, "fmt chunk is too small to be PCM")
            audio_format, channels, sample_rate, _byte_rate, _align, bits = struct.unpack_from(
                "<HHIIHH", body, data_offset
            )
            if audio_format == WAVE_FORMAT_EXTENSIBLE:
                _require(size >= 40, "WAVE_FORMAT_EXTENSIBLE fmt chunk is too small")
                (valid_bits,) = struct.unpack_from("<H", body, data_offset + 18)
                _require(
                    valid_bits in (0, 16),
                    f"unsupported WAVE_FORMAT_EXTENSIBLE valid bits: {valid_bits}",
                )
                audio_format = WAVE_FORMAT_PCM
            fmt = (audio_format, channels, sample_rate, bits)
        elif chunk_id == b"data":
            pcm = body[data_offset:chunk_end]

        offset = chunk_end + (size % 2)

    _require(fmt is not None, "WAVE body has no fmt chunk")
    _require(pcm is not None, "WAVE body has no data chunk")

    audio_format, channels, sample_rate, bits = fmt
    _require(audio_format == WAVE_FORMAT_PCM, f"expected PCM audio, got format {audio_format}")
    _require(bits == 16, f"expected 16-bit PCM, got {bits}-bit")
    _require(channels > 0, "WAVE body declares zero channels")
    if expect_channels is not None:
        _require(
            channels == expect_channels,
            f"expected {expect_channels} channel(s), got {channels}",
        )
    if expect_sample_rate is not None:
        _require(
            sample_rate == expect_sample_rate,
            f"expected {expect_sample_rate} Hz, got {sample_rate}",
        )

    _require(len(pcm) > 0, "WAVE data chunk is empty")
    _require(
        len(pcm) <= max_pcm_bytes,
        f"WAVE data chunk is {len(pcm)} bytes, over the {max_pcm_bytes} byte ceiling",
    )
    # A partial final frame would be read as a truncated sample by the player.
    _require(len(pcm) % 2 == 0, "WAVE data chunk ends mid PCM16 frame")

    frame_size = channels * (bits // 8)
    duration = len(pcm) / (sample_rate * frame_size)
    return WavData(
        pcm=pcm,
        sample_rate=sample_rate,
        num_channels=channels,
        sample_width=bits,
        duration_seconds=duration,
    )
