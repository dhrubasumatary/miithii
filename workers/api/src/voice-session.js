import { HttpError } from './validators.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ISSUER = 'miithii-api';
const AUDIENCE = 'miithii-voice-rtc';
const DEFAULT_TTL_SECONDS = 20 * 60;
const MAX_TTL_SECONDS = 30 * 60;

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

function encodeJson(value) {
  return base64url(encoder.encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(decoder.decode(decodeBase64url(value)));
}

async function hmacKey(secret, usages) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new HttpError(503, 'Voice RTC session signing is not configured', 'SERVICE_UNAVAILABLE');
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

export function isVoiceSessionToken(token) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) return false;
  try {
    const header = decodeJson(parts[0]);
    return header?.alg === 'HS256' && header?.typ === 'JWT';
  } catch {
    return false;
  }
}

export async function mintVoiceSessionToken({
  secret,
  principal,
  language,
  threadId,
  nowMs = Date.now(),
  ttlSeconds = DEFAULT_TTL_SECONDS
}) {
  if (typeof principal !== 'string' || !principal) throw new TypeError('principal is required');
  if (!['as', 'brx'].includes(language)) throw new TypeError('unsupported voice language');
  if (typeof threadId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(threadId)) throw new TypeError('invalid threadId');
  const ttl = Math.max(30, Math.min(MAX_TTL_SECONDS, Math.floor(ttlSeconds)));
  const now = Math.floor(nowMs / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: principal,
    language,
    threadId,
    iat: now,
    nbf: now - 5,
    exp: now + ttl,
    jti: crypto.randomUUID()
  };
  const unsigned = `${encodeJson(header)}.${encodeJson(claims)}`;
  const key = await hmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(unsigned));
  return { token: `${unsigned}.${base64url(new Uint8Array(signature))}`, claims };
}

export async function verifyVoiceSessionToken(token, secret, nowMs = Date.now()) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new HttpError(401, 'Invalid voice session', 'AUTH_REQUIRED');
  let header;
  let claims;
  try {
    header = decodeJson(parts[0]);
    claims = decodeJson(parts[1]);
  } catch {
    throw new HttpError(401, 'Invalid voice session', 'AUTH_REQUIRED');
  }
  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') {
    throw new HttpError(401, 'Invalid voice session signature', 'AUTH_REQUIRED');
  }
  const key = await hmacKey(secret, ['verify']);
  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    decodeBase64url(parts[2]),
    encoder.encode(`${parts[0]}.${parts[1]}`)
  );
  if (!verified) throw new HttpError(401, 'Invalid voice session signature', 'AUTH_REQUIRED');

  const now = Math.floor(nowMs / 1000);
  if (claims?.iss !== ISSUER || claims?.aud !== AUDIENCE) throw new HttpError(401, 'Invalid voice session scope', 'AUTH_REQUIRED');
  if (!Number.isFinite(claims.exp) || claims.exp <= now) throw new HttpError(401, 'Voice session expired', 'AUTH_REQUIRED');
  if (Number.isFinite(claims.nbf) && claims.nbf > now + 5) throw new HttpError(401, 'Voice session not active', 'AUTH_REQUIRED');
  if (Number.isFinite(claims.iat) && claims.iat > now + 5) throw new HttpError(401, 'Invalid voice session timestamp', 'AUTH_REQUIRED');
  if (typeof claims.sub !== 'string' || !/^(clerk|install):[a-zA-Z0-9_-]{1,160}$/.test(claims.sub)) {
    throw new HttpError(401, 'Invalid voice session subject', 'AUTH_REQUIRED');
  }
  if (!['as', 'brx'].includes(claims.language)) throw new HttpError(401, 'Invalid voice session language', 'AUTH_REQUIRED');
  if (typeof claims.threadId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(claims.threadId)) throw new HttpError(401, 'Invalid voice session thread', 'AUTH_REQUIRED');
  if (typeof claims.jti !== 'string' || !claims.jti) throw new HttpError(401, 'Invalid voice session id', 'AUTH_REQUIRED');

  return claims;
}

export function parseIceServers(value) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new HttpError(503, 'Voice RTC ICE configuration is invalid', 'SERVICE_UNAVAILABLE');
  }
  if (!Array.isArray(parsed) || parsed.length > 8) {
    throw new HttpError(503, 'Voice RTC ICE configuration is invalid', 'SERVICE_UNAVAILABLE');
  }
  return parsed.map(server => {
    if (!server || typeof server !== 'object') throw new HttpError(503, 'Voice RTC ICE configuration is invalid', 'SERVICE_UNAVAILABLE');
    const urls = typeof server.urls === 'string'
      ? server.urls
      : Array.isArray(server.urls) && server.urls.length && server.urls.every(url => typeof url === 'string')
        ? server.urls
        : null;
    if (!urls) throw new HttpError(503, 'Voice RTC ICE configuration is invalid', 'SERVICE_UNAVAILABLE');
    return {
      urls,
      ...(typeof server.username === 'string' ? { username: server.username } : {}),
      ...(typeof server.credential === 'string' ? { credential: server.credential } : {})
    };
  });
}

export function bindVoiceSessionRequest(body, claims) {
  const forbidden = ['responseMode', 'language', 'threadId', 'max_tokens', 'temperature', 'system', 'tools'];
  if (forbidden.some(key => body?.[key] !== undefined)) {
    throw new HttpError(400, 'Voice session policy fields are server-owned', 'INVALID_MESSAGE');
  }
  return {
    ...body,
    model: 'miithii',
    stream: false,
    responseMode: 'voice',
    language: claims.language,
    threadId: claims.threadId
  };
}
