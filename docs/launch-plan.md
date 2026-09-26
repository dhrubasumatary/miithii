# Miithii launch plan — from "it runs" to real users, real product, real business

Written 2026-09-15. Read `AGENTS.md` first; it is the technical ground truth. This file is the
honest gap analysis and the ordered path out.

Miithii is currently **deployed but not launchable**. The engineering quality in the v4 language
layer is genuinely above what a solo project normally reaches. The product, business, and trust
layers around it are almost entirely absent. That is the whole problem: you built the hard part and
skipped the parts that make it a product.

---

## 1. What you actually have (assets, honestly valued)

**Real and defensible:**

- `packages/language-core` — a contract layer for Assamese and Bodo with separate chat/voice
  scripts, per-language TTS voices, per-language token/character budgets, and a researched policy
  base. `docs/miithii-bodo-research.md` and `docs/miithii-assamese-research.md` cite primary sources
  (CIIL/NCERT primer, Unicode Devanagari chapter, Bodo Sahitya Sabha, BackTranslit corpus) and are
  explicit about what is *not* validated. This is the moat. Most "Indian language AI" products have
  a prompt and a dream; you have a versioned contract with tests.
- A working end-to-end voice loop: AudioWorklet 16kHz WAV capture → Bodhan STT → language-scoped
  LLM turn with delivery + script repair → Bodhan TTS, with turn ownership so an interrupt cannot
  corrupt a newer turn, and `server-timing` instrumentation throughout.
- An opt-in training corpus with real consent mechanics: separate from memory, off by default,
  credential-shaped text rejected, contributor deletion with `consent_version` monotonicity so an
  in-flight turn cannot resurrect deleted data.
- A Dodo/Assamese-aware prompt architecture that has already produced two verified contract
  behaviours (structured prompt held Latin script on an English greeting where the minimal prompt
  drifted into Assamese script; Bodo truncation at 800 tokens vs complete output at 4096).
- A credible research posture. The refusal to promote generated sentences to gold examples without
  speaker review is a genuine differentiator if you ever seek grants, partnerships, or press.

**Half-built or theatrical:**

- Subtitles: a waitlist form with its own worker, secret, and API endpoint. It consumes
  infrastructure and deploy surface while delivering nothing.
- Chat: a real product whose conversation history lives in a vendor we cannot delete from, with a
  UI label ("Forget everything") that overstates what it does.
- Voice: a real, delightful, single-session product that forgets everything by design and stores
  nothing the user can revisit.
- Training: collection works, export works, **nothing consumes it**. No trainer, no registry, no
  evaluation gate, no path from corpus to improved model.

**Absent entirely:** pricing, payments, analytics, error reporting, privacy policy, terms, support
path, status page, onboarding, retention mechanics, unit economics, any non-organic distribution.

---

## 2. What is missing for REAL USERS

A real user is someone who did not build this and will judge it in ninety seconds.

### 2.1 Trust and truth (blockers, not nice-to-haves)

| Gap | Evidence | Why it blocks launch |
|---|---|---|
| "Forget everything" does not delete conversations | `chat.tsx:1026`; `DELETE /api/memory` only touches Supermemory | Legal and ethical exposure. You collect Northeast Indian users' personal conversations while telling them deletion happens. |
| Training consent toggle is broken in production | `workers/chat/src/index.js:7-15` omits `/api/training*`; `use-account.ts:128,146` calls them | Users cannot exercise the control you promise. |
| Voice conversations are retained for training but unreviewable | `index.js:679-698` captures `surface:'voice'`; voice history is in-memory only | A user contributes data from a conversation they can no longer see or delete. |
| No privacy policy, no terms | grep across all four apps: zero matches | Required before collecting personal data at scale; also needed for OAuth verification, payment processors, and institutional adoption. |
| No account-level export for the user | only `/api/training/export`, operator token | Data-subject access expectation. |
| Weak AI disclosure | `base-policy.ts` only says be honest when asked | Under-specified for a general consumer audience. |

**Minimum fix:** one `/privacy` and one `/terms` page on the apex with truthful retention bullets, a
working consent toggle, and a deletion path that either really deletes threads or is renamed to what
it does. Days of work, and it unblocks everything else.

### 2.2 Product completeness

- **Voice forgets on reload.** For a "companion" this contradicts the premise. Nothing in
  `workers/api` can store a voice thread today.
- **Chat cannot speak Bodo.** `apps/chat` has no `language-core` dependency, so the second language
  of a two-language product is unreachable in the text surface. `BODO_PROFILE.policy.chat` admits it.
- **Persona is invisible.** Arguably the most distinct thing you wrote. A user cannot see it, choose
  it, or turn it down. That is why it "never happened".
- **Errors are English and generic** in a product promising Assamese and Bodo.
- **No onboarding.** Nothing explains tumi/apuni register, that replies follow the selected speech
  language, or what the daily limit is.
