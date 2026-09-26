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

`Android / future iOS -> Cloudflare Realtime SFU -> Modal/Pipecat -> Smart Turn V3 -> Bodhan STT -> workers/api -> Bodhan TTS -> Modal -> Cloudflare Realtime SFU -> device`

Daily rooms are rejected and the Daily transport branch has been removed. Some `@daily-co/*`
native packages remain because Pipecat's React Native SmallWebRTC transport currently uses Daily's
React Native WebRTC/media implementation. Do not mistake those implementation dependencies for a
product decision to use Daily's hosted transport.

Pipecat server-side turn detection is authoritative. `bot.py` uses Silero VAD with an explicit
Local Smart Turn V3 stop strategy. The old browser Voice app's fixed 1500 ms silence timer is not
the target architecture.

## Transport decision and current gate

Direct SmallWebRTC relay-to-relay through Cloudflare Realtime TURN is no longer the production
direction. A live relay-only libwebrtc test reached relay candidates on both sides but ICE failed:
connectivity requests were sent repeatedly while responses/received requests/received bytes stayed
at zero. A raw cross-network TURN test also proved asymmetric delivery:
`local_to_modal=false`, `modal_to_local=true`. Do not return to open-ended TURN archaeology.

Cloudflare Realtime SFU is the selected transport direction. On 2026-09-27 the current code passed
all three cheap live gates:

1. `smoke_cloudflare_sfu_datachannel.cjs` — both peers connected, both DataChannels open, messages
   delivered in both directions.
2. `smoke_cloudflare_sfu_libwebrtc.cjs` — publisher/receiver connected, remote audio track
   received, inbound audio bytes greater than zero.
3. `smoke_cloudflare_sfu_pipecat_peer.cjs` — browser and Modal connected, browser received bot
   audio, Modal received browser audio frames, the `chat` DataChannel opened, browser ping reached
   Modal, Modal application message reached browser, and the test ended with
   `CLOUDFLARE_SFU_PIPECAT_PEER_OK`.

The latest third-gate run reported browser inbound audio bytes 690, Modal input frames 7 / samples
6720, SCTP `ESTABLISHED`, DTLS connected, one application message in each direction, and the SFU
remote `chat` channel active.

The original Modal -> client DataChannel failure was an aiortc 1.15 interoperability edge:
Cloudflare emitted a duplicate DCEP OPEN for its negotiated reserved `server-events` stream.
Chromium tolerated it, while aiortc asserted because the stream ID was already registered and then
tore down SCTP. `CloudflareSFUConnection.enable_cloudflare_sctp_compat()` now handles only a
matching duplicate OPEN and sends the DCEP ACK. After that, Cloudflare `canReply: true` works
bidirectionally; separate client->server/server->client application channels are not required.

The actual Pipecat application DataChannel contract is preserved: WebRTC/SFU channel name is
`chat`; RTVI application JSON still carries `"label":"rtvi-ai"`.

The old `bea3900` direct-SmallWebRTC canary is now obsolete as a transport-debug artifact. Do not
use it to judge the new SFU route.

`workers/api/wrangler.jsonc` intentionally still points `VOICE_RTC_START_URL` at the currently
deployed legacy Modal `/connect` URL. Do **not** change it yet. The native SFU path is designed to
use an explicit `/sfu/start` override while continuing to obtain the signed capability from
`api.miithii.in/api/voice/session`.

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

Only after this gate passes should the production session routing move to the SFU path and the old
web Voice implementation be deleted.

## CI/CD and device testing

`.github/workflows/ci.yml` validates TypeScript, Expo config, generated Android native config,
language contracts, RTC tests, API tests and an actual Gradle debug APK build. The debug variant is
a native compile/dev-client check and requires Metro because React Native does not embed the JS
bundle in debuggable variants.

The standalone Android Voice canary is manual opt-in only via workflow-dispatch input
`build_canary=true`. Ordinary pushes must not produce it. When the next canary is deliberately
enabled it uses:

- `EXPO_PUBLIC_MIITHII_API_URL=https://api.miithii.in`
- `EXPO_PUBLIC_USE_VOICE_SESSION=true`
- `EXPO_PUBLIC_VOICE_TRANSPORT=cloudflare-sfu`
- `EXPO_PUBLIC_PIPECAT_START_URL=https://dhrubasumatary--miithii-voice-connect-app.modal.run/sfu/start`

Do not run that canary until the production Modal deployment exposes the SFU route without breaking
the Worker's still-live legacy `/connect` path.

`apps/mobile/src/cloudflare-sfu-transport.ts` is the native signalling adapter. It subclasses the
pinned Pipecat RN SmallWebRTC transport instead of creating a new conversation framework, reusing
its DailyMediaManager device lifecycle, microphone/audio-level handling, `chat`/RTVI parser,
message/keepalive semantics, and disconnect behavior. The subclass replaces only signalling/media
negotiation with the Cloudflare SFU sequence. Cloudflare App credentials remain server-side on
Modal; the device sends only its signed Miithii Voice capability to capability-protected `/sfu/*`
proxy routes.

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
3. Completed: prove Cloudflare SFU audio + bidirectional Pipecat application DataChannel on
   libwebrtc <-> Modal/aiortc.
4. Next: deploy the SFU runtime non-breakingly and prove the same path on physical Android.
5. Then delete direct TURN and losing transport experiments completely.
6. Pass the full physical Android end-to-end gate.
7. Delete frozen web Chat/Hub/Subtitles/Voice and their Workers/UI package if they are no longer
   intentionally served. Git history and checkpoint `88bc15a` are the recovery path.
8. Reduce `workers/api` to the capabilities the shipped product still uses; remove old Chat quota,
   upload, memory/UI protocol code only after the web surfaces are retired.

## Near-term product work

- Deploy the already-proven SFU server route without breaking the Worker's legacy `/connect` path.
- Then build exactly one GitHub Actions SFU Android canary and prove it on Wi-Fi, then cellular.
- Benchmark Local Smart Turn V3 on Assamese and Bodo natural pauses; do not assume English results
  transfer perfectly.
- Measure Bodhan STT, brain, and TTS first-audio latency independently.
- Keep language selection as reply-language control; user input speech remains auto-detected.
- Android quality first, then validate the same React Native app on iOS. Build a separate web
  client only after native voice behavior is stable; reuse the same session/API/RTC contracts.
