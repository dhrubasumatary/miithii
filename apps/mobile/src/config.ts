const rawApiUrl = process.env.EXPO_PUBLIC_MIITHII_API_URL?.trim();
const rawVoicePcmStartUrl = process.env.EXPO_PUBLIC_VOICE_PCM_START_URL?.trim();

export const MIITHII_API_URL = (rawApiUrl || "http://10.0.2.2:8787").replace(/\/+$/, "");

export function resolveVoicePcmStartUrl(sessionStartUrl: string) {
  if (rawVoicePcmStartUrl) return rawVoicePcmStartUrl.replace(/\/+$/, "");
  const candidate = sessionStartUrl.replace(/\/+$/, "");
  return /\/pcm\/start$/i.test(candidate) ? candidate : null;
}
