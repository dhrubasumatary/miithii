# Miithii continuation: 2026-10-05

This is the indexed current status, not an architecture authority. Follow root/mobile AGENTS.md,
current source and docs/README.md. Preserve the dirty/staged/untracked tree; no auto-commit,
retired-runtime restoration or additional subagents. Do not repeat paid probes or completed builds.

## Current runtime and build

- User reported GIF freezing in share APK. Recorded phone transition reproduces held pose:
  theme-freeze-before.mp4/grid.png in .tmp/ui-review. Prior end-state screenshots only proved
  cover release, not smooth playback. Original JS source swaps every 40ms stalled playback.
  ThemeTransition now preloads all 31 frames and animates visibility/scale with native driver.
  First build/check passed but phone recording theme-native-after.mp4 showed no silhouette:
  loading inside the hidden mask deadlocked readiness. Do not ship or call that attempt fixed.
  Revised preloading outside mask and kept provider cover mounted across transition handoff.
  Full check passed (`check-theme-preload-2026-10-05.log`); release build succeeded in 1m55s
  (`build-theme-preload-2026-10-05.log`) and installed. Both phone recordings show changing poses
  through the hold and completing reveal: theme-preload-after/reverse.mp4 and grids. Black
  handoff frame removed; brief gray capture flash still visible before playback, so do not
  claim every frame is perfect. Native-driver masked animation is now verified on this phone.
  Latest APK 120182039 bytes, SHA256
  81DC512270F06593593E8B317EBBFC565B2652DA4026C4509927CAFC11CC6CB2.
  Copied to /sdcard/Download/Miithii.apk; phone SHA256 matches. No paid speech probes.
- Reader follow-scrolling and Latest reply honor the live reduced-motion preference.
  Release build `build-reader-motion-2026-10-04.log` succeeded; that APK was superseded before
  installation. Phone scrollback acceptance remains open.
- Oct 5 share polish: geometric language-colored dropdown chevron replaces the font glyph;
  waiting state uses language accent, failures use alarm color. Full check passed: 4 pack,
  90 mobile, 322 agent tests, both typechecks, freshness and Ruff (`check-share-polish-2026-10-05.log`).
  Release build succeeded in 3m36s (`build-share-polish-2026-10-05.log`), 120182095 bytes,
  SHA256 7B4FD25DB83346655C7A733BFC9E5EF16624AD90235EB9F745B734D5E872B75C.
  Installed successfully over tethered Wi-Fi ADB 10.245.238.205:5555 and copied to
  /sdcard/Download/Miithii.apk; phone SHA256 matches. This is the current share APK.
  Opened idle Miithii, checked dark -> light -> dark via current UI-tree bounds. Both completed;
  updated theme button remained reachable. Screenshots/XML: share-ui/light/dark-2026-10-05 in
  .tmp/ui-review. Geometric chevron visible with correct accent. No voice session started.
  Original GIF-derived reveal remains in source; completed-state screenshots prove it released,
  not its frame cadence. Do not send any WhatsApp message.
- v39 deployed at 18:17 IST after the phone's CLIENT_INITIATED disconnect. Accepted-prefix
  replies now carry a shortened flag on END when the gate withholds a bad/incomplete tail or hits
  its budget. Mobile shows a quiet continuation notice after speech; rejected words remain hidden.
  A new-turn DELTA arriving without START replaces the old reply instead of appending to it.
  Focused gate/wire/reader tests pass; full check: 4 pack, 90 mobile, 322 agent tests, freshness,
  both typechecks and Ruff (`check-shortened-2026-10-04.log`). APK build succeeded in 1m55s;
  `build-shortened-2026-10-04.log`, 120181915 bytes, SHA256
  4C2ED2EDD76A0A205D74D1102F77D801FD859BF0262A87736FB5D5287626A154.
  Wi-Fi ADB installation returned Success on 192.168.1.2:5555. App was not launched over WhatsApp.
- Phone foreground was WhatsApp after the completed conversation. Do not launch Miithii or drive
  the microphone over the user's activity. Background APK installation is allowed.
- Latest APK installed after wait/motion fixes: 120181703 bytes; SHA256
  4C5646ABE41BB290019C34D85A2A64DD30E5DCA4CA6027D601132140A8069E21.
  Build succeeded in 2m11s; `build-wait-motion-2026-10-04.log`. Full check remains green:
  4 pack, 89 mobile, 320 agent tests, freshness, both typechecks and Ruff (`check-wait-motion-2026-10-04.log`).
