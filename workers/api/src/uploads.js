import { HttpError } from './validators.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
export const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const uploadId = url => typeof url === 'string' ? /^\/api\/uploads\/([a-f0-9-]{36})$/.exec(url)?.[1] : undefined;

export async function boundedBytes(request, maximum) {
  if (Number(request.headers.get('content-length')) > maximum) throw new HttpError(413, 'File is too large', 'REQUEST_TOO_LARGE');
  if (!request.body) throw new HttpError(400, 'File is empty', 'INVALID_FILE');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new HttpError(413, 'File is too large', 'REQUEST_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export function matchesImage(bytes, type) {
  const prefix = (...expected) => expected.every((value, index) => bytes[index] === value);
  if (type === 'image/png') return bytes.length >= 24 && prefix(137, 80, 78, 71, 13, 10, 26, 10);
  if (type === 'image/jpeg') return bytes.length >= 4 && prefix(255, 216, 255) && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  if (type === 'image/webp') return bytes.length >= 16 && prefix(82, 73, 70, 70) && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return false;
}

async function objectKey(principal, id) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(principal));
  const owner = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `images/${owner}/${id}`;
}

export async function readImage(env, principal, id) {
  if (!env.UPLOADS) throw new HttpError(503, 'Image uploads are unavailable', 'UPLOADS_UNAVAILABLE');
  const object = await env.UPLOADS.get(await objectKey(principal, id));
  if (!object || Number(object.customMetadata?.expiresAt) <= Date.now() || !Number.isFinite(Number(object.customMetadata?.expiresAt))) {
    throw new HttpError(410, 'Image has expired or is unavailable. Attach it again.', 'IMAGE_UNAVAILABLE');
  }
  if (object.size > MAX_IMAGE_BYTES || !IMAGE_TYPES.has(object.httpMetadata?.contentType)) throw new HttpError(400, 'Invalid stored image', 'INVALID_FILE');
  return object;
}

export async function handleUpload(request, env, principal, id, headers) {
  if (!env.UPLOADS) throw new HttpError(503, 'Image uploads are unavailable', 'UPLOADS_UNAVAILABLE');
  if (request.method === 'POST' && !id) {
    const type = request.headers.get('content-type')?.split(';')[0];
    if (!IMAGE_TYPES.has(type)) throw new HttpError(415, 'Use a PNG, JPEG or WebP image', 'INVALID_FILE');
    const bytes = await boundedBytes(request, MAX_IMAGE_BYTES);
    if (!matchesImage(bytes, type)) throw new HttpError(400, 'File does not match its image type', 'INVALID_FILE');
    const newId = crypto.randomUUID();
    const expiresAt = Date.now() + IMAGE_TTL_MS;
    await env.UPLOADS.put(await objectKey(principal, newId), bytes, { httpMetadata: { contentType: type }, customMetadata: { expiresAt: String(expiresAt) } });
    return Response.json({ id: newId, url: `/api/uploads/${newId}`, mediaType: type, expiresAt }, { status: 201, headers });
  }
  if (id && request.method === 'DELETE') {
    await env.UPLOADS.delete(await objectKey(principal, id));
    return new Response(null, { status: 204, headers });
  }
  if (id && request.method === 'GET') {
    const object = await readImage(env, principal, id);
    headers.set('content-type', object.httpMetadata.contentType);
    headers.set('content-security-policy', "default-src 'none'; sandbox");
    return new Response(object.body, { headers });
  }
  throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
}

// Resolve only owned private objects. No browser-supplied URL is ever fetched.
// Bytes travel directly to the model; there are no public or bearer download URLs.
export async function resolveImages(messages, env, principal) {
  const resolved = [];
  let count = 0;
  for (const message of messages) {
    const parts = [];
    for (const part of message.parts) {
      if (part.type !== 'file') { parts.push(part); continue; }
      if (++count > 4) throw new HttpError(400, 'Use at most four images per conversation request', 'INVALID_FILE');
      const id = uploadId(part.url);
      if (!id) throw new HttpError(400, 'Invalid image reference', 'INVALID_FILE');
      const object = await readImage(env, principal, id);
      if (part.mediaType !== object.httpMetadata.contentType) throw new HttpError(400, 'Image type mismatch', 'INVALID_FILE');
      const bytes = new Uint8Array(await object.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      parts.push({ type: 'file', mediaType: object.httpMetadata.contentType, url: `data:${object.httpMetadata.contentType};base64,${btoa(binary)}` });
    }
    resolved.push({ ...message, parts });
  }
  return resolved;
}
