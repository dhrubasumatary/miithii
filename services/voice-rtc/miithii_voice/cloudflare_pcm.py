from __future__ import annotations

import asyncio
import sys
from array import array
from dataclasses import dataclass
from typing import Protocol

from loguru import logger
from pipecat.audio.resamplers.base_audio_resampler import BaseAudioResampler
from pipecat.audio.utils import create_stream_resampler
from pipecat.frames.frames import (
    CancelFrame,
    EndFrame,
    InputAudioRawFrame,
    OutputAudioRawFrame,
    StartFrame,
)
from pipecat.transports.base_input import BaseInputTransport
from pipecat.transports.base_output import BaseOutputTransport
from pipecat.transports.base_transport import BaseTransport, TransportParams

PCM_SAMPLE_RATE = 48_000
PCM_CHANNELS = 2
PCM_SAMPLE_WIDTH_BYTES = 2
PCM_FRAME_BYTES = PCM_CHANNELS * PCM_SAMPLE_WIDTH_BYTES
CLOUDFLARE_MAX_MESSAGE_BYTES = 32 * 1024


class PacketDecodeError(ValueError):
    """Raised when a Cloudflare WebSocket-media protobuf packet is malformed."""


@dataclass(frozen=True, slots=True)
class MediaPacket:
    sequence_number: int = 0
    timestamp: int = 0
    payload: bytes = b""


class PCMWebSocket(Protocol):
    async def send_bytes(self, data: bytes) -> None: ...

    async def close(self, code: int = 1000) -> None: ...


def _encode_varint(value: int) -> bytes:
    if value < 0 or value > 0xFFFFFFFF:
        raise ValueError("protobuf uint32 is out of range")
    encoded = bytearray()
    while value >= 0x80:
        encoded.append((value & 0x7F) | 0x80)
        value >>= 7
    encoded.append(value)
    return bytes(encoded)


def _read_varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    for _ in range(5):
        if offset >= len(data):
            raise PacketDecodeError("truncated protobuf varint")
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            if value > 0xFFFFFFFF:
                raise PacketDecodeError("protobuf uint32 is out of range")
            return value, offset
        shift += 7
    raise PacketDecodeError("protobuf varint is too long")


def encode_media_packet(
    payload: bytes,
    *,
    sequence_number: int = 0,
    timestamp: int = 0,
) -> bytes:
    """Encode Cloudflare's Packet protobuf without a generated schema dependency."""

    packet = bytearray()
    if sequence_number:
        packet.extend(b"\x08")
        packet.extend(_encode_varint(sequence_number))
    if timestamp:
        packet.extend(b"\x10")
        packet.extend(_encode_varint(timestamp))
    packet.extend(b"\x2a")  # field 5, wire type 2 (bytes payload)
    packet.extend(_encode_varint(len(payload)))
    packet.extend(payload)
    if len(packet) > CLOUDFLARE_MAX_MESSAGE_BYTES:
        raise ValueError("Cloudflare WebSocket media packet exceeds 32 KB")
    return bytes(packet)


def decode_media_packet(data: bytes) -> MediaPacket:
    """Decode the subset of protobuf needed by Cloudflare's media adapter Packet."""

    if len(data) > CLOUDFLARE_MAX_MESSAGE_BYTES:
        raise PacketDecodeError("Cloudflare WebSocket media packet exceeds 32 KB")

    sequence_number = 0
    timestamp = 0
    payload = b""
    offset = 0
    while offset < len(data):
        key, offset = _read_varint(data, offset)
        field_number = key >> 3
        wire_type = key & 0x07
        if field_number == 0:
            raise PacketDecodeError("protobuf field number 0 is invalid")

        if wire_type == 0:
            value, offset = _read_varint(data, offset)
            if field_number == 1:
                sequence_number = value
            elif field_number == 2:
                timestamp = value
        elif wire_type == 1:
            if offset + 8 > len(data):
                raise PacketDecodeError("truncated protobuf fixed64")
            offset += 8
        elif wire_type == 2:
            length, offset = _read_varint(data, offset)
            end = offset + length
            if end > len(data):
                raise PacketDecodeError("truncated protobuf bytes field")
            if field_number == 5:
                payload = data[offset:end]
            offset = end
        elif wire_type == 5:
            if offset + 4 > len(data):
                raise PacketDecodeError("truncated protobuf fixed32")
            offset += 4
        else:
            raise PacketDecodeError(f"unsupported protobuf wire type: {wire_type}")

    return MediaPacket(sequence_number=sequence_number, timestamp=timestamp, payload=payload)


