# Miithii LiveKit agent

A LiveKit Agents worker hosted on Modal. The previous Pipecat, aiortc, Cloudflare media and PCM
implementations are not dependencies of this service.

A turn travels:

```
phone -> LiveKit -> Sarvam STTRealtime(session locale) -> Gemini 2.5/AIMLAPI
      -> language gate -> language-scoped TTS -> LiveKit -> phone
```

Bodo uses Bodhan. Assamese uses Bodhan by default, or ElevenLabs v4 when
`MIITHII_ASSAMESE_TTS=elevenlabs`, `ELEVEN_API_KEY`, and `MIITHII_ELEVEN_AS_VOICE_ID` are set.
`MIITHII_ELEVEN_MODEL` accepts `eleven_v4` or `eleven_v4_turbo`; Turbo is the voice-session default.
These settings never route Bodo to ElevenLabs. Missing configured credentials fail closed.
Choose an Assamese voice from an Assamese-language Professional Voice Clone, not a pre-made or
generated English-native voice. Confirm the language label and listen to the Assamese sample before
updating `MIITHII_ELEVEN_AS_VOICE_ID`; an English or Hindi female voice is not an Assamese voice
approval. The ElevenLabs key needs `voices_read` to list voices by language and gender; voice search
is read-only and does not synthesize audio.
The model's first-line `@mood` classification remains internal metadata and is removed before
preview and speech. ElevenLabs v4 expresses delivery through inline text tags; Miithii does not
inject those tags because canonical speech and aligned-transcript text must remain plain and agree.
Do not map mood to Stability or Similarity settings: those are voice controls, not verified mood
parameters. V4 Text-to-Dialogue accepts `stability`, which adjusts delivery variability, not a
named emotion. The pinned LiveKit plugin applies dialogue settings at context initialization and
invalidates its active connection when options change; keep dynamic mood-to-stability disabled
until its latency and lifecycle effects are designed and heard on the target phone. This preserves
plain canonical text and transcript alignment without claiming that stability selects a mood.
The deployment uses a dedicated `miithii-elevenlabs-assamese` secret on the agent server only.

## Modules

| Module | Responsibility |
| --- | --- |
| `config.py` | Every credential and provider setting, read in one place. Fails at startup, not mid-turn. |
| `policy.py` | Hash-verifies and loads the compiled `language-packs` artifact for one session. |
| `llm.py` | Gemini 2.5 Flash through AIMLAPI by default; direct Google is an explicit alternate route. |
| `tts_bodhan.py` | Bodhan as a non-streaming `TTS` with a `ChunkedStream`. |
| `wav.py` | RIFF/WAVE validation, so a truncated body never becomes audible audio. |
| `sentences.py` | Danda-aware segmentation, because LiveKit 1.8.3 hard-codes BlingFire. |
| `turns.py` | Turn identity and the stale-work guard. Cancellation is terminal. |
| `preview.py` | Text-first reply preview on the `miithii.reply` topic. |
| `token.py` | Self-issued LiveKit join tokens. The app never holds the signing secret. |
| `tools.py` | Inert function tools. None can mutate shared state or reach the network. |
| `probe.py` | Live provider probes. Read-only; not part of `pnpm check`. |

## Three decisions worth knowing

**The whole speech-recognition session is language-bound.** The pack maps canonical `asm` / `brx`
to Sarvam realtime `as-IN` / `brx-IN`, with `mode="codemix"` and `stream_type="fast"`. The
official LiveKit 1.8.3 Sarvam plugin does not expose Saaras v4 or keyterms, so those controls are
not represented as working configuration.

**Turn detection is Sarvam's endpointing**, set explicitly through `turn_handling`. Left implicit,
LiveKit auto-selects a Turn Detector that does not support Assamese or Bodo. Silero VAD is still
enabled, but only for barge-in. This is the direct answer to why the previous build broke: Smart Turn
was paired with a non-streaming TTS leg it could not model.

**The LLM is called from the agent, not through `api.miithii.in`.** That Worker was retired with the
other legacy apps and still carries Clerk auth, quotas and R2 for the old chat product. Every extra
hop is latency on a turn already gated by a slow TTS.

**Generated text and spoken text are different topics.** A model response first passes the language
gate; only its accepted canonical body is published on `miithii.reply`. `lk.transcription` means
*being spoken*. Only the latter may mark a sentence as delivered.

## Provider vocabularies are not interchangeable

Two issues found through live probes:

- Miithii's canonical ids are `asm` / `brx`. Bodhan's speech API takes provider codes `as` / `brx`,
  while Sarvam realtime takes `as-IN` / `brx-IN`. Provider codes always come from the pack resolver.
