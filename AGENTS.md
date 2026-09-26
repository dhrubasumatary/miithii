# AGENTS.md — Miithii ground truth

Written 2026-09-15 against the working tree at commit `6b023e8` **plus uncommitted local state**.
Read this before touching anything. Where this file disagrees with `README.md` or `docs/*.md`,
**trust this file** — the other docs are historical and were not updated alongside the code.

Scope: this is an operating brief for coding agents. It is not marketing copy. Do not soften it.

---

## 0. One-paragraph state of the system

Miithii is a Northeast-India language AI product with **two real surfaces** (Chat at
`chat.miithii.in`, Voice at `voice.miithii.in`) that share **one** Cloudflare API Worker
(`workers/api`, `api.miithii.in`). A third surface, Subtitles, is a **waitlist form only**.
The apex landing page is real. The genuinely valuable engineering — the v4 language/persona
contract package, Bodo support, the opt-in training corpus, and the voice rewrite — is
**uncommitted**: `HEAD` is a different, older product than what runs on this machine.
Conversation history for Chat lives in a **third-party vendor** (assistant-cloud), not in our
infrastructure, so account-level deletion does not delete conversations.

---

## 1. Verify reality yourself before you plan anything

Never trust a doc, a comment, or this file's summaries. Run these.

```powershell
git status --short                  # expect a large uncommitted delta; see section 6
git --no-pager log --oneline -12
git --no-pager ls-files | Measure-Object -Line   # 138 tracked files at 6b023e8

pnpm dlx wrangler@4.129.1 --version # 4.129.1; wrangler is NOT installed globally
node --version                      # v24.4.1
pnpm --version                      # 11.19.0 (packageManager pin)

# contract + client tests (fast, no network)
pnpm --filter @miithii/language-core test
pnpm --filter @miithii/voice test

# full gate (slow: typecheck + build all apps + api tests + api bundle)
pnpm check
```

**PowerShell gotcha (verified):** `node --test` writes its report to stderr, and PowerShell converts
any native stderr output into a `NativeCommandError` with a non-zero exit code. So
`pnpm --filter @miithii/language-core test` *looks* like a failure while actually passing
(15/15, exit 0). Trust `$LASTEXITCODE`, or run it directly:

```powershell
pushd packages/language-core; node --test test/*.test.mjs; echo "EXIT=$LASTEXITCODE"; popd
```

Production truth requires the Cloudflare MCP servers in `.cursor/mcp.json`, or:

```powershell
pnpm dlx wrangler@4.129.1 whoami
pnpm dlx wrangler@4.129.1 deployments list --name miithii-api
curl.exe -i https://api.miithii.in/health          # {service, version, status, prompt_hash}
curl.exe -i https://chat.miithii.in/api/usage      # expect 401 AUTH_REQUIRED
```

`/health` returns `prompt_hash`, a 16-hex prefix of the SHA-256 of the **chat** system prompt
(`workers/api/src/index.js:53`). That hash is how you prove which policy version is actually
deployed. If it does not change when `LANGUAGE_POLICY_VERSION` changes, the deploy did not take.
---

## 2. Repo map — what is actually live

| Path | Deployed as | Domain | Status |
|---|---|---|---|
| `workers/apex` | `miithii-apex-fresh` | `miithii.in`, `www` (301) | live landing |
| `workers/api` | `miithii-api` | `api.miithii.in` | **live brain** |
| `workers/chat` | `miithii-chat` | `chat.miithii.in` | live chat, 21-line proxy |
| `apps/voice` | `miithii-voice` | `voice.miithii.in/*` | live voice, **fat** worker |
| `apps/subtitles` | `miithii-subtitles` | `subtitles.miithii.in` | **waitlist only** |
| `apps/hub` | (assets only) | built to `apps/hub/out`, served by apex | live landing source |
| `packages/language-core` | shared lib | — | **uncommitted**, the v4 product |
| `packages/ui` | shared lib | — | live design system |

Server-render notes:

- All four Next apps share `agentRules: false` and `output: "export"` in production
  (`apps/*/next.config.ts`). This is a **static export** product; there is no Next server in
  production. Any feature that needs a Next runtime route handler is impossible here.
- Only `workers/api` sets `compatibility_flags: ["nodejs_compat"]`.
- Only `workers/api` and `workers/chat` pin `account_id`. `apps/voice` and `workers/apex` do not.

---

## 3. Who owns what data (the most important table in the repo)

