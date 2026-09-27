'use dom';

import { useDOMImperativeHandle, type DOMImperativeFactory } from "expo/dom";
import { type Ref, useRef } from "react";

import type {
  BotPublication,
  IceServer,
  PcmPublishRequest,
  PcmPublishResponse,
  PcmStartRequest,
  PcmStartResponse,
  PcmStopRequest,
  PcmSubscribeAnswerRequest,
  PcmSubscribeRequest,
  PcmSubscribeResponse,
  SessionDescription,
  VoiceDomErrorEvent,
  VoiceDomServerEvent,
  VoiceDomStartParams,
  VoiceDomStateEvent,
  VoiceServerEvent,
} from "./voice-contract";

export type VoiceDOMRef = {
  start(params: VoiceDomStartParams): void;
  stop(): void;
};

type Props = {
  ref: Ref<VoiceDOMRef>;
  dom?: import("expo/dom").DOMProps;
  onState(event: VoiceDomStateEvent): Promise<void>;
  onError(event: VoiceDomErrorEvent): Promise<void>;
  onEvent(event: VoiceDomServerEvent): Promise<void>;
};

type ActiveSession = {
  generation: number;
  voiceSessionId: string;
  startUrl: string;
  token: string;
};

function asDescription(value: SessionDescription): RTCSessionDescriptionInit {
  return { type: value.type, sdp: value.sdp };
}

function localDescription(pc: RTCPeerConnection): SessionDescription {
  const description = pc.localDescription;
  if (!description || !description.sdp || description.type !== "offer") {
    throw new Error("Voice WebRTC offer is unavailable");
  }
  return { type: "offer", sdp: description.sdp };
}

function pcmBase(startUrl: string) {
  const normalized = startUrl.replace(/\/+$/, "");
  if (!/\/pcm\/start$/i.test(normalized)) {
    throw new Error("Voice PCM start URL must end in /pcm/start");
  }
  return normalized.slice(0, -"/start".length);
}

async function jsonRequest<TRequest, TResponse>(
  url: string,
  token: string,
  body: TRequest,
  signal: AbortSignal,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => null) as (TResponse & { detail?: unknown }) | null;
  if (!response.ok) {
    const detail = payload && typeof payload.detail === "string"
      ? payload.detail
      : `Voice backend request failed (${response.status})`;
    throw new Error(detail);
  }
  if (!payload) throw new Error("Voice backend returned an empty response");
  return payload;
}

async function okRequest<TRequest>(
  url: string,
  token: string,
  body: TRequest,
  signal: AbortSignal,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: unknown } | null;
    const detail = payload && typeof payload.detail === "string"
      ? payload.detail
      : `Voice backend request failed (${response.status})`;
    throw new Error(detail);
  }
}

async function waitForIceGathering(pc: RTCPeerConnection, signal: AbortSignal) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("Voice ICE gathering timed out")), 10_000);
    const onAbort = () => finish(new DOMException("Voice connection cancelled", "AbortError"));
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", onChange);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForConnection(pc: RTCPeerConnection, signal: AbortSignal) {
  if (pc.connectionState === "connected") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("Voice peer connection timed out")), 15_000);
    const onAbort = () => finish(new DOMException("Voice connection cancelled", "AbortError"));
    const onChange = () => {
      if (pc.connectionState === "connected") finish();
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        finish(new Error(`Voice peer connection ${pc.connectionState}`));
      }
    };
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      pc.removeEventListener("connectionstatechange", onChange);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    pc.addEventListener("connectionstatechange", onChange);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function rtcConfiguration(iceServers: IceServer[]): RTCConfiguration {
  return {
    bundlePolicy: "max-bundle",
    iceServers: iceServers.map(server => ({
      urls: server.urls,
      ...(server.username ? { username: server.username } : {}),
      ...(server.credential ? { credential: server.credential } : {}),
    })),
  };
}

function isVoiceServerEvent(value: unknown): value is VoiceServerEvent {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const event = value as Record<string, unknown>;
  if (["user-started", "user-stopped", "bot-started", "bot-stopped"].includes(String(event.type))) {
    return true;
  }
  if (event.type === "transcript") {
    return typeof event.text === "string" && typeof event.final === "boolean";
  }
  if (event.type === "bot-text") return typeof event.text === "string";
  if (event.type === "audio-level") {
    return (event.source === "local" || event.source === "remote") && typeof event.level === "number";
  }
  if (event.type === "latency") return typeof event.stage === "string" && typeof event.ms === "number";
  return false;
}

