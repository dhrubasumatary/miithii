const crypto = require("crypto");
const { chromium } = require("playwright-core");

const API_URL = process.env.MIITHII_API_URL || "https://api.miithii.in";
const MODAL_URL =
  process.env.MIITHII_MODAL_URL ||
  "https://dhrubasumatary--miithii-voice-sfu-connect-app.modal.run";
const SFU_PREFIX = process.env.MIITHII_SFU_PREFIX || "/debug/sfu";
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
      "x-miithii-install-id": `android_sfu_pipecat_smoke_${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ language: "as" }),
  });
  const authorization = `Bearer ${voiceSession.token}`;
  const sfuRequest = (path, method = "POST", body = {}) =>
    jsonRequest(`${MODAL_URL}${SFU_PREFIX}${path}`, {
      method,
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  try {
    const clientSession = await sfuRequest("/sessions/new");
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
      let receivedTrack = false;
      pc.addEventListener("track", event => {
        if (event.track.kind === "audio") receivedTrack = true;
      });
      const localOffer = await pc.createOffer();
      await pc.setLocalDescription(localOffer);
      window.peer = { pc, context, oscillator, receivedTrack: () => receivedTrack };
      return {
        sessionDescription: { type: "offer", sdp: pc.localDescription.sdp },
        tracks: [{ location: "local", mid: transceiver.mid, trackName: track.id }],
      };
    });
    const published = await sfuRequest(
      `/sessions/${clientSession.sessionId}/tracks/new`,
      "POST",
      offer,
    );
    await page.evaluate(async answer => {
      await window.peer.pc.setRemoteDescription(answer);
    }, published.sessionDescription);
    await page.waitForFunction(
      () => window.peer.pc.connectionState === "connected",
      null,
      { timeout: 15000 },
    );

    const clientTrack = published.tracks.find(track => track.trackName);
    if (!clientTrack) throw new Error("SFU did not return the client audio track");

    const modalPeer = await sfuRequest("/pipecat-peer/start", "POST", {
      remoteSessionId: clientSession.sessionId,
      remoteTrackName: clientTrack.trackName,
    });

    const pulled = await sfuRequest(
      `/sessions/${clientSession.sessionId}/tracks/new`,
      "POST",
      {
        tracks: [
          {
            location: "remote",
            sessionId: modalPeer.sessionId,
            trackName: modalPeer.trackName,
          },
        ],
      },
    );
    console.log(
      `pull_sdp type=${pulled.sessionDescription?.type} length=${String(pulled.sessionDescription?.sdp || "").length}`,
    );
    const answer = await page.evaluate(async remoteOffer => {
      await window.peer.pc.setRemoteDescription(remoteOffer);
      const localAnswer = await window.peer.pc.createAnswer();
      await window.peer.pc.setLocalDescription(localAnswer);
      return { type: "answer", sdp: window.peer.pc.localDescription.sdp };
    }, pulled.sessionDescription);
    await sfuRequest(`/sessions/${clientSession.sessionId}/renegotiate`, "PUT", {
      sessionDescription: answer,
    });

    const establishedData = await sfuRequest(
      `/sessions/${clientSession.sessionId}/datachannels/establish`,
      "POST",
      { dataChannel: { location: "remote", dataChannelName: "server-events" } },
    );
    const serverEvents = establishedData.dataChannel || establishedData.datachannel;
    if (!serverEvents || serverEvents.id === undefined) {
      throw new Error("SFU did not return client server-events DataChannel ID");
    }
    const dataAnswer = await page.evaluate(
      async ({ remoteDescription, channelId }) => {
        const { pc } = window.peer;
        await pc.setRemoteDescription(remoteDescription);
        window.peer.serverEvents = pc.createDataChannel("server-events", {
          negotiated: true,
          id: channelId,
        });
        const localAnswer = await pc.createAnswer();
        await pc.setLocalDescription(localAnswer);
        return { type: "answer", sdp: pc.localDescription.sdp };
      },
      { remoteDescription: establishedData.sessionDescription, channelId: serverEvents.id },
    );
    await sfuRequest(`/sessions/${clientSession.sessionId}/renegotiate`, "PUT", {
      sessionDescription: dataAnswer,
    });
    const publishedData = await sfuRequest(
      `/sessions/${clientSession.sessionId}/datachannels/new`,
      "POST",
      {
        dataChannels: [{ location: "local", dataChannelName: "chat", ordered: true }],
      },
    );
    const clientDataChannelId = publishedData.dataChannels?.[0]?.id;
    if (clientDataChannelId === undefined) {
      throw new Error("SFU did not return client RTVI DataChannel ID");
    }
    await page.evaluate(channelId => {
      const channel = window.peer.pc.createDataChannel("chat", {
        negotiated: true,
        ordered: true,
        id: channelId,
      });
      window.peer.rtvi = channel;
      window.peer.messages = [];
      channel.addEventListener("message", event => {
        window.peer.messages.push(String(event.data));
      });
    }, clientDataChannelId);
    await sfuRequest(`/pipecat-peer/${modalPeer.sessionId}/datachannel/subscribe`, "POST", {
      remoteSessionId: clientSession.sessionId,
      remoteDataChannelName: "chat",
    });

    const deadline = Date.now() + 20000;
    let browserResult = null;
    let modalStatus = null;
    while (Date.now() < deadline) {
      browserResult = await page.evaluate(async () => {
        let inboundBytes = 0;
        const stats = await window.peer.pc.getStats();
        for (const stat of stats.values()) {
          if (stat.type === "inbound-rtp" && stat.kind === "audio") {
            inboundBytes = Math.max(inboundBytes, stat.bytesReceived || 0);
          }
        }
        return {
          connectionState: window.peer.pc.connectionState,
          receivedTrack: window.peer.receivedTrack(),
          inboundBytes,
        };
      });
      modalStatus = await sfuRequest(`/pipecat-peer/${modalPeer.sessionId}/status`);
      if (
        browserResult.connectionState === "connected" &&
        browserResult.receivedTrack &&
        browserResult.inboundBytes > 0 &&
        modalStatus.connectionState === "connected" &&
        modalStatus.inputFrames > 0 &&
        modalStatus.dataChannelState === "open"
      ) {
        break;
      }
      await page.waitForTimeout(250);
    }

    await page.waitForFunction(
      () => window.peer.rtvi?.readyState === "open",
      null,
      { timeout: 15000 },
    );
    await page.evaluate(() => window.peer.rtvi.send(`ping: ${Date.now()}`));
    const pingDeadline = Date.now() + 5000;
    while (Date.now() < pingDeadline) {
      modalStatus = await sfuRequest(`/pipecat-peer/${modalPeer.sessionId}/status`);
      if (modalStatus.receivedPing) break;
      await page.waitForTimeout(100);
    }
    const sendResult = await sfuRequest(
      `/pipecat-peer/${modalPeer.sessionId}/message`,
      "POST",
      { value: 42 },
    );
    let probeDelivered = false;
    try {
      await page.waitForFunction(
        () => window.peer.messages?.some(message => message.includes('"sfu-probe"')),
        null,
        { timeout: 5000 },
      );
      probeDelivered = true;
    } catch {
      // Preserve the hard assertion below, but collect transport metadata first.
    }
    modalStatus = await sfuRequest(`/pipecat-peer/${modalPeer.sessionId}/status`);
    const browserDataChannel = await page.evaluate(() => ({
      label: window.peer.rtvi?.label,
      id: window.peer.rtvi?.id,
      readyState: window.peer.rtvi?.readyState,
      bufferedAmount: window.peer.rtvi?.bufferedAmount,
      messages: window.peer.messages?.length || 0,
    }));

    console.log(`browser_state=${browserResult?.connectionState}`);
    console.log(`browser_received_audio_track=${browserResult?.receivedTrack}`);
    console.log(`browser_inbound_audio_bytes=${browserResult?.inboundBytes}`);
    console.log(`modal_state=${modalStatus?.connectionState}`);
    console.log(`modal_ice_state=${modalStatus?.iceConnectionState}`);
    console.log(`modal_input_frames=${modalStatus?.inputFrames}`);
    console.log(`modal_input_samples=${modalStatus?.inputSamples}`);
    console.log(`modal_datachannel=${modalStatus?.dataChannelState}`);
    console.log(`modal_received_ping=${modalStatus?.receivedPing}`);
    console.log(`modal_datachannel_meta=${JSON.stringify(modalStatus?.dataChannel || {})}`);
    console.log(`modal_sfu_channels=${JSON.stringify(modalStatus?.sfuDataChannels || [])}`);
    console.log(`send_result=${JSON.stringify(sendResult?.dataChannel || {})}`);
    console.log(`browser_datachannel_meta=${JSON.stringify(browserDataChannel)}`);
    const browserMessages = await page.evaluate(() => window.peer.messages?.length || 0);
    console.log(`browser_datachannel_messages=${browserMessages}`);
    if (
      browserResult?.connectionState !== "connected" ||
      !browserResult?.receivedTrack ||
      browserResult?.inboundBytes <= 0 ||
      modalStatus?.connectionState !== "connected" ||
      modalStatus?.inputFrames <= 0 ||
      modalStatus?.dataChannelState !== "open" ||
      !modalStatus?.receivedPing ||
      !probeDelivered ||
      browserMessages <= 0
    ) {
      throw new Error("Cloudflare SFU Modal aiortc media/control proof failed");
    }
    console.log("CLOUDFLARE_SFU_PIPECAT_PEER_OK");
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
