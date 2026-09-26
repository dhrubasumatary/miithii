const { chromium } = require("playwright-core");
const crypto = require("crypto");

const API_URL = process.env.MIITHII_API_URL || "https://api.miithii.in";
const MODAL_URL =
  process.env.MIITHII_MODAL_URL ||
  "https://dhrubasumatary--miithii-voice-connect-app.modal.run";
const CHROME_PATH =
  process.env.MIITHII_CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const RELAY_ONLY = process.env.MIITHII_SMOKE_RELAY_ONLY === "1";
const SINGLE_TURNS = process.env.MIITHII_SMOKE_SINGLE_TURNS === "1";
const CLIENT_NO_TURN = process.env.MIITHII_SMOKE_CLIENT_NO_TURN === "1";
const CLIENT_TURN_URL = process.env.MIITHII_SMOKE_CLIENT_TURN_URL?.trim();
const CONNECT_TIMEOUT_MS = Number(process.env.MIITHII_SMOKE_CONNECT_TIMEOUT_MS || 60000);
const DATA_CHANNEL_TIMEOUT_MS = Number(
  process.env.MIITHII_SMOKE_DATA_CHANNEL_TIMEOUT_MS || 10000,
);

function candidateTypes(sdp) {
  const types = [];
  for (const line of sdp.split(/\r?\n/)) {
    if (!line.startsWith("a=candidate:") || !line.includes(" typ ")) continue;
    const type = line.split(" typ ")[1].split(" ")[0];
    if (type && !types.includes(type)) types.push(type);
  }
  return types;
}

function safeSdpSummary(sdp) {
  return sdp
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.startsWith("m=") ||
        line.startsWith("a=mid:") ||
        line.startsWith("a=group:") ||
        line.startsWith("a=candidate:") ||
        line === "a=end-of-candidates" ||
        line.startsWith("a=ice-options:") ||
        line.startsWith("a=setup:"),
    )
    .join("\n");
}

