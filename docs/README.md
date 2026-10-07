# Miithii docs

This directory contains a developer guide, supporting research, and captured evidence. None
overrides the live repository.

**GitHub handoff — 7 October 2026:** the current LiveKit source, constraints, and indexed
status/research documents are published together for `main` through PR #3.
Historical screenshots/XML under `audit-2026-09-29` are omitted from this handoff;
private `.tmp` provider/device captures remain local. Their mentions are evidence references,
not downloadable files in the handoff.

## Current authority

`developer-guide.md` is the developer-facing map of the current source, setup, and known limits.
It was reviewed against the local working tree on 7 October 2026 and includes a publication
caveat for uncommitted code. It is maintained documentation, not a replacement for source/tests
or an architectural handoff authorizing retired code to return. The root `README.md` is the
GitHub entry point; this file remains the only documentation index.

`current-work.md` is the user-requested active continuation status. It records verified work,
blockers and next actions; it does not override repository invariants or current source.

For any implementation work, use these sources in this order:

1. `AGENTS.md` — current product/runtime invariants and the active tree.
2. Current source and tests under `apps/mobile`, `services/agent`, `packages/language-packs`, and
   `packages/language-core-ts`.
3. `services/agent/README.md` — operational notes for the current LiveKit agent.
4. `docs/developer-guide.md` as a source-oriented explanation; other indexed files as status,
   research, or evidence according to their descriptions here.

UI agents should also read `apps/mobile/AGENTS.md` before changing the Android surface. It exists
specifically to prevent provider codes, deleted language-core concepts, or duplicated language data
from leaking back into components.

The retired `packages/language-core` package, old voice-contract JSON shape, Pipecat/SmallWebRTC,
Cloudflare realtime/media paths, old Modal voice runtimes, and old Premium/ElevenLabs experiments
must not be restored from documentation or Git history.

## Current language system

- Canonical language ids are `asm` and `brx`.
- Language data lives in `packages/language-packs` and compiles into one hash-verified artifact.
- Mobile reads the registry and segmentation data through the thin `packages/language-core-ts`
  package.
- The Python agent reads the same compiled artifact and owns runtime enforcement logic.
- Provider language codes such as Bodhan `as` and Sarvam `as-IN` are provider-specific values,
  never Miithii language identities.
- Language packs remain draft until native review approves production language content.

## Files kept here

`miithii-mobile-ui.md` is the implementation record for the Android face: the current surface,
generation-is-not-speech invariant, dated device/provider observations, and remaining acceptance.
Read it before changing visuals. Historical observations do not certify the revised UI; final
builds and dated phone checks are recorded there alongside the remaining sensory acceptance.

`prompt-audit-2026-10-01.md` records the six prompt audits, implemented checks, and unresolved
provider/native-review/device acceptance gates. The task briefs and obsolete experience design
record were retired after these findings were recorded.

The Assamese/Bodo research and evaluation notes are retained as research inputs for future native
review. They may contain dated citations or historical discussion; they do not describe the active
runtime unless the current source agrees.

The `audit-2026-09-29` images/XML files are frozen evidence from that date. They are not current UI
specifications and should not be used to reconstruct deleted product behavior.

Old handoffs, fresh-build plans, and architecture research briefs were intentionally removed on
2026-09-30 because they described superseded code and repeatedly caused agents to resurrect retired
systems.