| Concern | Owner | Reachable by our own backend? |
|---|---|---|
| Identity | Clerk (`clerk.miithii.in`, JWT template `miithii-api`) | verify only; principal = `clerk:<sub>` |
| Chat threads + titles | **assistant-cloud** `proj-00s8iick8y6c.assistant-api.com` | **NO** |
| Memory | Supermemory (`api.supermemory.ai/v3`, `/v4`) | yes |
| Quota, prefs, consent version | DO `DailyQuota` | yes |
| Training corpus | DO `TrainingCorpus` (name `miithii-opt-in-v1`) | yes |
| Chat images | R2 `miithii-chat-uploads`, 24h TTL | yes |

Consequences you must design around:

1. `DELETE /api/memory` deletes **Supermemory documents only**. It cannot enumerate or delete a
   single thread. The Chat UI button says "Forget everything" → "Memories deleted"
   (`apps/chat/src/components/chat.tsx:1026`). That is misleading. Do not make it worse; if you
   touch that UI, either scope the label to memories or implement thread deletion.
2. Individual thread deletion goes **browser → assistant-cloud**, bypassing our API entirely
   (`apps/chat/src/components/thread-list.aui.tsx:406`).
3. Voice has **no persistence at all**: history is an in-memory ref
   (`apps/voice/src/app/page.tsx`). A reload loses the conversation and the user can never
   review or delete it — yet with training consent on, the full turn is retained server-side
   (section 4).
---

## 4. Exact request paths (verified, with line references)

### Chat

```
browser apps/chat  →  chat.miithii.in/api/chat/v2        (same-origin)
  workers/chat/src/index.js  forwards 7 paths only (see 6.1)
    →  workers/api  POST /api/chat/v2
         validateUIMessages (validators.js) → resolveImages (uploads.js)
         → chatV2(): Supermemory search → streamText(chatSystemPrompt + memory_search tool)
         → onFinish: Supermemory write, then training capture
                     (surface 'chat', targetLanguage always CHAT_DEFAULT_LANGUAGE)
         → toUIMessageStreamResponse()
threads + titles persisted by assistant-cloud, not by us
```

### Voice

```
browser apps/voice → voice.miithii.in/api/...
  /api/stt      apps/voice/worker.js → Bodhan indic-transcribe (16kHz mono WAV from MicRecorder)
  /api/chat     apps/voice/worker.js → api.miithii.in POST /v1/chat/completions
                  body: { model:'miithii', stream:false, responseMode:'voice', language,
                          turnId, max_tokens: contract.tts.generationMaxTokens,
                          temperature:0.62, threadId:`voice-<lang>`, messages }
                  → api applies the VOICE system prompt, then delivery repair
                    (empty | finish_reason=length | too long), then script repair
                    (validateOutputScript); otherwise 502 LANGUAGE_CONTRACT / VOICE_DELIVERY
  /api/display  Bodhan indic-translate, same-language romanize; runs only when
                displayScript !== speechScript (Bodo only)
  /api/tts      Bodhan indic-speak, exactly ONE provider request per turn
```

Load-bearing facts about Voice:

- `responseMode: "voice"` is injected **by `apps/voice/worker.js`, not by the client**. The
  browser never sends it. `validateBody` rejects any other value (`validators.js:86-91`).
- Voice sets `memoryEnabled = false` **unconditionally** (`workers/api/src/index.js:543`:
  `responseMode !== 'voice' && prefs.memoryEnabled`). Voice never reads or writes Supermemory.
  Do not "fix" this without an explicit product decision.
- Voice **does** reach the training corpus when consent is on, with `surface: 'voice'` and
  `targetLanguage` = the selected language (`workers/api/src/index.js:679-698`).
- `threadId` is the constant string `voice-<lang>` (`apps/voice/src/app/page.tsx:461`), so all
  voice sessions for a language collapse into one pseudo-conversation. This affects Supermemory
  conversation ids, `threadHash` in the corpus, and the 95/5 conversation-level split in
  `workers/api/scripts/prepare-training.mjs`.
- Every voice turn calls `/api/usage` up to four times: `verifyAccount()` runs inside
  `handleChat`, `handleStt`, `handleTts`, and `handleDisplayText` (`apps/voice/worker.js`).

### Full API surface (`workers/api/src/index.js:439-513`)

