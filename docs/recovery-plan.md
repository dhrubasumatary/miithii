# Miithii recovery plan

Prepared 2026-09-16 from the working tree at `6b023e8` plus local changes.
This is an execution plan, not a claim that fixes have shipped.

## Outcome

A recoverable, reproducible release of Chat and Voice with working consent controls,
truthful deletion labels, tested language contracts, and a verified rollback procedure.
Pause new product features until steps 1–4 pass. Subtitles stays explicitly a waitlist.

## 1. Preserve the product before reorganizing it

- Inventory tracked changes and untracked product files. Review secrets and licenses before staging.
- Create a recovery branch and a reviewed checkpoint containing the complete product delta;
  preserve it in an approved private remote before splitting work. A branch alone does not save edits.
- Include language-core, training modules, Voice components/tests and supporting documents.
  Exclude credentials, vendor deployment metadata, screenshots, logs, px0 and scratch copies.
- Preserve unrelated local files outside the product checkout; do not delete them as cleanup.
- From the checkpoint, prepare dependency-ordered review slices: language contracts;
  API integration/training; Voice integration; Chat consent UI; CI and documentation.
  Keep inseparable changes together rather than creating broken intermediate commits.
- Verify a fresh checkout can bootstrap and run the checks. Record the checkpoint SHA.

Exit: product source survives loss of this checkout; recovery instructions are tested.

## 2. Fix broken behavior and data-control claims

- Forward exactly `/api/training/prefs` and `/api/training` through Chat. Keep operator
  export private to the API surface. Test GET/POST preferences and DELETE against the
  proxy, preserving authentication, methods, body, status and errors.
- Remove automatic production fallback from Voice development. Local API failure must
  produce a clear local error; any remote development target must be explicitly configured.
- Rename “Forget everything” to “Delete saved memories.” Explain that chat history and
  training contributions have separate controls. Report success only after server confirmation.
- Verify consent default, enable/disable, failed saves, contribution deletion, and an
  in-flight capture racing with deletion. Document the actual retention boundaries.
- Give each Voice conversation a unique ID with a defined reset/language-switch lifecycle.
  Preserve the ID across its turns and turnId across retries; test stale-turn cancellation.
  Treat existing collapsed corpus thread hashes as legacy data requiring separate handling;
  new IDs cannot repair historical grouping.

Exit: regression tests reproduce the old failures and pass after fixes; browser checks
confirm truthful controls on the same-origin Chat and Voice paths.

## 3. Make verification a release requirement

- Use one shared verification command in PR CI and deployment verification: typechecks,
  language tests, Voice tests, API tests, Chat proxy tests, static builds and all five
  Worker dry runs. Ensure deployment cannot bypass this gate for its exact source revision.
- Add scoped API type checking and a declared language-core dependency. Preserve the
  current supported build while adjusting the separate API installation/lockfile setup.
- Add safe smoke tests for forwarded routes: unauthenticated requests return API errors,
  never asset HTML. Use isolated test identities for authenticated stateful tests.
- Compare deployed prompt_hash with the expected hash for the release and record all
  Worker deployment versions. Establish the currently deployed baseline before release.
- Rehearse rollback through the workflow. Document partial-release recovery and Durable
  Object schema compatibility; do not assume rolling back Worker code rolls back data.
- Review the existing per-release R2 lifecycle mutation as a separate migration concern.

Exit: a failing contract/proxy test or any broken Worker bundle prevents deployment.

## 4. Ship a bounded stabilization release

- Run pnpm check, all Worker dry runs and a clean-checkout verification.
- Exercise Chat sign-in continuation, streaming, uploads, quota, memory and training controls.
- Exercise both Voice languages: permission denied, silence, interruption, language switch,
  reload, timeout, quota exhaustion, Bodo display conversion and one TTS request per turn.
- Deploy only through the production workflow. Verify health/hash, same-origin APIs and
  signed-in flows. Roll back on failed critical flows or sustained service errors.
- Update README/environment examples and the operating brief to the tested release.

Exit: release SHA, gate results, deployment versions, smoke results and rollback target
are recorded together. Production parity is verified, not inferred from local tests.

## 5. Improve architecture after stabilization

- Evaluate moving Voice provider orchestration into the API Worker with staged secret
  migration and client compatibility. Server-side secrets in a Worker are not by themselves
  a browser leak; consolidation should have a concrete operational benefit.
- Reduce repeated Voice account checks without weakening per-endpoint authorization.
- Investigate assistant-cloud capabilities and choose a supportable account-history
  deletion/export design before making broader deletion promises.
- Measure legacy endpoint usage before deprecating public paths.
- Add content-free latency/error metrics and speaker-reviewed Assamese/Bodo evaluations.
  Script validation alone does not establish language quality.

## Guardrails

No local production deploys, destructive cleanup, implicit production development traffic,
new language behavior, merged memory/training consent, or infrastructure migrations hidden
inside cleanup. Preserve static exports and existing per-language budgets. Product choices
about persistent Voice history, persona selection and additional languages remain separate.
