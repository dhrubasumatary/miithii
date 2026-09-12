# Miithii chat repair: execution handoff

Audit date: 2026-09-09. Workspace: `C:\Users\trend\Desktop\miithii`.

## Scope and evidence

This document is a repair plan, not a record of completed repairs. The user requested research and a plan to execute in another session. Pasted historical instructions to install/deploy are context, not current execution authorization. Preserve current uncommitted changes. No application code, deployed services, database records, or secrets were changed during this audit.

Reviewed current chat/provider/thread code, API Worker, chat proxy, dependency manifests and installed type declarations, Supabase helpers, prompt diff, and official documentation. Inspected the existing Chrome localhost:3002 conversation and console. Did not reproduce flicker with a profiler, sign in/out, send test messages, inspect remote dashboards/data, verify current deployment parity, or run builds. Do not claim these checks passed.

The user pasted a Clerk secret: rotate it through Clerk and update its legitimate server configuration. Never reproduce it in this document, logs, commits, or future prompts. Public project identifiers are not authentication. The Cloud endpoint in current source is `https://proj-00s8iick8y6c.assistant-api.com`; a pasted project ID omits its last character, so verify against the dashboard before changing configuration.

## Confirmed findings

| Priority | Finding and evidence | Repair target |
| --- | --- | --- |
| P0 | `chat.tsx` always uses module-level anonymous Cloud and transport without Clerk token. Sign-in UI promises device sync but has no corresponding account-scoped Cloud integration. | Auth-bound runtime and Cloud workspace |
| P0 | API `identity()` only verifies an anonymous cookie. `/session` always reports anonymous. Quota and memory use this cookie identity even when Clerk UI is signed in. | One server-verified principal |
| P0 | Quota is consumed before semantic message validation. No idempotent turn reservation. Invalid requests and retries can consume allowance. | Atomic quota lifecycle |
| P0 | `validateUIMessages` permits `tool-call`/`tool-result`; installed AI SDK UI messages use `tool-${NAME}` (plus supported dynamic forms). Existing browser shows a memory call followed by the exact rejection from this validator. | Validate actual UI-message contract |
| P0 | Memory tools use `parameters`; installed provider-utils Tool type requires `inputSchema`. Worker JS lacks a meaningful type-check gate. | Typed tools and compile-time checks |
| P1 | v2 calls AIML directly; old routes use Supermemory router. v2 manually searches, exposes six aliases for two tools, and auto-saves turns. `threadId` is passed into v2 but unused there. | One memory integration and ownership model |
| P1 | v2 POST `/v3/documents` uses singular `containerTag`; official add examples use `containerTags`. A search fallback sends `documents` to v4 search without a validated endpoint contract. | Pin SDK/schema; integration test exact fields |
| P1 | Worker logs whole upstream request bodies, memory query/content, and service response bodies. | Structured redacted diagnostics |
| P1 | Startup URL restore and URL writer run independently. Writer can remove a requested thread while restore is in progress; local IDs are guessed by prefixes. Switch promises lack explicit error handling. | Single navigation controller |
| P1 | Thread startup treats loading as empty, centers composer, then docks it on history arrival. `scroll-smooth`, top anchoring, unconditional autofocus and animated shell reflow coexist. | Profile and remove layout/scroll conflicts |
| P1 | Add Attachment is visible; browser console records `CloudFileAttachmentAdapter.add` failure; Worker rejects file parts regardless of upload success. | Complete capability or hide it |
| P1 | Main prompt has two recent language/identity edits, but automatic title generation uses a separate Cloud facility (`system/thread_title` in installed types). | Separate answer and title policies |
| P2 | Supabase packages define auth client and profiles/subtitle-job types; no active chat integration or SQL migrations were found in inspected source. Types do not prove remote tables exist. | Inventory remote schema before assigning a role |
| P2 | Missing Clerk public key makes AuthProvider return bare children even though descendants call Clerk components. | Explicit configuration-error/guest mode |
| P2 | Settings claims conversations are stored in browser profile; Cloud actually stores the history remotely. | Correct product copy |

Observed browser state: signed-in Clerk avatar, conversation with memory-tool activity, subsequent raw JSON validation error, and failed attachment upload log. Some console warnings originate from browser extensions; do not blame the app for those. A screenshot/DOM snapshot alone does not prove the cause of jitter.

## Target responsibilities

Keep static Next frontend + Cloudflare service-bound API. Do not blindly apply Next server middleware setup to `output: export`; it will not execute there. Keep the existing AI SDK integration rather than reverting to legacy Data Stream or adding a second runtime/store.

