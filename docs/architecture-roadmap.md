# Miithii architecture roadmap — the three-runtime build-up

Written 2026-09-15. Extends `AGENTS.md` (ground truth) and `docs/launch-plan.md` (product path).
This file is the architecture for everything from here on, including the Expo mobile app and the
Pipecat realtime voice service. Read `AGENTS.md` first.

Context that constrains every decision below: this is a **solo-maintainer product** with two real
surfaces already in production on Cloudflare Workers, a Bodhan provider whose TTS allows
**~4 requests/minute and ~30 seconds per request**, and a hard requirement to reach **iOS and
Android via Expo** using **Pipecat** for realtime voice. Every choice below is filtered through:
would a solo maintainer regret operating this at 2 a.m.?

---

## 1. Invariants (these outrank every phase)

1. **One brain.** `workers/api` is the only owner of identity, quota, threads, memory, training,
   uploads, and policy. Every other runtime is a *peripheral*: it may transform media or relay, it
   must never hold long-lived vendor credentials or make product-policy decisions.
2. **The contract is the product.** `packages/language-core` owns language, script, voice, budgets,
   and persona. Every surface — web, edge worker, Python service, mobile app — consumes the same
   contract. A language that exists in one surface does not exist.
3. **Adapt, don't build.** Pipecat, Expo, Clerk, Cloudflare, and Pipecat's client SDKs already
   solve transport, turn detection, auth, and NAT traversal. The only code we write is two thin
   provider adapters and one session endpoint. Custom code is a liability, not an asset.
4. **Truth is architectural.** Deletion, retention, and consent are implemented as enumeration
   over owned stores, and the privacy page is generated from a data map that CI verifies.
5. **Never break the running product.** The current web voice path stays in production until the
   Pipecat path is proven end-to-end on real cellular networks. Additive migration only.

---

## 2. Target architecture — three runtimes

```
┌────────────────────────────────────────────────────────────────────────┐
│ L0  packages/language-core  (TypeScript, the only source of truth)     │
│     profiles · contracts · persona · evals                             │
│     NEW: exports profiles/<id>.json  ← machine-readable artifact       │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │ typed import (TS surfaces)    │ JSON artifact (non-TS)
┌───────────────▼───────────────┐   ┌───────────▼───────────────────────┐
│ L1  workers/api  (the brain)  │   │ artifact consumers:               │
│  Clerk verify · DailyQuota DO │   │  · services/voice-rtc (Python)    │
│  ThreadStore DO · Memory      │   │  · apps/mobile (Expo client)      │
│  TrainingCorpus DO · R2       │   │  · web surfaces in this repo      │
│  POST /v1/chat/completions    │   └───────────────────────────────────┘
│  NEW POST /api/voice/session  │
└───────┬──────────────────────┘
        │ scoped short-lived session token (JWT/HMAC)
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ L2  services/voice-rtc  (NEW, Python + Pipecat — the audio peripheral)  │
│  SmallWebRTCTransport (peer-to-peer, no SFU) + Cloudflare TURN ICE      │
│  Silero VAD (turn detection)                                            │
│  BodhanSTTService(STTService)  → api.bodhan.ai/v1/audio/transcriptions  │
│  BodhanTTSService(TTSService)  → api.bodhan.ai/v1/audio/speech          │
│  LLM = POST workers/api /v1/chat/completions  ← policy stays in the brain│
│  Holds: VOICE_RTC_TOKEN only. No Clerk keys, no prompt text, no policy. │
└───────▲─────────────────────────────────────────────────────────────────┘
        │ WebRTC (audio) + RTVI events over the data channel
┌───────┴─────────────────────────────────────────────────────────────────┐
│ L3  apps/mobile  (NEW, Expo — the third surface)                        │
│  expo-dev-client · @pipecat-ai/client-js                                │
│  @pipecat-ai/react-native-small-webrtc-transport                        │
│  @clerk/clerk-expo → workers/api /api/voice/session                     │
│  Same language/persona UI contract as web (reads the JSON artifact)     │
└─────────────────────────────────────────────────────────────────────────┘
  L-web (unchanged): apps/chat + apps/voice on Workers until Phase F
```

The load-bearing rule is the arrow from L2 back to L1: **the Pipecat bot does not talk to Bodhan
or the model directly about policy — it asks `workers/api` for the reply.** The prompt, the
language contract, the delivery repair, and the script validation stay in one place, so web and
mobile cannot drift. The Python service's job is transport, turn detection, and audio plumbing
only.

---

