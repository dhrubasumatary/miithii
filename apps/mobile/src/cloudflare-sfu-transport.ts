import {
  RNSmallWebRTCTransport,
  type MediaManager,
  type SmallWebRTCTransportConstructorOptions,
} from "@pipecat-ai/react-native-small-webrtc-transport";
import {
  RTCPeerConnection,
  type MediaStreamTrack,
} from "@daily-co/react-native-webrtc";

type NativeDataChannel = ReturnType<RTCPeerConnection["createDataChannel"]>;
type UpstreamConnectParams = NonNullable<
  Parameters<RNSmallWebRTCTransport["_connect"]>[0]
>;
type UpstreamValidatedParams = NonNullable<
  ReturnType<RNSmallWebRTCTransport["_validateConnectionParams"]>
>;

type CloudflareSFUConnectParams = UpstreamValidatedParams & {
  transport: "cloudflare-sfu";
  sessionId: string;
};

type JsonObject = Record<string, unknown>;

type TransportInternals = {
  mediaManager: MediaManager;
  pc: RTCPeerConnection | null;
  dc: NativeDataChannel | null;
  audioLevelObserver: { start(pc: RTCPeerConnection): void };
  syncTrackStatus(): void;
  createDataChannel(
    label: string,
    options: { negotiated: boolean; ordered?: boolean; id: number },
  ): NativeDataChannel;
};

const CLOUDFLARE_STUN = "stun:stun.cloudflare.com:3478";

function asObject(value: unknown, message: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as JsonObject;
}

function asString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value) throw new Error(message);
  return value;
}

function asNumber(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(message);
  return value;
}

