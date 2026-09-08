"use client";

// Mic capture for Bodhan indic-transcribe, which accepts WAV but rejects the
// WebM/Opus that MediaRecorder produces in Chrome. We capture raw PCM through
// an AudioWorklet (injected as a blob so no extra build step is needed),
// downsample to 16 kHz mono, and encode 16-bit WAV client-side.

const TARGET_SAMPLE_RATE = 16_000;
const WORKLET_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("capture-processor", CaptureProcessor);
`;

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (text: string, at: number) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(at + i, text.charCodeAt(i));
  };
  writeString("RIFF", 0);
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString("WAVE", 8);
  writeString("fmt ", 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString("data", 36);
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const length = Math.ceil(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    output[i] = end > start ? sum / (end - start) : 0;
  }
  return output;
}

export class MicRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleCount = 0;
  private recordingSampleRate = 0;

  async start(onLevel?: (level: number) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    const context = new AudioContext();
    this.context = context;
    this.recordingSampleRate = context.sampleRate;
    const workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
    await context.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    this.node = new AudioWorkletNode(context, "capture-processor");
    this.node.port.onmessage = event => {
      const samples = event.data as Float32Array;
      this.chunks.push(samples);
      this.sampleCount += samples.length;
      if (onLevel) {
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
        onLevel(Math.sqrt(sum / samples.length));
      }
    };
    const source = context.createMediaStreamSource(this.stream);
    source.connect(this.node);
    // Worklets only tick when the graph pulls; a muted gain to destination
    // keeps that pull while staying silent.
    const mute = context.createGain();
    mute.gain.value = 0;
    this.node.connect(mute);
    mute.connect(context.destination);
  }

  /** Duration of captured audio in seconds. */
  get durationSeconds(): number {
    return this.recordingSampleRate ? this.sampleCount / this.recordingSampleRate : 0;
  }

  /** Stop capture and return the recording as a 16 kHz mono WAV blob. */
  async stop(): Promise<Blob> {
    this.node?.port.close();
    this.node?.disconnect();
    await this.context?.close();
    this.stream?.getTracks().forEach(track => track.stop());
    this.node = null;
    this.context = null;
    this.stream = null;

    const chunks = this.chunks;
    const total = this.sampleCount;
    const inputSampleRate = this.recordingSampleRate;
    this.chunks = [];
    this.sampleCount = 0;
    this.recordingSampleRate = 0;

    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return encodeWav(downsample(merged, inputSampleRate, TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE);
  }

  /** Discard the capture without encoding (e.g. recording was too short). */
  async abort(): Promise<void> {
    this.node?.port.close();
    this.node?.disconnect();
    await this.context?.close();
    this.stream?.getTracks().forEach(track => track.stop());
    this.node = null;
    this.context = null;
    this.stream = null;
    this.chunks = [];
    this.sampleCount = 0;
    this.recordingSampleRate = 0;
  }
}
