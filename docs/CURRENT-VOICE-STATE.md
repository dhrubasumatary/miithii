# Miithii Voice — current execution state

Last updated: 2026-09-27. Recovery checkpoint before cleanup on this branch: `88bc15a`.

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

On 2026-09-27 the safe canary signalling path was re-verified against the deployed services:
`api.miithii.in/api/voice/session` minted a signed capability, the same capability was accepted by
the deployed Modal `/start` endpoint derived from the legacy `/connect` host, and `/start`
returned a session ID plus two ICE servers. This proves admission/signalling setup only; it does not
prove Android ICE, the RTVI data channel, RTP, or end-to-end audio.

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
language contracts, RTC tests, API tests and an actual Gradle debug APK build. The debug variant is
a native compile/dev-client check and requires Metro because React Native does not embed the JS
bundle in debuggable variants.

For non-PR runs CI additionally builds `assembleRelease` as a private-alpha SmallWebRTC canary.
That variant embeds the JavaScript and these explicit canary settings:

- `EXPO_PUBLIC_MIITHII_API_URL=https://api.miithii.in`
- `EXPO_PUBLIC_USE_VOICE_SESSION=true`
- `EXPO_PUBLIC_PIPECAT_START_URL=https://dhrubasumatary--miithii-voice-connect-app.modal.run/start`

The app endpoint precedence is: explicit `EXPO_PUBLIC_PIPECAT_START_URL` override, then the signed
session's `startUrl`, then the normal local `/start` default. The signed session bearer token is
still sent when the explicit override wins. The production Worker remains on legacy `/connect`
until physical Android proves ICE + data channel.

This Windows workstation currently has no JDK, Android SDK or `adb`; CI APK artifacts are therefore
the reproducible device-testing path until a local Android toolchain is installed.

`.github/workflows/deploy-voice-runtime.yml` is deliberately manual. It requires GitHub secrets
`MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` and repository/environment variable `VOICE_RTC_HEALTH_URL`.
Deploying Modal must not automatically switch the API Worker to `/start`; transport proof comes
first.

As verified on 2026-09-27, that deploy workflow is not armed yet: the repository has no
`voice-production` environment, the required Modal token secrets are not present in the repo-level
Actions secret names, and `VOICE_RTC_HEALTH_URL` is not present in the repo-level variable names.
This does not block the current Android canary because the already-deployed Modal revision exposes
both legacy `/connect` and SmallWebRTC `/start`.

The Modal runtime deliberately uses `min_containers=0`, `max_containers=1` and a 300-second
scaledown window during private alpha. This protects the budget while keeping repeated device tests
warm for a short period. Do not enable a 24/7 warm replica until measured cold-start latency and
real usage justify the idle cost.

## Cleanup order

1. Completed: checkpoint current product state and remove generated local clutter.
2. Completed: remove the rejected Daily hosted-transport branch.
3. Keep while debugging: direct SmallWebRTC/TURN and Cloudflare SFU diagnostic code.
4. Choose one working production transport; delete the losing transport experiments completely.
5. Pass the physical Android end-to-end gate.
6. Delete frozen web Chat/Hub/Subtitles/Voice and their Workers/UI package if they are no longer
   intentionally served. Git history and checkpoint `88bc15a` are the recovery path.
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
