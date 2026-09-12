const MAX_BYTES = 128 * 1024;

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function readJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json', 'INVALID_JSON');
  }
  if (Number(request.headers.get('content-length')) > MAX_BYTES) {
    throw new HttpError(413, 'Request too large', 'REQUEST_TOO_LARGE');
  }
  if (!request.body) throw new HttpError(400, 'JSON body required', 'INVALID_JSON');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new HttpError(413, 'Request too large', 'REQUEST_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
  } catch {
    throw new HttpError(400, 'Invalid JSON', 'INVALID_JSON');
  }
}

export function validateBody(body, model) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'JSON object required', 'INVALID_MESSAGE');
  }
  // assistant-ui data-stream requests include runtime metadata alongside the
  // message history. These fields are accepted for protocol compatibility but
  // are intentionally ignored by the model adapter below.
  const allowed = new Set([
    'messages',
    'message',
    'model',
    'stream',
    'max_tokens',
    'temperature',
    'threadId',
    'turnId',
    'responseMode',
    'language',
    'system',
    'tools',
    'runConfig',
    'state',
    'parentId',
    'unstable_assistantMessageId'
  ]);
  if (Object.keys(body).some(key => !allowed.has(key))) {
    throw new HttpError(400, 'Unsupported request field', 'INVALID_MESSAGE');
  }
  if (body.system || (body.tools && Object.keys(body.tools).length)) {
    throw new HttpError(400, 'Client system prompts and tools are not supported', 'INVALID_MESSAGE');
  }
  if (body.threadId !== undefined && (typeof body.threadId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.threadId))) {
    throw new HttpError(400, 'Invalid threadId', 'INVALID_MESSAGE');
  }
  if (body.turnId !== undefined && (typeof body.turnId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.turnId))) {
    throw new HttpError(400, 'Invalid turnId', 'INVALID_MESSAGE');
  }
  if (body.responseMode !== undefined && body.responseMode !== 'voice') {
    throw new HttpError(400, 'Unsupported response mode', 'INVALID_MESSAGE');
  }
  if (body.language !== undefined && (body.responseMode !== 'voice' || !['as', 'brx'].includes(body.language))) {
    throw new HttpError(400, 'Unsupported voice language', 'INVALID_MESSAGE');
  }
  if (body.message !== undefined) {
    if (body.messages !== undefined) throw new HttpError(400, 'Use message or messages, not both', 'INVALID_MESSAGE');
    body.messages = [{ role: 'user', content: body.message }];
  }
  if (body.model !== undefined && body.model !== 'miithii' && body.model !== model) {
    throw new HttpError(400, 'Unsupported model', 'INVALID_MESSAGE');
  }
  if (body.stream !== undefined && typeof body.stream !== 'boolean') {
    throw new HttpError(400, 'stream must be boolean', 'INVALID_MESSAGE');
  }
  if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 8192)) {
    throw new HttpError(400, 'max_tokens must be between 1 and 8192', 'INVALID_MESSAGE');
  }
  if (body.temperature !== undefined && (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) {
    throw new HttpError(400, 'temperature must be between 0 and 2', 'INVALID_MESSAGE');
  }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 100) {
    throw new HttpError(400, 'Provide 1 to 100 messages', 'INVALID_MESSAGE');
  }
  const messages = body.messages.map(message => {
    let content = message?.content;
    if (Array.isArray(content) && content.every(part => part?.type === 'text' && typeof part.text === 'string')) {
      content = content.map(part => part.text).join('\n');
    }
    // AI SDK UIMessage uses `parts`, while OpenAI-compatible clients use
    // `content`. Permit only text parts so this public endpoint never accepts
    // client-side tools, files, reasoning, or arbitrary structured payloads.
    if (content === undefined && Array.isArray(message?.parts) && message.parts.every(part => part?.type === 'text' && typeof part.text === 'string')) {
      content = message.parts.map(part => part.text).join('\n');
    }
    if (!message || !['user', 'assistant'].includes(message.role) || typeof content !== 'string' || !content.trim() || content.length > 16000) {
      throw new HttpError(400, 'Messages require a user/assistant role and 1 to 16000 characters of text', 'INVALID_MESSAGE');
    }
    return { role: message.role, content };
  });
  if (messages.at(-1).role !== 'user') throw new HttpError(400, 'Last message must be from the user', 'INVALID_MESSAGE');
  return {
    model,
    messages,
    stream: body.stream ?? false,
    max_tokens: body.max_tokens ?? 8192,
    responseMode: body.responseMode,
    language: body.language,
    ...(body.temperature === undefined ? {} : { temperature: body.temperature })
  };
}

// /api/chat/v2 speaks the AI SDK UI-message protocol (assistant-ui Cloud
// runtime). Text-only for now; attachments and tools widen this deliberately.
export const SERVER_TOOL_NAMES = new Set(['memory_search']);
export const UI_STRUCTURED_PARTS = new Set(['step-start', 'step-finish', 'reasoning', 'source-url', 'source-document']);
export const isServerToolPart = part => typeof part?.type === 'string' && (
  SERVER_TOOL_NAMES.has(part.type.replace(/^tool-/, '')) ||
  (['tool-call', 'tool-result', 'tool-error'].includes(part.type) && SERVER_TOOL_NAMES.has(part.toolName))
);

export function validateUIMessages(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 100) {
    throw new HttpError(400, 'Provide 1 to 100 messages', 'INVALID_MESSAGE');
  }
  if (messages.at(-1)?.role !== 'user') {
    throw new HttpError(400, 'Last message must be from the user', 'INVALID_MESSAGE');
  }
  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role)) {
      throw new HttpError(400, 'Messages require a user or assistant role', 'INVALID_MESSAGE');
    }
    if (typeof message.id !== 'string' || !message.id || message.id.length > 128) {
      throw new HttpError(400, 'Messages require an id', 'INVALID_MESSAGE');
    }
    if (!Array.isArray(message.parts) || message.parts.length < 1) {
      throw new HttpError(400, 'Message parts required', 'INVALID_MESSAGE');
    }
    let textLength = 0;
    let imageCount = 0;
    for (const part of message.parts) {
      if (part?.type === 'text' && typeof part.text === 'string') {
        textLength += part.text.length;
        continue;
      }
      if (message.role === 'user' && part?.type === 'file' && ['image/png', 'image/jpeg', 'image/webp'].includes(part.mediaType) && typeof part.url === 'string' && /^\/api\/uploads\/[a-f0-9-]{36}$/.test(part.url) && ++imageCount <= 4) continue;
      if (message.role === 'assistant' && (UI_STRUCTURED_PARTS.has(part?.type) || isServerToolPart(part))) {
        continue;
      }
      throw new HttpError(400, 'Only text messages and server memory tool records are supported right now', 'INVALID_MESSAGE');
    }
    if (message.role === 'user' && ((textLength < 1 && imageCount === 0) || textLength > 16000)) {
      throw new HttpError(400, 'User messages require 1 to 16000 characters of text', 'INVALID_MESSAGE');
    }
    if (message.role === 'assistant' && textLength > 16000) {
      throw new HttpError(400, 'Messages exceed character limit', 'INVALID_MESSAGE');
    }
  }
  return messages;
}
