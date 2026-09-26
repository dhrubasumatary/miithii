const { chromium } = require("playwright-core");
const crypto = require("crypto");

const API_URL = process.env.MIITHII_API_URL || "https://api.miithii.in";
const MODAL_URL =
  process.env.MIITHII_MODAL_URL ||
  "https://dhrubasumatary--miithii-voice-connect-app.modal.run";
const CHROME_PATH =
  process.env.MIITHII_CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${url} HTTP ${response.status}: ${body.detail || "unknown"}`);
  }
  return body;
}

async function getIceConfig() {
  const installId = `turn_smoke_${crypto.randomBytes(18).toString("hex")}`;
  const admission = await jsonFetch(`${API_URL}/api/voice/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-miithii-install-id": installId,
    },
    body: JSON.stringify({ language: "as" }),
  });
  const start = await jsonFetch(`${MODAL_URL}/start`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${admission.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      transport: "webrtc",
      enableDefaultIceServers: true,
      body: { language: "as" },
    }),
  });
  return start.iceConfig.iceServers
    .filter((server) => server.username)
    .map((server) => ({
      ...server,
      urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
    }));
}

(async () => {
  const [iceServersA, iceServersB] = await Promise.all([getIceConfig(), getIceConfig()]);
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });
  const page = await browser.newPage();
  try {
    const result = await page.evaluate(async ({ iceServersA, iceServersB }) => {
      const pcA = new RTCPeerConnection({
        iceServers: iceServersA,
        iceTransportPolicy: "relay",
      });
      const pcB = new RTCPeerConnection({
        iceServers: iceServersB,
        iceTransportPolicy: "relay",
      });
      const dcA = pcA.createDataChannel("probe");
      let dcB;
      pcB.addEventListener("datachannel", (event) => {
        dcB = event.channel;
      });

      async function waitForGathering(pc) {
        if (pc.iceGatheringState === "complete") return;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("gather timeout")), 15000);
          pc.addEventListener("icegatheringstatechange", () => {
            if (pc.iceGatheringState === "complete") {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }

      const offer = await pcA.createOffer();
      await pcA.setLocalDescription(offer);
      await waitForGathering(pcA);
      await pcB.setRemoteDescription(pcA.localDescription);
      const answer = await pcB.createAnswer();
      await pcB.setLocalDescription(answer);
      await waitForGathering(pcB);
      await pcA.setRemoteDescription(pcB.localDescription);

      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (
          pcA.connectionState === "connected" &&
          pcB.connectionState === "connected" &&
          dcA.readyState === "open" &&
          dcB?.readyState === "open"
        ) {
          break;
        }
        if (pcA.connectionState === "failed" || pcB.connectionState === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const statsA = await pcA.getStats();
      const transportA = [...statsA.values()].find((stat) => stat.type === "transport");
      const localRelayCount = [...statsA.values()].filter(
        (stat) => stat.type === "local-candidate" && stat.candidateType === "relay",
      ).length;
      const remoteRelayCount = [...statsA.values()].filter(
        (stat) => stat.type === "remote-candidate" && stat.candidateType === "relay",
      ).length;
      const pairCount = [...statsA.values()].filter(
        (stat) => stat.type === "candidate-pair",
      ).length;
      return {
        a: pcA.connectionState,
        b: pcB.connectionState,
        dcA: dcA.readyState,
        dcB: dcB?.readyState || "missing",
        iceA: pcA.iceConnectionState,
        iceB: pcB.iceConnectionState,
        localRelayCount,
        remoteRelayCount,
        pairCount,
        selectedCandidatePairChanges: transportA?.selectedCandidatePairChanges || 0,
        bytesSent: transportA?.bytesSent || 0,
        bytesReceived: transportA?.bytesReceived || 0,
      };
    }, { iceServersA, iceServersB });

    console.log(`peer_a=${result.a}`);
    console.log(`peer_b=${result.b}`);
    console.log(`ice_a=${result.iceA}`);
    console.log(`ice_b=${result.iceB}`);
    console.log(`data_a=${result.dcA}`);
    console.log(`data_b=${result.dcB}`);
    console.log(`local_relay_count=${result.localRelayCount}`);
    console.log(`remote_relay_count=${result.remoteRelayCount}`);
    console.log(`candidate_pair_count=${result.pairCount}`);
    console.log(`selected_pair_changes=${result.selectedCandidatePairChanges}`);
    console.log(`transport_bytes_sent=${result.bytesSent}`);
    console.log(`transport_bytes_received=${result.bytesReceived}`);
    if (
      result.a !== "connected" ||
      result.b !== "connected" ||
      result.dcA !== "open" ||
      result.dcB !== "open"
    ) {
      process.exitCode = 1;
      return;
    }
    console.log("CLOUDFLARE_TURN_CHROME_TO_CHROME_OK");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`SMOKE_ERROR=${error.message}`);
  process.exit(1);
});
