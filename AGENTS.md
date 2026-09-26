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

`Android -> SmallWebRTC -> Pipecat/Modal -> Bodhan STT -> workers/api -> Bodhan TTS -> Android`

Daily hosted transport is rejected and its client/server branch is removed. Some `@daily-co/*`
packages still exist because the Pipecat React Native SmallWebRTC transport currently uses Daily's
React Native WebRTC/media implementation. Do not reintroduce Daily rooms or `/connect`.

Pipecat owns server-side turn semantics. The RTC bot explicitly uses Silero VAD + Local Smart Turn
V3. The legacy browser Voice 1500 ms silence timer is not the Android architecture.

## Current blocker

Production Android Voice is not end-to-end yet. Direct SmallWebRTC between Android/libwebrtc and
Modal/aiortc has not proven ICE connectivity through Cloudflare Realtime TURN. Keep the existing
TURN/SFU diagnostics until one production transport is proven, then delete the losing experiments.

`workers/api/wrangler.jsonc` still points `VOICE_RTC_START_URL` at the old deployed Modal
`/connect` endpoint. Do not change/deploy it to `/start` until a remote libwebrtc/physical Android
smoke test reaches connected state and the RTVI data channel opens.

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
embed the JavaScript bundle and therefore needs Metro. Non-PR CI also builds and uploads a
SmallWebRTC canary APK from the release variant with the signed-session API URL and explicit Modal
`/start` override embedded. This private-alpha canary is the standalone physical-phone artifact;
it does not use EAS and it does not change the production Worker's legacy `/connect` setting.

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

1. Preserve a checkpoint before structural deletion — done at `ff7814c`.
2. Remove rejected Daily hosted transport — done in the post-checkpoint cleanup.
3. Prove one Android transport end-to-end.
4. Delete the losing TURN/SFU/transport experiments.
5. Pass the physical Android release gate.
6. Remove frozen web product code and simplify `workers/api` to shipped capabilities.

Do not perform broad `git clean`, `git reset --hard`, or other wholesale cleanup. Delete only paths
whose role has been traced and whose recovery point is known.
