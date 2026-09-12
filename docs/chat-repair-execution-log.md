# Miithii chat repair: execution log

Execution date: 2026-09-09. Follows `docs/chat-repair-handoff.md`. This log
records what was actually changed and checked in this session, what was
deliberately deferred, and what still needs verification before a production
release. It preserves the user's prior uncommitted work; nothing here reverts
that work, it completes and corrects it.

## Files changed

- `workers/api/src/index.js` — rewritten (same file, not a new architecture):
  - Removed the anonymous `__Host-miithii_anon` cookie identity system
    (`identity()`, `COOKIE`, `LIFETIME`). Sign-in is required for every route
    that generates, reads usage, or touches memory; there is no guest
    identity or guest quota left in the code.
  - `requireIdentity`/`verifyClerkToken` (previously defined but never
    called) are now wired into `fetch()`. Every chat, usage, and memory route
    calls `requireIdentity` before doing any work; the derived principal is
    always `clerk:<sub>`.
  - Fixed request ordering: message/body validation now runs **before**
    quota is consumed (previously quota was charged first, so a malformed
    request could burn a user's daily allowance).
  - `DailyQuota` Durable Object extended in place (same class name, additive
    `CREATE TABLE IF NOT EXISTS`, no migration needed): added an idempotent
    `consume(turnId)` keyed by the user message id, so retries/duplicate
    submissions replay the original allow/deny decision instead of double
    charging; added `getPrefs()`/`setMemoryEnabled()` for the per-account
    memory preference; kept `status()` read-only for usage display.
  - New routes: `GET /api/usage` (read-only quota status), `GET`/`POST
    /api/memory/prefs` (read/set the memory on/off preference), `DELETE
    /api/memory` (explicit "forget everything" — lists and bulk-deletes every
    Supermemory document scoped to the account). Removed `/session`, which
    the frontend never called and which only existed to issue the anonymous
    cookie.
  - Memory: removed the redundant `memory_save` tool. Automatic per-turn
    ingestion (`onFinish`) is the single "automatically remember useful
    details" mechanism, so a turn is never ingested twice. `memory_search`
    remains for on-demand lookups beyond the proactively injected top-3
    matches. Both retrieval and ingestion are now gated by the account's
    memory preference, front and back (the legacy `/api/chat` OpenAI-shaped
    endpoint stops sending Supermemory routing headers entirely when memory
    is off, instead of relying on prompt text alone).
  - Structured error codes (`AUTH_REQUIRED`, `INVALID_MESSAGE`,
    `DAILY_LIMIT`, `UPSTREAM_BUSY`, `UPSTREAM_TIMEOUT`, `NOT_FOUND`,
    `METHOD_NOT_ALLOWED`, `SERVICE_UNAVAILABLE`, `ORIGIN_NOT_ALLOWED`,
    `INTERNAL`) are now included on every error response, not just message
    text.
  - Fixed a real CORS bug: preflight only allowed the `content-type` header,
    which would have rejected every `Authorization: Bearer …` request from a
    real browser. Now allows `content-type, authorization` and `DELETE`.
  - Added a deployed-prompt hash (`x-prompt-hash` response header and
    `/health` field) — a short SHA-256 prefix, never the prompt text — so a
    future regression can be tied to a specific prompt revision without
    leaking it.
  - Added explicit `Asia/Kolkata`-formatted timestamps (`now_ist`) to the
    trusted server context for both `/api/chat` and `/api/chat/v2`, addressing
    the UTC/IST confusion noted in the audit.
  - Small JWKS cache (10 minutes) so authenticated requests don't refetch
    Clerk's public keys every time.
- `workers/chat/src/index.js` — forwards the new `/api/usage`,
  `/api/memory`, `/api/memory/prefs` paths to the API worker; dropped the
  `/session` forward.
- `apps/chat/src/components/chat.tsx`:
  - `ThreadTitleSync`: implements the confirmed decision — a thread's title
    is set once, deterministically, from a grapheme-safe, whitespace-normalized
    excerpt of the first user message (`excerptTitle`), the moment that
    message lands. It never touches a thread that already has any title, so
    a manual rename is never overwritten. This is a best-effort mitigation
    for Cloud's own server-side auto-titling (`system/thread_title`): by the
    time any such job could run, an explicit title already exists. This
    residual risk is **not verified against the live Cloud backend** in this
    session — see "Not verified" below.
  - Wired `useAccount()` (new hook) into `ChatShell`/`SettingsDialog`:
    Settings now shows the real daily usage (`GET /api/usage`) instead of a
    static "50 messages per day" string, refreshing after every completed
    run and on tab focus. Added a real memory on/off toggle
    (`GET`/`POST /api/memory/prefs`) with pending/error states, and a
    "Forget everything" action (`DELETE /api/memory`) with a two-click
    confirm, matching the confirmed semantics: turning memory off stops
    future remembering/lookup but does not erase history; deletion is a
    separate, explicit action.
  - Removed the dead `credentials: "include"` from the chat transport (no
    cookies are issued anymore) and fixed the `AssistantChatTransport` typing
    (see dependency fix below).
- `apps/chat/src/components/thread.aui.tsx` /
  `apps/chat/src/components/assistant-ui/elements/attachment.aui.tsx`:
  removed the composer's attachment drag-and-drop zone and "Add Attachment"
  button (`ComposerAddAttachment`, `ComposerAttachments`, and the drop zone
  wrapper deleted as dead code). The Worker rejects file parts unconditionally
  today, so the control could never succeed; historical/received attachments
  still render if any exist (`UserMessageAttachments` kept).
- `apps/chat/src/hooks/use-account.ts` — new. Client hook for
  `/api/usage` and `/api/memory/prefs`, authenticated with the same
  `miithii-api` Clerk JWT template already used for chat.
- `pnpm-workspace.yaml` — added `overrides: { ai: 7.0.94 }`. The installed
  tree had **two** copies of `ai` (7.0.94 direct, 7.0.93 pulled in by
  `@assistant-ui/ai-sdk`'s looser range), which made `AssistantChatTransport`'s
  generic `UIMessage` a structurally distinct, incompatible type across the
  two copies. This was a real, reproducible type error (confirmed with
  `tsc --noEmit`), not a stale-cache artifact. After the override + reinstall
  there is exactly one `ai` in the lockfile.

## Deliberately not done (and why)

- **Supabase for memory preferences**: the handoff flagged Supabase as a
  possible home for account preferences, subject to remote schema inventory.
  Per this session's instruction to prefer Cloudflare for production and
  because no chat-facing Supabase schema exists today, the memory preference
  and quota both live in the same Cloudflare Durable Object, keyed by the
  verified Clerk principal. This avoids introducing a second datastore and a
  second Clerk↔auth integration for a single boolean.
- **Voice-turn/text-turn quota unification, attachment upload path,
  Supabase inventory, prompt/title A/B evaluation with native speakers**:
  out of scope for this pass; each requires either a second app's
  cooperation, real credentials/live testing, or human language review that
  cannot be done from this session.
- **Assamese prompt content changes**: none made. The handoff explicitly
  warns against ad hoc prompt edits without a reviewed evaluation set: the
  existing prompt (already reverted to original once in this repo's history)
  was left untouched.

- `apps/chat/src/components/auth-provider.tsx` — updated to render a
  graceful setup required screen when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is
  missing or blank, preventing descendant Clerk hooks from crashing with
  unhandled context errors (addressing P2 from handoff).
- `workers/api/src/validators.js` — extracted pure validation logic
  (`HttpError`, `readJson`, `validateBody`, `validateUIMessages`,
  `isServerToolPart`, constants) into a dedicated module for modularity and
  isolated testability.
- `workers/api/test-protocol.mjs` — automated protocol test suite exercising
  the UI message format, memory search tool call & output records, unauthorized
  tool and attachment rejections, length bounds, and legacy body validation.
  Wired as `"test": "node test-protocol.mjs"` in `workers/api/package.json`.

## Verified in this session

- `apps/chat`: `pnpm typecheck` (`tsc --noEmit`) — clean (exit code 0).
- `apps/chat`: `pnpm build` (`next build`, static export) — succeeds (exit code 0).
- `workers/api`: `pnpm test` (`node test-protocol.mjs`) — 10 fixture suites pass.
- `workers/api`: `wrangler deploy --dry-run --outdir dist` — bundles
  successfully, bindings resolve (`DAILY_QUOTA`, `CHAT_RATE_LIMIT`, vars).
- Manual re-read of the full rewritten `workers/api/src/index.js` against
  the pre-existing behavior to confirm no protocol/quota/memory regression
  for the paths that were already working (message validation, streaming,
  Supermemory tag schemas, which were already correct before this session).

## Not verified (needs a live pass before production)

- No real Clerk token was exchanged against a live Clerk instance; JWKS
  verification logic is implemented per Clerk's documented backend
  verification flow but not exercised end-to-end here.
- No live Supermemory calls were made (search, save, list, bulk delete);
  the bulk-delete implementation is based on Supermemory's documented
  `/v3/documents/list` and `/v3/documents/bulk` contracts, not a live test.
- Whether Assistant Cloud auto-titles new threads server-side, and whether
  it skips that when a title is already present, is unverified — this can
  only be confirmed by watching real thread titles after a deploy.
- Two-account isolation, concurrent-request idempotency, and IST rollover
  were reasoned through but not exercised against the deployed Durable
  Object with real concurrent requests.
- `CLERK_ISSUER` / `CLERK_AUDIENCE` / `CLERK_JWKS_URL` must be set on the
  `miithii-api` Worker (via `wrangler secret put` or dashboard vars) before
  any of this works in production; they were not present in the inspected
  `wrangler.jsonc`. `COOKIE_SIGNING_SECRET` is no longer read by the code and
  can be removed from the Worker's secrets once confirmed unused elsewhere.

## Suggested next steps

1. Configure `CLERK_ISSUER`/`CLERK_AUDIENCE` (and the Clerk JWT templates
   `miithii-api` and `assistant-ui`) for both Clerk dev and prod instances,
   and confirm Assistant Cloud's own Clerk auth rule points at the same
   instance.
2. Deploy to a preview/staging environment and run the acceptance gates
   listed in `docs/chat-repair-handoff.md` (`## Acceptance evidence required
   from execution session`) with two real test accounts.
3. Watch real thread titles after the first few conversations to confirm
   Cloud does not overwrite the excerpt title with its own generated one.
4. Decide and implement Supabase's role (if any) only after inventorying the
   remote schema, per the handoff's explicit caution.