function relayOnlySdp(sdp) {
  return sdp
    .split(/\r?\n/)
    .filter(
      (line) => !line.startsWith("a=candidate:") || line.includes(" typ relay"),
    )
    .join("\r\n");
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${url} HTTP ${response.status}: ${body.detail || "unknown"}`);
  }
  return body;
}

function clientIceServers(iceServers) {
  if (CLIENT_NO_TURN) {
    return iceServers.filter((server) => !server.username);
  }
  if (CLIENT_TURN_URL) {
    return iceServers
      .filter((server) => server.username)
      .map((server) => ({ ...server, urls: [CLIENT_TURN_URL] }));
  }
  if (!SINGLE_TURNS) return iceServers;
  return iceServers
    .filter((server) => server.username)
    .map((server) => ({
      ...server,
      urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
    }));
}

(async () => {
  const installId = `browser_smoke_${crypto.randomBytes(18).toString("hex")}`;
  const admission = await jsonFetch(`${API_URL}/api/voice/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-miithii-install-id": installId,
    },
    body: JSON.stringify({ language: "as" }),
  });
  const headers = {
    authorization: `Bearer ${admission.token}`,
    "content-type": "application/json",
  };
  const start = await jsonFetch(`${MODAL_URL}/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      transport: "webrtc",
      enableDefaultIceServers: true,
      body: { language: "as" },
    }),
  });

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  try {
    const local = await page.evaluate(
      async ({ iceServers, relayOnly }) => {
        const pc = new RTCPeerConnection({
          iceServers,
          iceTransportPolicy: relayOnly ? "relay" : "all",
        });
        window.__pc = pc;
        const dataChannel = pc.createDataChannel("chat", { ordered: true });
        window.__dc = dataChannel;

        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0.0001;
        const destination = context.createMediaStreamDestination();
        oscillator.connect(gain).connect(destination);
        oscillator.start();
        window.__audio = { context, oscillator };
        pc.addTrack(destination.stream.getAudioTracks()[0], destination.stream);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (pc.iceGatheringState !== "complete") {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("ICE gathering timeout")),
              15000,
            );
            pc.addEventListener("icegatheringstatechange", () => {
              if (pc.iceGatheringState === "complete") {
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        }
        return {
          sdp: pc.localDescription.sdp,
          type: pc.localDescription.type,
        };
      },
      { iceServers: clientIceServers(start.iceConfig.iceServers), relayOnly: RELAY_ONLY },
    );

    console.log(`client_candidate_types=${candidateTypes(local.sdp).join(",") || "none"}`);
    console.log(`client_sdp_summary=\n${safeSdpSummary(local.sdp)}`);
    const answer = await jsonFetch(
      `${MODAL_URL}/sessions/${start.sessionId}/api/offer`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          sdp: local.sdp,
          type: local.type,
          pc_id: null,
          restart_pc: false,
          requestData: { language: "as" },
        }),
      },
    );
    const answerSdp = RELAY_ONLY ? relayOnlySdp(answer.sdp) : answer.sdp;
    console.log(`server_candidate_types=${candidateTypes(answerSdp).join(",") || "none"}`);
    console.log(`server_sdp_summary=\n${safeSdpSummary(answerSdp)}`);

    const result = await page.evaluate(async ({ sdp, type, connectTimeoutMs, dataChannelTimeoutMs }) => {
      const pc = window.__pc;
      const dc = window.__dc;
      const states = [];
      const iceStates = [];
      const pushStates = () => {
        if (states.at(-1) !== pc.connectionState) states.push(pc.connectionState);
        if (iceStates.at(-1) !== pc.iceConnectionState) iceStates.push(pc.iceConnectionState);
      };
      pushStates();
      pc.addEventListener("connectionstatechange", pushStates);
      pc.addEventListener("iceconnectionstatechange", pushStates);
      await pc.setRemoteDescription({ sdp, type });

      const deadline = Date.now() + connectTimeoutMs;
      const pairSnapshots = [];
      let nextSnapshot = 0;
      while (Date.now() < deadline && pc.connectionState !== "connected") {
        await new Promise((resolve) => setTimeout(resolve, 250));
        pushStates();
        if (Date.now() >= nextSnapshot) {
          nextSnapshot = Date.now() + 1000;
          const liveStats = await pc.getStats();
          pairSnapshots.push(
            [...liveStats.values()]
              .filter((stat) => stat.type === "candidate-pair")
              .map((stat) => ({
                state: stat.state,
                nominated: stat.nominated,
                writable: stat.writable,
                localCandidateId: stat.localCandidateId,
                remoteCandidateId: stat.remoteCandidateId,
                requestsSent: stat.requestsSent,
                responsesReceived: stat.responsesReceived,
                requestsReceived: stat.requestsReceived,
                responsesSent: stat.responsesSent,
                bytesSent: stat.bytesSent,
                bytesReceived: stat.bytesReceived,
              })),
          );
        }
        if (pc.connectionState === "failed" || pc.connectionState === "closed") break;
      }

      const dataDeadline = Date.now() + dataChannelTimeoutMs;
      while (
        pc.connectionState === "connected" &&
        dc.readyState !== "open" &&
        Date.now() < dataDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        pushStates();
      }

      const stats = await pc.getStats();
      const safeStats = [];
      for (const stat of stats.values()) {
        if (
          stat.type === "candidate-pair" ||
          stat.type === "local-candidate" ||
          stat.type === "remote-candidate" ||
          stat.type === "transport"
        ) {
          safeStats.push(Object.fromEntries(Object.entries(stat)));
        }
      }
      return {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        dataChannelState: dc.readyState,
        states,
        iceStates,
        pairSnapshots,
        stats: safeStats,
      };
    }, {
      sdp: answerSdp,
      type: answer.type,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      dataChannelTimeoutMs: DATA_CHANNEL_TIMEOUT_MS,
    });

    console.log(`peer_connection_state=${result.connectionState}`);
    console.log(`ice_connection_state=${result.iceConnectionState}`);
    console.log(`data_channel=${result.dataChannelState}`);
    console.log(`states=${result.states.join(">")}`);
    console.log(`ice_states=${result.iceStates.join(">")}`);
    result.pairSnapshots.forEach((snapshot, index) => {
      console.log(`pair_snapshot_${index}=${JSON.stringify(snapshot)}`);
    });
    for (const stat of result.stats) {
      console.log(`rtc_stat=${JSON.stringify(stat)}`);
    }
    if (result.connectionState !== "connected" || result.dataChannelState !== "open") {
      process.exitCode = 1;
      return;
    }
    console.log("LIBWEBRTC_MODAL_ICE_OK");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`SMOKE_ERROR=${error.message}`);
  process.exit(1);
});