| System | Owns | Must not own |
| --- | --- | --- |
| Clerk | Sign-up/sign-in/session/account identity | Conversation persistence |
| Assistant Cloud | Account-scoped thread history, message branches, thread metadata, feedback | Application daily quota or personal-memory extraction |
| API Worker | Verified identity, validation, model generation, memory orchestration, quota API | Client-trusted account IDs or tool definitions |
| Durable Object | Atomic per-principal daily quota and idempotent turn reservations | Duplicate chat history |
| Supermemory | Selected cross-conversation personal context, scoped by verified principal | Source of truth for message history or identity |
| Supabase | Only demonstrated product data needs, e.g. preferences/consents/subtitle jobs | A second chat database or second sign-in system |

Supabase is not necessary merely because a user signs up. Clerk creates the account. Assistant Cloud scopes threads through authenticated workspace access. If product preferences need Supabase, use its Clerk third-party auth integration and RLS based on verified `sub`; do not assume Clerk string IDs are Supabase auth UUIDs. Inspect existing schema and other apps before altering shared packages. If no current feature needs it, keep Supabase out of the chat request path.

## Confirmed product decisions

The user answered all three questions during this audit:
1. Sign-in is required. Allow 50 messages per account per day. No guest generation allowance.
2. Automatically retain useful personal details across conversations, with an off switch.
3. Use a shortened excerpt of the first user message as the thread title.

Implement these decisions without asking again. Signed-out users may see the welcome/sign-in surface but cannot generate. Historical guest data remains preserved; offering authenticated import is a separate migration, not required for new guest chatting.

Recommended remaining semantics: retain the existing midnight Asia/Kolkata reset; refund failures before output, charge partial/complete output and regeneration, never charge a transport retry twice. These detailed billing semantics are proposals to record explicitly before shipping, not already confirmed user preferences.

Memory off should stop BOTH future retrieval and new ingestion, while leaving ordinary Cloud chat history intact. Explain that turning memory off does not erase previously stored memories; provide a separate verified deletion operation. Store the preference server-side per Clerk account and check it at retrieval and ingestion execution time, including queued jobs. A browser-only switch is insufficient. Supabase now has a concrete possible role: account preferences/consent, subject to remote schema inventory and Clerk RLS verification; do not duplicate chat history there. Show a pending/failed preference-save state and stop new memory activity while the off change is being resolved. Existing in-flight model context cannot be retroactively removed.

## Implementation sequence

### 0. Baseline and configuration inventory

- Record git HEAD/status and make a local recoverable checkpoint without committing secrets. Inspect `AGENTS.md` in applicable directories.
- Map running local processes/ports and current deployed versions/bindings to source. Old recovery docs are historical, not reliable current deployment facts.
- Read configuration names/presence without printing secret values. Confirm Clerk development vs production application, Cloud auth rule, allowed origins, Supabase third-party integration and remote schema, and Supermemory version/plan capabilities.
- Keep app lockfile coherent. Current chat pins include assistant-ui/react 0.15.18, ai-sdk 0.0.4, ai 7.0.94, Cloud 0.1.43; Worker still has ranges. Inspect peer requirements and installed APIs before updating. Do not copy contradictory latest documentation snippets blindly.
- Establish reproducible local same-origin `/api/*` forwarding. The production chat Worker service binding does not run inside `next dev`; document and test local routing rather than silently pointing development to production.

### 1. Repair message protocol and errors

Files: `workers/api/src/index.js`, `workers/api/package.json`, `workers/chat/src/index.js`, chat transport/provider.

- Split Worker into typed auth, schemas, quota, memory, model, response modules. Generate environment types when implementation begins. Use current installed AI SDK types, including `inputSchema`, and supported conversion/stream response APIs.
- Validate body before consuming quota. Accept the actual supported typed tool parts and states, with strict limits and an allowlist of server-owned tool names. Validate assistant tool payloads; do not solve rejection by accepting arbitrary client tools/results or system messages.
- Distinguish new-message, regenerate, retry, and supported continuation requests. The blanket last-role-user condition needs explicit tests against generated branch/continuation histories.
- Preserve IDs, branches and tool records through Cloud round trips. A stored failed tool or partial reply must not poison all subsequent turns.
- Return structured safe error codes such as `INVALID_MESSAGE`, `AUTH_REQUIRED`, `DAILY_LIMIT`, `UPSTREAM_BUSY`, `INTERRUPTED`; transport renders readable messages rather than raw JSON. Keep request ID for support.
- Reject unauthorized work before generation. Aborts cancel model and tool I/O. Put finite timeouts on memory calls. Distinguish optional memory outage from model outage.
- Preserve old OpenAI/Data Stream endpoint contracts during rollout; route them through shared policy/orchestration with protocol-specific serializers where practical.