| Path | Method | Notes |
|---|---|---|
| `/`, `/health` | GET | 200 `ok` or 503 `not_configured`; returns `prompt_hash` |
| `/v1/models` | GET | stub list: one model `miithii` |
| `/v1/chat/completions` | POST | OpenAI-shaped, non-stream; **Voice uses this** |
| `/api/chat` | POST | OpenAI-shaped, non-stream; legacy, no in-repo client |
| `/chat` | POST | same; legacy, no in-repo client |
| `/api/chat/v2` | POST | AI SDK UI-message stream; **Chat uses this** |
| `/api/usage` | GET | `DailyQuota.status()` + `principal: 'clerk'` |
| `/api/memory` | DELETE | Supermemory bulk delete (docs only) |
| `/api/memory/prefs` | GET, POST | `memoryEnabled` |
| `/api/training/prefs` | GET, POST | `trainingEnabled` |
| `/api/training` | DELETE | delete contributor rows + bump `trainingVersion` |
| `/api/training/export` | GET | requires `TRAINING_EXPORT_TOKEN`, timing-safe compare |
| `/api/uploads`, `/api/uploads/:uuid` | POST, GET, DELETE | 5MB, PNG/JPEG/WebP, magic-byte checked |

Cross-cutting behaviour:

- CORS is explicit: `ALLOWED_ORIGINS` (wrangler vars) plus
  `ALLOW_LOCAL_ORIGINS === 'true' && isLocalOrigin(origin)` in dev. Non-allowed origins get
  403 `ORIGIN_NOT_ALLOWED`. Exposed: `x-request-id, retry-after, x-vercel-ai-data-stream,
  x-ratelimit-remaining, x-ratelimit-reset`.
- Two independent limit systems: DO `DailyQuota` (50 turns/day, resets at IST midnight,
  idempotent per `turnId`) and `CHAT_RATE_LIMIT` (30 requests / 60s per `cf-connecting-ip`).
  Chat surfaces the daily number; Voice calls `/api/usage` and discards the response.
- Error codes reaching the UI: `AUTH_REQUIRED`, `DAILY_LIMIT`, `UPSTREAM_BUSY`,
  `UPSTREAM_TIMEOUT`, `NO_SPEECH`, `STT_UNAVAILABLE`, `TTS_UNAVAILABLE`, `VOICE_DELIVERY`,
  `LANGUAGE_CONTRACT`, `INVALID_FILE`, `IMAGE_UNAVAILABLE`, `INVALID_MESSAGE`.

---

## 5. The language contract (the actual product, and it is uncommitted)

`packages/language-core/` is the single source of truth for reply language, script, TTS voice,
and personality. `LANGUAGE_POLICY_VERSION = '2026-09-15-v4'`.

```
src/base-policy.ts        NEUTRAL_COMPANION_POLICY  (personality + safety + memory rules)
src/types.ts              LanguageProfile { id, locale, name, nativeName, replyScript,
                                            displayScript, tts, policy{common,chat,voice,personality} }
src/profiles/assamese.ts  ASSAMESE_PROFILE
src/profiles/bodo.ts      BODO_PROFILE
src/index.ts              buildLanguageSystemPrompt({surface, language}), getReplyContract()
src/script.ts             validateOutputScript()  (Unicode Script, not numeric blocks)
src/evidence.ts           revision-bound quote validation, deliberately no mastery state
src/meaning-controller.ts revision-owned latest-meaning controller (Subtitles/Voice helper)
```

Contract values you must not casually change:

| | Assamese `as` | Bodo `brx` |
|---|---|---|
| chat script | `latin` (Romanized) | `latin` |
| voice script | `assamese` (Unicode "Bengali" block) | `devanagari` |
| voice display script | `assamese` | `latin` (romanize step exists for `brx` only) |
| TTS voice | `Prastuti` | `Gwrbw` |
| max spoken chars | 360 | **180** |
| generation tokens | 512 | **4096** |

Why the Bodo asymmetry exists (do not "unify" it): `docs/miithii-bodo-research.md` records that
Gemini 2.5 Flash spends much of its budget on hidden reasoning for Bodo and returned truncated
mid-word output at 800 tokens, while `Gwrbw` speaks slowly enough that ~240 characters produced
30.5s of audio. Larger generation budget + shorter spoken budget is deliberate.

Composition order in `buildLanguageSystemPrompt()`:
`NEUTRAL_COMPANION_POLICY` → `REPLY CONTRACT` → `LANGUAGE PROFILE` → `SURFACE PROFILE` →
`PERSONALITY REALIZATION`. `workers/api` then prepends a `SERVER SECURITY BOUNDARY` block and
`SERVER CONTEXT` capability metadata (`workers/api/src/index.js:565`).

Enforcement status (uneven, and this is a real problem):

- `apps/voice` declares `@miithii/language-core: workspace:*` — typed, tested.
- `workers/api` imports `'../../../packages/language-core/src/index.ts'` **by relative path** and
  has **no `typecheck` script**. Its only build gate is `wrangler deploy --dry-run`.
- `apps/chat` does not depend on `language-core` at all, so it cannot display or select a
  language. `BODO_PROFILE.policy.chat` itself says Chat still defaults to Assamese.