## 3. The contract artifact (L0 — do this before anything mobile)

`packages/language-core` currently exports TypeScript only; the Python service and the Expo app
cannot import it. Add a script that emits a versioned JSON artifact per language:

```jsonc
// artifacts/profile.as.json  (emitted, committed, hash-pinned in CI)
{
  "policyVersion": "2026-09-15-v4",
  "language": "as",
  "locale": "as-IN",
  "tts": { "voice": "Prastuti", "maxInputChars": 360, "generationMaxTokens": 512 },
  "scripts": { "chat": "latin", "voice": "assamese", "voiceDisplay": "assamese" },
  "persona": { "id": "companion-v1" }
}
```

Rules: emitted by a script, committed, and **hash-pinned in CI** — a test fails if the JSON is
stale relative to the TypeScript source. Non-TS runtimes treat it as read-only data and refuse a
mismatched `policyVersion`. This mirrors what the repo already does in reverse: `/health` exposes
`prompt_hash` to prove what is deployed; the artifact hash proves what the peripherals built
against.

---

## 4. Session flow and trust boundary (L1 → L2 → L3)

```
Expo app                workers/api                  services/voice-rtc          Bodhan / LLM
   │  Clerk sign-in (@clerk/clerk-expo)                      │
   │──────────────────────►│                                 │
   │  POST /api/voice/session {language, threadId}             │
   │──────────────────────►│  verify Clerk token             │
   │                       │  quota check (DailyQuota DO)    │
   │                       │  mint session JWT (30-120s TTL) │
   │                       │  embed: principal, language,    │
   │                       │  threadId, iceServers, /start URL│
   │◄──────────────────────│                                 │
   │  POST voice-rtc /start  (offer + session JWT)             │
   │──────────────────────────────────────────────────────────►│
   │                       │                                 │  verify JWT (shared VOICE_RTC_TOKEN)
   │                       │◄── POST /v1/chat/completions ───│  per turn: LLM reply with language policy
   │                       │                                 │  POST /audio/transcriptions (indic-transcribe)
   │◄══════════════ WebRTC audio + RTVI events ════════════════│  POST /audio/speech (indic-speak, voice from artifact)
```

Consequences of this shape:

- The voice service holds exactly one secret: `VOICE_RTC_TOKEN`, a shared HMAC key with
  `workers/api`. It cannot mint identity, cannot read memories, and cannot change policy.
- A leaked voice-service credential expires in seconds and grants audio relay only.
- Quota is consumed exactly once per turn, in the brain, idempotently per `turnId` — the same
  guarantee the web path already has (`DailyQuota.consume`).
- The mobile app never sees `BODHAN_*`, `UPSTREAM_API_KEY`, or `SUPERMEMORY_API_KEY`.

---

## 5. The Bodhan adapters and the one hard product constraint

Bodhan's API is OpenAI-shaped, so the adapters are thin:

- `BodhanSTTService(STTService)` — wraps `POST /audio/transcriptions` with `model:
  "indic-transcribe"` and a 16kHz WAV/PCM frame. If Pipecat's `OpenAISTTService` accepts a
  `base_url` override, subclass it instead of writing from scratch.
- `BodhanTTSService(TTSService)` — wraps `POST /audio/speech` with `model: "indic-speak"`,
  `voice` and `instructions.lang` read from the contract artifact, never hardcoded.
- No adapter writes prompts, validates scripts, or repairs replies — that is `workers/api`'s job.

**The hard constraint, stated plainly:** Bodhan documents ~30 seconds per TTS request and
~4 requests/minute. True full-duplex realtime voice synthesizes continuously and gets interrupted
mid-sentence; under this provider that is not sustainable. Design decision, inherited from the web
path that already solved it (`apps/voice/worker.js` keeps exactly one provider request per turn):

1. The Pipecat pipeline aggregates LLM output into **one complete spoken turn** before synthesis —
   same delivery contract as web.
2. Barge-in is allowed: user speech cancels *queued playback* via VAD, and the pipeline drops the
   remainder rather than issuing a new synthesis request mid-answer.
3. If interruption feels too slow in user testing, the fix is a provider conversation (more quota,
   or a streaming TTS tier), not a rewrite of the architecture. Budget for that conversation.

This means mobile voice is **near-realtime, not magic-realtime**: interruption feels like a
walkie-talkie, not like talking over a friend. Saying that out loud in the plan is important — the
architecture cannot exceed the provider.

---

## 6. Deployment and hosting (solo-maintainer filtered)