- Connection/end clocks now advance independently instead of staying at 0s. Thinking/synthesis
  still share one continuous reply clock; monotonic timing and phase-tagged state prevent stale
  elapsed values or previous-operation haptics from entering a new wait. Timed phone sampling open.
- Language sheet honors reduced motion and stops its in-flight animation on preference changes.
  Removed obsolete matrix commentary. Phone checked the current build at 200% font scale and
  transition_animation_scale=0: both choices and Cancel remain reachable; sheet and theme controls
  work. Evidence: large-current-sheet.png/XML and reduced-before/after.xml/png in .tmp/ui-review.
  Earlier large-type-sheet capture predates APK installation and is not evidence for the new build.
  Device font_scale and transition_animation_scale restored and verified at original 1.0 values.
- A fresh physical-phone conversation is visible after installation. Three completed replies in
  reduced-after.png show no mood markers, and theme switching preserves LISTENING. Current worker
  logs confirm Flash plus the exact female v4 Turbo voice. Nine agent-speaking transitions measured
  747-3477 ms from committed turns; these exclude STT endpointing and phone audibility. One turn
  withheld an incomplete model tail after an accepted sentence; do not describe the run as flawless.
  Evidence: worker-fresh-phone-v38.log. No additional paid audio probes were run this turn.
  That session subsequently ended with CLIENT_INITIATED disconnect at 18:11 IST.

- Latest deeper audit: full morning worker logs are in
  `.tmp/ui-review/worker-phone-session-morning-2026-10-04.log`, not just the routing/probe excerpts.
  They show repeated STT inactivity timeouts in an old Bodo room while Assamese was active, Assamese wrong-script and generic-AI
  repairs, worker shutdown deadlines, and Flash Lite rather than the documented Flash baseline.
- Concrete persona conflict removed from Assamese language research: ordinary name/who questions
  previously explicitly demanded an AI-companion introduction, after the shared persona rules.
  Shared persona now distinguishes ordinary introductions from direct AI/human questions. Truthful
  disclosure remains required for direct questions. No native language content was fabricated.
- Added an explicit reply-script boundary so Roman grammar references are not output exemplars.
  Two short live text probes still failed on Flash Lite (Roman output); Flash passed both the name
  and direct AI/human questions with native-script output and the canonical gate. Evidence:
  `identity-after-conflict-fix.log`, `identity-after-script-boundary.log`, and
  `identity-flash-comparison.log` in `.tmp/ui-review/`. These are limited samples, not fluency approval.
- Restored local LLM route to google/gemini-2.5-flash. Modal miithii-llm-route secret supplies that
  model after older runtime secrets, without overwriting their credentials. v38 deployed 18:00 IST.
- Installed SDK useSession.start may still room.connect after its token request resolves following
  abort. Added a connection-state guard that disconnects late connections until the pending start
  settles. Two focused tests reproduce token-delay cancellation and successful-start cleanup.
  Server entrypoint finally retires work and explicitly awaits session.aclose with a 10-second bound;
  close/start-failure/cancellation tests assert cleanup. Native no-stale-audio acceptance remains open.
- Modal app: miithii-livekit-agent. Current v39 deployed 2026-10-04 18:17 IST;
  v36 fixed bare moods and v35 introduced the selected voice. Use PYTHONUTF8=1 and
  PYTHONIOENCODING=utf-8 for Windows Modal CLI; otherwise deployment output can fail encoding.
- Assamese Standard: ElevenLabs eleven_v4_turbo, user-selected female voice
  90ipbRoKi4CpHXvKVtl0. Local ignored env and miithii-elevenlabs-assamese Modal secret updated.
  Worker logs confirm the exact ID. Bodo remains language-pack Bodhan, with no ElevenLabs route.
- One new-voice complete-turn probe passed: .tmp/ui-review/probe-asm-female-2026-10-04.log.
  Subscriber first non-silent audio 3268 ms, 11.29 seconds signal, complete generated preview,
  no repair, 100% normalized common-prefix transcript coverage. This excludes phone audibility,
  microphone/STT endpointing and native pronunciation approval. Do not repeat it without cause.
- That probe exposed publication before room.connect. Corrected ordering and continuous zero-PCM
  capture; the old silent track had no frames. This local probe correction needs no paid repeat.
- Phone screenshots/XML: .tmp/ui-review/installed-ui.png, dark-ui.png, language-ui.xml,
  bodo-ui.xml, session-ui.png. Verified centered original wordmark, theme switch, language menu,
  Assamese -> Bodo -> Assamese selection, and entry into LISTENING with real conversation text.
  UIAutomator can fail to reach idle during continuous animation; never reuse an old XML as a
  current dump. Screen captures remain evidence when this happens. No phone audio heard by agent.

