export function ownsVoiceTurn(
  signal: AbortSignal,
  expectedSession: number,
  currentSession: number,
  expectedTurn: number,
  currentTurn: number
): boolean {
  return !signal.aborted && expectedSession === currentSession && expectedTurn === currentTurn;
}

export function acceptsPushToTalkTarget(tagName: string): boolean {
  return !["BUTTON", "INPUT", "TEXTAREA", "SELECT", "A"].includes(tagName.toUpperCase());
}

export type VoiceHistoryTurn = {
  role: "user" | "assistant";
  text: string;
  language?: string;
};

export function selectVoiceHistory<T extends VoiceHistoryTurn>(turns: T[], language: string): T[] {
  // User speech can be in any language and remains useful context. Assistant
  // replies are examples of output style, so never feed another selected reply
  // language back into the model after a language switch.
  return turns.filter(turn => turn.role === "user" || turn.language === language);
}
