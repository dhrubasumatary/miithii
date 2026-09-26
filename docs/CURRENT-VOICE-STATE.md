# Miithii Voice — current execution state

Last updated: 2026-09-27. Recovery checkpoint before cleanup: `ff7814c`.

This file is the first operational document a future coding agent should read.
Older architecture/recovery plans are historical and must not override this file or the code.

## Product direction

Miithii is Android-first now. The product under active development is the Expo/React Native Voice
app in `apps/mobile`. Android is the first quality bar because it is the device we can test first.
The app must remain portable to iOS; web comes after the native product is proven. Do not fork the
conversation logic by platform. Keep platform-specific code at the media/device boundary only.

The active product core is:

- `apps/mobile` — thin React Native client: UI, microphone/speaker, lifecycle, connection state.
- `services/voice-rtc` — Pipecat realtime runtime on Modal: transport, VAD/turn lifecycle, STT/TTS.
- `workers/api` — Miithii brain and signed `/api/voice/session` capabilities.
- `packages/language-core` — Assamese/Bodo policy and exported Voice contracts.

## Current realtime path

Target path:

`Android -> SmallWebRTC -> Pipecat/Modal -> Bodhan STT -> workers/api -> Bodhan TTS -> Android`

Daily rooms are rejected and the Daily transport branch has been removed. Some `@daily-co/*`
native packages remain because Pipecat's React Native SmallWebRTC transport currently uses Daily's
React Native WebRTC/media implementation. Do not mistake those implementation dependencies for a
product decision to use Daily's hosted transport.

Pipecat server-side turn detection is authoritative. `bot.py` uses Silero VAD with an explicit
Local Smart Turn V3 stop strategy. The old browser Voice app's fixed 1500 ms silence timer is not
the target architecture.

## Blocking issue before end-to-end Android production testing

Direct SmallWebRTC between Android/libwebrtc and Modal/aiortc has not yet proven ICE connectivity
through Cloudflare Realtime TURN. Previous relay-only tests gathered relay candidates and sent ICE
requests but received no peer responses. TURN/SFU smoke scripts and the temporary aioice
compatibility patch are retained because they are evidence for this unresolved blocker.

`workers/api/wrangler.jsonc` intentionally still points `VOICE_RTC_START_URL` at the currently
deployed legacy Modal `/connect` URL. Do **not** change/deploy it to `/start` until the deployed
Modal `/start` path passes a remote libwebrtc/Android smoke test and opens the RTVI data channel.

The old `apps/voice` web product remains a live fallback at `voice.miithii.in`. Do not delete it
until Android Voice passes the end-to-end release gate below.

## End-to-end release gate

Android Voice is considered real only when a physical Android phone can repeatedly:

1. obtain a signed Voice session from `api.miithii.in`;
2. connect to the deployed Modal runtime on Wi-Fi and cellular;
3. stream microphone audio without stuck ICE/data-channel state;
4. detect a natural end of turn without the browser 1500 ms timer;
5. transcribe Assamese/Bodo/English input through Bodhan;
6. receive the correct selected Assamese or Bodo reply from the Miithii brain;
7. hear the full Bodhan TTS response without truncation;
8. interrupt/reset cleanly with no stale audio or stale callbacks;
9. expose useful stage latency so the slow component is measurable.

Only after this gate passes should `VOICE_RTC_START_URL` move to `/start` in production and the old
web Voice implementation be deleted.

## CI/CD and device testing

`.github/workflows/ci.yml` validates TypeScript, Expo config, generated Android native config,
language contracts, RTC tests, API tests and an actual Gradle debug APK build. Non-PR runs upload
the APK as a GitHub Actions artifact for installation on a physical Android phone.

This Windows workstation currently has no JDK, Android SDK or `adb`; CI APK artifacts are therefore
the reproducible device-testing path until a local Android toolchain is installed.

`.github/workflows/deploy-voice-runtime.yml` is deliberately manual. It requires GitHub secrets
`MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` and repository/environment variable `VOICE_RTC_HEALTH_URL`.
Deploying Modal must not automatically switch the API Worker to `/start`; transport proof comes
first.

## Cleanup order

1. Completed: checkpoint current product state and remove generated local clutter.
2. Completed: remove the rejected Daily hosted-transport branch.
3. Keep while debugging: direct SmallWebRTC/TURN and Cloudflare SFU diagnostic code.
4. Choose one working production transport; delete the losing transport experiments completely.
5. Pass the physical Android end-to-end gate.
6. Delete frozen web Chat/Hub/Subtitles/Voice and their Workers/UI package if they are no longer
   intentionally served. Git history and checkpoint `ff7814c` are the recovery path.
7. Reduce `workers/api` to the capabilities the shipped product still uses; remove old Chat quota,
   upload, memory/UI protocol code only after the web surfaces are retired.

## Near-term product work

- Prove transport on a physical Android phone before polishing infrastructure further.
- Benchmark Local Smart Turn V3 on Assamese and Bodo natural pauses; do not assume English results
  transfer perfectly.
- Measure Bodhan STT, brain, and TTS first-audio latency independently.
- Keep language selection as reply-language control; user input speech remains auto-detected.
- Android quality first, then validate the same React Native app on iOS. Build a separate web
  client only after native voice behavior is stable; reuse the same session/API/RTC contracts.
