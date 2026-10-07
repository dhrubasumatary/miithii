"""Live provider probes for the Miithii voice runtime.

The unit tests prove the adapter's contract against a stubbed network. They prove nothing
about the real providers. This script closes that gap: it exercises each provider boundary
with a real credential and reports the measurements the plan's gates ask for, so a decision
is made on observed behaviour rather than on a provider's marketing page.

It is read-only with respect to the product: nothing here joins a room, mutates state, or
spends meaningful credit. It is deliberately not part of `pnpm check`.

Usage, from the repository root::

    uv run --directory services/agent python -m miithii_agent.probe            # everything
    uv run --directory services/agent python -m miithii_agent.probe bodhan      # one provider

Credentials come from the environment or from ``services/agent/.env``.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

import numpy as np
from livekit import rtc
from livekit.agents import llm
from livekit.agents.types import APIConnectOptions

# Provider fixtures, one set per language.
#
# Each one is written in the script the language contract actually requires: Assamese in the
# shared Assamese/Bengali block, Bodo in Devanagari. This was previously wrong - the Bodo
# fixture was Assamese script - so every green Bodo probe was measuring the wrong script and
# proved nothing about the real Bodo voice path. `tests/test_probe_fixtures.py` now asserts
# this, so the mistake cannot come back.
FIXTURES: dict[str, str] = {
    "asm": "আপুনি কেমন আছে? মই মিতি। আজি বৃষ্টি হৈছে।",
    "brx": "आं बेयावनो दं, मा बुंनो नागिरदों। थिखि ना?",
}


@dataclass
class ProbeResult:
    name: str
    ok: bool
    detail: str
    timings: dict[str, float] | None = None

    def render(self) -> str:
        head = f"{'PASS' if self.ok else 'FAIL'}  {self.name}: {self.detail}"
        if not self.timings:
            return head
        measured = "  ".join(f"{key}={value:.0f}ms" for key, value in self.timings.items())
        return f"{head}\n        {measured}"


def load_env() -> None:
    """Load ``services/agent/.env`` without requiring python-dotenv."""
    path = Path(__file__).resolve().parents[1] / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def _key(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is not set")
    return value


def _no_retry() -> APIConnectOptions:
    return APIConnectOptions(max_retry=0, retry_interval=0.0, timeout=20.0)


# --------------------------------------------------------------------------- Bodhan


def describe_pcm(pcm: bytes, sample_rate: int, channels: int) -> dict[str, Any]:
    """Describe decoded PCM frames.

    The AudioEmitter decodes the provider's WAV container, so ``event.frame.data`` is already
    raw PCM16 - not another WAV. Re-parsing it as a container is a probe bug, not a provider
    bug, and the first live run of this script made exactly that mistake.
    """
    return {
        "bytes": len(pcm),
        "sample_rate": sample_rate,
        "channels": channels,
        "bits": 16,
        "audio_seconds": round(len(pcm) / (sample_rate * channels * 2), 2),
    }


async def probe_bodhan_container() -> list[ProbeResult]:
    """Validate the provider's raw body with the agent's own parser.

    This is the check that proves `miithii_agent/wav.py` matches reality rather than the
    documentation. It goes around the AudioEmitter deliberately, because the emitter hides
    the container from us.
    """
    import aiohttp

    from .policy import get_policy
    from .wav import WavError, parse_wav

    try:
        api_key = _key("BODHAN_API_KEY")
    except RuntimeError as exc:
        return [ProbeResult("bodhan/container", False, str(exc))]

    url = os.environ.get("BODHAN_BASE_URL", "https://api.bodhan.ai/v1").rstrip("/")
    url = f"{url}/audio/speech"
    results: list[ProbeResult] = []

    async with aiohttp.ClientSession() as session:
        for language, text in FIXTURES.items():
            policy = get_policy(language)
            async with session.post(
                url,
                json={
                    "model": "indic-speak",
                    "input": text.split("।")[0].strip() + "।",
                    "voice": policy.voice,
                    "instructions": json.dumps({"lang": policy.bodhan_lang}),
                },
                headers={"Authorization": f"Bearer {api_key}"},
            ) as response:
                body = await response.read()
                declared = response.headers.get("content-type", "")
                if response.status != 200:
                    results.append(
                        ProbeResult(
                            f"bodhan/container/{language}",
                            False,
                            f"HTTP {response.status} {body[:160]!r}",
                        )
                    )
                    continue
                try:
                    parsed = parse_wav(body)
                except WavError as exc:
                    results.append(
                        ProbeResult(f"bodhan/container/{language}", False, f"parser: {exc}")
                    )
                    continue
                # The provider declares audio/mpeg while sending RIFF/WAVE. Recorded rather
                # than failed, because the adapter hardcodes the mime it hands the emitter
                # and therefore is not affected. Trusting the header would break playback.
                mismatch = "  <-- WRONG content-type" if "wav" not in declared else ""
                results.append(
                    ProbeResult(
                        f"bodhan/container/{language}",
                        True,
                        f"RIFF PCM16 {parsed.sample_rate}Hz x{parsed.num_channels}"
                        f" {parsed.duration_seconds:.2f}s,"
                        f" content-type={declared}{mismatch}",
                    )
                )
    return results


async def probe_bodhan() -> list[ProbeResult]:
    """Synthesise one fixture per language and measure the real latency profile."""
    import aiohttp

    from .config import BodhanSettings
    from .policy import get_policy
    from .tts_bodhan import BodhanTTS

    results: list[ProbeResult] = []
    try:
        api_key = _key("BODHAN_API_KEY")
    except RuntimeError as exc:
        return [ProbeResult("bodhan", False, str(exc))]

    settings = BodhanSettings(
        api_key=api_key,
        base_url=os.environ.get("BODHAN_BASE_URL", "https://api.bodhan.ai/v1"),
        model=os.environ.get("BODHAN_MODEL", "indic-speak"),
        connect_timeout=15.0,
        read_timeout=45.0,
        total_timeout=60.0,
        max_response_bytes=8 * 1024 * 1024,
    )

    async with aiohttp.ClientSession() as session:
        for language, text in FIXTURES.items():
            policy = get_policy(language)
            # One sentence per request, because that is what the agent actually sends and the
            # provider's latency is judged on exactly that shape.
            sentence = text.split("।")[0].strip() + "।"
            provider = BodhanTTS(
                settings=settings,
                voice=policy.voice,
                lang=policy.bodhan_lang,
                http_session=session,
            )
            started = time.perf_counter()
            first_byte: float | None = None
            frames = bytearray()
            try:
                stream = provider.synthesize(
                    sentence,
                    conn_options=_no_retry(),
                )
                async for event in stream:
                    if first_byte is None:
                        first_byte = (time.perf_counter() - started) * 1000
                    frames += bytes(event.frame.data)
            except Exception as exc:  # noqa: BLE001 - the error is the finding
                results.append(
                    ProbeResult(
                        f"bodhan/{language} ({policy.voice})",
                        False,
                        f"{type(exc).__name__}: {exc}"[:300],
                    )
                )
                continue

            elapsed = (time.perf_counter() - started) * 1000
            if not frames:
                results.append(
                    ProbeResult(f"bodhan/{language} ({policy.voice})", False, "no audio returned")
                )
                continue

            info = describe_pcm(bytes(frames), provider.sample_rate, provider.num_channels)
            results.append(
                ProbeResult(
                    f"bodhan/{language} ({policy.voice})",
                    True,
                    f"{info['audio_seconds']}s audio, PCM16 {info['sample_rate']}Hz mono",
                    {
                        "first_byte": first_byte or 0.0,
                        "total": elapsed,
                    },
                )
            )

    return results


async def probe_bodhan_rejects_bad_input() -> list[ProbeResult]:
    """Confirm a malformed request fails loudly rather than returning silent audio."""
    import aiohttp

    from .config import BodhanSettings

    try:
        api_key = _key("BODHAN_API_KEY")
    except RuntimeError as exc:
        return [ProbeResult("bodhan/invalid-voice", False, str(exc))]

    settings = BodhanSettings(
        api_key=api_key,
        base_url=os.environ.get("BODHAN_BASE_URL", "https://api.bodhan.ai/v1"),
        model="indic-speak",
        connect_timeout=15.0,
        read_timeout=30.0,
        total_timeout=45.0,
        max_response_bytes=8 * 1024 * 1024,
    )
    results = []
    async with aiohttp.ClientSession() as session:
        for label, body in (
            ("invalid-voice", {"model": "indic-speak", "input": "প্ৰশ্ন", "voice": "NotAVoice",
                               "instructions": json.dumps({"lang": "as"})}),
            ("invalid-lang", {"model": "indic-speak", "input": "প্ৰশ্ন", "voice": "Prastuti",
                              "instructions": json.dumps({"lang": "zz"})}),
        ):
            async with session.post(
                settings.speech_url,
                json=body,
                headers={"Authorization": f"Bearer {api_key}"},
            ) as response:
                detail = (await response.text())[:160].replace("\n", " ")
                # The reference documents 422 for an unusable voice/lang, but the gateway
                # answers 5xx. Either way the request is refused, which is what matters; the
                # divergence is recorded because it changes how the adapter maps the failure.
                refused = response.status >= 400
                results.append(
                    ProbeResult(
                        f"bodhan/{label}",
                        refused,
                        f"HTTP {response.status} {detail}"
                        + ("" if response.status == 422 else "  (docs say 422)"),
                    )
                )
    return results


EMOJI_RE = re.compile(
    "["
    "\U0001F000-\U0001FAFF"  # pictographs, symbols and emoticons
    "\u2600-\u27BF"  # misc symbols and dingbats
    "\uFE00-\uFE0F"  # variation selectors
    "\u200D"  # zero-width joiner, used to build compound emoji
    "\u2190-\u21FF"  # arrows, which render as emoji
    "]"
)



def _resample(pcm: bytes, source_rate: int, target_rate: int) -> bytes:
    """Linear-interpolation resample of PCM16 mono.

    Adequate for a probe. If recognition quality turns out to be the limiting factor rather
    than entitlement, this is the first thing to replace with a proper band-limited filter.
    """
    if source_rate == target_rate:
        return pcm
    samples = np.frombuffer(pcm, dtype="<i2")
    if samples.size == 0:
        return pcm
    target_count = max(1, int(samples.size / source_rate * target_rate))
    positions = np.linspace(0, samples.size - 1, target_count)
    resampled = np.interp(positions, np.arange(samples.size), samples.astype(np.float64))
    return resampled.astype("<i2").tobytes()


async def probe_roundtrip() -> list[ProbeResult]:
    """Bodhan speaks, Sarvam listens: one probe covering both provider boundaries.

    This is the most informative check available before a phone is involved, and it is only
    possible because both providers cover the same two languages. It answers two questions at
    once: whether the Sarvam realtime endpoint is entitled for this account, and whether
    Assamese and Bodo survive a real synthesis/recognition cycle.

    The accuracy signal is weak evidence by construction - the audio is synthetic and the
    expected text is known exactly - so a mismatch is a prompt to listen, not a verdict.
    """
    import aiohttp
    from livekit.plugins.sarvam import STTRealtime

    from .config import BodhanSettings
    from .policy import get_policy
    from .tts_bodhan import BodhanTTS

    try:
        bodhan_key = _key("BODHAN_API_KEY")
        sarvam_key = _key("SARVAM_API_KEY")
    except RuntimeError as exc:
        return [ProbeResult("roundtrip", False, str(exc))]

    results: list[ProbeResult] = []
    settings = BodhanSettings(
        api_key=bodhan_key,
        base_url=os.environ.get("BODHAN_BASE_URL", "https://api.bodhan.ai/v1"),
        model="indic-speak",
        connect_timeout=15.0,
        read_timeout=45.0,
        total_timeout=60.0,
        max_response_bytes=8 * 1024 * 1024,
    )

    # One short ordinary sentence per language, in the script the contract requires.
    cases = {"asm": "আপুনি কেমন আছে", "brx": "आं बेयावनो दं, मा बुंनो नागिरदों"}

    async with aiohttp.ClientSession() as session:
        for language, expected in cases.items():
            policy = get_policy(language)
            provider = BodhanTTS(
                settings=settings,
                voice=policy.voice,
                lang=policy.bodhan_lang,
                http_session=session,
            )
            pcm = bytearray()
            async for event in provider.synthesize(f"{expected}।", conn_options=_no_retry()):
                pcm += bytes(event.frame.data)

            if not pcm:
                results.append(
                    ProbeResult(f"roundtrip/{language}", False, "Bodhan produced no audio")
                )
                continue

            raw = np.frombuffer(_resample(bytes(pcm), provider.sample_rate, 16_000), dtype="<i2")
            # The VAD decides an utterance ended on trailing silence. Without it the transcript
            # never finalises, which looks identical to a broken key.
            padded = np.concatenate([raw, np.zeros(24_000, dtype="<i2")])
            stt = STTRealtime(
                language=policy.stt_locale,
                api_key=sarvam_key,
                endpointing="vad",
                sample_rate=16_000,
            )
            recognition = stt.stream(conn_options=_no_retry())
            transcript = ""

            async def feed() -> None:
                for start in range(0, padded.size, 16_000):
                    block = padded[start : start + 16_000]
                    frame = rtc.AudioFrame.create(
                        sample_rate=16_000,
                        num_channels=1,
                        samples_per_channel=len(block),
                    )
                    frame._data = block.tobytes()  # noqa: SLF001 - the plugin has no setter
                    recognition.push_frame(frame)
                    # Pace the frames like a real stream instead of dumping them at once.
                    await asyncio.sleep(0.05)
                recognition.flush()

            feeder = asyncio.create_task(feed())
            try:
                deadline = time.perf_counter() + 30
                while time.perf_counter() < deadline and not transcript:
                    try:
                        event = await asyncio.wait_for(recognition.__anext__(), timeout=5)
                    except (TimeoutError, StopAsyncIteration):
                        continue
                    if "FINAL_TRANSCRIPT" not in str(getattr(event, "type", "")):
                        continue
                    alternatives = getattr(event, "alternatives", None) or []
                    transcript = (alternatives[0].text if alternatives else "").strip()
            except Exception as exc:  # noqa: BLE001
                results.append(
                    ProbeResult(
                        f"roundtrip/{language}",
                        False,
                        f"Sarvam failed: {type(exc).__name__}: {exc}"[:300],
                    )
                )
                continue
            finally:
                feeder.cancel()
                await asyncio.gather(feeder, return_exceptions=True)
                with contextlib.suppress(Exception):
                    await recognition.aclose()
                # STTRealtime lazily creates and owns an aiohttp ClientSession. Closing only
                # the stream leaves that provider session alive, which made an otherwise green
                # roundtrip finish with ``Unclosed client session`` warnings for each language.
                with contextlib.suppress(Exception):
                    await stt.aclose()

            exact = transcript.rstrip("।.!?") == expected
            results.append(
                ProbeResult(
                    f"roundtrip/{language} ({policy.voice} -> {language}-IN)",
                    bool(transcript),
                    f"expected {expected!r}, heard {transcript!r}"
                    + ("" if exact else "   (differs - listen before concluding)"),
                )
            )
    return results



# ---------------------------------------------------------------------------- Sarvam


async def probe_sarvam() -> list[ProbeResult]:
    """Prove the realtime endpoint is entitled, by reading the server's own handshake.

    Constructing an ``STTRealtime`` only runs the plugin's language validation, and feeding
    it silence proves nothing because a VAD correctly returns no events for no speech. The
    decisive check is the websocket handshake: an entitled account receives
    ``event: session.begin`` echoing the resolved config, and an unentitled one does not.
    """
    import aiohttp

    try:
        api_key = _key("SARVAM_API_KEY")
    except RuntimeError as exc:
        return [ProbeResult("sarvam", False, str(exc))]

    base = os.environ.get(
        "SARVAM_REALTIME_URL", "wss://api.sarvam.ai/speech-to-text-realtime/ws"
    )
    results: list[ProbeResult] = []
    async with aiohttp.ClientSession() as session:
        for label, code in (("asamese", "as-IN"), ("bodo", "brx-IN"), ("auto", "auto")):
            url = (
                f"{base}?language_code={code}&encoding=linear16&sample_rate=16000"
                f"&stream_type=balanced&mode=transcribe&endpointing=vad"
            )
            started = time.perf_counter()
            try:
                async with session.ws_connect(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=aiohttp.ClientWSTimeout(ws_close=15),
                ) as ws:
                    message = await asyncio.wait_for(ws.receive(), timeout=10)
                    elapsed = (time.perf_counter() - started) * 1000
                    payload = json.loads(message.data) if message.data else {}
                    began = payload.get("event") == "session.begin"
                    model = (payload.get("config") or {}).get("model", "?")
                    results.append(
                        ProbeResult(
                            f"sarvam/{label} ({code})",
                            began,
                            f"session.begin, model={model}"
                            if began
                            else f"unexpected handshake: {str(payload)[:160]}",
                            {"handshake": elapsed},
                        )
                    )
            except Exception as exc:  # noqa: BLE001
                results.append(
                    ProbeResult(
                        f"sarvam/{label} ({code})",
                        False,
                        f"{type(exc).__name__}: {exc}"[:300],
                    )
                )
    return results



# ------------------------------------------------------------------------- AIML / LLM


async def probe_llm() -> list[ProbeResult]:
    """Run the real language-pack turn and report first-token latency and the output shape.

    This is the Gate 2 LLM evidence: the production system prompt is sent, because a call
    without it measures the base model rather than Miithii. The un-prompted behaviour is the
    reason the policy exists - the model leaks instruction artifacts, mixes scripts, and emits
    emoji that a speech engine would try to read aloud.
    """
    from .config import load_settings
    from .llm import build_llm
    from .policy import get_policy

    settings = load_settings()
    results: list[ProbeResult] = []
    if not settings.llm.enabled:
        return [ProbeResult("llm", False, "no LLM credential configured")]

    # Each language's fixtures, with the real system prompt for that language.
    cases = {
        "asm": "আপুনি কেমন আছে?",
        "brx": "आं बेयावनो दं, मा बुंनो नागिरदों। थिखि ना?",
    }
    for language, question in cases.items():
        policy = get_policy(language)
        try:
            model = build_llm(settings.llm, policy)
            started = time.perf_counter()
            first_token: float | None = None
            text = ""
            chunks = 0
            # LLMStream yields ChatChunk objects whose `.delta` is a ChoiceDelta, so the
            # text is at `.delta.content`. A bare str is also permitted by the framework's
            # llm_node contract, so accept either. The final chunk carries usage and has
            # delta=None, which is why this is a chain of guarded reads.
            chat = model.chat(
                chat_ctx=llm.ChatContext(
                    items=[
                        llm.ChatMessage(role="system", content=[policy.system_prompt]),
                        llm.ChatMessage(role="user", content=[question]),
                    ]
                ),
                conn_options=_no_retry(),
            )
            async for event in chat:
                if isinstance(event, str):
                    delta = event
                else:
                    choice = getattr(event, "delta", None)
                    delta = getattr(choice, "content", None)
                if not isinstance(delta, str) or not delta:
                    continue
                chunks += 1
                if first_token is None:
                    first_token = (time.perf_counter() - started) * 1000
                text += delta
            total = (time.perf_counter() - started) * 1000
        except Exception as exc:  # noqa: BLE001
            results.append(
                ProbeResult(f"llm/{language}", False, f"{type(exc).__name__}: {exc}"[:300])
            )
            continue

        problems = _output_problems(text, policy)
        timings = {"first_token": first_token or 0.0, "total": total}
        results.append(
            ProbeResult(
                f"llm/{language} ({settings.llm.model})",
                bool(text.strip()) and not problems,
                f"{len(text)} chars in {chunks} chunk(s): {text[:90]!r}"
                + (f"   ISSUES: {', '.join(problems)}" if problems else "   clean"),
                timings,
            )
        )
    return results


def _output_problems(text: str, policy) -> list[str]:  # noqa: ANN001 - VoicePolicy
    """Flag output shapes that would be wrong in the product.

    Emoji and leaked instruction headers are not cosmetic: both reach Bodhan, which will
    happily try to read them aloud.
    """
    problems: list[str] = []
    if EMOJI_RE.search(text):
        problems.append("contains emoji, which TTS would speak")
    for marker in ("Response:", "Standard", "System:", "You are", "###"):
        if marker in text:
            problems.append(f"leaked instruction artifact {marker!r}")
            break
    if policy.language == "brx" and not any("ऀ" <= ch <= "ॿ" for ch in text):
        problems.append("Bodo reply is not in Devanagari")
    return problems




# ------------------------------------------------------------------------------ LiveKit


async def probe_livekit() -> list[ProbeResult]:
    """Confirm the credentials can reach the project and mint a join token.

    Minting a token matters beyond this probe: the app currently depends on LiveKit's
    development token server, and being able to mint one ourselves removes that dependency
    for device testing and de-risks the production token endpoint at Gate 8.
    """
    from livekit import api

    try:
        url = _key("LIVEKIT_URL")
        key = _key("LIVEKIT_API_KEY")
        secret = _key("LIVEKIT_API_SECRET")
    except RuntimeError as exc:
        return [ProbeResult("livekit", False, str(exc))]

    results: list[ProbeResult] = []
    client = api.LiveKitAPI(url, key, secret)
    try:
        response = await client.room.list_rooms(api.ListRoomsRequest())
        # ListRoomsResponse is a message, not a sequence; the rooms hang off `.rooms`.
        names = [room.name for room in response.rooms]
        results.append(ProbeResult("livekit/rooms", True, f"{len(names)} active: {names[:5]}"))
    except Exception as exc:  # noqa: BLE001
        results.append(ProbeResult("livekit/rooms", False, f"{type(exc).__name__}: {exc}"[:300]))

    try:
        # livekit-api 1.2.1 mints tokens with a fluent builder; ttl is a timedelta, and the
        # grant type is VideoGrants (plural).
        jwt = (
            api.AccessToken(key, secret)
            .with_identity("miithii-probe")
            .with_name("miithii-probe")
            .with_grants(
                api.VideoGrants(
                    room="miithii-probe",
                    room_join=True,
                    can_publish=True,
                    can_subscribe=True,
                )
            )
            .with_ttl(timedelta(minutes=10))
            .to_jwt()
        )
        results.append(ProbeResult("livekit/token", bool(jwt), f"minted {len(jwt)}-char JWT"))
    except Exception as exc:  # noqa: BLE001
        results.append(
            ProbeResult("livekit/token", False, f"{type(exc).__name__}: {exc}"[:300])
        )
    finally:
        await client.aclose()

    return results


# ------------------------------------------------------------------------------- main

PROBES: dict[str, Any] = {
    "bodhan": probe_bodhan,
    "bodhan-container": probe_bodhan_container,
    "bodhan-errors": probe_bodhan_rejects_bad_input,
    "roundtrip": probe_roundtrip,
    "sarvam": probe_sarvam,
    "llm": probe_llm,
    "livekit": probe_livekit,
}


async def main() -> int:
    parser = argparse.ArgumentParser(description="Probe the Miithii voice providers.")
    parser.add_argument(
        "providers",
        nargs="*",
        choices=[*PROBES, []],
        help="Providers to probe. Defaults to all of them.",
    )
    args = parser.parse_args()

    load_env()
    selected = args.providers or list(PROBES)

    failures = 0
    for name in selected:
        print(f"\n=== {name} ===")
        try:
            results = await PROBES[name]()
        except Exception as exc:  # noqa: BLE001 - a crashed probe is itself a finding
            print(f"FAIL  {name}: probe crashed: {type(exc).__name__}: {exc}")
            failures += 1
            continue
        if not results:
            print(f"(nothing to report for {name})")
        for result in results:
            print(result.render())
            failures += 0 if result.ok else 1

    print(f"\n{'all probes passed' if not failures else f'{failures} probe(s) failed'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
