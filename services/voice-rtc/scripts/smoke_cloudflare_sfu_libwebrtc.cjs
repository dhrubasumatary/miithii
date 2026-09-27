const crypto = require("crypto");
const { chromium } = require("playwright-core");

const API_URL = process.env.MIITHII_API_URL || "https://api.miithii.in";
const MODAL_URL =
  process.env.MIITHII_MODAL_URL ||
  "https://dhrubasumatary--miithii-voice-sfu-connect-app.modal.run";
const CHROME_PATH =
  process.env.MIITHII_CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  const voiceSession = await jsonRequest(`${API_URL}/api/voice/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-miithii-install-id": `android_sfu_smoke_${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ language: "as" }),
  });
  const authorization = `Bearer ${voiceSession.token}`;
  const sfuRequest = (path, method = "POST", body = {}) =>
    jsonRequest(`${MODAL_URL}/debug/sfu${path}`, {
      method,
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  try {
    const publisher = await sfuRequest("/sessions/new");
    const offer = await page.evaluate(async () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      gain.gain.value = 0.08;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      const track = destination.stream.getAudioTracks()[0];
      const transceiver = pc.addTransceiver(track, { direction: "sendonly" });
      const localOffer = await pc.createOffer();
      await pc.setLocalDescription(localOffer);
      window.publisher = { pc, context, oscillator };
      return {
        sessionDescription: { type: "offer", sdp: pc.localDescription.sdp },
        tracks: [{ location: "local", mid: transceiver.mid, trackName: track.id }],
      };
    });
    const published = await sfuRequest(
      `/sessions/${publisher.sessionId}/tracks/new`,
      "POST",
      offer,
    );
    await page.evaluate(async answer => {
      await window.publisher.pc.setRemoteDescription(answer);
    }, published.sessionDescription);

    const publishedTrack = published.tracks.find(track => track.trackName);
    if (!publishedTrack) throw new Error("SFU did not return a published track");

    const receiver = await sfuRequest("/sessions/new");
    const pulled = await sfuRequest(`/sessions/${receiver.sessionId}/tracks/new`, "POST", {
      tracks: [
        {
          location: "remote",
          sessionId: publisher.sessionId,
          trackName: publishedTrack.trackName,
        },
      ],
    });
    const answer = await page.evaluate(async remoteOffer => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      let receivedTrack = false;
      pc.addEventListener("track", event => {
        if (event.track.kind === "audio") receivedTrack = true;
      });
      await pc.setRemoteDescription(remoteOffer);
      const localAnswer = await pc.createAnswer();
      await pc.setLocalDescription(localAnswer);
      window.receiver = { pc, receivedTrack: () => receivedTrack };
      return { type: "answer", sdp: pc.localDescription.sdp };
    }, pulled.sessionDescription);
    await sfuRequest(`/sessions/${receiver.sessionId}/renegotiate`, "PUT", {
      sessionDescription: answer,
    });

    const result = await page.evaluate(async () => {
      const deadline = Date.now() + 20000;
      let inboundBytes = 0;
      while (Date.now() < deadline) {
        const stats = await window.receiver.pc.getStats();
        for (const stat of stats.values()) {
          if (stat.type === "inbound-rtp" && stat.kind === "audio") {
            inboundBytes = Math.max(inboundBytes, stat.bytesReceived || 0);
          }
        }
        if (
          window.publisher.pc.connectionState === "connected" &&
          window.receiver.pc.connectionState === "connected" &&
          window.receiver.receivedTrack() &&
          inboundBytes > 0
        ) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      return {
        publisherState: window.publisher.pc.connectionState,
        receiverState: window.receiver.pc.connectionState,
        receivedTrack: window.receiver.receivedTrack(),
        inboundBytes,
      };
    });
    console.log(`publisher_state=${result.publisherState}`);
    console.log(`receiver_state=${result.receiverState}`);
    console.log(`received_audio_track=${result.receivedTrack}`);
    console.log(`inbound_audio_bytes=${result.inboundBytes}`);
    if (
      result.publisherState !== "connected" ||
      result.receiverState !== "connected" ||
      !result.receivedTrack ||
      result.inboundBytes <= 0
    ) {
      throw new Error("Cloudflare SFU media proof failed");
    }
    console.log("CLOUDFLARE_SFU_LIBWEBRTC_OK");
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
