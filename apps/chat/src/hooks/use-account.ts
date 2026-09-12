"use client";

import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type UsageStatus = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: number;
  timezone: string;
};

export type MemoryPrefs = { memoryEnabled: boolean };

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
  };
};

async function getRequestError(res: Response): Promise<Error> {
  let message = `Request failed (${res.status})`;
  try {
    const data = (await res.json()) as ApiErrorPayload;
    if (data.error?.message) message = data.error.message;
  } catch {
    // The status is still useful when an upstream/proxy returns a non-JSON body.
  }
  return new Error(message);
}

/**
 * Reads and updates the server-authoritative daily allowance and memory
 * preference for the signed-in account. Never invents a value locally:
 * an unavailable status stays `null` rather than showing a fake zero.
 */
export function useAccount() {
  const { getToken, isSignedIn } = useAuth();
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [prefs, setPrefs] = useState<MemoryPrefs | null>(null);
  const [usagePending, setUsagePending] = useState(true);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [usageError, setUsageError] = useState(false);
  const [prefsLoadError, setPrefsLoadError] = useState(false);
  const [prefsPending, setPrefsPending] = useState(false);
  const [prefsSaveError, setPrefsSaveError] = useState(false);

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken({ template: "miithii-api" });
      const res = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw await getRequestError(res);
      return res.json();
    },
    [getToken],
  );

  const refreshUsage = useCallback(async () => {
    if (!isSignedIn) return;
    setUsagePending(true);
    try {
      setUsage(await authedFetch("/api/usage"));
      setUsageError(false);
    } catch {
      setUsageError(true);
    } finally {
      setUsagePending(false);
    }
  }, [authedFetch, isSignedIn]);

  const refreshPrefs = useCallback(async () => {
    if (!isSignedIn) return;
    setPrefsLoading(true);
    try {
      setPrefs(await authedFetch("/api/memory/prefs"));
      setPrefsLoadError(false);
    } catch {
      setPrefsLoadError(true);
    } finally {
      setPrefsLoading(false);
    }
  }, [authedFetch, isSignedIn]);

  const setMemoryEnabled = useCallback(
    async (enabled: boolean) => {
      setPrefsPending(true);
      setPrefsSaveError(false);
      try {
        const result: MemoryPrefs = await authedFetch("/api/memory/prefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memoryEnabled: enabled }),
        });
        setPrefs(result);
        return result;
      } catch (error) {
        setPrefsSaveError(true);
        throw error;
      } finally {
        setPrefsPending(false);
      }
    },
    [authedFetch],
  );

  const forgetMemory = useCallback(async () => {
    return authedFetch("/api/memory", { method: "DELETE" }) as Promise<{
      deleted: number;
    }>;
  }, [authedFetch]);

  useEffect(() => {
    refreshUsage();
    refreshPrefs();
  }, [refreshUsage, refreshPrefs]);

  // Usage can go stale while the tab sits in the background across the IST
  // midnight rollover; a focus check keeps it honest without token-by-token
  // polling.
  useEffect(() => {
    const onFocus = () => refreshUsage();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshUsage]);

  return {
    usage,
    usagePending,
    usageError,
    prefs,
    prefsLoading,
    prefsLoadError,
    prefsPending,
    prefsSaveError,
    refreshUsage,
    refreshPrefs,
    setMemoryEnabled,
    forgetMemory,
  };
}