Pipecat needs a long-running Python process; Cloudflare Workers cannot host it. Options, honestly
compared:

| Option | ~Cost | Ops burden | Notes |
|---|---|---|---|
| Fly.io machine (shared-cpu-1x) | $3–6/mo | Low | `fly deploy`, autosuspend possible; cold start hurts first voice turn |
| Hetzner CX22 VPS + Cloudflare Tunnel | ~€5/mo | Medium | Always-on (best for voice), one box to patch, most predictable |
| Railway | $5+/mo | Low | Fastest to start, less infra control |
| Oracle Cloud free ARM | Free | Medium-high | Real capacity/reliability risk; fine for a dev bot, not prod |
| Pipecat Cloud (managed) | Paid, per-minute | Lowest | Delegates hosting entirely; costs scale with usage |

Recommendation: **start with one small always-on box (Fly shared-cpu or Hetzner) running a single
Pipecat instance**, sized honestly for early scale: `aiortc` on shared vCPU handles a handful of
concurrent sessions, which is exactly what a solo launch has. Pipecat documents a VM-per-session
pattern for when concurrency grows; adopt it when a real user count demands it, not before.

TURN: SmallWebRTC is peer-to-peer and needs no SFU, but strict NATs and cellular networks need a
TURN relay. Use **Cloudflare Realtime TURN** — it is already in your account, your billing, and
your compliance story, and it hands out short-lived credentials. Pass servers via
`PIPECAT_ICE_SERVERS` on the server and return the same list from `/api/voice/session` so both ends
agree. Fallback if Cloudflare TURN pricing disappoints: `coturn` on the same box (it must be
reachable on UDP 3478, which is the one networking thing you will own).

HTTPS is mandatory in production — browsers and WebViews block microphone access on insecure
origins.

---

## 7. Build-up phases with gates

Ordered so that nothing new starts on an unstable base, and nothing breaks production.

### Phase A — Ground truth and one brain (no new runtimes yet)

This is `AGENTS.md` §7 and `launch-plan.md` Phases 0–1, unchanged, because everything below
compiles against it: commit the v4 delta, fix the Chat proxy allowlist, add `typecheck` to
`workers/api` and make `language-core` a declared dependency there and in `apps/chat`, add all five
worker dry-runs to CI, decide thread ownership (ThreadStore DO vs honest labeling), ship `/privacy`
and `/terms`.

**Gate:** CI green; `/api/training*` reachable from Chat; a third party can exercise deletion and
end with zero retained personal data; `prompt_hash` matches the deployed contract.

### Phase B — Contract artifact + session endpoint (L0 + L1)

1. Add `scripts/export-profiles.mjs` to `packages/language-core`; emit `artifacts/profile.<id>.json`;
   add a CI test that fails if the artifact is stale vs the TypeScript source.
2. Add `POST /api/voice/session` to `workers/api`: Clerk-verify, quota check, mint a short-lived
   session JWT containing `principal`, `language`, `threadId`, ICE servers, and the `/start` URL.
   No Bodhan or model keys in the response.
3. Extend `DailyQuota.prefs` and `ReplyContract` with `persona` (from the launch plan) so the
   artifact carries it from day one rather than growing it later.

**Gate:** `curl` with a Clerk token returns a decodable session JWT whose `language` is rejected
when not `as|brx`; artifact hash changes when `LANGUAGE_POLICY_VERSION` changes; CI red on a
hand-edited artifact.

### Phase C — Pipecat voice service, local-first (L2)

1. `services/voice-rtc/` (own Python env via `uv`, own Dockerfile, in this monorepo so the contract
   artifact is a sibling, not a remote dependency).
2. Pipecat pipeline: `SmallWebRTCTransport` → `SileroVADAnalyzer` → `BodhanSTTService` →
   `OpenAICompatibleLLMService` pointed at `workers/api/v1/chat/completions` with the session JWT →
   `BodhanTTSService` reading voice/budgets from the artifact.
3. One-turn aggregation + barge-in-cancels-playback semantics from §5.
4. Prove it locally with Pipecat's dev runner and a browser client before touching Expo.

**Gate:** a full Assamese and a full Bodo conversation loop on localhost, with interruption,
correct script in replies, and `finish_reason=length` handled by the brain's existing repair path;
latency logged per stage (STT / LLM / TTS first byte) and compared against the web path.

### Phase D — Deploy the voice service (L2 in prod, still no mobile)

