export type ReplyLanguage = "as" | "brx";

export type SessionDescription = {
  type: "offer" | "answer";
  sdp: string;
};

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type PcmStartRequest = {
  language: ReplyLanguage;
};

export type PcmStartResponse = {
  voiceSessionId: string;
  iceConfig: {
    iceServers: IceServer[];
  };
  eventsUrl?: string;
};

export type PcmPublishRequest = {
  sessionDescription: SessionDescription;
};

export type BotPublication = {
  sessionId: string;
  trackName: string;
};

export type PcmPublishResponse = {
  sessionDescription: SessionDescription;
  botPublication: BotPublication;
};

export type PcmSubscribeRequest = {
  botPublication: BotPublication;
};

export type PcmSubscribeResponse = {
  subscriberSessionId: string;
  sessionDescription: SessionDescription;
};

export type PcmSubscribeAnswerRequest = {
  subscriberSessionId: string;
  sessionDescription: SessionDescription;
};

export type PcmStopRequest = Record<string, never>;

export type VoiceDomStartParams = {
  generation: number;
  language: ReplyLanguage;
  startUrl: string;
  token: string;
};

export type VoiceDomState = "connecting" | "ready" | "stopped" | "error";

export type VoiceDomStateEvent = {
  generation: number;
  state: VoiceDomState;
  stage?: "permission" | "start" | "publish" | "subscribe" | "connected";
};

export type VoiceDomErrorEvent = {
  generation: number;
  message: string;
};

export type VoiceLatencyStage =
  | "pcm-input"
  | "vad"
  | "stt"
  | "brain"
  | "tts-first-audio"
  | "tts-total"
  | "playback";

export type VoiceServerEvent =
  | { type: "user-started" }
  | { type: "user-stopped" }
  | { type: "transcript"; text: string; final: boolean }
  | { type: "bot-text"; text: string }
  | { type: "bot-started" }
  | { type: "bot-stopped" }
  | { type: "audio-level"; source: "local" | "remote"; level: number }
  | { type: "latency"; stage: VoiceLatencyStage; ms: number };

export type VoiceDomServerEvent = {
  generation: number;
  event: VoiceServerEvent;
};
