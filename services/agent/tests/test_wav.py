"""WAV validation: a truncated or malformed body must never become audible audio."""

from __future__ import annotations

import struct

import pytest

from miithii_agent.wav import WavError, parse_wav

PCM_GUID = b"\x01\x00\x00\x00\x00\x00\x10\x00\x80\x00\x00\xaa\x00\x38\x9b\x71"
ONE_SECOND = b"\x01\x02" * 24_000


def build_wav(
    pcm: bytes = ONE_SECOND,
    *,
    rate: int = 24_000,
    channels: int = 1,
    bits: int = 16,
    fmt_id: int = 1,
    riff_size: int | None = None,
    truncate: int = 0,
) -> bytes:
    block_align = channels * bits // 8
    fmt = struct.pack("<HHIIHH", fmt_id, channels, rate, rate * block_align, block_align, bits)
    if fmt_id == 0xFFFE:
        fmt += struct.pack("<HHI", 22, bits, 3) + PCM_GUID
    body = (
        b"WAVE"
        + b"fmt "
        + struct.pack("<I", len(fmt))
        + fmt
        + b"data"
        + struct.pack("<I", len(pcm))
        + pcm
    )
    header = b"RIFF" + struct.pack("<I", len(body) if riff_size is None else riff_size)
    out = header + body
    return out[: len(out) - truncate] if truncate else out


def test_valid_pcm16_mono_24k() -> None:
    result = parse_wav(build_wav())
    assert result.sample_rate == 24_000
    assert result.num_channels == 1
    assert result.sample_width == 16
    assert result.pcm == ONE_SECOND
    assert result.duration_seconds == pytest.approx(1.0)


def test_wave_format_extensible_is_accepted() -> None:
    result = parse_wav(build_wav(fmt_id=0xFFFE))
    assert result.sample_rate == 24_000
    assert result.duration_seconds == pytest.approx(1.0)


def test_unknown_chunks_are_skipped() -> None:
    body = build_wav()
    # Insert a LIST chunk immediately before the data chunk header.
    marker = body.index(b"data")
    extra = b"LIST" + struct.pack("<I", 4) + b"INFO"
    spliced = body[:marker] + extra + body[marker:]
    assert parse_wav(spliced).pcm == ONE_SECOND


def test_corrupting_the_format_chunk_is_rejected() -> None:
    """A chunk spliced into the wrong place must fail loudly, not decode as noise."""
    body = build_wav()
    spliced = body[: body.index(b"data") - 4] + b"LIST" + struct.pack("<I", 4) + b"INFO" + body[
        body.index(b"data") - 4 :
    ]
    with pytest.raises(WavError):
        parse_wav(spliced)


@pytest.mark.parametrize(
    ("label", "make_body"),
    [
        ("truncated_transfer", lambda: build_wav(truncate=64)),
        ("riff_size_lies", lambda: build_wav(riff_size=10_000_000)),
        ("partial_pcm_frame", lambda: build_wav(b"\x01\x02\x03")),
        ("empty_data_chunk", lambda: build_wav(b"")),
        ("not_riff", lambda: b"NOPE" + bytes(40)),
        ("truncated_header", lambda: b"RI"),
        ("no_wave_type", lambda: b"RIFF" + struct.pack("<I", 4) + b"AVI "),
    ],
)
def test_malformed_bodies_are_rejected(label: str, make_body) -> None:
    # Bodies are built inside the test rather than parametrized directly: a multi-kilobyte
    # `bytes` in an id becomes a temp filename, which Windows rejects past 32767 chars.
    with pytest.raises(WavError):
        parse_wav(make_body())


@pytest.mark.parametrize(
    ("label", "make_body"),
    [
        ("wrong_sample_rate", lambda: build_wav(rate=16_000)),
        ("wrong_channel_count", lambda: build_wav(channels=2)),
        ("float_encoding", lambda: build_wav(fmt_id=3)),
        ("eight_bit", lambda: build_wav(bits=8)),
    ],
)
def test_unexpected_formats_are_rejected(label: str, make_body) -> None:
    with pytest.raises(WavError):
        parse_wav(make_body())


def test_size_ceiling_is_enforced() -> None:
    with pytest.raises(WavError, match="ceiling"):
        parse_wav(build_wav(), max_pcm_bytes=1024)


def test_ceiling_counts_only_pcm_not_headers() -> None:
    # A 24k mono body just over the ceiling must fail; the same body under it must pass.
    parse_wav(build_wav(b"\x00\x00" * 500), max_pcm_bytes=1001)
    with pytest.raises(WavError, match="ceiling"):
        parse_wav(build_wav(b"\x00\x00" * 600), max_pcm_bytes=1001)
