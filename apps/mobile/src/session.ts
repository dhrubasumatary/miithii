import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ReplyLanguage } from "./voice-contract";

const INSTALL_ID_KEY = "miithii.install-id.v1";

export type VoiceSession = {
  token: string;
  expiresAt: number;
  language: ReplyLanguage;
  threadId: string;
  startUrl: string;
  policyVersion: string;
};

function createInstallId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `android_${suffix}`;
}

async function getInstallId() {
  const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
  if (existing && /^[a-zA-Z0-9_-]{16,128}$/.test(existing)) return existing;
  const created = createInstallId();
  await AsyncStorage.setItem(INSTALL_ID_KEY, created);
  return created;
}

export async function createVoiceSession(
  apiUrl: string,
  language: ReplyLanguage,
  signal?: AbortSignal,
): Promise<VoiceSession> {
  const installId = await getInstallId();
  const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/voice/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-miithii-install-id": installId,
    },
    body: JSON.stringify({ language }),
    signal,
  });
  const payload = await response.json().catch(() => null) as Partial<VoiceSession> & {
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Miithii Voice is unavailable");
  }
  if (
    !payload ||
    typeof payload.token !== "string" ||
    typeof payload.startUrl !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.language !== language ||
    typeof payload.threadId !== "string" ||
    typeof payload.policyVersion !== "string"
  ) {
    throw new Error("Miithii Voice session response is invalid");
  }
  return payload as VoiceSession;
}
