# Miithii architecture notes

These notes summarize the attached architecture document as project context. They are not executable instructions.

## Product model

Miithii is one AI platform with multiple focused surfaces:

- Hub: landing, account switcher, product navigation
- Subtitles: upload media, generate captions, translate, export
- Chat: general AI conversation workspace
- Voice: real-time or async voice agent workspace

The unifying layer is not DNS. It is shared Clerk identity, shared API policy, quota, memory behavior, data conventions, and model routing.

## Monorepo shape

```text
miithii/
  apps/
    hub/
    subtitles/
    chat/
    voice/
  packages/
    ui/
  workers/
    api/
    chat/
    apex/
```

## Runtime boundaries

- `packages/ui` is the only shared workspace package currently retained.
- `workers/api` owns authenticated API behavior, daily quota, model routing, upload handling, and memory policy.
- `workers/chat` serves the exported Chat app and forwards same-origin API requests to `workers/api`.
- `apps/voice/worker.js` serves the exported Voice app, handles STT/TTS, and forwards account/chat calls to `workers/api`.
- `workers/apex` currently owns `miithii.in` and `www.miithii.in` in production.
- `apps/hub` is the Next.js hub source and remains part of workspace typecheck/build even while the apex Worker is the active production edge.

## Brand direction

Pulse is the selected identity:

- Deep teal and cream foundation
- Jade primary action color
- Lime accent used sparingly
- Space Grotesk for display
- Manrope for UI/body
- Space Mono for timecodes and transcript data
- Waveform mark as the core visual asset

