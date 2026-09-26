const rawPipecatUrl = process.env.EXPO_PUBLIC_PIPECAT_URL?.trim();
const rawTransport = process.env.EXPO_PUBLIC_VOICE_TRANSPORT?.trim().toLowerCase();
const rawApiUrl = process.env.EXPO_PUBLIC_MIITHII_API_URL?.trim();
const rawUseVoiceSession = process.env.EXPO_PUBLIC_USE_VOICE_SESSION?.trim().toLowerCase();

export type VoiceTransportKind = "webrtc" | "daily";
export const VOICE_TRANSPORT: VoiceTransportKind = rawTransport === "daily" ? "daily" : "webrtc";

// Android Emulator reaches the host machine through 10.0.2.2. Physical devices
// should set EXPO_PUBLIC_PIPECAT_URL to the computer's LAN address.
export const PIPECAT_URL = (rawPipecatUrl || "http://10.0.2.2:7860").replace(/\/+$/, "");
export const MIITHII_API_URL = (rawApiUrl || "http://10.0.2.2:8787").replace(/\/+$/, "");
// Production Voice starts with a short-lived capability minted by the Miithii
// brain. Local emulator development keeps the direct /start path so 10.0.2.2
// works without depending on the API worker's loopback start URL.
export const USE_VOICE_SESSION = rawUseVoiceSession === "true"
  || (rawUseVoiceSession !== "false" && MIITHII_API_URL.startsWith("https://"));
export const PIPECAT_START_URL =
  process.env.EXPO_PUBLIC_PIPECAT_START_URL?.trim() ||
  `${PIPECAT_URL}${VOICE_TRANSPORT === "daily" ? "/connect" : "/start"}`;
