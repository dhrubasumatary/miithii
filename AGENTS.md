# AGENTS.md — Miithii voice app

Last updated: 2026-09-30.

Miithii is a voice companion for Assamese and Bodo speakers. The previous web apps, Android app,
Cloudflare runtime, first Modal runtime, Pipecat transport, WebRTC experiments, deployment files, and
generated native projects are retired. Git history is the recovery mechanism; do not restore old
runtime code into the active tree unless the user explicitly asks for a historical comparison.

## The active tree

- `apps/mobile` — Expo SDK 57 / React Native 0.86.3, official `@livekit/react-native` 3.0.0.
- `services/agent` — LiveKit Agents 1.8.3 on Modal. Sarvam realtime STT, Gemini 2.5 Flash through
  AIMLAPI by default. Standard speech uses Bodhan for Bodo; Assamese can explicitly select
  ElevenLabs v4 through server configuration. Expression controls require separate validation.
- `packages/language-packs` — the source of truth for language data. Packs use canonical ISO 639-3
  ids (`asm`, `brx`), are schema-validated, compile to one hash-verified JSON artifact, and remain
  draft until native review has approved production language content.
- `packages/language-core-ts` — the thin TypeScript reader used by mobile for the language registry
  and shared sentence-boundary data. Python runtime logic lives in `services/agent/miithii_agent` and
  reads the same compiled language-pack artifact.

`docs/README.md` is the only documentation index. Files under `docs/` are research/evidence unless
that index explicitly says otherwise. Historical handoffs and architecture plans were deleted on
purpose; do not search Git history for one and treat it as an implementation brief.

`pnpm run check` runs contract freshness, both typechecks, and every suite. It must exit 0.

## Rules that do not bend

The language id is immutable for one session. It selects the pack, Sarvam realtime locale, prompt,
gate, and TTS voice. Switching Assamese/Bodo ends the current room and starts a fresh session. The
installed LiveKit Sarvam 1.8.3 integration is configured with explicit `as-IN` / `brx-IN`,
`mode="codemix"`, and `stream_type="fast"`; it has no model/keyterms parameter, so do not add dead
configuration pretending those controls exist.

Assamese and Bodo policy must remain isolated. No rule, prompt, voice, limit, blocklist entry,
fallback line, crisis phrase, or exemplar from one language may reach the other. Never add
LLM-written native-language pack content. Native-language production content requires reviewer
metadata and the compiler must continue to fail closed when that approval is missing.

Cancellation, reset, language switch, reconnect, and app backgrounding must never allow stale
speech or stale events to re-enter the current turn. `TurnRegistry` enforces this; wiring it to
real lifecycle events is what makes it mean anything.

## Two invariants worth more than their line count

**Generation is not speech.** Text may be shown only as *generated*; the app marks a sentence
*spoken* only when LiveKit's TTS-aligned transcript says so. Alignment must measure how far the
two agree, never assume the transcript's length is the reply's length. Marking unspoken text as
spoken is the one bug the alignment layer exists to prevent.

On the Bodhan route the two streams are expected to be byte-identical, because the aligned
transcript is the sentence text handed to synthesis rather than text a provider rebuilt from
word timings. The measurement is not therefore optional and the tolerance is not licence: a
divergence means the transcript and the preview came from different text, and the app must
under-claim rather than absorb it. See `docs/miithii-mobile-ui.md` §4 and
`services/agent/tests/test_tts_alignment.py`.

**Interruptions discard audio, by design.** On any interruption LiveKit clears its shared output
buffer. Everything queued but unplayed is dropped, and the transcript is truncated to match. So
false barge-in is expensive and asymmetric: a synthesizer holding one sentence loses a sentence,
one holding a whole reply loses the reply. Every interruption option is set explicitly for this
reason, and buffering less before speech is worth more than tuning anything else.

## Do not re-add

Do not re-add provider-authored delivery text, bracketed performance cues, or provider control
tokens. The only LLM control envelope allowed by the current language contract is the first-line
`@mood: <...>` classification. The gate removes that line before display and TTS; canonical speech
remains plain words. A provider may receive a server-owned style parameter derived from the mood
only when that provider's accepted values have been verified.

Do not restore the retired TypeScript `packages/language-core` or its old voice-contract shape.
Git history is evidence only. The active language contract is the compiled `language-packs`
artifact consumed independently by Python and TypeScript.

Prefer official SDKs and supported integrations over custom media/network code.

## Evidence discipline

A gate is complete only with phone evidence or a focused test, never from a passing suite alone.
Every timed or measured claim names what measured it. Agent-side timings are not phone
audibility. Do not describe anything as fixed until it has been heard.

A language pack is not shippable because its schema validates. Native review, contamination evals,
crisis fixtures, fallback speech, name pronunciation, and real provider/phone tests remain separate
gates. Empty reviewed-content files are preferable to fabricated Assamese or Bodo.

The user has a physical Android phone ready for acceptance testing.