def _s16le_samples(data: bytes) -> array:
    if len(data) % PCM_SAMPLE_WIDTH_BYTES:
        raise ValueError("PCM16 payload must contain whole samples")
    samples = array("h")
    samples.frombytes(data)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def _samples_to_s16le(samples: array) -> bytes:
    if sys.byteorder == "little":
        return samples.tobytes()
    copy = array("h", samples)
    copy.byteswap()
    return copy.tobytes()


def stereo_to_mono_s16le(payload: bytes) -> bytes:
    """Downmix interleaved stereo PCM16LE to mono PCM16LE."""

    if len(payload) % PCM_FRAME_BYTES:
        raise ValueError("Cloudflare PCM payload is not aligned to stereo PCM16 frames")
    samples = _s16le_samples(payload)
    mono = array(
        "h",
        ((samples[index] + samples[index + 1]) // 2 for index in range(0, len(samples), 2)),
    )
    return _samples_to_s16le(mono)


def mono_to_stereo_s16le(payload: bytes) -> bytes:
    """Duplicate mono PCM16LE samples into interleaved stereo PCM16LE."""

    samples = _s16le_samples(payload)
    stereo = array("h")
    for sample in samples:
        stereo.extend((sample, sample))
    return _samples_to_s16le(stereo)


async def cloudflare_pcm_to_pipeline_mono(
    payload: bytes,
    *,
    resampler: BaseAudioResampler,
    target_sample_rate: int = 16_000,
) -> bytes:
    """Convert Cloudflare's 48 kHz stereo PCM16LE into Pipecat/VAD mono PCM."""

    mono = stereo_to_mono_s16le(payload)
    return await resampler.resample(mono, PCM_SAMPLE_RATE, target_sample_rate)


class CloudflarePCMInputTransport(BaseInputTransport):
    def __init__(self, transport: CloudflarePCMTransport, params: TransportParams, **kwargs):
        super().__init__(params, **kwargs)
        self._transport = transport
        self._resampler = create_stream_resampler()
        self._ready = False

    @property
    def ready(self) -> bool:
        return self._ready

    async def start(self, frame: StartFrame):
        await super().start(frame)
        self._ready = True
        await self.set_transport_ready(frame)
        await self._transport._mark_pipeline_part_ready()

    async def stop(self, frame: EndFrame):
        self._ready = False
        await super().stop(frame)

    async def cancel(self, frame: CancelFrame):
        self._ready = False
        await super().cancel(frame)

    async def push_cloudflare_packet(self, data: bytes) -> bool:
        if not self._ready or self._transport.closed:
            return False
        packet = decode_media_packet(data)
        if not packet.payload:
            return True
        audio = await cloudflare_pcm_to_pipeline_mono(
            packet.payload,
            resampler=self._resampler,
            target_sample_rate=self.sample_rate,
        )
        if not audio:
            return True
        frame = InputAudioRawFrame(audio=audio, sample_rate=self.sample_rate, num_channels=1)
        frame.transport_source = "microphone"
        await self.push_audio_frame(frame)
        return True


class CloudflarePCMOutputTransport(BaseOutputTransport):
    def __init__(self, transport: CloudflarePCMTransport, params: TransportParams, **kwargs):
        super().__init__(params, **kwargs)
        self._transport = transport
        self._ready = False

    @property
    def ready(self) -> bool:
        return self._ready

    async def start(self, frame: StartFrame):
        await super().start(frame)
        self._ready = True
        await self.set_transport_ready(frame)
        await self._transport._mark_pipeline_part_ready()

    async def stop(self, frame: EndFrame):
        self._ready = False
        await super().stop(frame)

    async def cancel(self, frame: CancelFrame):
        self._ready = False
        await super().cancel(frame)

    async def write_audio_frame(self, frame: OutputAudioRawFrame) -> bool:
        if not self._ready or self._transport.closed:
            return False
        if frame.num_channels == 1:
            payload = mono_to_stereo_s16le(frame.audio)
        elif frame.num_channels == PCM_CHANNELS:
            if len(frame.audio) % PCM_FRAME_BYTES:
                raise ValueError("Output stereo PCM is not frame-aligned")
            payload = frame.audio
        else:
            raise ValueError(f"Unsupported output channel count: {frame.num_channels}")
        return await self._transport.send_bot_packet(encode_media_packet(payload))


class CloudflarePCMTransport(BaseTransport):
    """Pipecat transport backed by Cloudflare Realtime WebSocket media adapters."""

    def __init__(self, *, name: str | None = None):
        super().__init__(name=name)
        self._params = TransportParams(
            audio_in_enabled=True,
            audio_in_sample_rate=16_000,
            audio_in_channels=1,
            audio_out_enabled=True,
            audio_out_sample_rate=PCM_SAMPLE_RATE,
            # Keep Pipecat's output pipeline mono; duplicate to Cloudflare's required
            # stereo wire format only at the transport edge.
            audio_out_channels=1,
            audio_out_10ms_chunks=2,
            audio_out_end_silence_secs=0,
        )
        self._input = CloudflarePCMInputTransport(self, self._params, name="cloudflare-pcm-input")
        self._output = CloudflarePCMOutputTransport(
            self, self._params, name="cloudflare-pcm-output"
        )
        self._mic_socket: PCMWebSocket | None = None
        self._bot_socket: PCMWebSocket | None = None
        self._socket_lock = asyncio.Lock()
        self._pipeline_ready_parts = 0
        self._pipeline_ready = asyncio.Event()
        self._connected_emitted = False
        self._closed = False

        self._register_event_handler("on_client_connected")
        self._register_event_handler("on_client_disconnected")

    @property
    def closed(self) -> bool:
        return self._closed

    @property
    def pipeline_ready(self) -> bool:
        return self._pipeline_ready.is_set()

    @property
    def mic_connected(self) -> bool:
        return self._mic_socket is not None

    @property
    def bot_connected(self) -> bool:
        return self._bot_socket is not None

    def input(self) -> CloudflarePCMInputTransport:
        return self._input

    def output(self) -> CloudflarePCMOutputTransport:
        return self._output

    async def _mark_pipeline_part_ready(self) -> None:
        self._pipeline_ready_parts += 1
        if self._pipeline_ready_parts >= 2:
            self._pipeline_ready.set()

    async def wait_pipeline_ready(self) -> None:
        await self._pipeline_ready.wait()

    async def attach_mic(self, websocket: PCMWebSocket) -> None:
        await self._replace_socket("mic", websocket)

    async def attach_bot(self, websocket: PCMWebSocket) -> None:
        await self._replace_socket("bot", websocket)

    async def _replace_socket(self, kind: str, websocket: PCMWebSocket) -> None:
        old: PCMWebSocket | None = None
        async with self._socket_lock:
            if self._closed:
                raise RuntimeError("PCM transport is closed")
            attr = "_mic_socket" if kind == "mic" else "_bot_socket"
            old = getattr(self, attr)
            setattr(self, attr, websocket)
            should_emit = self._mic_socket is not None and self._bot_socket is not None
            should_emit = should_emit and not self._connected_emitted
            if should_emit:
                self._connected_emitted = True
        if old is not None and old is not websocket:
            try:
                await old.close(code=1012)
            except Exception:
                logger.debug("Old {} PCM WebSocket was already closed", kind)
        if should_emit:
            await self._call_event_handler("on_client_connected", self)

    async def detach_mic(self, websocket: PCMWebSocket) -> None:
        await self._detach_socket("mic", websocket)

    async def detach_bot(self, websocket: PCMWebSocket) -> None:
        await self._detach_socket("bot", websocket)

    async def _detach_socket(self, kind: str, websocket: PCMWebSocket) -> None:
        async with self._socket_lock:
            attr = "_mic_socket" if kind == "mic" else "_bot_socket"
            if getattr(self, attr) is websocket:
                setattr(self, attr, None)

    async def push_mic_packet(self, data: bytes) -> bool:
        return await self._input.push_cloudflare_packet(data)

    async def send_bot_packet(self, data: bytes) -> bool:
        async with self._socket_lock:
            websocket = self._bot_socket
        if websocket is None or self._closed:
            return False
        try:
            await websocket.send_bytes(data)
            return True
        except Exception as error:
            logger.warning("Bot PCM WebSocket write failed: {}", type(error).__name__)
            await self.detach_bot(websocket)
            return False

    async def disconnect(self) -> None:
        async with self._socket_lock:
            if self._closed:
                return
            self._closed = True
            sockets = [socket for socket in (self._mic_socket, self._bot_socket) if socket]
            self._mic_socket = None
            self._bot_socket = None
        for websocket in sockets:
            try:
                await websocket.close(code=1000)
            except Exception:
                logger.debug("PCM WebSocket already closed during session teardown")
        await self._call_event_handler("on_client_disconnected", self)
