import {
  PipecatClient,
  type Transport,
  type BotLLMTextData,
  type PipecatMetricsData,
  type TranscriptData,
  type TransportState,
} from "@pipecat-ai/client-js";
import { DailyMediaManager } from "@pipecat-ai/react-native-daily-media-manager";
import { RNDailyTransport } from "@pipecat-ai/react-native-daily-transport";
import { RNSmallWebRTCTransport } from "@pipecat-ai/react-native-small-webrtc-transport";

import type { VoiceTransportKind } from "./config";

export type ReplyLanguage = "as" | "brx";

export type VoiceClientEvents = {
  onTransportState(state: TransportState): void;
  onConnected(): void;
  onDisconnected(): void;
  onUserStartedSpeaking(): void;
  onUserStoppedSpeaking(): void;
  onBotStartedSpeaking(): void;
  onBotStoppedSpeaking(): void;
  onUserTranscript(data: TranscriptData): void;
  onBotText(data: BotLLMTextData): void;
  onLocalAudioLevel(level: number): void;
  onRemoteAudioLevel(level: number): void;
  onMetrics(data: PipecatMetricsData): void;
  onError(message: string): void;
};

export function createVoiceClient(
  events: VoiceClientEvents,
  transportKind: VoiceTransportKind = "webrtc",
): PipecatClient {
  const transport = transportKind === "daily"
    ? new RNDailyTransport()
    : new RNSmallWebRTCTransport({ mediaManager: new DailyMediaManager() });

  return new PipecatClient({
    // client-js models devices with the browser MediaDeviceInfo type while the
    // React Native transport returns @daily-co/react-native-webrtc's equivalent
    // shape. This is the only compatibility cast needed at the SDK boundary.
    transport: transport as unknown as Transport,
    enableMic: true,
    enableCam: false,
    disconnectOnBotDisconnect: true,
    callbacks: {
      onTransportStateChanged: events.onTransportState,
      onConnected: events.onConnected,
      onDisconnected: events.onDisconnected,
      onUserStartedSpeaking: events.onUserStartedSpeaking,
      onUserStoppedSpeaking: events.onUserStoppedSpeaking,
      onBotStartedSpeaking: events.onBotStartedSpeaking,
      onBotStoppedSpeaking: events.onBotStoppedSpeaking,
      onUserTranscript: events.onUserTranscript,
      onBotLlmText: events.onBotText,
      onLocalAudioLevel: events.onLocalAudioLevel,
      onRemoteAudioLevel: level => events.onRemoteAudioLevel(level),
      onMetrics: events.onMetrics,
      onError: message => {
        const data = message?.data;
        const error = data && typeof data === "object" && "error" in data
          ? (data as { error?: unknown }).error
          : null;
        events.onError(typeof error === "string" ? error : "Voice connection failed");
      },
      onDeviceError: error => events.onError(error.message || "Microphone is unavailable"),
    },
  });
}
