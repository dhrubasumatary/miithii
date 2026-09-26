import { NEUTRAL_COMPANION_POLICY } from './base-policy.ts';
import { ASSAMESE_PROFILE } from './profiles/assamese.ts';
import { BODO_PROFILE } from './profiles/bodo.ts';
import type { LanguageId, LanguageProfile, ProductSurface, ReplyContract } from './types.ts';

export * from './types.ts';
export * from './script.ts';
export * from './evidence.ts';
export * from './meaning-controller.ts';
export { NEUTRAL_COMPANION_POLICY, ASSAMESE_PROFILE, BODO_PROFILE };

export const LANGUAGE_POLICY_VERSION = '2026-09-15-v4';
export const CHAT_DEFAULT_LANGUAGE: LanguageId = 'as';
export const VOICE_DEFAULT_LANGUAGE: LanguageId = 'as';

export const LANGUAGE_PROFILES: Readonly<Record<LanguageId, LanguageProfile>> = Object.freeze({
  as: ASSAMESE_PROFILE,
  brx: BODO_PROFILE
});

export function getLanguageProfile(language: LanguageId): LanguageProfile {
  return LANGUAGE_PROFILES[language];
}

export function isLanguageId(value: string): value is LanguageId {
  return Object.hasOwn(LANGUAGE_PROFILES, value);
}

export function getReplyContract(surface: ProductSurface, language: LanguageId = surface === 'chat' ? CHAT_DEFAULT_LANGUAGE : VOICE_DEFAULT_LANGUAGE): ReplyContract {
  const profile = getLanguageProfile(language);
  return {
    language: profile.id,
    locale: profile.locale,
    languageName: profile.name,
    nativeName: profile.nativeName,
    script: profile.replyScript[surface],
    displayScript: profile.displayScript[surface],
    tts: profile.tts
  };
}

export function buildLanguageSystemPrompt(options: { surface: ProductSurface; language?: LanguageId }): string {
  const language = options.language ?? (options.surface === 'chat' ? CHAT_DEFAULT_LANGUAGE : VOICE_DEFAULT_LANGUAGE);
  const profile = getLanguageProfile(language);
  const contract = getReplyContract(options.surface, language);
  return `${NEUTRAL_COMPANION_POLICY}\n\nREPLY CONTRACT\nLanguage: ${profile.name} (${profile.id}; ${profile.locale})\nScript: ${contract.script}\n\nLANGUAGE PROFILE\n${profile.policy.common}\n\nSURFACE PROFILE\n${profile.policy[options.surface]}\n\nPERSONALITY REALIZATION\n${profile.policy.personality}`;
}
