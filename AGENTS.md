# AGENTS.md — Miithii current operating brief

Last updated: 2026-09-27.

Read `docs/CURRENT-VOICE-STATE.md` first. It is the current product/architecture handoff.
Checkpoint `88bc15a` is the rollback point immediately before the transport cleanup on this branch.

## Product direction

- Miithii is Android-first Voice now.
- iOS comes after Android is excellent; keep React Native code portable.
- Web comes after native Voice is stable; do not fork backend/session/turn semantics by platform.
- Ship product behavior before polishing architecture.

## Active code

- `apps/mobile` — Expo/React Native client.
- `services/voice-rtc` — Pipecat realtime runtime on Modal.
- `workers/api` — Miithii brain + signed Voice session endpoint.
- `packages/language-core` — Assamese/Bodo language policy and Voice contracts.

`pnpm-workspace.yaml` intentionally contains only `apps/mobile` and `packages/language-core`.
The API Worker and Python RTC service have their own dependency managers.

## Realtime target

`Android/iOS -> Cloudflare Realtime SFU -> Pipecat/Modal -> Bodhan STT -> workers/api -> Bodhan TTS -> Cloudflare Realtime SFU -> device`

Daily hosted transport is rejected and its client/server branch is removed. Some `@daily-co/*`
packages still exist because the Pipecat React Native SmallWebRTC transport currently uses Daily's
React Native WebRTC/media implementation. Do not reintroduce Daily rooms or `/connect`.

Pipecat owns server-side turn semantics. The RTC bot explicitly uses Silero VAD + Local Smart Turn
V3. The legacy browser Voice 1500 ms silence timer is not the Android architecture.

## Current blocker

Direct relay-to-relay SmallWebRTC through Cloudflare TURN is rejected for production. Live
cross-network tests proved asymmetric TURN delivery and relay-only libwebrtc -> Modal ICE failed
despite both peers gathering relay candidates.

Cloudflare Realtime SFU is now the chosen transport direction. On 2026-09-27 all three live SFU
gates passed against the current code: bidirectional SFU DataChannel, libwebrtc audio forwarding,
and libwebrtc <-> SFU <-> Modal/aiortc with audio plus bidirectional Pipecat application messages.
The third gate ends with `CLOUDFLARE_SFU_PIPECAT_PEER_OK`.

The remaining gate is native integration and physical Android end-to-end behavior. The React Native
SFU transport exists behind explicit `EXPO_PUBLIC_VOICE_TRANSPORT=cloudflare-sfu`, but do not build
another APK until the SFU runtime is deployed non-breakingly and the browser gates remain green.

`workers/api/wrangler.jsonc` still points `VOICE_RTC_START_URL` at the old deployed Modal
`/connect` endpoint. Do not change it yet. Native SFU canaries use an explicit `/sfu/start`
override while still using the legitimate signed Voice capability.

## Frozen fallback

`apps/voice` is still the live web fallback at `voice.miithii.in`; do not delete it until the
physical Android end-to-end gate in `docs/CURRENT-VOICE-STATE.md` passes.

The old Chat/Hub/Subtitles/web Worker/UI code is outside the active workspace. Do not add new work
there. It may be deleted after the native Voice cutover or when explicitly required by the cleanup
plan; Git history/checkpoint `88bc15a` is the recovery path.

## Verification

Run before committing meaningful product/runtime changes:

```powershell
pnpm check
pnpm --dir apps/mobile exec expo-doctor
pnpm --dir apps/mobile prebuild:android --clean
```

CI compiles the Android debug variant to prove the native project builds. That debug APK does not
embed the JavaScript bundle and therefore needs Metro. The standalone Voice canary is now manual
opt-in only through the CI workflow's `build_canary` input; ordinary pushes must not spend a
standalone canary build. The future canary uses the SFU transport and explicit `/sfu/start`.

This Windows machine currently has no local JDK, Android SDK, or `adb` configured.

## Deployment

- `.github/workflows/deploy-production.yml` deploys the Cloudflare brain manually.
- `.github/workflows/deploy-voice-runtime.yml` deploys Modal manually after verification.
- Never deploy production from a local machine.
- Never make the API Worker point to `/start` merely because Modal deployed; transport proof is a
  separate gate.

## Non-negotiable product behavior

- User may speak any supported/input language; STT auto-detects.
- Assamese/Bodo selector controls reply language + TTS voice, not input language.
- Assamese and Bodo have separate language rules; never leak one profile into the other.
- No stale turn may speak after a newer turn/reset/language switch.
- Voice must disconnect cleanly when backgrounded.
- Measure STT, brain, and TTS latency separately.
- Prefer deletion and simple contracts over parallel legacy paths.

## Cleanup order

1. Preserve a checkpoint before structural deletion — done at `88bc15a`.
2. Remove rejected Daily hosted transport — done in the post-checkpoint cleanup.
3. Prove Cloudflare SFU on libwebrtc <-> Modal/aiortc — done.
4. Prove the same SFU route on physical Android.
5. Delete direct TURN/losing transport experiments.
6. Pass the physical Android release gate.
7. Remove frozen web product code and simplify `workers/api` to shipped capabilities.

Do not perform broad `git clean`, `git reset --hard`, or other wholesale cleanup. Delete only paths
whose role has been traced and whose recovery point is known.