export default function VoiceDOM({ ref, onState, onError, onEvent }: Props) {
  const commandRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const publisherRef = useRef<RTCPeerConnection | null>(null);
  const receiverRef = useRef<RTCPeerConnection | null>(null);
  const sessionRef = useRef<ActiveSession | null>(null);
  const eventsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const emitState = (event: VoiceDomStateEvent) => {
    void onState(event).catch(() => {});
  };

  const stopCurrent = async (notify: boolean) => {
    const active = sessionRef.current;
    abortRef.current?.abort();
    abortRef.current = null;

    publisherRef.current?.close();
    publisherRef.current = null;
    receiverRef.current?.close();
    receiverRef.current = null;
    eventsRef.current?.close();
    eventsRef.current = null;
    microphoneRef.current?.getTracks().forEach(track => track.stop());
    microphoneRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    sessionRef.current = null;

    if (active) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5_000);
      try {
        const base = pcmBase(active.startUrl);
        await okRequest<PcmStopRequest>(
          `${base}/${encodeURIComponent(active.voiceSessionId)}/stop`,
          active.token,
          {},
          controller.signal,
        );
      } catch {
        // Local media is already retired. Server cleanup remains best-effort.
      } finally {
        window.clearTimeout(timeout);
      }
      if (notify) emitState({ generation: active.generation, state: "stopped" });
    }
  };

  const startCurrent = async (params: VoiceDomStartParams, command: number) => {
    await stopCurrent(false);
    if (commandRef.current !== command) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    const current = () => commandRef.current === command && !signal.aborted;
    const base = pcmBase(params.startUrl);

    try {
      emitState({ generation: params.generation, state: "connecting", stage: "permission" });
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (!current()) {
        microphone.getTracks().forEach(track => track.stop());
        return;
      }
      microphoneRef.current = microphone;

      emitState({ generation: params.generation, state: "connecting", stage: "start" });
      const started = await jsonRequest<PcmStartRequest, PcmStartResponse>(
        params.startUrl,
        params.token,
        { language: params.language },
        signal,
      );
      if (!current()) return;
      sessionRef.current = {
        generation: params.generation,
        voiceSessionId: started.voiceSessionId,
        startUrl: params.startUrl,
        token: params.token,
      };
      if (started.eventsUrl) {
        const events = new WebSocket(started.eventsUrl);
        eventsRef.current = events;
        events.addEventListener("message", message => {
          if (!current()) return;
          try {
            const event = JSON.parse(String(message.data)) as unknown;
            if (isVoiceServerEvent(event)) {
              void onEvent({ generation: params.generation, event }).catch(() => {});
            }
          } catch {
            // Ignore malformed diagnostic/event frames; media stays live.
          }
        });
      }

      emitState({ generation: params.generation, state: "connecting", stage: "publish" });
      const publisher = new RTCPeerConnection(rtcConfiguration(started.iceConfig.iceServers));
      publisherRef.current = publisher;
      for (const track of microphone.getAudioTracks()) publisher.addTrack(track, microphone);
      await publisher.setLocalDescription(await publisher.createOffer());
      await waitForIceGathering(publisher, signal);
      const published = await jsonRequest<PcmPublishRequest, PcmPublishResponse>(
        `${base}/${encodeURIComponent(started.voiceSessionId)}/publish`,
        params.token,
        { sessionDescription: localDescription(publisher) },
        signal,
      );
      await publisher.setRemoteDescription(asDescription(published.sessionDescription));
      await waitForConnection(publisher, signal);
      if (!current()) return;

      emitState({ generation: params.generation, state: "connecting", stage: "subscribe" });
      const subscribed = await jsonRequest<PcmSubscribeRequest, PcmSubscribeResponse>(
        `${base}/${encodeURIComponent(started.voiceSessionId)}/subscribe`,
        params.token,
        { botPublication: published.botPublication as BotPublication },
        signal,
      );
      if (subscribed.sessionDescription.type !== "offer") {
        throw new Error("Voice backend returned an invalid subscriber offer");
      }

      const receiver = new RTCPeerConnection(rtcConfiguration(started.iceConfig.iceServers));
      receiverRef.current = receiver;
      receiver.addEventListener("track", event => {
        const audio = audioRef.current;
        if (!audio || !event.streams[0]) return;
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => {});
      });
      await receiver.setRemoteDescription(asDescription(subscribed.sessionDescription));
      await receiver.setLocalDescription(await receiver.createAnswer());
      await waitForIceGathering(receiver, signal);
      const answer = receiver.localDescription;
      if (!answer?.sdp || answer.type !== "answer") {
        throw new Error("Voice WebRTC subscriber answer is unavailable");
      }
      await okRequest<PcmSubscribeAnswerRequest>(
        `${base}/${encodeURIComponent(started.voiceSessionId)}/subscribe-answer`,
        params.token,
        {
          subscriberSessionId: subscribed.subscriberSessionId,
          sessionDescription: { type: "answer", sdp: answer.sdp },
        },
        signal,
      );
      await waitForConnection(receiver, signal);
      if (!current()) return;

      emitState({ generation: params.generation, state: "ready", stage: "connected" });
    } catch (error) {
      if (!current()) return;
      const message = error instanceof Error ? error.message : "Could not open Miithii Voice";
      emitState({ generation: params.generation, state: "error" });
      void onError({ generation: params.generation, message }).catch(() => {});
      await stopCurrent(false);
    }
  };

  useDOMImperativeHandle(
    ref as Ref<DOMImperativeFactory>,
    () => ({
      start: (...args) => {
        const params = args[0] as unknown as VoiceDomStartParams;
        const command = commandRef.current + 1;
        commandRef.current = command;
        void startCurrent(params, command);
      },
      stop: () => {
        commandRef.current += 1;
        void stopCurrent(true);
      },
    }),
    [onError, onEvent, onState],
  );

  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
}
