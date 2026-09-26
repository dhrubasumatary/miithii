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

Production uses Pipecat SmallWebRTC directly between Android and one stateful Modal ASGI replica.
`modal_app.py` exposes `/start` plus the session-scoped Pipecat offer/ICE routes and runs the same
`run_bot()` pipeline used locally. Voice capabilities expire after 20 minutes.

Direct STUN was tested against Modal and did not establish an ICE pair from a remote client, even
though both peers gathered server-reflexive candidates. Production therefore uses Cloudflare
Realtime TURN as the relay fallback. `/start` generates a short-lived TURN credential for each
Voice capability and returns it as Pipecat `iceConfig`; the long-lived TURN key never reaches the
Android app.

Create a Modal secret named `miithii-voice` containing:

- `BODHAN_API_KEY`
- `BODHAN_TTS_API_KEY`
- `VOICE_RTC_TOKEN`
- `MIITHII_API_URL=https://api.miithii.in`
- `CLOUDFLARE_TURN_KEY_ID`
- `CLOUDFLARE_TURN_KEY_API_TOKEN`

Then deploy from this directory with `modal deploy modal_app.py`.

Do not put provider credentials in the Android app. Android gets a short-lived Voice capability
from `api.miithii.in/api/voice/session`; Modal verifies it before creating the SmallWebRTC peer.

Keep `workers/api` `VOICE_RTC_START_URL` pointed at the deployed Modal `/start` endpoint only after
`/health` reports `relayConfigured: true` and the remote WebRTC smoke test reaches `connected`.

## Latency

The runtime logs `voice_stage` measurements for Bodhan STT, Miithii brain response, and Bodhan TTS
time-to-first-audio. Optimize the slowest measured stage rather than adding speculative machinery.