- Bodhan labels its WAV bodies `Content-Type: audio/mpeg`. The header is wrong; the adapter
  hardcodes `audio/wav` for the emitter and must keep doing so.

## Local checks

```powershell
uv sync --directory services/agent
uv run --directory services/agent ruff check .
uv run --directory services/agent pytest
```

## Probing the real providers

Unit tests stub the network, so they prove the adapter's contract and nothing about Bodhan, Sarvam
or the model. `probe.py` closes that gap with real credentials:

```powershell
uv run --directory services/agent python -m miithii_agent.probe            # everything
uv run --directory services/agent python -m miithii_agent.probe roundtrip  # Bodhan -> Sarvam
```

It reads `services/agent/.env` (gitignored) or the process environment. The `roundtrip` probe is
the most informative one available before a phone is involved: Bodhan speaks a known sentence and
Sarvam transcribes it back, which covers both provider boundaries at once.

Historical provider notes are not an implementation contract. Use the live probes plus current
tests/source; `docs/README.md` explains which retained documents are research/evidence only.

## Latency and speech proposal audit: 2026-10-01

The latency and Bulbul proposals were checked against the current source and installed LiveKit
1.8.3 SDK. The pipeline already passes accepted sentences to synthesis while later text is being
generated; it does not wait for the whole reply. Bodhan still buffers and validates each complete
WAV before emitting it. Existing `TurnTimings` instrumentation measures turn commitment, first
token, first accepted sentence, generation completion, HTTP/body/validation/emission, and LiveKit
playout start. These are agent-side measurements, not Android speaker audibility. The first-sentence
span now starts at the first token, avoiding the negative duration a serial-pipeline assumption
produced. Interrupted/retired turns stop collecting callbacks, and session close, failed startup,
and worker cancellation retire their registry epoch.

No endpointing or preemptive-synthesis defaults changed. Ten real spoken turns per language are
still needed to identify the dominant delay and compare speculative synthesis with the current
route. Record phone speech-end/first audible output separately from server stages. Endpointing
and false barge-in need listening evidence together: faster synthesis does not justify lost
sentences. No measured preemptive-synthesis delta is available from this audit.

Bulbul remains an unimplemented experiment. The official
[LiveKit Sarvam TTS guide](https://docs.livekit.io/agents/models/tts/sarvam/)
and installed plugin confirm streaming synthesis, `min_buffer_size=30`, `linear16` output,
and `prewarm()` support. The plugin uses `SARVAM_API_KEY`, as STT does; a second credential is not
intrinsically required, although TTS entitlement and failures need separate verification. These
features could remove whole-WAV buffering and decode/connection overhead; they do not prove lower
end-to-end latency or acceptable Assamese pronunciation. Bodo must keep its current independent
route. Adding an experimental Assamese route needs explicit server routing/configuration,
capability validation, and failure tests. A language-pack schema change is needed only if new
pack-owned provider data is introduced, not merely because the router gains an experiment flag.

The installed Sarvam streaming plugin hardcodes its basic sentence tokenizer and exposes no
constructor parameter for Miithii's tokenizer. A new route therefore needs demonstrated canonical
text/aligned-transcript agreement, interruption truncation, and unchanged strict alignment tests
before enabling it. Do not loosen alignment checks. Compare both providers using identical existing
reviewable sentences within each pack's request limits, recording first audio frame and total
synthesis duration. Native review of names, pronunciation, fallback/crisis speech, and phone
playback remains required; draft packs and an unmeasured voice cannot be called shippable.

The installed `BackgroundAudioPlayer` publishes a separate `AudioSource`/track and does not write
the reply preview or aligned TTS transcript. This clears the transcript-contamination question at
the SDK-source level, but no thinking/connection sounds were added. Any such sounds still need
phone mixing, interruption, and accessibility acceptance; they cannot stand in for latency work.

## Deploy

Two functions on the Modal app `miithii-livekit-agent`:

- `agent` - the LiveKit worker, one warm CPU container, health on port 8081.
- `token` - a stateless endpoint at the function root that signs a join token. It takes a
  `POST` with LiveKit's standard token-request body, including `room_config` and participant
  attributes, and returns `201` with `{server_url, participant_token}`. It is **unauthenticated**,
  which makes it a development convenience rather than production admission. Agent dispatch is
  restricted to the configured Miithii worker, metadata is bounded, and room configuration is
  fixed to one client participant. Authentication still requires a real user identity provider;
  do not ship this public endpoint as production admission.

Both read the Modal secret `miithii-livekit-agent-secrets`, which holds the server-side LiveKit and
provider credentials. None of those values belong in the mobile app.

```powershell
modal deploy services/agent/modal_app.py
```
