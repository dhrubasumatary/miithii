from __future__ import annotations

import os
import sys
import uuid

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import aiohttp
from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.observers.loggers.metrics_log_observer import MetricsLogObserver
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.tts_service import TextAggregationMode
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.workers.runner import WorkerRunner

from miithii_voice.bodhan import BodhanSTTService, BodhanTTSService
from miithii_voice.brain import MiithiiBrainService
from miithii_voice.contracts import load_contract
from miithii_voice.processors import CompleteTurnSpeechGate
from miithii_voice.session import verify_voice_session

load_dotenv(override=False)


TRANSPORT_PARAMS = {
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
    "daily": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
}


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


async def run_bot(
    transport: BaseTransport,
    runner_args: RunnerArguments,
    *,
    session_token: str | None = None,
) -> None:
    brain_url = os.environ.get("MIITHII_API_URL", "http://127.0.0.1:8787")
    dev_no_auth = os.environ.get("MIITHII_DEV_NO_AUTH", "").strip().lower() == "true"
    active_session_token = (
        session_token or os.environ.get("MIITHII_VOICE_SESSION_TOKEN", "").strip()
    )
    scoped_session = bool(active_session_token) and not dev_no_auth
    request_body = runner_args.body if isinstance(runner_args.body, dict) else {}
    requested_language = request_body.get("language")
    if dev_no_auth:
        contract = load_contract(requested_language or os.environ.get("MIITHII_VOICE_LANGUAGE"))
        authorization = ""
        thread_id = f"voice-dev-{uuid.uuid4()}"
    elif scoped_session:
        claims = verify_voice_session(active_session_token, required_env("VOICE_RTC_TOKEN"))
        if requested_language and requested_language != claims.language:
            raise RuntimeError("Voice session language does not match the signed session")
        contract = load_contract(claims.language)
        authorization = f"Bearer {active_session_token}"
        thread_id = claims.thread_id
    else:
        contract = load_contract(os.environ.get("MIITHII_VOICE_LANGUAGE"))
        authorization = f"Bearer {required_env('MIITHII_CLERK_TOKEN')}"
        thread_id = f"voice-{uuid.uuid4()}"
    stt_key = required_env("BODHAN_API_KEY")
    tts_key = required_env("BODHAN_TTS_API_KEY")
    session_id = str(uuid.uuid4())

    logger.info(
        "Starting Miithii RTC session={} language={} policy={}",
        session_id,
        contract.language,
        contract.policy_version,
    )

    async with aiohttp.ClientSession() as http:
        # SegmentedSTTService consumes VAD start/stop frames and sends one WAV per
        # utterance. User speech remains auto-detected by Bodhan.
        vad = VADProcessor(vad_analyzer=SileroVADAnalyzer())
        stt = BodhanSTTService(api_key=stt_key, session=http)
        brain = MiithiiBrainService(
            session=http,
            api_url=brain_url,
            authorization=authorization,
            contract=contract,
            thread_id=thread_id,
            scoped_session=scoped_session,
        )
        speech_gate = CompleteTurnSpeechGate()
        tts = BodhanTTSService(
            api_key=tts_key,
            contract=contract,
            session=http,
            # The gate emits exactly one text frame per assistant turn. TOKEN mode
            # therefore maps that frame to exactly one Bodhan request, preserving the
            # provider's 4-RPM envelope while still streaming response bytes to WebRTC.
            text_aggregation_mode=TextAggregationMode.TOKEN,
        )

        context = LLMContext()
        user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(
                # Pipecat 1.10 defaults to VAD/transcription turn start plus Local
                # Smart Turn V3 for semantic end-of-turn. We spell it out so an
                # upstream default change cannot silently alter Miithii's behavior.
                user_turn_strategies=UserTurnStrategies(),
                user_turn_stop_timeout=5.0,
            ),
        )

        pipeline = Pipeline(
            [
                transport.input(),
                vad,
                stt,
                user_aggregator,
                brain,
                speech_gate,
                tts,
                transport.output(),
                assistant_aggregator,
            ]
        )

        worker = PipelineWorker(
            pipeline,
            params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
            idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
            observers=[MetricsLogObserver()],
        )
        runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
        await runner.add_workers(worker)

        @transport.event_handler("on_client_connected")
        async def on_client_connected(_transport, _client):
            logger.info("Voice client connected session={}", session_id)

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(_transport, _client):
            logger.info("Voice client disconnected session={}", session_id)
            await runner.cancel()

        await runner.run()


async def bot(runner_args: RunnerArguments) -> None:
    transport = await create_transport(runner_args, TRANSPORT_PARAMS)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
