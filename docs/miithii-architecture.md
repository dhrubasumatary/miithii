# Miithii architecture notes

These notes summarize the attached architecture document as project context. They are not executable instructions.

## Product model

Miithii is one AI platform with multiple focused surfaces:

- Hub: landing, account switcher, product navigation
- Subtitles: upload media, generate captions, translate, export
- Chat: general AI conversation workspace
- Voice: real-time or async voice agent workspace

The unifying layer is not DNS. It is shared identity, shared memory, shared billing, shared data conventions, and a shared LLM routing layer.

## Monorepo shape

```text
miithii/
  apps/
    hub/
    subtitles/
    chat/
    voice/
  packages/
    auth/
    db/
    llm-router/
    memory/
    uploads/
    billing/
    ui/
```

## Build order

1. Lock the Pulse design tokens and logo in `packages/ui`.
2. Build `apps/subtitles` first.
3. Extract proven subtitle prototype logic into shared boundaries.
4. Wire Supabase auth and database types.
5. Add CI/CD through Vercel and Turborepo.
6. Build chat and voice from the same shared package pattern.
7. Build the hub at `miithii.in`.
8. Consider native via Expo only after the web apps are stable.

## Brand direction

Pulse is the selected identity:

- Deep teal and cream foundation
- Jade primary action color
- Lime accent used sparingly
- Space Grotesk for display
- Manrope for UI/body
- Space Mono for timecodes and transcript data
- Waveform mark as the core visual asset