- **The daily limit is invisible.** `x-ratelimit-remaining` and `usage.remaining` exist; Voice
  fetches `/api/usage` and discards it.

### 2.3 Reliability and support

- **No user-facing error reporting.** No Sentry, no analytics. You will learn about breakage from
  Twitter, not telemetry.
- **No status page**, no incident process, no support channel (email at minimum).
- **CI cannot catch a broken subtitles or apex bundle** before merge — only the API bundle is
  dry-run in `ci.yml`.
- **Dev can write to production** (`apps/voice/dev-worker.mjs` falls back to `api.miithii.in`).
- **Daily-limit UX is missing:** the user hits `DAILY_LIMIT` with `retry-after` and no countdown.

---

## 3. What is missing for a REAL BUSINESS

### 3.1 Revenue surface: none exists

No pricing page, no plan, no checkout, no paywall, no metering beyond a flat free limit of 50
turns/day (`DailyQuota`, IST midnight reset). `git log` shows the pre-monorepo app (`6936242`)
included payments; the monorepo reset dropped it. You removed the revenue surface during the rebuild
and never restored it.

A realistic shape for this product:

- **Free:** 50 turns/day, Chat + Voice, both languages.
- **Plus:** higher limits, persistent voice threads, cross-surface memory, priority during provider
  congestion. This is the tier that pays for Bodhan TTS and for 4096-token Bodo reasoning.
- **Institutional:** bulk/curriculum access for schools, colleges, and Assamese/Bodo language
  organisations. This is where research credibility converts into money and is the path least
  dependent on consumer willingness to pay.

Do **not** add a paywall before the trust fixes in 2.1. Charging for a product whose delete button
lies is a legal problem, not a growth problem.

### 3.2 Unit economics are unmeasured

You cannot price what you have not measured. Per-turn cost spans Bodhan `indic-transcribe`, Gemini
2.5 Flash via AI/ML API (possibly behind the Supermemory router), Bodhan `indic-speak`, optional
Bodhan `indic-translate` (Bodo only), plus DO/R2 and Clerk. A Bodo voice turn uses a **4096-token**
generation budget and can produce ~30s of TTS audio: cheap on Chat, possibly expensive on Voice.

**Task:** instrument cost per turn before any pricing decision. You already have the hooks —
`server-timing` on `/stt`, `/chat`, `/tts`, `/display`, and model `usage` in the Chat stream
(`messageMetadata` in `chatV2`). Log provider, tokens, and audio seconds per surface and language;
you will know blended cost within a week.

### 3.3 Distribution: none

There is no channel. The apex has correct SEO plumbing (title, canonical, JSON-LD, robots, sitemap)
and static-export performance — a real foundation — but no content that could rank.

Highest-leverage, lowest-cost plays, given what already exists:

1. **Publish the research.** `docs/miithii-bodo-research.md`, the Bodo delivery-budget finding
   (800 tokens → truncated; 4096 → complete; 213 chars → 30.5s of audio), and the Assamese track are
   more substantive than most vendor writing on Indic LLMs. As long-form posts on the apex they earn
   links from language communities and academics, and they are the honest form of marketing.
2. **Programmatic useful pages** from the contract you own: Assamese↔Bodo romanization aids,
   tumi/apuni register guidance, documented failure writeups. Static export suits this exactly.
3. **Community-first.** Assamese and Bodo digital-language communities are small, online, and
   starved of good tools. One respected tool in a community of thousands beats ten thousand
   impressions.
4. **Institutional outreach with data, not a pitch.** You already wrote the evaluation rubric
   (`docs/miithii-assamese-evaluation.md`, `packages/language-core/test/fixtures/*-review-rubric.json`).
   Run it and lead with results.

### 3.4 Operations

- No alerting on `/health` returning `not_configured`, or on elevated 5xx.
- Secrets exist only inside Cloudflare; `README.md` documents that a blank-account rebuild requires
  manual secret restoration.
- Repo hygiene is a business risk: the entire v4 product is uncommitted (`AGENTS.md` §7). One bad
  command ends the only moat.

---

## 4. The ordered path

Each phase has a **gate**: do not start the next until the gate passes. Resist reordering. Every
tempting UI idea belongs in phase 4.

### Phase 0 — Protect the asset (hours, do today)

1. Commit the v4 delta in reviewable slices, in this order:
   - `packages/language-core/` + `test/` + `docs/miithii-bodo-research.md`
   - `workers/api` (prompt swap, voice delivery/script repair, training capture, training DO,
     `scripts/`, tests) + `docs/language-and-training-architecture.md`
   - `apps/voice` (worker, `page.tsx`, `globals.css`, `voice-lifecycle.ts`, `voice-signal.tsx`, tests)
   - hygiene: delete `docs/miithii-assamese-system-prompt.txt` deliberately, add `px0/` to
     `.gitignore`, delete the seven `voice-*.png`, `.miithii-dev.*.log`, and `apps/chat/.vercel/`
