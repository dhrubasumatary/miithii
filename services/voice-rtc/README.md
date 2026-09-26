# Miithii Voice Runtime

Pipecat owns realtime media and turn lifecycle. The Cloudflare brain owns language policy and the
LLM. Bodhan remains the STT/TTS provider.

## Local

Local Windows development uses SmallWebRTC and no product auth:

```powershell
Copy-Item .env.example .env
uv sync
uv run python bot.py --transport webrtc
```

The Pipecat development runner is available at `http://localhost:7860`.

## Production

The target native route is Cloudflare Realtime SFU between the device and Pipecat/aiortc on Modal.
Direct Modal <-> device relay-to-relay TURN was rejected after live cross-network tests proved
asymmetric relay delivery. Do not make direct TURN the production topology.

`modal_app.py` exposes capability-authenticated `/sfu/*` signalling/proxy routes. Cloudflare App
credentials stay on Modal; the native client receives no Cloudflare secret. The SFU route preserves
Pipecat's application contract: DataChannel name `chat`, RTVI JSON label `rtvi-ai`.

The browser/libwebrtc SFU gate currently passes audio in both directions and bidirectional Pipecat
application messages through Modal/aiortc. A narrow aiortc compatibility guard handles Cloudflare's
duplicate DCEP OPEN for the reserved negotiated `server-events` stream.

Create a Modal secret named `miithii-voice` containing:

- `BODHAN_API_KEY`
- `BODHAN_TTS_API_KEY`
- `VOICE_RTC_TOKEN`
- `MIITHII_API_URL=https://api.miithii.in`
- `CLOUDFLARE_TURN_KEY_ID`
- `CLOUDFLARE_TURN_KEY_API_TOKEN`

Production deployment remains manual through the repository workflow. Do not deploy locally over
the existing production Modal app while the Cloudflare Worker still points to legacy `/connect`.

Do not put provider or Cloudflare credentials in the Android app. Android gets a short-lived Voice
capability from `api.miithii.in/api/voice/session`; Modal verifies it before creating/proxying the
SFU sessions. Keep the Worker on legacy `/connect` until the physical Android SFU release gate
passes.

## Latency

The runtime logs `voice_stage` measurements for Bodhan STT, Miithii brain response, and Bodhan TTS
time-to-first-audio. Optimize the slowest measured stage rather than adding speculative machinery.
