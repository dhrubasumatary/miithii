# Miithii mobile implementation and evidence

Updated 2026-10-04. Phone screenshots, SDK transcript evidence, subscriber audio measurements,
and human listening are separate evidence. None substitutes for native language review.

## Current surface

The Expo Android client uses the lowercase miithii PNG wordmark from its current app-icon asset,
centered on standby and compact above the conversation once turns arrive. There is no matrix,
waveform, visualizer selector, repeated idle instruction, or disconnected microphone button.
The header offers the pack's native language name and a compact appearance icon. The dock has
a primary Start/End control, a real SDK microphone toggle while connected, and confirmed Clear
when there is history. Icon controls retain accessibility labels and actionable disabled states.

Assamese uses saffron; Bodo uses teal. Content uses bundled Hind Siliguri and Annapurna SIL;
chrome uses Space Mono. Conversation rows retain readable paragraphs and distinct speaker labels.
Generated text is labelled not yet spoken; only aligned transcripts advance spoken state.
The virtualized transcript follows new content while the reader is at the bottom and offers
jump-to-latest after they scroll away. End retains history; language changes clear it.

Starting, generation, synthesis, and ending show a changing elapsed state, activity indicator,
and subtle wordmark breathing. Listening/speaking movement uses the official LiveKit native
volume hook. Reduced motion suppresses logo and language-sheet animation. Preparation, extended wait, interruption,
and failure have distinct Android haptic cues; a long wait changes its explanation at 12 seconds.
No estimate or progress percentage claims audio is ready. Routine explanatory paragraphs are absent.
Connection and ending have independent elapsed clocks; thinking and synthesis share one reply clock.
Clocks use monotonic time and never carry a previous phase's seconds into a new wait.

The original web GIF supplies the theme mask. Android mask views hide their drawable between
draws, so its lossless PNG frames are used explicitly for the short reveal rather than depending
on an invisible animated drawable. Capture/paint ordering, load bounds, and reduced motion are
handled without remounting the voice runtime. Sensory acceptance of the final reveal remains separate.

## Lifecycle and speech contract

deriveVoiceUiState owns all control actions. Cancel keeps history. Backgrounding cancels pending
starts. Operation bounds release stuck UI gates. Shared native audio is leased to the room that
started it, so cleanup from a retired room cannot stop a new room's audio. Focused tests cover late
cleanup, cancellation during startup, and recovery after native start failure.
An aborted start also guards against a late SDK connection after token fetching; focused tests
reproduce that race. Device cancellation acceptance remains separate from those tests.

miithii.reply is stamped with language, room, session, epoch, and turn. Foreign and retired events
are refused before adoption. SDK-aligned transcripts establish what was played. Bodhan alignment
measures agreement and under-claims divergence. Interruptions discard unplayed buffered audio.
Device RPC registers once per room with current callbacks and observable registration failure.

## Evidence: 2026-10-01

Local arm64 release builds installed on USB phone R9ZY30DVSJN. ADB UI trees and screenshots
observed cold launch, language sheet/pick, appearance switching, connected LISTENING, and actual
mute/Unmute state. A real phone turn showed 'Can you hear me?' and an aligned Assamese reply.
The simplified PNG logo and compact live dock were visible. This is transcript evidence, not
a claim that the reviewer heard the Android speaker or felt the haptics.

Modal worker v33 deployed with the audited preview/lifecycle update; rollback reference v32.
Deployed probe_turn measured first non-silent subscriber audio at 7140ms for Assamese and 2829ms
for Bodo. Both completed with 100% canonical-text/aligned-transcript coverage. These text-input
probes exclude live STT endpointing and Android audibility, and do not approve native content.
One real phone session's server TurnTimings measured commitment-to-agent-speaking at 1743ms;
this is an agent measurement, not a phone stopwatch.

Full checks passed 84 mobile tests and 263 Python tests, contract freshness, typechecks, and Ruff.
The final presentation changes also require successful release compilation and phone checking.

## Remaining acceptance

Hear the final phone build in both languages, including interruptions and long replies. Feel the
wait/failure haptics; inspect the GIF reveal, long scrollback, large fonts, reduced motion,
background/reconnect and rapid language/start cancellation. Ten spoken turns per language remain
needed for comparable latency evidence. Draft language packs still need native review, contamination
evals, crisis/fallback fixtures, name pronunciation, and real provider/phone acceptance.

Frozen audit-2026-09-29 evidence and provider research remain dated historical observations.
See the six-prompt audit for its original findings and limits.

