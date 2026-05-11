const DEFAULT_AUDIO_BUCKET = "miithii-audio";

type RequestOptions = RequestInit & {
  prefer?: string;
};

export function getAudioBucket() {
  return process.env.SUPABASE_AUDIO_BUCKET || DEFAULT_AUDIO_BUCKET;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server env is not configured");
  }

  return { url, serviceRoleKey };
}

async function supabaseFetch(path: string, options: RequestOptions = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const headers = new Headers(options.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  if (options.prefer) headers.set("Prefer", options.prefer);

  const res = await fetch(`${url}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase request failed ${res.status}: ${detail}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function insertRow<T extends Record<string, unknown>>(table: string, row: T) {
  if (!isSupabaseConfigured()) return null;

  const data = await supabaseFetch(`/rest/v1/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
    prefer: "return=representation",
  });

  return Array.isArray(data) ? data[0] : data;
}

export async function updateRows<T extends Record<string, unknown>>(
  table: string,
  query: string,
  patch: T
) {
  if (!isSupabaseConfigured()) return null;

  return supabaseFetch(`/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    prefer: "return=representation",
  });
}

export async function selectRows<T = Record<string, unknown>>(table: string, query: string) {
  if (!isSupabaseConfigured()) return [] as T[];
  const data = await supabaseFetch(`/rest/v1/${table}?${query}`);
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function uploadPrivateAudioObject({
  body,
  contentType,
  path,
}: {
  body: Buffer;
  contentType: string;
  path: string;
}) {
  if (!isSupabaseConfigured()) return null;

  const bucket = getAudioBucket();
  await supabaseFetch(`/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "31536000",
      "x-upsert": "true",
    },
    body: new Uint8Array(body),
  });

  return {
    bucket,
    path,
    bytes: body.byteLength,
  };
}

export async function createSignedAudioUrl(path: string, expiresIn = 900) {
  if (!isSupabaseConfigured()) return null;

  const bucket = getAudioBucket();
  const data = await supabaseFetch(`/storage/v1/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });

  const signedPath = data?.signedURL || data?.signedUrl;
  if (!signedPath) return null;
  const { url } = getSupabaseConfig();
  return signedPath.startsWith("http") ? signedPath : `${url}${signedPath}`;
}