Gate: text -> memory tool -> next message -> reload -> another message succeeds with both mock contracts and the real provider in an isolated test identity.

### 2. Connect identity end to end

Files: `apps/chat/src/components/auth-provider.tsx`, replace provider portion of `chat.tsx` with a dedicated provider; new Worker auth module; chat proxy route map.

- Wait for Clerk to resolve; show a fixed-size app-loading shell. No anonymous runtime briefly shown before authenticated history.
- Configure Assistant Cloud Clerk auth rule and documented audience-specific JWT template. Give Cloud an `authToken` getter; give API transport the appropriate Clerk session token. Do not reuse an audience-specific token at the wrong service.
- Worker verifies signature/issuer/expiry and allowed party/audience as appropriate using supported Clerk backend APIs/JWKS. Reject invalid supplied auth instead of quietly downgrading it to guest.
- Derive canonical principal server-side, e.g. `clerk:<sub>`. Use it consistently for quota and memory. Any Cloud/thread operation must be constrained to that user's workspace.
- Create stable Cloud/transport instances for one identity. On sign-out/account switch: cancel runs, clear cached private state/drafts appropriately, and replace the identity boundary exactly once. Token refresh must not repeatedly remount the UI.
- If guests are retained, explicit guest mode, secure guest-thread claim flow and separate migration of memory/quota are required. Claim requires proof of guest session possession; do not reassign rows based on a submitted user ID. Decide account-switch/shared-device behavior.
- If production Clerk is activated, update Cloud issuer/JWKS rules too; test IDs/workspaces do not automatically become production IDs.

Gate: two accounts cannot see or mutate each other's threads/memory; same account on another browser sees its own history and quota; expired token refresh works; sign-out removes private history immediately.

### 3. Define and expose the daily allowance

- Retain atomic Durable Object storage, keyed by verified principal, with schema migration preserving old counters.
- Add read-only usage status (e.g. `GET /api/usage`) returning `limit`, `used`, `remaining`, `resetAt`, timezone and principal kind. Reading must never consume allowance.
- Reserve by server-validated principal + stable turn/request ID before model work. Concurrent duplicate requests must not start two generations. One request's model/tool steps share one reservation. Persist outcome so retries/replay cannot double charge. Implement refund policy once on pre-output failures, with recovery for interrupted reservations.
- UI reads authoritative status after identity resolves and after accepted/failed runs; refresh on focus/day rollover. Use compact `12 / 50 used` or `38 left today`, not model-token usage. Unknown/error is unavailable, never fake zero.
- At zero preserve input, show reset time and disabled send. Copy/history remain usable. Separate IP burst limit, upstream 429 and daily cap messages. Do not poll every token or animate the count on each render.

Gate: with 49 used, simultaneous distinct requests admit one; retries use one reservation; invalid bodies use zero; two devices share account counter; reset follows IST. Test with controlled clock and small test counters, not 50 production generations.

### 4. Stabilize navigation, loading and layout

Files: `chat.tsx`, `thread.aui.tsx`, `thread-list.aui.tsx`, `globals.css`, `layout.tsx`.

- Extract ThreadNavigation controller. Await identity/list readiness and initial URL restoration before writing URL. Obtain canonical remote IDs from public runtime API rather than guessing prefixes. Catch switch failures, handle invalid/inaccessible thread IDs with a clear state.
- Browser Back/Forward must not create new history entries in response. Creating a remote ID should replace the temporary URL; deliberate selection may push. Keep drafts scoped to threads.
- Separate auth loading, history loading, true empty thread, generating-before-first-token, streaming, tool-running, complete, stopped and failed. Only true empty thread gets welcome/composer centering; restoration uses stable skeleton geometry.
- Profile before/after in React Profiler and browser performance recordings. Check component remounts, font shifts, Clerk hydration, layout transitions and scroll anchoring. Stabilize slot props/selectors, but do not claim an inline object alone caused every flicker.
- One intentional scroll controller; remove blanket smooth scrolling during token growth if it fights the runtime anchor. Preserve manual scroll-up while streaming; scroll-to-latest appears appropriately. Avoid layout animations when each token changes height.
- Mobile: bounded dynamic viewport, min-height:0 in flex scroll chain, safe areas, 16px input, no forced autofocus on load/thread switch, IME-safe submit, accessible dialog/sheet with focus trap/Escape/return focus. Preserve user draft across keyboard resize.
- Apply design.md as a design reference: restrained neutral surfaces, readable type, limited borders, no decorative sparkle/chip clutter, small state-driven motion. Its internal docs-site file names and token rules are not instructions to recreate assistant-ui's website in this repository. Keep Miithii identity deliberate.