**Persona is prose, not a control.** It exists in `base-policy.ts` and each profile's
`personality` block and is injected server-side, but there is no `persona` field in
`ReplyContract`, no `persona` column in `DailyQuota.prefs` (only `memory_enabled`,
`training_enabled`, `training_version`), and no UI anywhere. A user cannot see or change it.

---

## 6. Known broken, dead, or misleading (verified — do not rediscover these)

### 6.1 Chat proxy is missing the training endpoints — live production bug

`workers/chat/src/index.js:7-15` forwards only `/api/uploads*`, `/api/chat`, `/api/chat/v2`,
`/api/usage`, `/api/memory`, `/api/memory/prefs`.

`apps/chat/src/hooks/use-account.ts:128` POSTs `/api/training/prefs` and `:146` DELETEs
`/api/training`. Both fall through to `env.ASSETS.fetch` and return the 404 page. The training
consent toggle in Chat settings therefore **cannot work in production**, and CI cannot see it
because `apps/chat` has no tests and no test script.

### 6.2 Dead endpoints

`/chat` and `/api/chat` (non-v2, non-voice) have no in-repo client. Voice uses
`/v1/chat/completions`; Chat uses `/api/chat/v2`. They still authenticate, consume quota, and are
publicly reachable.

### 6.3 Undocumented secret

`TRAINING_EXPORT_TOKEN` is required by `/api/training/export`
(`workers/api/src/index.js:464`) but appears in neither `.env.example` nor `README.md`. With it
unset, the endpoint returns 503.

### 6.4 Dev can silently write to production

`apps/voice/dev-worker.mjs` tries local `http://127.0.0.1:8787` and, on any connection failure,
falls back to `https://api.miithii.in`. Local development can therefore burn production quota and
write production memory/training data.

### 6.5 Two workers hold upstream vendor secrets

`apps/voice/worker.js` holds `BODHAN_API_KEY` and `BODHAN_TTS_API_KEY` inside a static-asset
worker. `apps/subtitles/worker.js` holds `WAITLIST_KEY` for a waitlist form. The clean pattern is
already in the repo: `workers/chat/src/index.js`, 21 lines, zero secrets.

### 6.6 Local-only clutter (untracked, but it makes the tree unreadable)

`px0/` (an unrelated Go code-viewer project: LSP servers, web UI, 20 themes, Makefile, LICENSE),
`tmp/` (two more full copies of the repo), seven `apps/voice/voice-*.png` audit screenshots,
`.miithii-dev.out.log` / `.miithii-dev.err.log`, and `apps/chat/.vercel/project.json` from the
abandoned Vercel attempt. `git ls-files` itself is clean (138 files, no secrets, no build output),
so all of this is local state — but it will mislead any agent that explores by directory listing.

### 6.7 Stale docs (keep for history, never as truth)

- `docs/miithii-architecture.md` — says `packages/ui` is the only shared workspace package (false)
  and its repo map predates `packages/language-core` and the training pipeline.
- `docs/production-recovery.md` (2026-08-18) claims Vercel still resolves apex. Superseded.
- `README.md` says "Chat and Voice require sign-in"; commit `2c317bf` made Chat usable before
  sign-in.
- `.env.example:17` sets `NEXT_PUBLIC_API_BASE_URL=https://api.miithii.in`, while
  `apps/chat/next.config.ts` hardcodes `env: { NEXT_PUBLIC_API_BASE_URL: "" }` to force
  same-origin. Example and code disagree.
- `docs/miithii-assamese-system-prompt.txt` is still in `HEAD` and imported by the committed
  `workers/api/src/index.js`, but is deleted in the working tree. That single file is the clearest
  evidence that `HEAD` is a different product than this working copy.

---

## 7. The uncommitted delta is the top risk

20 modified + 15 untracked paths, **+2272 / −1282 lines**, containing:

- all of `packages/language-core/` (the v4 contract and both language profiles)
- `workers/api/src/training-data.js`, `training-corpus.js`, `workers/api/scripts/*`,
  `workers/api/test-training.mjs`
- the entire voice rewrite: `page.tsx` (912-line diff), `worker.js` (363), `globals.css` (1359),
  plus `voice-lifecycle.ts`, `components/voice-signal.tsx`, `apps/voice/test/`
- `docs/language-and-training-architecture.md`, `docs/miithii-bodo-research.md`
- `workers/api/src/index.js` (+275): prompt swap, voice delivery/script repair, training capture

None of it has a commit, a CI run, or a rollback point. **A single `git checkout .` or a dead disk
destroys the product.** Treat "commit the v4 delta in reviewable slices" as the highest-priority
task in this repository.

