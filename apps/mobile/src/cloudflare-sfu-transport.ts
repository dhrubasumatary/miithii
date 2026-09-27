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
  iceConfig: {
    iceServers: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }>;
  };
};

type JsonObject = Record<string, unknown>;

export type MiithiiSFUTransportErrorCode =
  | "sfu_http"
  | "microphone_connect_timeout";

export class MiithiiSFUTransportError extends Error {
  readonly code: MiithiiSFUTransportErrorCode;
  readonly path?: string;
  readonly status?: number;

  constructor(
    code: MiithiiSFUTransportErrorCode,
    message: string,
    context: { path?: string; status?: number } = {},
  ) {
    super(message);
    this.name = "MiithiiSFUTransportError";
    this.code = code;
    this.path = context.path;
    this.status = context.status;
  }
}

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
  signal?: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("Miithii SFU connection cancelled");
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (signal?.aborted) throw new Error("Miithii SFU connection cancelled");
  throw new Error(message);
}

async function settleIceGathering(
  pc: RTCPeerConnection,
  stage: (name: string, data?: JsonObject) => void,
  label: string,
  signal?: AbortSignal,
): Promise<void> {
  const candidateSnapshot = () => {
    const sdp = pc.localDescription?.sdp || "";
    const candidates = sdp.match(/^a=candidate:.*$/gm) || [];
    const candidateTypes = Array.from(new Set(
      candidates
        .map(candidate => candidate.match(/\styp\s+(\S+)/)?.[1])
        .filter((value): value is string => Boolean(value)),
    ));
    return { candidates, candidateTypes };
  };

  const startedAt = Date.now();
  const deadline = startedAt + 12_000;
  let lastCandidateFingerprint = "";
  let lastCandidateChangeAt = startedAt;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("Miithii SFU connection cancelled");
    const { candidates, candidateTypes } = candidateSnapshot();
    const candidateFingerprint = candidates.join("\n");
    if (candidateFingerprint !== lastCandidateFingerprint) {
      lastCandidateFingerprint = candidateFingerprint;
      lastCandidateChangeAt = Date.now();
    }

    const hasReachableCandidate = candidateTypes.includes("srflx")
      || candidateTypes.includes("relay");
    const quietForMs = Date.now() - lastCandidateChangeAt;
    // This SFU adapter does not trickle candidates after SDP is submitted.
    // @daily-co/react-native-webrtc updates localDescription for every emitted
    // candidate, but on Android we have observed libwebrtc remain in the
    // `gathering` state indefinitely even after candidate emission stops. Wait
    // for the real completion event when it arrives; otherwise require a stable
    // candidate set before freezing the latest localDescription.
    if (
      candidates.length > 0
      && hasReachableCandidate
      && (pc.iceGatheringState === "complete" || quietForMs >= 1_000)
    ) {
      stage("ice_gathering_ready", {
        label,
        state: pc.iceGatheringState,
        mode: pc.iceGatheringState === "complete" ? "complete" : "quiescent",
        quietForMs,
        candidateCount: candidates.length,
        candidateTypes,
      });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  if (signal?.aborted) throw new Error("Miithii SFU connection cancelled");

  const { candidates, candidateTypes } = candidateSnapshot();
  stage("ice_gathering_failed", {
    label,
    state: pc.iceGatheringState,
    candidateCount: candidates.length,
    candidateTypes,
  });
  throw new Error(`${label} could not find a reachable ICE candidate`);
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
  private botReadyObserved = false;
  private clientReadyRetryTimers: ReturnType<typeof setTimeout>[] = [];
  private connectAbortController: AbortController | null = null;
  private pendingRequestControllers = new Set<AbortController>();
  private clientSessionId: string | null = null;
  private modalSessionId: string | null = null;
  private serverEventsChannel: NativeDataChannel | null = null;
  private signalingBase: string | null = null;
  private cleanupHeaders: Headers | null = null;
  private disconnectPromise: Promise<void> | null = null;
  private _retirementAcknowledged = false;

  get retirementAcknowledged(): boolean {
    return this._retirementAcknowledged;
  }

  constructor(options: SmallWebRTCTransportConstructorOptions) {
    super(options);
  }

  override _validateConnectionParams(connectParams: unknown): CloudflareSFUConnectParams {
    const params = asObject(connectParams, "Miithii SFU connection parameters are missing");
    if (params.transport !== "cloudflare-sfu") {
      throw new Error("Miithii SFU connection parameters are invalid");
    }
    const rawIceConfig = asObject(params.iceConfig, "Miithii SFU ICE configuration is missing");
    if (!Array.isArray(rawIceConfig.iceServers) || rawIceConfig.iceServers.length === 0) {
      throw new Error("Miithii SFU ICE servers are missing");
    }
    const iceServers = rawIceConfig.iceServers.map(value => {
      const server = asObject(value, "Miithii SFU ICE server is invalid");
      const urls = server.urls;
      if (
        !((typeof urls === "string" && urls) ||
          (Array.isArray(urls) && urls.length > 0 && urls.every(url => typeof url === "string" && url)))
      ) {
        throw new Error("Miithii SFU ICE server URLs are invalid");
      }
      return {
        urls: urls as string | string[],
        ...(typeof server.username === "string" ? { username: server.username } : {}),
        ...(typeof server.credential === "string" ? { credential: server.credential } : {}),
      };
    });
    return {
      transport: "cloudflare-sfu",
      sessionId: asString(params.sessionId, "Miithii SFU session is invalid"),
      iceConfig: { iceServers },
    };
  }

  override async _connect(
    connectParams?: UpstreamConnectParams,
  ): Promise<void> {
    const internal = this as unknown as TransportInternals;
    this._retirementAcknowledged = false;
    this.connectAbortController?.abort();
    const connectAbortController = new AbortController();
    this.connectAbortController = connectAbortController;
    const connectSignal = connectAbortController.signal;
    const ensureConnectActive = () => {
      if (connectSignal.aborted) throw new Error("Miithii SFU connection cancelled");
    };
    this.botReadyObserved = false;
    const stage = (name: string, data: JsonObject = {}) => {
      console.info("[miithii-voice-stage]", name, data);
    };
    const startEndpoint = endpointString(this.startBotParams?.endpoint);
    if (!startEndpoint || !/\/sfu\/start\/?$/.test(startEndpoint)) {
      throw new Error("Miithii SFU start endpoint is invalid");
    }
    const signalingBase = startEndpoint.replace(/\/start\/?$/, "");
    const authHeaders = this.startBotParams?.headers;
    this.signalingBase = signalingBase;
    this.cleanupHeaders = new Headers(authHeaders);

    const sfuRequest = async (
      path: string,
      method: "POST" | "PUT",
      body: JsonObject,
    ): Promise<JsonObject> => {
      ensureConnectActive();
      stage("sfu_request", { path, method });
      const headers = new Headers(authHeaders);
      headers.set("content-type", "application/json");
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 25_000);
      this.pendingRequestControllers.add(controller);
      try {
        const response = await fetch(`${signalingBase}${path}`, {
          method,
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const detail = payload && typeof payload === "object" && "detail" in payload
            ? String((payload as { detail?: unknown }).detail)
            : "Miithii SFU signalling failed";
          throw new MiithiiSFUTransportError("sfu_http", detail, {
            path,
            status: response.status,
          });
        }
        ensureConnectActive();
        stage("sfu_response", { path, status: response.status });
        return asObject(payload, "Miithii SFU signalling response is invalid");
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(timedOut ? "Miithii SFU signalling timed out" : "Miithii SFU signalling cancelled");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        this.pendingRequestControllers.delete(controller);
      }
    };

    const checkChannelStatus = async (modalSessionId: string) => {
      try {
        const status = await sfuRequest(`/pipecat-peer/${modalSessionId}/status`, "POST", {});
        stage("channel_status", {
          dataChannel: status.dataChannel,
          sfuDataChannels: status.sfuDataChannels,
          clientDataChannels: status.clientDataChannels,
        });
      } catch (error) {
        stage("channel_status_failed", { error: String(error) });
      }
    };

    this.state = "connecting";
    stage("media_connect_start");
    await internal.mediaManager.connect();
    ensureConnectActive();
    stage("media_connect_ok");

    const created = await sfuRequest("/sessions/new", "POST", {});
    const clientSessionId = asString(created.sessionId, "Miithii SFU client session is invalid");
    this.clientSessionId = clientSessionId;
    stage("client_session_ok");

    const validatedParams = connectParams as CloudflareSFUConnectParams | undefined;
    const iceServers = validatedParams?.iceConfig?.iceServers;
    if (!iceServers?.length) {
      throw new Error("Miithii SFU ICE configuration is unavailable");
    }
    const rtcIceServers = iceServers.map(server => ({
      ...server,
      urls: Array.isArray(server.urls) ? server.urls : [server.urls],
    }));
    stage("ice_config_ready", {
      serverCount: rtcIceServers.length,
      hasTurn: rtcIceServers.some(server => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some(url => url.startsWith("turn:" ) || url.startsWith("turns:"));
      }),
    });
    const pc = new RTCPeerConnection({
      iceServers: rtcIceServers,
      bundlePolicy: "max-bundle",
    });
    internal.pc = pc;
    stage("peer_created");

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
    stage("microphone_track_ready", { enabled: localAudio.enabled });
    // Mirror Pipecat's own RN WebRTC setup. Creating a media-type
    // transceiver and replacing its sender track is the path exercised by
    // @pipecat-ai/react-native-small-webrtc-transport on Android/iOS.
    const audioTransceiver = pc.addTransceiver("audio", {
      direction: "sendonly",
    });
    await audioTransceiver.sender.replaceTrack(localAudio as unknown as MediaStreamTrack);
    stage("audio_transceiver_ready");
    const offer = await pc.createOffer();
    ensureConnectActive();
    stage("offer_created");
    await pc.setLocalDescription(offer);
    ensureConnectActive();
    stage("local_description_set");
    await settleIceGathering(pc, stage, "microphone offer", connectSignal);
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
    ensureConnectActive();
    stage("microphone_answer_set");
    const publishedTracks = Array.isArray(published.tracks) ? published.tracks : [];
    const publishedTrack = publishedTracks.find(
      value => value && typeof value === "object",
    ) as JsonObject | undefined;
    if (publishedTrack?.errorCode || publishedTrack?.errorDescription) {
      stage("microphone_publish_failed", {
        errorCode: String(publishedTrack.errorCode ?? "unknown"),
      });
      throw new Error(`Miithii SFU microphone publication failed (${String(publishedTrack.errorCode ?? "unknown")})`);
    }
    const microphoneTrackName = asString(
      publishedTrack?.trackName,
      "Miithii SFU microphone publication is invalid",
    );
    try {
      await waitFor(
        () => pc.connectionState === "connected",
        15_000,
        "Miithii SFU microphone publication did not connect",
        connectSignal,
      );
    } catch (error) {
      if (connectSignal.aborted) throw error;
      throw new MiithiiSFUTransportError(
        "microphone_connect_timeout",
        "Miithii SFU microphone publication did not connect",
      );
    }
    stage("microphone_peer_connected");

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
    stage("modal_peer_ok");

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
    ensureConnectActive();
    stage("bot_audio_offer_set");
    const pullAnswer = await pc.createAnswer();
    ensureConnectActive();
    await pc.setLocalDescription(pullAnswer);
    ensureConnectActive();
    await settleIceGathering(pc, stage, "bot audio answer", connectSignal);
    if (!pc.localDescription) throw new Error("Miithii SFU bot audio answer is invalid");
    await sfuRequest(`/sessions/${clientSessionId}/renegotiate`, "PUT", {
      sessionDescription: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      },
    });
    stage("bot_audio_subscribed");

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
    ensureConnectActive();
    stage("data_transport_offer_set");
    this.serverEventsChannel = pc.createDataChannel("server-events", {
      negotiated: true,
      id: serverEventsId,
    });
    const dataAnswer = await pc.createAnswer();
    ensureConnectActive();
    await pc.setLocalDescription(dataAnswer);
    ensureConnectActive();
    await settleIceGathering(pc, stage, "data answer", connectSignal);
    if (!pc.localDescription) throw new Error("Miithii SFU data answer is invalid");
    await sfuRequest(`/sessions/${clientSessionId}/renegotiate`, "PUT", {
      sessionDescription: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      },
    });
    stage("data_transport_established");

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
    stage("chat_channel_created", { id: chatId });
    (chat as NativeDataChannel & { addEventListener(type: string, listener: (event: { data: unknown }) => void): void })
      .addEventListener("message", event => {
      try {
        const message = JSON.parse(String(event.data)) as JsonObject;
        stage("chat_message_received", { type: String(message.type ?? "unknown") });
        if (message.type === "bot-ready") {
          this.botReadyObserved = true;
          for (const timer of this.clientReadyRetryTimers) clearTimeout(timer);
          this.clientReadyRetryTimers = [];
        }
      } catch {
        stage("chat_message_received", { type: "non_json" });
      }
      });

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
      connectSignal,
    );
    stage("chat_channel_open", { id: chat.id });
    internal.syncTrackStatus();
    internal.audioLevelObserver.start(pc);
    this.state = "connected";
    stage("transport_connected");
    this._callbacks.onConnected?.();
    for (const delay of [3000, 9000]) {
      const timer = setTimeout(() => { void checkChannelStatus(modalSessionId); }, delay);
      this.clientReadyRetryTimers.push(timer);
    }
  }

  override sendReadyMessage(): void {
    const internal = this as unknown as TransportInternals;
    console.info("[miithii-voice-stage]", "client_ready_send", {
      state: internal.dc?.readyState,
      id: internal.dc?.id,
    });
    super.sendReadyMessage();
    console.info("[miithii-voice-stage]", "client_ready_sent", {
      bufferedAmount: internal.dc?.bufferedAmount,
    });
    for (const delay of [1500, 4000, 8000]) {
      const timer = setTimeout(() => {
        if (this.botReadyObserved || internal.dc?.readyState !== "open") return;
        console.info("[miithii-voice-stage]", "client_ready_retry", { delay });
        super.sendReadyMessage();
        void internal.pc?.getStats().then(report => {
          const channels: JsonObject[] = [];
          report.forEach((value: JsonObject) => {
            if (value.type === "data-channel") {
              channels.push({
                label: value.label,
                dataChannelIdentifier: value.dataChannelIdentifier,
                state: value.state,
                messagesSent: value.messagesSent,
                bytesSent: value.bytesSent,
                messagesReceived: value.messagesReceived,
                bytesReceived: value.bytesReceived,
              });
            }
          });
          console.info("[miithii-voice-stage]", "native_datachannel_stats", { channels });
        }).catch(() => {});
      }, delay);
      this.clientReadyRetryTimers.push(timer);
    }
  }

  private async _disconnectOnce(): Promise<void> {
    const internal = this as unknown as TransportInternals;
    const hadPeerConnection = Boolean(internal.pc);
    const signalingBase = this.signalingBase;
    const cleanupHeaders = this.cleanupHeaders ? new Headers(this.cleanupHeaders) : null;
    const clientSessionId = this.clientSessionId;
    const modalSessionId = this.modalSessionId;
    this._retirementAcknowledged = false;
    this.connectAbortController?.abort();
    this.connectAbortController = null;
    for (const timer of this.clientReadyRetryTimers) clearTimeout(timer);
    this.clientReadyRetryTimers = [];
    for (const controller of this.pendingRequestControllers) controller.abort();
    this.pendingRequestControllers.clear();
    this.serverEventsChannel?.close();
    this.serverEventsChannel = null;

    // Cleanup has its own controller because disconnect aborts every normal
    // signalling request above. Start the server retirement before local
    // teardown so the two can overlap, but never hold the microphone/PC open
    // while waiting for a slow or disappearing network.
    const leavePromise = signalingBase && cleanupHeaders && clientSessionId
      ? (async () => {
        const cleanupController = new AbortController();
        const cleanupTimeout = setTimeout(() => cleanupController.abort(), 5_000);
        cleanupHeaders.set("content-type", "application/json");
        try {
          const response = await fetch(`${signalingBase}/leave`, {
            method: "POST",
            headers: cleanupHeaders,
            body: JSON.stringify({
              clientSessionId,
              ...(modalSessionId ? { modalSessionId } : {}),
            }),
            signal: cleanupController.signal,
          });
          if (response.ok) {
            this._retirementAcknowledged = true;
            console.info("[miithii-voice-stage]", "sfu_leave", { status: response.status });
          } else {
            console.info("[miithii-voice-stage]", "sfu_leave_failed", { status: response.status });
          }
        } catch (error) {
          console.info("[miithii-voice-stage]", "sfu_leave_failed", {
            error: cleanupController.signal.aborted ? "timeout" : String(error),
          });
        } finally {
          clearTimeout(cleanupTimeout);
        }
      })()
      : Promise.resolve();

    this.clientSessionId = null;
    this.modalSessionId = null;
    this.signalingBase = null;
    this.cleanupHeaders = null;

    let teardownError: unknown = null;
    try {
      await super._disconnect();
      // Upstream SmallWebRTC `stop()` returns early when no peer connection
      // exists, without releasing its media manager. Startup can fail after
      // `initDevices()` but before this SFU adapter creates a PC, so explicitly
      // release native media in that path before a future client is allowed.
      if (!hadPeerConnection) await internal.mediaManager.disconnect();
    } catch (error) {
      teardownError = error;
    }
    await leavePromise;
    if (teardownError) throw teardownError;
  }

  override async _disconnect(): Promise<void> {
    if (this.disconnectPromise) {
      await this.disconnectPromise;
      return;
    }

    const disconnectPromise = this._disconnectOnce();
    this.disconnectPromise = disconnectPromise;
    try {
      await disconnectPromise;
    } finally {
      if (this.disconnectPromise === disconnectPromise) {
        this.disconnectPromise = null;
      }
    }
  }

}