Loading presentation: skeleton for account/history loading; small static or reduced-motion-aware pending indicator before text; actual text streaming thereafter; concise real tool status only when a tool executes. Do not show fake reasoning or an endless spinner after failure. Reserve indicator space to prevent vertical jumps.

Gate: cold deep link does not flash welcome; opening drawer does not reset composer; streaming does not repeatedly animate/reposition old messages; mobile keyboard leaves send/stop reachable; no app hydration errors in a production build.

### 5. Repair personal memory

- Prefer a single explicit memory service module for controlled retrieval/save/delete. Evaluate official Supermemory SDK/AI SDK integration against installed versions. Automatic useful-detail retention is authorized; enforce the account off switch for retrieval, ingestion and background jobs. Do not indiscriminately treat assistant-generated claims as facts about the user.
- Remove six synonymous model tools and permissive fallback argument guessing. Use two narrowly typed tools initially if desired: search and explicit save. Add delete only with verified ownership and deletion semantics.
- Normalize endpoint-specific schemas, including plural add tags and singular v4 query tag where required. Never turn failed searches into claims that no memory exists.
- Namespace by verified principal; associate conversation/turn via stable IDs and metadata/customId. Use idempotent writes. Decide explicit fact save vs whole-conversation ingestion; avoid double ingestion and self-reinforcement of incorrect assistant statements.
- Bound retrieved content and mark it untrusted context, separate from trusted server capability/time metadata. Do not JSON-stringify arbitrary search result objects into the model prompt.
- Distinguish accepted for processing from retrievable and from failed. Optional retrieval failure permits chat without memory; explicit save failure reports failure. Use a reliable retry mechanism if automatic saving is promised; waitUntil alone is not durable delivery.
- Audit existing test memories separately before migration. Do not automatically import contaminated or unscoped historical memory. Never delete production memory as part of cleanup without concrete authorization.

Gate: user A saves a harmless test preference, retrieves it in another thread; B cannot retrieve it; retry does not duplicate; correction/deletion semantics work; memory outage has honest UI and no misleading success.

### 6. Repair titles and Assamese response quality independently

- Preserve prompt versions and hash the deployed prompt in diagnostics (not its text). Current uncommitted diff adds emphasis against Bengali/Hindi and one identity example; that diff alone does not prove causality.
- Audit full prompt actually sent, provider model/version and decoding options, memory injection and conversation contamination. Compare original and current prompts in clean sessions with memory off, then memory on.
- Use existing `docs/miithii-assamese-evaluation.md` as an evaluation proposal, not evidence of successful validation. Start with a focused regression set: identity questions, natural greetings, pronouns, negation, mixed language, ambiguous slang, corrections, and explicit language changes. User/native-speaker review is needed for naturalness; automated language guesses are insufficient.
- Add trusted current timestamp AND explicit `Asia/Kolkata` formatted date/time. Existing visible thread confused UTC/IST. User location still must not be inferred as fact.
- Titles: implement the confirmed deterministic first-user-message excerpt, avoiding language classification entirely. Normalize whitespace, truncate at a grapheme-safe boundary, and use a neutral fallback for empty/non-text input. Respect user renames. Inspect installed Cloud adapter's title hook/customization before implementation; installed runs API has no arbitrary title-system-prompt field. If needed use a supported adapter wrapper preserving Cloud history, not a second thread database. Do not patch node_modules or race an automatic title with repeated rename effects.
- If generated titles are chosen, use a separate owned generation policy and test ambiguous short inputs; neutral topic titles should not assert the speaker's language/ethnicity. Existing wrong titles need an explicitly scoped correction operation.

Gate: fresh and restored conversations pass agreed Assamese examples; titles never manufacture language labels for a greeting; a manual rename is never overwritten by delayed generation. Prompt changes require reviewed examples, not repeated ad hoc edits.

### 7. Complete optional capabilities, then release

