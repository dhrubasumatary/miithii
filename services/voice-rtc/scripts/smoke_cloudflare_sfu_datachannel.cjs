const crypto = require("crypto");
const { chromium } = require("playwright-core");

const API_URL = process.env.MIITHII_API_URL || "https://api.miithii.in";
const MODAL_URL =
  process.env.MIITHII_MODAL_URL ||
  "https://dhrubasumatary--miithii-voice-connect-app.modal.run";
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

async function waitFor(page, expression, timeoutMs = 15000) {
  await page.waitForFunction(expression, null, { timeout: timeoutMs });
}

async function main() {
  const voiceSession = await jsonRequest(`${API_URL}/api/voice/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-miithii-install-id": `android_sfu_dc_smoke_${crypto.randomUUID()}`,
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
    await page.evaluate(() => {
      window.sfuDataPeers = {};
    });

    async function establishPeer(key) {
      const session = await sfuRequest("/sessions/new");
      const established = await sfuRequest(
        `/sessions/${session.sessionId}/datachannels/establish`,
        "POST",
        {
          dataChannel: { location: "remote", dataChannelName: "server-events" },
        },
      );
      const serverEvents = established.dataChannel || established.datachannel;
      if (!established.sessionDescription || serverEvents?.id === undefined) {
        throw new Error(`SFU did not establish DataChannel transport: ${JSON.stringify(established)}`);
      }
      const answer = await page.evaluate(
        async ({ key, remoteDescription, serverEventsId }) => {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
            bundlePolicy: "max-bundle",
          });
          await pc.setRemoteDescription(remoteDescription);
          const serverEvents = pc.createDataChannel("server-events", {
            negotiated: true,
            id: serverEventsId,
          });
          const localAnswer = await pc.createAnswer();
          await pc.setLocalDescription(localAnswer);
          window.sfuDataPeers[key] = {
            pc,
            serverEvents,
            messages: [],
          };
          return { type: "answer", sdp: pc.localDescription.sdp };
        },
        {
          key,
          remoteDescription: established.sessionDescription,
          serverEventsId: serverEvents.id,
        },
      );
      await sfuRequest(`/sessions/${session.sessionId}/renegotiate`, "PUT", {
        sessionDescription: answer,
      });
      return session;
    }

    const publisher = await establishPeer("publisher");
    const subscriber = await establishPeer("subscriber");

    await waitFor(
      page,
      () =>
        window.sfuDataPeers.publisher?.pc.connectionState === "connected" &&
        window.sfuDataPeers.subscriber?.pc.connectionState === "connected" &&
        window.sfuDataPeers.publisher?.serverEvents.readyState === "open" &&
        window.sfuDataPeers.subscriber?.serverEvents.readyState === "open",
    );

    const published = await sfuRequest(
      `/sessions/${publisher.sessionId}/datachannels/new`,
      "POST",
      {
        dataChannels: [
          { location: "local", dataChannelName: "rtvi-ai", ordered: true },
        ],
      },
    );
    const subscribed = await sfuRequest(
      `/sessions/${subscriber.sessionId}/datachannels/new`,
      "POST",
      {
        dataChannels: [
          {
            location: "remote",
            sessionId: publisher.sessionId,
            dataChannelName: "rtvi-ai",
            ordered: true,
            waitForAck: true,
            canReply: true,
          },
        ],
      },
    );

    const publisherChannelId = published.dataChannels?.[0]?.id;
    const subscriberChannelId = subscribed.dataChannels?.[0]?.id;
    if (publisherChannelId === undefined || subscriberChannelId === undefined) {
      throw new Error("SFU did not return negotiated DataChannel IDs");
    }

    await page.evaluate(
      ({ publisherChannelId, subscriberChannelId }) => {
        const publisher = window.sfuDataPeers.publisher;
        const subscriber = window.sfuDataPeers.subscriber;
        publisher.channel = publisher.pc.createDataChannel("rtvi-ai", {
          negotiated: true,
          id: publisherChannelId,
          ordered: true,
        });
        subscriber.channel = subscriber.pc.createDataChannel("rtvi-ai", {
          negotiated: true,
          id: subscriberChannelId,
          ordered: true,
        });
        publisher.channel.addEventListener("message", event => {
          publisher.messages.push(String(event.data));
        });
        subscriber.channel.addEventListener("message", event => {
          subscriber.messages.push(String(event.data));
        });
      },
      { publisherChannelId, subscriberChannelId },
    );

    await waitFor(
      page,
      () =>
        window.sfuDataPeers.publisher?.channel.readyState === "open" &&
        window.sfuDataPeers.subscriber?.channel.readyState === "open",
    );

    // waitForAck consumes the subscriber's first message, then opens publisher delivery.
    await page.evaluate(() => window.sfuDataPeers.subscriber.channel.send("ack"));
    await page.waitForTimeout(250);
    await page.evaluate(() =>
      window.sfuDataPeers.publisher.channel.send(
        JSON.stringify({ label: "rtvi-ai", type: "ping", data: { value: 1 } }),
      ),
    );
    await waitFor(
      page,
      () => window.sfuDataPeers.subscriber.messages.some(message => message.includes('"ping"')),
    );
    await page.evaluate(() =>
      window.sfuDataPeers.subscriber.channel.send(
        JSON.stringify({ label: "rtvi-ai", type: "pong", data: { value: 2 } }),
      ),
    );
    await waitFor(
      page,
      () => window.sfuDataPeers.publisher.messages.some(message => message.includes('"pong"')),
    );

    const result = await page.evaluate(() => ({
      publisherState: window.sfuDataPeers.publisher.pc.connectionState,
      subscriberState: window.sfuDataPeers.subscriber.pc.connectionState,
      publisherChannelState: window.sfuDataPeers.publisher.channel.readyState,
      subscriberChannelState: window.sfuDataPeers.subscriber.channel.readyState,
      publisherMessages: window.sfuDataPeers.publisher.messages.length,
      subscriberMessages: window.sfuDataPeers.subscriber.messages.length,
    }));
    console.log(`publisher_state=${result.publisherState}`);
    console.log(`subscriber_state=${result.subscriberState}`);
    console.log(`publisher_datachannel=${result.publisherChannelState}`);
    console.log(`subscriber_datachannel=${result.subscriberChannelState}`);
    console.log(`publisher_messages=${result.publisherMessages}`);
    console.log(`subscriber_messages=${result.subscriberMessages}`);
    if (
      result.publisherState !== "connected" ||
      result.subscriberState !== "connected" ||
      result.publisherChannelState !== "open" ||
      result.subscriberChannelState !== "open" ||
      result.publisherMessages < 1 ||
      result.subscriberMessages < 1
    ) {
      throw new Error("Cloudflare SFU DataChannel proof failed");
    }
    console.log("CLOUDFLARE_SFU_DATACHANNEL_OK");
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
