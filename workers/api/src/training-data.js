const encoder = new TextEncoder();
const MAX_TRAINING_TEXT = 16_000;

const CREDENTIAL_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
  /\bsk[-_][A-Za-z0-9_-]{16,}/i,
  /\bpk_(?:live|test)_[A-Za-z0-9_-]{16,}/i,
  /\bGOCSPX-[A-Za-z0-9_-]{16,}/,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
];

const cleanText = value => typeof value === 'string' ? value.trim() : '';

export function redactCommonIdentifiers(value) {
  return cleanText(value)
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[phone]');
}

export function containsCredentialLikeText(value) {
  const text = cleanText(value);
  return Boolean(text && CREDENTIAL_PATTERNS.some(pattern => pattern.test(text)));
}

export function detectDominantScript(value) {
  const text = cleanText(value);
  let latin = 0;
  let assameseBengali = 0;
  let devanagari = 0;
  let otherLetters = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code >= 0x0980 && code <= 0x09ff) assameseBengali += 1;
    else if (code >= 0x0900 && code <= 0x097f) devanagari += 1;
    else if (/\p{Script=Latin}/u.test(char)) latin += 1;
    else if (/\p{Letter}/u.test(char)) otherLetters += 1;
  }
  const counts = [
    ['latin', latin],
    ['assamese-bengali', assameseBengali],
    ['devanagari', devanagari],
    ['other', otherLetters],
  ].filter(([, count]) => count > 0);
  if (!counts.length) return 'unknown';
  counts.sort((left, right) => right[1] - left[1]);
  const total = counts.reduce((sum, [, count]) => sum + count, 0);
  if (counts.length > 1 && counts[0][1] / total < 0.7) return 'mixed';
  return counts[0][0];
}

export async function stableHash(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value ?? '')));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildTrainingExample({
  principal,
  threadId,
  turnId,
  surface,
  targetLanguage,
  userText,
  assistantText,
  model,
  policyVersion,
  createdAt = Date.now(),
}) {
  const rawUser = cleanText(userText);
  const rawAssistant = cleanText(assistantText);
  if (!principal || !threadId || !turnId || !rawUser || !rawAssistant) return null;
  if (rawUser.length > MAX_TRAINING_TEXT || rawAssistant.length > MAX_TRAINING_TEXT) return null;
  if (!['chat', 'voice'].includes(surface)) return null;
  if (!['as', 'brx'].includes(targetLanguage)) return null;
  if (containsCredentialLikeText(rawUser) || containsCredentialLikeText(rawAssistant)) return null;
  const user = redactCommonIdentifiers(rawUser);
  const assistant = redactCommonIdentifiers(rawAssistant);
  const normalizedTurnId = String(turnId).slice(0, 128);
  return {
    id: await stableHash(`${principal}\0${surface}\0${threadId}\0${normalizedTurnId}`),
    contributorHash: await stableHash(principal),
    threadHash: await stableHash(`${principal}:${threadId}`),
    turnId: normalizedTurnId,
    surface,
    targetLanguage,
    userText: user,
    assistantText: assistant,
    userScript: detectDominantScript(user),
    assistantScript: detectDominantScript(assistant),
    model: String(model || 'unknown').slice(0, 200),
    policyVersion: String(policyVersion || 'unknown').slice(0, 200),
    createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
  };
}

export function rowToTrainingRecord(row) {
  return {
    id: row.id,
    messages: [
      { role: 'user', content: row.user_text },
      { role: 'assistant', content: row.assistant_text },
    ],
    metadata: {
      record_version: 1,
      source: 'miithii_opt_in',
      surface: row.surface,
      target_language: row.target_language,
      user_script: row.user_script,
      assistant_script: row.assistant_script,
      model: row.model,
      policy_version: row.policy_version,
      contributor_id: row.contributor_hash,
      conversation_id: row.thread_hash,
      turn_id: row.turn_id,
      created_at: new Date(Number(row.created_at)).toISOString(),
    },
  };
}
