/**
 * Correlate LiveKit's per-segment agent transcripts with Miithii's current preview turn.
 *
 * LiveKit 1.8.3 flushes its transcription output once per speech segment. The React hook keeps
 * every resulting stream in `useSessionMessages`, so the last `agentTranscript` is only the last
 * sentence/segment and old turns remain in the same array. Treating that one message as the whole
 * spoken reply can rewind highlighting or make a repeated prefix from a previous turn look spoken.
 *
 * Miithii's preview START and LiveKit's transcription streams are both text streams opened by the
 * same agent process. Their stream timestamps therefore give us a narrow, provider-independent
 * turn boundary: only agent transcript streams opened at or after the current preview START belong
 * to this turn, and all of those segments are concatenated in arrival order.
 */

export type TranscriptMessage = {
  type?: string;
  message?: string;
  id?: string;
  timestamp?: number;
};

export function spokenTranscriptForTurn(
  messages: readonly TranscriptMessage[],
  previewStartedAt: number,
): string {
  const agent = messages.filter(
    (message) =>
      message.type === 'agentTranscript' &&
      typeof message.message === 'string' &&
      message.message.length > 0,
  );

  // If the preview stream itself was dropped, there is no trustworthy turn boundary. Preserve
  // the old degraded behaviour rather than concatenating every historical transcript in the room.
  if (previewStartedAt <= 0) {
    return agent.length > 0 ? agent[agent.length - 1]?.message?.trim() ?? '' : '';
  }

  return agent
    .filter(
      (message) =>
        typeof message.timestamp === 'number' && message.timestamp >= previewStartedAt,
    )
    .map((message) => message.message?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}
