# Miithii

**Developer handoff — 7 October 2026.** The `codex/developer-handoff` branch contains the current
LiveKit source, language packs, Android app, and Cloudflare download site. GitHub's `main` still
contains the retired runtime. Clone the handoff branch to use the setup commands below.

Miithii is an Android voice companion for Assamese and Bodo speakers. The app sends microphone
audio through LiveKit to a Python agent, which transcribes speech, generates a reply, checks it
against the selected language policy, and synthesizes speech back to the phone.

This is a project under active development. Both language packs are draft, the current token
endpoint has no user authentication, and phone acceptance is incomplete. A passing test suite
does not establish pronunciation, conversational quality, or production readiness.

The project was developed through conversations with Codex. These documents explain the code
so another developer can work on it without that conversation history.

## Start here

- [Android download](https://voice.miithii.in)
- [Versioned APK release](https://github.com/dhrubasumatary/miithii/releases/tag/voice-2026-10-05-theme-preload)
- [Handoff review](https://github.com/dhrubasumatary/miithii/pull/3)

- [Documentation index](docs/README.md)
- [Developer guide](docs/developer-guide.md): session flow, code map, setup, and known limits

The handoff branch includes [agent operations](services/agent/README.md),
[dated evidence](docs/current-work.md), and [contribution constraints](AGENTS.md).

The developer guide was written against the local working tree on **7 October 2026**, with
`0a107fe` as its local base commit. The handoff publishes that working-tree migration for review.
Read the source in your checkout before relying on a route or command here.

## Repository

| Directory | Responsibility |
| --- | --- |
| `apps/mobile` | Expo Android app, session controls, transcript, and display alignment |
| `services/agent` | Python LiveKit agent and Modal worker/token deployment |
| `packages/language-packs` | Language data, review metadata, compiler, and shared JSON artifact |
| `packages/language-core-ts` | Thin mobile reader for the language registry and segmentation data |

The previous web apps and voice runtimes are retired. Git history preserves them; they are not
alternative setup paths for the current app.

## Local checks

With pnpm and uv installed, from the repository root:

```powershell
pnpm install --frozen-lockfile
uv sync --directory services/agent
pnpm run check
```

The root check verifies compiled-pack freshness, TypeScript types, pack/mobile/Python tests,
and Python lint. Live provider calls and listening tests are separate. See the developer guide
before starting a voice session; it requires provider credentials and a native Android build.
