# Miithii mobile — agent notes

This file scopes the repository-wide `AGENTS.md` rules to Android/UI work. The current mobile app is
an Expo SDK 57 / React Native 0.86.3 LiveKit client; it does not own language policy.

## Language identity

- Miithii's canonical language ids are **`asm`** (Assamese) and **`brx`** (Bodo).
- Never introduce `as` as an app/UI language id. `as` is a provider/compatibility code resolved by
  the language pack at the server boundary.
- Import `LanguageId`, `DEFAULT_LANGUAGE_ID`, `LANGUAGE_OPTIONS`, `languageOption`, and
  `normalizeLanguageId` from `@miithii/language-core-ts` instead of creating a second registry.
- Language names shown in selectors/header chrome come from `LANGUAGE_OPTIONS`/`languageOption`.
  Do not hard-code a second Assamese/Bodo option table in a component.
- The selected reply language is sent only as the `miithii.language` participant attribute. A
  language switch ends the current room and creates a fresh session.

`packages/language-core-ts` is intentionally thin. It reads the compiled artifact produced from
`packages/language-packs`; it is **not** the retired `packages/language-core` system. Do not restore
that deleted package or copy historical language rules into the UI.

## Generated text is not spoken text

`miithii.reply` carries canonical generated text that has passed the server gate. LiveKit's
TTS-aligned agent transcript is the evidence for what was actually played. The UI may show generated
text as pending, but it must never label it spoken merely because generation completed.

Interruption, reset, backgrounding, language switch, and reconnect must not let stale text/audio from
the previous turn/session advance the current UI.

## Editing boundary

UI work should stay in `apps/mobile` unless a product contract genuinely requires a cross-layer
change. Do not edit `packages/language-packs` to make a component easier to implement, and do not
encode provider names, model names, voices, provider language codes, or linguistic rules in mobile.

Historical files under `docs/` are research/evidence only; `docs/README.md` explains their status.
Git history is not a current implementation brief.