---

## 8. Commands

```powershell
pnpm bootstrap        # pnpm install --frozen-lockfile && npm ci --prefix workers/api
pnpm dev              # api + voice api proxy + all Next apps (3000-3003, 8787, 8788)
pnpm typecheck        # turbo typecheck across the workspace
pnpm build            # turbo build (all apps static-export)
pnpm check            # typecheck + language-core test + voice test + build + api test + api build

pnpm --dir apps/chat dev            # 3002
pnpm --dir apps/voice dev           # 3003
pnpm --dir apps/voice dev:api       # 8788 voice API proxy (dev-worker.mjs)
npm  --prefix workers/api run dev   # 8787 API worker (wrangler dev)
npm  --prefix workers/api test      # test-protocol.mjs + test-training.mjs
```

Deploy is **only** via `.github/workflows/deploy-production.yml` on push to `main`, or manual
dispatch. Order: API → Chat → Voice → Subtitles → Apex, then smoke tests.

CI reality check: `.github/workflows/ci.yml` typechecks, builds, tests `language-core`, voice, and
the API worker, but dry-runs **only the API bundle**. The other four worker bundles are dry-run
only in the deploy workflow, i.e. after merge. A broken `apps/subtitles/worker.js` or
`workers/apex` fails at release time, not in review.

---

## 9. Conventions you must follow

1. **No Next.js runtime features.** All apps are static exports. No route handlers, no server
   actions, no middleware, no `force-dynamic`, no server-only `cookies()`.
2. **Language behaviour is data.** Changing language policy means editing `packages/language-core`,
   adding assertions in `packages/language-core/test/language-core.test.mjs`, and updating
   `test/fixtures/language-contracts.json` when a public contract value changes. Never hardcode a
   language, script, voice id, or character limit in an app or worker.
3. **Never accept language policy from the client.** Clients select an id; the server composes the
   prompt. `validateBody` explicitly rejects client `system` and `tools`.
4. **Voice budgets come from the profile.** `workers/api` overrides `max_tokens` from
   `getReplyContract('voice', language)`; do not let clients set it.
5. **Async work is bound to a turn.** Voice uses `sessionGenerationRef` + `turnGenerationRef` +
   `ownsVoiceTurn()`. Never let a stale STT/LLM/TTS result mutate a newer turn.
6. **No optimistic UI for state we do not control.** `use-account.ts` leaves `usage` as `null`
   rather than showing a fake zero, and deletion never reports success it cannot verify. Preserve
   that discipline.
7. **Secrets never enter the browser bundle.** Only `NEXT_PUBLIC_*` may. `BODHAN_*`,
   `UPSTREAM_API_KEY`, `SUPERMEMORY_API_KEY`, `WAITLIST_KEY`, `TRAINING_EXPORT_TOKEN` stay server-side.
8. **Comments explain why, not what.** The codebase already does this well (why the ScriptProcessor
   fallback exists, why a muted GainNode keeps the worklet pulling). Match it.
9. **No new dependencies without a reason.** `apps/chat` already carries a duplicate
   `components/ui/*` copy of shadcn primitives alongside `packages/ui`; do not add a third layer.

---

## 10. Boundaries — do not do these

- Do not commit secrets, `workers/api/.dev.vars`, `.env.local`, or `.vercel/`.
- Do not deploy to production from a local machine. Use the workflow.
- Do not change worker routes, DO migrations, or the R2 lifecycle without treating it as a
  production migration.
- Do not fold training into the existing memory consent. They are separate purposes with separate
  controls; keep them separate.
- Do not present model output as fact, or claim a memory write/delete succeeded when it is
  asynchronous. `memory_capabilities.delete` is deliberately `false` in server context.
- Do not resurrect `docs/miithii-assamese-system-prompt.txt` into runtime. It is archived history.

---

## 11. Definition of done

A change is not done until:

1. `pnpm check` passes locally.
2. If it touches language policy: `pnpm --filter @miithii/language-core test` was failing before
   and passes after, and `LANGUAGE_POLICY_VERSION` is bumped.
3. If it touches a Worker:
   `pnpm dlx wrangler@4.129.1 deploy --config <path> --dry-run --outdir .wrangler-dry-run/<name>`
   succeeds.
4. If it adds an API path: it is added to every worker that must forward it
   (`workers/chat/src/index.js`, `apps/voice/worker.js`) and its CORS exposure is considered.
5. If it changes user-visible truth (deletion, retention, memory), the label matches what the
   server actually does.
6. `git status` contains no accidental artifacts (`*.png`, logs, `.vercel/`, `px0/`, `tmp/`).