1. Fly.io or Hetzner, one instance, `VOICE_RTC_TOKEN` + `PIPECAT_ICE_SERVERS` configured.
2. Cloudflare Realtime TURN (preferred) or `coturn`; verify from a phone on cellular, not LAN.
3. Route `voice-rtc.<domain>` through Cloudflare so TLS is automatic and the trust story is one
   account.

**Gate:** 20 consecutive successful sessions from cellular networks; ICE failure rate under ~5%;
a crashed bot process auto-restarts and the client recovers; no secret in the service except
`VOICE_RTC_TOKEN`.

### Phase E — Expo app (L3)

1. `apps/mobile`: `expo-dev-client` (required — native WebRTC cannot run in Expo Go), Expo
   prebuild with the react-native-webrtc config plugin for microphone permissions, iOS deployment
   target ≥ 15, Android `minSdkVersion` ≥ 24.
2. `@pipecat-ai/client-js` + `@pipecat-ai/react-native-small-webrtc-transport`;
   `@clerk/clerk-expo` for sign-in; language selector reading the same JSON artifact the service
   uses; reuse the visual language of `apps/voice/src/components/voice-signal.tsx` (RTVI exposes
   audio levels, so the same feedback design ports).
3. Deletion, usage display, and training consent from day one — parity with web is the product, not
   a stretch goal.

**Gate:** TestFlight + internal Android build; a cellular voice conversation in both languages;
sign-out leaves zero user data on device; deletion from the app deletes everywhere.

### Phase F — Convergence decisions (only after E)

Decide with data, not preference:

- Does web voice migrate to the Pipecat path (RTVI everywhere), or stay on the current Workers
  edge path? Keep both only if the edge path is measurably better on web.
- Does `ThreadStore` replace assistant-cloud for web chat?
- Does the training corpus accept RTC turns (with the same consent controls), and does
  `surface: 'voice'` need an `rtc` value?

---

## 8. What this plan deliberately does not do

- **No rewrite of the working web voice path.** It runs, it respects the provider's rate limit, and
  it is instrumented. It converges only when the new path is proven better.
- **No self-built transport, VAD, echo cancellation, or signaling.** Pipecat and WebRTC solved
  these; every custom line here is a line you debug at 2 a.m.
- **No fine-tuning yet.** The corpus needs volume and the eval rubric needs native-speaker review
  first. When the corpus justifies it, the path is LoRA on a hosted GPU (Unsloth/axolotl class) with
  the same eval gates — gated on corpus size, not enthusiasm.
- **No multi-instance voice service.** One box, a handful of sessions, honest about it. VM-per-session
  when real concurrency demands it.

---

## 9. Research references (what this plan is built on)

- Pipecat React Native SDK: `@pipecat-ai/client-js` +
  `@pipecat-ai/react-native-small-webrtc-transport` (iOS ≥ 15, Android minSdk ≥ 24). The Daily
  transport and `DailyMediaManager` are optional and pull in `@daily-co/*` deps plus an Expo config
  plugin — avoid unless needed.
  https://docs.pipecat.ai/api-reference/client/react-native/overview ·
  https://github.com/pipecat-ai/pipecat-client-react-native-transports
- SmallWebRTC transport: peer-to-peer, no SFU, HTTP offer/answer signaling, `IceServer` config,
  `PIPECAT_ICE_SERVERS`, HTTPS required in production, and the `PIPECAT_SCTP_MAX_CHUNK_SIZE=1100`
  MTU gotcha (cellular/IPv6 paths stall above it).
  https://docs.pipecat.ai/api-reference/server/services/transport/small-webrtc
- Custom services: `STTService` / `TTSService` base classes; Pipecat's OpenAI STT/TTS services are
  subclassable with a `base_url` override — the intended home for the Bodhan adapters.
- Cloudflare Realtime TURN: managed TURN with short-lived credentials, same account as everything
  else. Verify current usage pricing before committing; `coturn` is the fallback.
- Pipecat self-hosting paths (Fly.io example, Railway template, VM-per-session pattern):
  https://github.com/pipecat-ai/pipecat-examples
- Expo SDK request context: https://github.com/pipecat-ai/pipecat/issues/862 (closed in favour of
  the RN transports above).
- LiveKit Agents is the credible alternative with a mature Expo plugin. Chosen against because
  Pipecat keeps the Python pipeline (Bodhan adapters, custom VAD strategy, RTVI events) under our
  control, which the contract-as-product invariant requires. Revisit only if SmallWebRTC + TURN
  fails on real cellular networks.

The single sentence to remember: **the brain does not move, the contract does not fork, and the
audio peripheral stays dumb.**