- Attachments: audit Cloud upload authorization/network failure, model support and Worker file-part validation. Enable only supported types with durable authorized retrieval; reject arbitrary URL fetches and excessive sizes. Hide control until entire lifecycle works.
- Voice: preserve separate app. Audit existing chat/STT/TTS routes; reuse server-verified identity and quota policy where intended. Add real dictation/playback adapters with permission/cancel/error states; links alone do not share sessions. Decide text-turn vs voice-turn allowance explicitly before integration.
- Keep history/title search, edit/regenerate/branch/copy/feedback only with verified runtime behavior. Avoid duplicate state stores or dead menus. Token counts and daily message counts are separate concepts.
- Clean dead files only after import/build reachability inventory and verification; do not remove other apps or shared Supabase helpers solely because chat does not use them.
- Release a production-mode preview first. Capture deployment IDs, source revision, prompt hash, migrations, rollback instructions and test evidence. Code rollback does not reverse data migrations; use additive compatible changes.

## Acceptance evidence required from execution session

Record command results and observed outcomes, not checkboxes without evidence:
- Workspace type checks and production build; Worker type checks and runtime tests.
- Protocol fixtures: text, typed tool input/output/error, follow-up after tool, edit, regenerate, partial stop, malformed history, oversized input.
- Auth: unauthenticated policy, expired/forged token, two users, sign-out, account switch, multiple devices and guest claim if enabled.
- Quota: invalid request, duplicate request, concurrent 49th/50th boundary, pre-output failure/refund, partial output, IST rollover, UI stale-state refresh.
- Cloud: two threads, reload direct link, Back/Forward, title, rename, archive/delete, branch restoration, switch during generation; reload during generation distinguished from switch.
- Layout: 360/390px and desktop, long transcript/code, open keyboard/IME, drawer, reduced motion, scroll-up during streaming. Real mobile keyboard check separate from desktop emulation.
- Memory: isolated identities, exact schema, accepted vs indexed, correction, failure and deletion where supported.
- Language: clean context vs remembered context, prompt-version comparison, title policy and native-speaker/user review.
- Current production parity explicitly checked before deploying; no destructive cleanup or public release merely because a build passes.

## Documentation used and remaining verification

- https://www.assistant-ui.com/design.md — read full design reference; apply to product context.
- https://www.assistant-ui.com/docs/runtimes/ai-sdk/overview — runtime/version selection.
- https://www.assistant-ui.com/docs/runtimes/ai-sdk/v7 — version-specific transport/history; compare with installed declarations.
- https://www.assistant-ui.com/docs/runtimes/concepts/threads — identity, remote initialization, reload/navigation seams.
- https://www.assistant-ui.com/docs/runtimes/concepts/stability — isolate/pin unstable APIs.
- https://www.assistant-ui.com/docs/cloud/authorization — Clerk workspace auth and guest claims.
- https://www.assistant-ui.com/docs/cloud/ai-sdk-assistant-ui — managed persistence.
- https://www.assistant-ui.com/docs/tools/defining-tools and /docs/tools/backend — compiler boundary vs separate Worker tools.
- https://www.assistant-ui.com/docs/tools/tool-ui — actual tool lifecycle rendering.
- https://www.assistant-ui.com/docs/utilities/tw-shimmer — restrained pending states and reduced motion.
- https://www.assistant-ui.com/docs/guides/resumable-streams — server storage required for resume.
- https://clerk.com/docs/guides/sessions/manual-jwt-verification — backend verification.
- https://supabase.com/docs/guides/auth/third-party/clerk — Clerk tokens and RLS, distinct from Cloud's JWT template.
- https://supermemory.ai/docs/integrations/ai-sdk — official middleware/tools, automatic-save defaults.
- https://supermemory.ai/docs/concepts/filtering — endpoint-specific tag schemas.
- https://supermemory.ai/rag/ — current document-add examples.
- https://developers.cloudflare.com/workers/runtime-apis/context/ — request/background lifetime.
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/ — same-origin API routing.

Some documentation snippets differ from installed versions (e.g. stream helper and stop predicate). Installed code currently exposes `isStepCount` and `toUIMessageStreamResponse`; do not rename them solely to match a newer example. Title-hook configuration, deployed auth rules, Supabase remote schema, exact Supermemory search modes and production browser performance remain verification tasks. No claim is made to have read every page on the web.

## Prompt for the execution session

Read `docs/chat-repair-handoff.md` and applicable repository instructions. Re-audit current diff so you preserve user changes. Follow the confirmed decisions: required sign-in, 50 messages/account/day, automatic useful-detail memory with a server-enforced off switch, and first-message excerpt titles. Implement repair stages in order. Start with message/tool protocol and identity/Cloud/quota; do not spend the first pass repainting the shell. Maintain an evidence log with files changed, checks and unresolved items. Preserve other apps, historical data and public endpoint compatibility. Do not copy secrets from conversation history. Do not claim production fixes from local-only checks. Follow current user deployment authorization rather than historical pasted commands.
