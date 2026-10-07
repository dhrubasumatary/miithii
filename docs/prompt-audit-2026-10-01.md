# Prompt audit — 2026-10-01

This record describes source inspection and focused checks for the six prompts in
the now-retired `docs/prompts/` briefs. It is evidence, not a replacement architecture or a native-language review.
Device acceptance and provider deployment are separate from the checks recorded here.

Follow-up on 2026-10-04 found gaps this audit did not catch: Assamese research still required
AI introductions for ordinary name questions; the streaming gate missed colonless mood markers;
and a cancelled mobile start could connect after its delayed token request. Those paths now have
source corrections and focused regressions. Full worker logs also exposed wrong-script repairs
with the configured Flash Lite model; two identity/script samples passed on the documented Flash
route. Worker v38 and the updated phone build are recorded in `current-work.md`. These findings
supersede broad interpretations of this older audit; native review and phone audibility remain open.

## Prompts 01/02 — latency and Assamese speech

Source and installed-SDK inspection found sentence generation and synthesis already overlap;
Bodhan buffers one validated WAV per sentence. Timing callbacks now stop on retired/interrupted
turns, first-sentence timing starts at first token, and close/startup failure/worker cancellation
retire the registry. Six regression tests were added. The runtime agent reported 263 agent tests
and scoped Ruff passing. No deployment or endpointing/provider default change occurred.

Sarvam TTS supports streaming, buffer size, linear16 and prewarm, but hardcodes its sentence
tokenizer without a supported constructor override. Bulbul remains experimental: strict alignment,
interruption, native pronunciation, identical-sentence comparison, and phone playback remain gates.
Bodo remains independent. Background audio uses a separate SDK audio source/track; no thinking
sounds were added. No ten-turn latency comparison, speculative-synthesis benefit, or audible
improvement was measured. Detailed findings are in `services/agent/README.md`.

## Prompt 03 — device bridge lifecycle

Inline callback dependencies could churn RPC registration during renders. Current callbacks and
session facts now live in a ref, with one stable command handler registered per room. Registration
failure is surfaced; duplicate registration does not dispose the surviving handler. Disposed
handlers refuse late work. Focused tests exercise those failures. Invalid language commands
report failure honestly. Pending microphone starts cancel on backgrounding.

## Prompt 04 — named controls and operation bounds

`deriveVoiceUiState` owns primary, language, clear, and microphone interactions. Reconnect resolves
to history-preserving Cancel, clear appears only when available, startup requires user action,
and unknown agent states remain transitional. Real published microphone state determines muted
presence. Operation deadlines release gates; stale completion cannot release a newer operation.
The lifecycle agent reported 15 focused tests passing. A final combined check and physical taps
remain gates; this record does not claim every original assertion was reproduced before editing.

## Prompt 05 — generated arrival and conversation

Current source renders generated text at full presence with a generated label and dotted underline,
without the old per-sentence fade. Spoken/speaking/pending/unspoken retain separate meanings.
The microphone control calls the SDK and reads its published state; muted stops microphone-driven
listening presentation. Help and primary actions follow lifecycle facts. Long exchanges retain
scrollback and jump-to-latest. The subsequent user-requested simplification removes both
visualizers, uses the current lowercase PNG wordmark, and places icon controls in one compact dock.
No native-language pack copy was invented.

Release builds and dated phone checks are recorded in miithii-mobile-ui.md; sensory acceptance
remains open. Modal v33 includes the audited preview update. The brief's strictly serial
pipeline claim was corrected against source: generation and sentence synthesis overlap. No
first-time-user second-by-second phone result or improved audibility is claimed.

## Prompt 06 — mood isolation

The reported Assamese mood displayed in a Bodo session could not be reproduced from the
current source. There is no client mood field or mood rendering path. The server parses the
six Miithii values, strips the `@mood` control envelope, and publishes canonical text.
Provider expression text and a second provider-authored mood vocabulary were not introduced.

Room routing selects the session's policy. The token issuer writes the same canonical language
into the server-generated room route and the signed `miithii.language` participant attribute.
The worker reads the room at dispatch, before the client participant joins; it does not
independently compare the participant attribute. `load_language_packs` caches a dictionary
containing separate policies keyed by language; it does not cache one session's chosen policy
for the whole process. The mobile runtime is keyed by its epoch, so a language change replaces
that runtime. Comments now state the actual boundary: the attribute is available to the client
to inspect, while the worker routes from the server-generated room name.

Two transport weaknesses were confirmed and corrected:

- Preview events previously lacked explicit language and room identity. A first packet could
  establish the correlation guard without those checks. Events now carry both stamps, and the
  client checks them against the selected language and current room before adopting a session.
  `PreviewGuard.lastRefusal` records language, room, or session mismatch.
- An older turn could pass the staleness check while the new turn's preview was still empty.
  The ordering check now rejects older turns regardless of the current text length.

The hook resolves the room name when a message arrives because connecting can precede the
server assigning that name. Existing reader-generation invalidation still prevents a disposed
reader from applying late chunks after a disconnect.

Focused checks: Python `tests/test_preview.py` passed 20 tests; TypeScript
`src/lib/replyPreview.test.ts` passed 18 tests. Fixtures assert refusal of Assamese preview
metadata in a Bodo session, refusal before foreign-session adoption, and rejection of an old
turn while the current preview is empty. Mobile typecheck and Ruff on the changed Python files
also passed at the isolation change checkpoint. Later UI edits need their own final checks.

Deployment consequence: language and room stamps are required. A new client refuses preview
events from an older worker until the matching server is deployed. This has not been represented
as proof of phone speech or a reproduced historical contamination incident.

## Cleanup policy and identified candidates

Keep root and mobile `AGENTS.md`: they contain active language, lifecycle, native-review, and
speech-alignment safeguards and are referenced by the documentation index. Keep language-pack
review files, compiler gates, focused tests, and retained native research. A schema-valid draft
pack is not reviewed production content. Existing historical code and handoff deletions should
remain deleted.

Remove implementation leftovers after active UI edits settle. A read-only TypeScript scan with
`--noUnusedLocals --noUnusedParameters` identified unused imports and parameters in Console,
DotMatrix, LanguageSheet, Logo, Transcript, VoiceShell, theme copy, and ThemeProvider. The same
scan caught an in-progress missing `useContext` import in ThemeProvider. These findings describe
that checkpoint, not the final UI state.

DotMatrix's previous comments about one animated value per dot, a 40 ms timer, diffing per-dot
writes, and a sentence flash no longer match its eight animated volume bands and pulse. Its
unused timer constants and sentence-index plumbing should be removed or implemented, with the
comments following the actual code. Console's unused reset-fill style is a leftover from the
former hold-to-clear control.

Documentation cleanup completed:

- Retired `miithii-experience.md`, which presented removed camera surfaces, hold gestures,
  camera RPCs, and the old matrix timer as current behavior.
- Replaced `miithii-mobile-ui.md` with a concise source/evidence record. Historical phone and
  provider observations are dated; revised-UI phone verification remains pending.
- Retired the six prompt briefs after recording outcomes and remaining gates here. Their stale
  line references and superseded proposals are no longer active instructions.
- Kept native research, review gates, AGENTS safeguards, and frozen device evidence.
- `.tmp` still needs inspection because it mixes working files and current acceptance evidence.

No native-language content or review status was authored or changed in this audit.