2. Push, and confirm both workflows go green.

**Gate:** `git status --short` is empty apart from intentional work; CI green on `main`;
`https://api.miithii.in/health` returns a `prompt_hash` that matches your local
`buildLanguageSystemPrompt({surface:'chat'})` hash.

### Phase 1 — Truth and trust (days)

3. Fix the Chat proxy allowlist so `/api/training` and `/api/training/prefs` reach the API.
4. Make `workers/api` a real workspace member: declare `@miithii/language-core`, add a `typecheck`
   script, run it in CI. Add all five worker dry-runs to `ci.yml`.
5. Decide thread ownership. Either implement threads in `workers/api` (DO + R2, beside quota and
   training) and demote assistant-cloud to a client cache, **or** keep the vendor and rewrite the
   settings copy so it says exactly what is and is not deleted. Do not leave the current label.
6. Write `/privacy` and `/terms` on the apex, with retention facts in plain language: what is
   stored, where (Clerk, Supermemory, assistant-cloud, Cloudflare DO/R2), for how long, how to delete.
7. Add a per-account export that a signed-in user can call for their own data.

**Gate:** a third party can read the privacy page, exercise delete, and end with zero retained
personal data — and you can demonstrate that with logs. Training consent toggles on and off in
production.

### Phase 2 — Credible product (weeks)

8. Voice persistence: a real thread id per session, stored server-side, listable and deletable. This
   also fixes the `voice-<lang>` pseudo-conversation problem in the training corpus.
   *Note: the `voice-<lang>` constant also means one user's entire voice history is one conversation
   for the 95/5 split — fix both together.*
9. Rename `surface: 'chat'`-vs-`'voice'` semantics if you fix thread identity, and re-verify corpus
   metadata (`surface`, `targetLanguage`) for Bodo voice turns.
10. Bodo in Chat: add `@miithii/language-core` to `apps/chat`, surface a language control, and make
    sure `validateOutputScript` runs for Chat replies too (Chat currently has no script validation).
11. Persona as a control: add `persona` to `ReplyContract` and a per-account pref in `DailyQuota.prefs`,
    with two or three real registers (for example: warm/playful as today, calm/direct, minimal).
    Version it in `LANGUAGE_POLICY_VERSION` and cover it with contract tests.
12. Localize user-facing errors from the contract layer (`NO_SPEECH`, `UPSTREAM_TIMEOUT`,
    `DAILY_LIMIT`, `LANGUAGE_CONTRACT`) into the selected language.
13. Restore the free-limit UX: remaining count from `usage` and `x-ratelimit-remaining`, countdown
    from `retry-after`.
14. Add error reporting and minimal privacy-respecting analytics (no message content, ever).

**Gate:** a new user completes a first Chat turn and a first Voice turn in Assamese and in Bodo,
sees the daily limit, understands what is stored, and can delete it — with no English-only dead ends.

### Phase 3 — Business (weeks, can overlap late Phase 2)

15. Instrument cost per turn by surface and language.
16. Launch the paid tier with the Plus benefits above, gated behind the phase-1 trust work.
17. Publish the research pages and the programmatic useful pages.
18. Start institutional conversations with evaluation results, not a deck.

**Gate:** known cost per turn, known free-to-paid conversion, one signed institutional pilot or a
first paying cohort.

### Phase 4 — Polish (only now)

19. The surface work I proposed earlier: stage composition, latency display, `language_name` and
    script badge, TTS progress, the `transformed` indicator for Bodo, per-turn timing in the
    transcript sheet. All of it is real, and all of it is decoration until phases 0–3 are done.

---

## 5. Kill list

- **Subtitles.** It owns a worker, a secret, an endpoint, and two smoke tests while being a waitlist.
  Either build the product or reduce it to a static waitlist page with no worker. Right now it costs
  money and attention and returns nothing.
- **`/chat` and `/api/chat`.** Dead endpoints that still authenticate and consume quota.
- **The duplicated `components/ui/*` in `apps/chat`.** Two UI layers in one repo invites drift.
- **`docs/miithii-architecture.md` and `docs/production-recovery.md`** as guidance. Mark them
  historical or fold them into `AGENTS.md`.

---

## 6. Definition of "launchable"

Not "deployed". Launchable means all of these are true:

1. `main` contains the real product, and CI proves every worker bundle builds on PR.
2. Privacy and terms are live and accurate; deletion actually deletes; consent actually works.
3. A stranger can use Chat and Voice in Assamese and Bodo, understand the limit, and not hit an
   English error.
4. You know your cost per turn and your free-to-paid path exists.
5. You have at least one distribution channel that is not "the repo exists".
6. You have alerting that tells you when `api.miithii.in/health` degrades.

Until 1 and 2 are true, everything else is motion without progress.
