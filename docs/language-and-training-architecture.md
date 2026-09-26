# Miithii language and training architecture

Miithii is a companion that should let a person speak naturally while receiving replies in a selected Northeast Indian language. The current production languages are Assamese (`as`) and Bodo (`brx`). More languages must be added as isolated modules rather than by appending exceptions to an Assamese prompt.

## Invariants

1. **Input language and reply language are separate.** A person may speak or type in any language. The selected Miithii language controls the reply policy and Voice TTS voice.
2. **No language owns the base personality.** Shared companion, safety, memory and privacy behavior lives in a neutral base policy. Language-specific grammar, script, register and output rules live in language profiles.
3. **Language behavior is data with contracts.** Chat, Voice and the API consume the same language IDs and policy metadata. Contract tests should fail when a surface drifts.
4. **Async work belongs to an exact turn/session generation.** Old STT, LLM or TTS work must not be allowed to mutate a newer Voice turn.
5. **Derived language knowledge must point back to evidence.** Any future claim about a user's language preferences or demonstrated ability must cite the exact transcript revision that produced it. Product heuristics are not proficiency certification.
6. **Training use requires explicit consent.** Conversation memory and model-training contribution are different purposes and different controls.

## Current language behavior

| Language | ID | Chat default | Voice reply script | Voice TTS |
| --- | --- | --- | --- | --- |
| Assamese | `as` | conversational Romanized Assamese | Assamese/Bengali Unicode block | Bodhan `Prastuti` |
| Bodo | `brx` | language profile policy | Devanagari | Bodhan `Gwrbw` |

The language-core package is the source of truth. Adding a future language should require a new profile plus its tests, not edits scattered through Chat and Voice.

## Training corpus v1

Training contribution is **off by default**. When a signed-in person explicitly enables it, only new text turns are eligible for capture:

- latest user text
- assistant reply text
- selected target language
- detected scripts
- surface (`chat` or `voice`)
- model and language-policy version
- a one-way contributor identifier
- a one-way conversation identifier

Raw microphone audio is **not** part of v1. Audio/transcript collection for future STT or TTS training needs a separate consent, retention and deletion design.

Credential-shaped and over-limit text is rejected before storage rather than truncated. Users can stop future contribution independently from memory. Deleting contributed text also turns contribution off, preventing a later in-flight turn from silently restoring data after deletion.

The export format is JSONL with `messages` plus metadata. `workers/api/scripts/prepare-training.mjs` recomputes reply script from the actual text, rejects missing conversation identity and obvious reply-script conflicts, deduplicates records, then makes a deterministic conversation-level 95/5 train/validation split so turns from one conversation cannot leak across the evaluation boundary.

## Language evidence

The evidence layer is intentionally separate from personal memory and from the training corpus.

- **Personal memory**: facts/preferences useful for conversation continuity.
- **Language evidence**: revision-bound observations about script, modality, corrections or demonstrated usage.
- **Training corpus**: explicitly contributed examples used outside the live product to improve/evaluate models.

Language evidence should never silently become a claim that a person has mastered a language. Any projection must be reproducible from validated observations.

## Realtime Voice path

The current web Voice product remains on Cloudflare + Bodhan while its lifecycle and latency are improved in place. Pipecat is the preferred future realtime orchestration layer because it provides WebRTC clients, interruption semantics, turn detection, transcript events, service metrics and custom processors.

Pipecat is **not** inserted into the current production path just to add another framework. It requires a long-running Python runtime, while Miithii's current backend is Cloudflare Workers. The language-core and training contracts are deliberately transport/provider-neutral so a future Pipecat service can adopt them without rewriting product policy.

Dograh is useful when Miithii needs a visual workflow/telephony platform. It is not the core abstraction for the current browser companion, so it stays out of the critical runtime for now.

### Future Pipecat seam

```text
browser/mobile
    │ WebRTC
    ▼
Pipecat transport
    │
    ├─ turn detection / interruption
    ├─ Bodhan-compatible STT adapter
    ├─ Miithii language-core + LLM
    ├─ Bodhan-compatible TTS adapter
    ├─ transcript/evidence events
    └─ opt-in training event sink
```

The migration should happen only after Bodhan STT/TTS latency and streaming behavior are measured in the target deployment. A framework should not erase the speech quality advantage Miithii gets from language-specialized providers.