## Latest phone-discovered defect

The live phone displayed bare @neutral and @soft in reply text. Existing parsing covered colon
variants only. Updated enforcement to strip supported bare mood prefixes at a whitespace boundary,
reject mood markers inside speech, and discard unsupported standalone control headers. Streaming
regressions include separately chunked markers/newlines. Do not strip a bare marker at chunk end:
its colon might arrive in the next chunk. Current full-check evidence is recorded above.
Fix deployed in v36. Phone return-ui.xml confirms background/return releases the session and
exposes START CONVERSATION. Old malformed replies remain retained history; no new-turn speech
verification of the fix has been heard. Evidence: .tmp/ui-review/check-mood-fix-2026-10-04.log.

## Completed source changes

- Female persona, no volunteered AI introduction; explicit direct identity honesty and crisis safety
  preserved. Removed forced crisis AI disclaimer. Compiled language packs regenerated.
- Assamese Hind Siliguri Regular + OFL; Bodo Annapurna SIL. Rejected Noto Sans Bengali and unused
  Involute removed. No invented native-language content. Native font/pronunciation approval open.
- Clean centered wordmark and permanent icon voice control; retired matrix and decorative field gone.
- Pending/discarded text uses quieter colour instead of paragraph underlines/strike-throughs;
  interruption label distinguishes text never spoken. Generation never advances spoken state.
- One measured preparation timer across thinking -> synthesis; state haptics and long-wait feedback.
  AppState ends the room when inactive/backgrounded; copy tells users to keep the screen open.
- Original GIF-derived theme mask retained; cover readiness race tested and reduced-motion changes
  finish in-flight reveal. Language selector uses shared width; reader generations invalidate stale
  async preview on media/signal reconnect and reattach on Reconnected.
- Confirmed unused copy, fonts, retired language-core, old briefs/handoffs and dormant provider-tag
  machinery removed. Preserve active tests, native-review records, source assets and AGENTS rules.

## Expression contract and remaining gates

An async user choice is pending: keep plain text or explicitly revise the rule for server-owned
Assamese-only tags mapped from existing mood, with no extra LLM and alignment tests before enabling.
Do not treat elapsed time as approval. Current AGENTS.md expressly prohibits bracketed delivery cues/provider tokens. Only @mood metadata
is allowed; it is removed before canonical display/TTS. No provider tags or dynamic style are active.
Official v4 supports inline tags, but these appeared in provider transcripts in earlier experiments.
Do not restore removed tag projection or add another LLM for delivery: it would add latency and
requires a deliberate contract change. The pinned official LiveKit plugin accepts stability for
v4 dialogue and invalidates its connection on update_options. Stability is not a named mood enum;
any fixed value needs voice-specific listening evidence, and dynamic changes need latency design.
References: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 and
https://github.com/livekit/agents/blob/7d3a90714fe6b4d7310413def76a23d8e53e2bff/livekit-plugins/livekit-plugins-elevenlabs/livekit/plugins/elevenlabs/tts.py.

1. Bare-mood fix check and v36 deployment are complete. Do not repeat them without a new change.
   Confirm a new phone turn has no markers; actual phone audibility remains human evidence.
2. Phone acceptance remaining: start/cancel, mute/reset, language switch while live, long text/history,
   timed preparation, background/reconnect and audible interruption. Large-font sheet and reduced-motion
   controls have phone evidence above; conversation scaling and sensory motion still need review. Haptic feel remains
   human evidence. Use UI-tree coordinates, preserve user activity and avoid unnecessary paid turns.
3. Follow up phone persona behavior with the v38 prompt/model changes. The focused Flash name/
   direct-AI text probes pass; preserve direct-identity honesty and do not fabricate native exemplars.
4. Language packs remain draft. Native review, contamination/crisis/fallback tests and provider/phone
   pronunciation remain separate gates. Schema validation is not production approval.
5. Public /token has routing restrictions but no identity authentication. A real identity design
   remains required before public production; do not embed a shared secret in the APK.
6. Haptics helper catches synchronous throws but does not consume rejected async promises.
   Follow up with explicit promise rejection handling; avoid rebuilding this share APK for
   unrelated work. No haptic failure was observed on the phone.

Never put API keys in this note, code, logs or Git. The user plans key rotation; do not repeat it.