function endpointString(endpoint: unknown): string | null {
  if (typeof endpoint === "string") return endpoint;
  if (endpoint instanceof URL) return endpoint.toString();
  if (endpoint instanceof Request) return endpoint.url;
  return null;
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  message: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

/**
 * Keep Pipecat's React Native media/device/RTVI implementation, but replace
 * direct SmallWebRTC signalling with Cloudflare Realtime SFU signalling.
 *
 * The pinned upstream transport keeps its media manager, peer and channel as
 * runtime fields even though its declarations mark them private. This class
 * intentionally reaches only those four fields so the rest of Pipecat's
 * transport semantics stay upstream-owned.
 */
export class MiithiiCloudflareSFUTransport extends RNSmallWebRTCTransport {
  private clientSessionId: string | null = null;
  private modalSessionId: string | null = null;
  private serverEventsChannel: NativeDataChannel | null = null;

  constructor(options: SmallWebRTCTransportConstructorOptions) {
    super(options);
  }

  override _validateConnectionParams(connectParams: unknown): CloudflareSFUConnectParams {
    const params = asObject(connectParams, "Miithii SFU connection parameters are missing");
    if (params.transport !== "cloudflare-sfu") {
      throw new Error("Miithii SFU connection parameters are invalid");
    }
    return {
      transport: "cloudflare-sfu",
      sessionId: asString(params.sessionId, "Miithii SFU session is invalid"),
    };
  }

  override async _connect(
    _connectParams?: UpstreamConnectParams,
  ): Promise<void> {
    const internal = this as unknown as TransportInternals;
    const startEndpoint = endpointString(this.startBotParams?.endpoint);
    if (!startEndpoint || !/\/sfu\/start\/?$/.test(startEndpoint)) {
      throw new Error("Miithii SFU start endpoint is invalid");
    }
    const signalingBase = startEndpoint.replace(/\/start\/?$/, "");
    const authHeaders = this.startBotParams?.headers;

    const sfuRequest = async (
      path: string,
      method: "POST" | "PUT",
      body: JsonObject,
    ): Promise<JsonObject> => {
      const headers = new Headers(authHeaders);
      headers.set("content-type", "application/json");
      const response = await fetch(`${signalingBase}${path}`, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload === "object" && "detail" in payload
          ? String((payload as { detail?: unknown }).detail)
          : "Miithii SFU signalling failed";
        throw new Error(detail);
      }
      return asObject(payload, "Miithii SFU signalling response is invalid");
    };

    this.state = "connecting";
    await internal.mediaManager.connect();

    const created = await sfuRequest("/sessions/new", "POST", {});
    const clientSessionId = asString(created.sessionId, "Miithii SFU client session is invalid");
    this.clientSessionId = clientSessionId;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: CLOUDFLARE_STUN }],
      bundlePolicy: "max-bundle",
    });
    internal.pc = pc;

    const eventfulPc = pc as RTCPeerConnection & {
      addEventListener(
        type: "track",
        listener: (event: { track: MediaStreamTrack }) => void,
      ): void;
      addEventListener(type: "connectionstatechange", listener: () => void): void;
    };
    eventfulPc.addEventListener("track", event => {
      const track = event.track as MediaStreamTrack;
      track.enabled = true;
      this._callbacks.onTrackStarted?.(track as unknown as globalThis.MediaStreamTrack);
      (track as MediaStreamTrack & {
        addEventListener(type: "ended", listener: () => void): void;
      }).addEventListener("ended", () => {
        this._callbacks.onTrackStopped?.(track as unknown as globalThis.MediaStreamTrack);
      });
    });
    eventfulPc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed") this.state = "error";
    });

    const localAudio = this.tracks().local.audio;
    if (!localAudio) throw new Error("Microphone track is unavailable");
    const audioTransceiver = pc.addTransceiver(localAudio as unknown as MediaStreamTrack, {
      direction: "sendonly",
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitFor(
      () => pc.iceGatheringState === "complete",
      5_000,
      "Miithii SFU ICE gathering timed out",
    );
    if (!pc.localDescription || audioTransceiver.mid === null) {
      throw new Error("Miithii SFU microphone offer is invalid");
    }

    const published = await sfuRequest(
      `/sessions/${clientSessionId}/tracks/new`,
      "POST",
      {
        sessionDescription: {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp,
        },
        tracks: [{
          location: "local",
          mid: audioTransceiver.mid,
          trackName: localAudio.id,
        }],
      },
    );
    const publishDescription = asObject(
      published.sessionDescription,
      "Miithii SFU microphone answer is missing",
    );
    await pc.setRemoteDescription({
      type: asString(publishDescription.type, "Miithii SFU microphone answer type is invalid"),
      sdp: asString(publishDescription.sdp, "Miithii SFU microphone answer SDP is invalid"),
    });
    await waitFor(
      () => pc.connectionState === "connected",
      15_000,
      "Miithii SFU microphone publication did not connect",
    );
    const publishedTracks = Array.isArray(published.tracks) ? published.tracks : [];
    const publishedTrack = publishedTracks.find(
      value => value && typeof value === "object" && typeof (value as JsonObject).trackName === "string",
    ) as JsonObject | undefined;
    const microphoneTrackName = asString(
      publishedTrack?.trackName,
      "Miithii SFU microphone publication is invalid",
    );

    const modalPeer = await sfuRequest("/pipecat-peer/start", "POST", {
      remoteSessionId: clientSessionId,
      remoteTrackName: microphoneTrackName,
      runBot: true,
    });
    const modalSessionId = asString(
      modalPeer.sessionId,
      "Miithii SFU Modal session is invalid",
    );
    const botTrackName = asString(
      modalPeer.trackName,
      "Miithii SFU bot audio publication is invalid",
    );
    this.modalSessionId = modalSessionId;

    const pulled = await sfuRequest(
      `/sessions/${clientSessionId}/tracks/new`,
      "POST",
      {
        tracks: [{
          location: "remote",
          sessionId: modalSessionId,
          trackName: botTrackName,
        }],
      },
    );
    const pullDescription = asObject(
      pulled.sessionDescription,
      "Miithii SFU bot audio offer is missing",
    );
    await pc.setRemoteDescription({
      type: asString(pullDescription.type, "Miithii SFU bot audio offer type is invalid"),
      sdp: asString(pullDescription.sdp, "Miithii SFU bot audio offer SDP is invalid"),
    });
    const pullAnswer = await pc.createAnswer();
    await pc.setLocalDescription(pullAnswer);
    await waitFor(
      () => pc.iceGatheringState === "complete",
      5_000,
      "Miithii SFU bot audio answer ICE gathering timed out",
    );
    if (!pc.localDescription) throw new Error("Miithii SFU bot audio answer is invalid");
    await sfuRequest(`/sessions/${clientSessionId}/renegotiate`, "PUT", {
      sessionDescription: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      },
    });

    const established = await sfuRequest(
      `/sessions/${clientSessionId}/datachannels/establish`,
      "POST",
      { dataChannel: { location: "remote", dataChannelName: "server-events" } },
    );
    const establishedDescription = asObject(
      established.sessionDescription,
      "Miithii SFU data transport offer is missing",
    );
    const serverEvents = asObject(
      established.dataChannel ?? established.datachannel,
      "Miithii SFU data transport is invalid",
    );
    const serverEventsId = asNumber(
      serverEvents.id,
      "Miithii SFU data transport ID is invalid",
    );
    await pc.setRemoteDescription({
      type: asString(establishedDescription.type, "Miithii SFU data offer type is invalid"),
      sdp: asString(establishedDescription.sdp, "Miithii SFU data offer SDP is invalid"),
    });
    this.serverEventsChannel = pc.createDataChannel("server-events", {
      negotiated: true,
      id: serverEventsId,
    });
    const dataAnswer = await pc.createAnswer();
    await pc.setLocalDescription(dataAnswer);
    await waitFor(
      () => pc.iceGatheringState === "complete",
      5_000,
      "Miithii SFU data answer ICE gathering timed out",
    );
    if (!pc.localDescription) throw new Error("Miithii SFU data answer is invalid");
    await sfuRequest(`/sessions/${clientSessionId}/renegotiate`, "PUT", {
      sessionDescription: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      },
    });

    const publishedData = await sfuRequest(
      `/sessions/${clientSessionId}/datachannels/new`,
      "POST",
      {
        dataChannels: [{
          location: "local",
          dataChannelName: "chat",
          ordered: true,
        }],
      },
    );
    const dataChannels = Array.isArray(publishedData.dataChannels)
      ? publishedData.dataChannels
      : [];
    const publishedChannel = asObject(
      dataChannels[0],
      "Miithii SFU chat channel is invalid",
    );
    const chatId = asNumber(
      publishedChannel.id,
      "Miithii SFU chat channel ID is invalid",
    );
    const chat = internal.createDataChannel("chat", {
      negotiated: true,
      ordered: true,
      id: chatId,
    });
    internal.dc = chat;

    await sfuRequest(
      `/pipecat-peer/${modalSessionId}/datachannel/subscribe`,
      "POST",
      {
        remoteSessionId: clientSessionId,
        remoteDataChannelName: "chat",
      },
    );

    await waitFor(
      () => pc.connectionState === "connected" && chat.readyState === "open",
      20_000,
      "Miithii SFU connection timed out",
    );
    internal.syncTrackStatus();
    internal.audioLevelObserver.start(pc);
    this.state = "connected";
    this._callbacks.onConnected?.();
  }

  override async _disconnect(): Promise<void> {
    this.serverEventsChannel?.close();
    this.serverEventsChannel = null;
    this.clientSessionId = null;
    this.modalSessionId = null;
    await super._disconnect();
  }

}
