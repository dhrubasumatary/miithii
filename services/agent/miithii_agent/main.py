"""Miithii LiveKit voice agent.

Pipeline, in the order a turn travels it::

    phone -> LiveKit -> Sarvam STT -> Gemini + language pack -> canonical validation
          -> Standard synthesis -> LiveKit -> phone

Three decisions are load-bearing here.

Turn detection is Sarvam's endpointing, set explicitly through ``turn_handling``. Leaving
it unset would let the session auto-select LiveKit's Turn Detector, whose supported-language
list does not include Assamese or Bodo. This is also the deliberate answer to why the
previous build broke: Smart Turn was paired with a non-streaming TTS leg it could not
model. VAD is still enabled, but only for interruption handling.

The reply language is immutable for the session. It selects the language pack, the pinned Sarvam
realtime locale, the model prompt, the deterministic gate, and the TTS voice. Sarvam still runs in
``codemix`` mode, but this build does not pretend the pinned Assamese/Bodo recognizer is an
independent arbitrary-language detector.

One generation is one canonical reply. The model returns words, the gate decides whether they
may be spoken, and the chosen synthesizer renders exactly those words. Expressive delivery used
to be a second JSON envelope authored by the model and decoded before synthesis; it was removed
because it forced the whole reply to be buffered before any audio started, which made an
interruption discard several sentences of queued audio at once. Both tiers now stream the same
incremental way, and the transcript is a prefix of what the model actually generated.
"""

from __future__ import annotations

import asyncio
import contextlib
import inspect
import logging
from collections.abc import AsyncIterable, AsyncIterator, Callable
from typing import Any

import aiohttp
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    FlushSentinel,
    JobContext,
    ModelSettings,
    cli,
    llm,
)
from livekit.agents.stt import STT
from livekit.agents.tts import TTS
from livekit.agents.vad import VAD

from .config import Settings, configured_agent_name, load_settings
from .enforcement import (
    CheckResult,
    Mood,
    Rejection,
    Verdict,
    build_repair_prompt,
    check_answer,
    check_sentence,
    chunk_text,
    is_flush,
    native_fallback,
    parse_mood_line,
    strip_mood_prefix,
    was_truncated,
)
from .llm import build_llm
from .policy import VoicePolicy, get_policy
from .preview import PreviewKind, ReplyPreviewPublisher
from .rooms import route_for_room
from .sentences import take_complete_sentences
from .tiers import VoiceTier
from .timing import TurnTimings, format_turn
from .tools import build_tools
from .tts_bodhan import BodhanTiming
from .turns import DeliveryState, TurnRegistry
from .voice_tts import build_voice_tts

logger = logging.getLogger("miithii.voice")

# One HTTP session per agent process. Bodhan is asked for one short request per sentence, so
# a per-sentence connection would pay a TLS handshake on every one of them.
_http_session: aiohttp.ClientSession | None = None


def _shared_http_session() -> aiohttp.ClientSession:
    global _http_session
    if _http_session is None or _http_session.closed:
        _http_session = aiohttp.ClientSession()
    return _http_session


def build_stt(settings: Settings, policy: VoicePolicy) -> STT:
    """Streaming Sarvam STT bound to the session's immutable language pack."""
    from livekit.plugins.sarvam import STTRealtime

    return STTRealtime(
        language=policy.stt_locale,
        api_key=settings.sarvam.api_key,
        stream_type="fast",
        mode="codemix",
        # Server-side endpointing: Sarvam decides when a turn ends and reports the boundary
        # to LiveKit, so endpoint timings must be tuned on real Assamese/Bodo speech.
        endpointing="vad",
        vad_min_silence_ms=settings.sarvam.min_silence_ms,
        vad_min_speech_ms=settings.sarvam.min_speech_ms,
        sample_rate=settings.sarvam.sample_rate,
    )


def build_vad() -> VAD:
    """VAD for barge-in only. It must not decide turn boundaries; Sarvam does.

    Silero loads an ONNX model, which is blocking, so this runs once per process in
    ``setup`` rather than once per session. Its thresholds come from their own settings, not
    from Sarvam's, because the two answer different questions.
    """
    from livekit.plugins.silero import VAD as SileroVAD

    settings = load_settings().vad
    return SileroVAD.load(
        min_silence_duration=settings.min_silence,
        min_speech_duration=settings.min_speech,
        sample_rate=settings.sample_rate,
    )


def setup(proc: object) -> None:
    """Per-process initialisation: warm the VAD and the plugin imports.

    Importing the provider plugins inside the session blocked the event loop for over half a
    second on the first job, which lands squarely in the middle of the user's first turn. The
    imports are the slow part and are not session-specific, so they happen once per process
    here instead of on first use.
    """
    proc.userdata["vad"] = build_vad()  # type: ignore[attr-defined]
    with contextlib.suppress(Exception):
        import livekit.plugins.google  # noqa: F401
        import livekit.plugins.openai  # noqa: F401
        import livekit.plugins.sarvam  # noqa: F401
        import livekit.plugins.silero  # noqa: F401
    # There is deliberately no script-table warm-up here any more. The gate used to build its
    # character classes by scanning the Unicode database, which measured 242ms of synchronous
    # work and had to be kept off the turn path. `script_check` now carries two compiled
    # ranges instead, so there is nothing to precompute and nothing to warm.


def vad_for(proc: object) -> VAD:
    """Return the warmed VAD, loading it if this process has not been set up yet."""
    userdata = getattr(proc, "userdata", None)
    if isinstance(userdata, dict) and "vad" in userdata:
        return userdata["vad"]  # type: ignore[no-any-return]
    vad = build_vad()
    if isinstance(userdata, dict):
        userdata["vad"] = vad
    return vad


def build_tts(
    settings: Settings,
    policy: VoicePolicy,
    voice_tier: VoiceTier = "standard",
    on_timing: Callable[[BodhanTiming], None] | None = None,
) -> TTS:
    """Compatibility wrapper around the product-tier TTS router."""
    provider, _route = build_voice_tts(
        settings,
        policy,
        voice_tier,
        http_session=_shared_http_session(),
        on_bodhan_timing=on_timing,
    )
    return provider


class MiithiiAgent(Agent):
    """Holds one compiled language-pack policy for exactly one session."""

    def __init__(
        self,
        settings: Settings,
        policy: VoicePolicy,
        voice_tier: VoiceTier,
        room: rtc.Room,
        session_id: str,
    ) -> None:
        self._policy = policy
        self._voice_tier = voice_tier
        self._turns = TurnRegistry()
        self._preview = ReplyPreviewPublisher(
            room, session_id, self._turns, language=policy.language
        )
        self._timing = TurnTimings()
        self._turn_open = False
        super().__init__(
            # Built per session and bound to this session's language, so two concurrent
            # sessions can never observe each other's policy.
            instructions=policy.system_prompt,
            tools=build_tools(policy.language),
        )

    async def on_user_turn_completed(self, turn_ctx: Any = None, new_message: Any = None) -> None:
        """Open the clock when LiveKit commits the user's turn.

        LiveKit documents this hook as the point where the user has finished speaking and the
        LLM is about to respond. It is therefore a valid agent-side turn boundary, but not a
        proven physical microphone speech-end timestamp; the metric names preserve that
        distinction instead of overstating what this hook can observe.

        The base hook is awaited, not called. Overriding it synchronously returned `None` where
        the framework awaited a coroutine, which raised inside the turn and stopped the reply
        from ever reaching TTS - a silent failure with no voice and no visible cause.
        """
        await super().on_user_turn_completed(turn_ctx, new_message)
        self._timing = TurnTimings()
        self._timing.mark("turn_committed")
        self._turn_open = True

    def _on_tts_timing(self, sample: BodhanTiming) -> None:
        if not self._turn_open:
            return
        # A synthesis task from an interrupted previous turn can finish after the next turn has
        # already opened. Absolute monotonic timestamps let us reject that stale callback instead
        # of attributing old provider latency to the new user turn.
        if sample.request_started_at < self._timing.started_at:
            return
        # Every timestamp comes from the same monotonic process clock as TurnTimings. This is
        # intentionally not reconstructed from provider-relative durations: doing so used to
        # omit the scheduling/validation gap and made an ~8s turn look like ~2s.
        self._timing.mark_at("tts_request", sample.request_started_at)
        self._timing.mark_at("tts_headers", sample.response_headers_at)
        self._timing.mark_at("tts_body", sample.body_complete_at)
        self._timing.mark_at("tts_ready", sample.audio_ready_at)
        self._timing.mark_at("tts_provider_emit", sample.provider_emitted_at)
        logger.info(
            "miithii provider timing %s tts_audio=%.2fs",
            format_turn(self._timing, self._policy.language),
            sample.audio_seconds,
        )

    def _on_agent_state_changed(self, event: Any) -> None:
        """Close the turn clock at LiveKit's first playout-backed speaking transition."""
        if not self._turn_open or getattr(event, "new_state", None) != "speaking":
            return
        self._timing.mark("agent_speaking")
        self._turn_open = False
        logger.info("%s", format_turn(self._timing, self._policy.language))

    def _on_user_interrupted(self, _event: Any = None) -> None:
        """Retire the live turn the moment the user takes the floor.

        LiveKit clears its own audio buffer on an interruption, which is why queued speech
        stops. Without this the registry would still consider the interrupted turn current,
        so a synthesis task finishing late could publish audio and preview text for a turn
        the user has already moved past. Cancellation is terminal: the audio is gone, and the
        app must not be told otherwise.
        """
        self._turns.cancel(self._turns.current)
        self._turn_open = False

    def retire_session(self) -> int:
        """End this session boundary. Used by reset, language switch, and reconnect."""
        self._turn_open = False
        return self._turns.advance_epoch()

    @property
    def policy(self) -> VoicePolicy:
        return self._policy

    @property
    def turns(self) -> TurnRegistry:
        return self._turns

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool],
        model_settings: ModelSettings,
    ) -> AsyncIterable[llm.ChatChunk | str | FlushSentinel]:
        """Gate the generated answer, then hand it to the speech path.

        This is the fail-closed boundary. The system prompt asks for a specific script and a
        specific length; that is a request, not a guarantee. An answer is checked against the
        language contract here, and one that fails is not passed downstream at all - the text
        simply never reaches TTS.

        A preview is still published, including for a rejected answer, so the app can show
        what happened rather than appearing to hang. The preview carries the verdict, so the
        screen can distinguish "said" from "refused".
        """
        result = super().llm_node(chat_ctx, tools, model_settings)
        if inspect.isawaitable(result):
            result = await result

        if not isinstance(result, AsyncIterable):
            return result

        turn_id = self._turns.begin_turn()
        # Capture the actual SDK speech, not whichever turn is newest when a delayed
        # callback arrives. There is no user_interruption_detected event in 1.8.3.
        try:
            speech = self.session.current_speech
        except RuntimeError:
            speech = None  # Node-level tests may run without an attached session.

        def retire_interrupted_turn() -> None:
            current = self._turns.is_current(turn_id)
            self._turns.cancel(turn_id)
            if current:
                self._turn_open = False

        if speech is not None:

            def on_speech_done(handle: Any) -> None:
                if handle.interrupted:
                    retire_interrupted_turn()

            speech.add_done_callback(on_speech_done)
        await self._preview.publish(turn_id, PreviewKind.START, "")

        async def regenerate(corrective: str) -> tuple[str, bool]:
            """Run one more generation under a corrective instruction.

            Returns the retry's text and whether the retry was itself truncated. The retry is a
            separate generation with its own finish reason: it must be judged on what actually
            happened to it, not on what happened to the answer it is replacing. Reading the
            flag from the first attempt instead would accept a retry that was also cut off.
            """
            repair_ctx = chat_ctx.copy()
            # `add_message` is keyword-only and takes the role and content directly; it does
            # not accept a ChatMessage, and it has no positional form.
            repair_ctx.add_message(role="user", content=corrective)
            # Explicit two-argument super, not the zero-argument form. The implicit form infers
            # its arguments from the enclosing function's first parameter, and inside this
            # nested closure that parameter is `corrective`, not `self`. The result was a
            # TypeError raised only when a repair was actually attempted - so every answer that
            # failed the gate produced an unhandled error and no audio at all, which is exactly
            # the turn the fail-closed path exists to handle.
            retry = super(MiithiiAgent, self).llm_node(repair_ctx, tools, model_settings)
            if inspect.isawaitable(retry):
                retry = await retry
            if not isinstance(retry, AsyncIterable):
                return "", False
            parts: list[str] = []
            retry_truncated = False
            async for item in retry:
                retry_truncated = was_truncated(item) or retry_truncated
                text = chunk_text(item)
                if text:
                    parts.append(text)
            return "".join(parts), retry_truncated

        async def validate(
            answer: str,
            *,
            truncated: bool,
            initial: CheckResult | None = None,
        ) -> CheckResult:
            """Judge one answer, retrying once if it would not be spoken.

            Both tiers share this path because the generated text *is* the canonical text.
            Expressive delivery used to be a separate JSON envelope layered on top; removing it
            means there is nothing left to decode, so a generation cannot fail for reasons the
            user could never act on.
            """
            check = initial or check_answer(answer, self._policy, truncated=truncated)

            if check.speakable:
                return check

            # Exactly one repair, and only before anything has been spoken. After speech
            # starts, regenerating would desynchronise the transcript from the audio, so the
            # turn simply stops instead.
            logger.info(
                "miithii repairing an answer: %s (language=%s)",
                check.describe(),
                self._policy.language,
            )
            await self._preview.publish(turn_id, PreviewKind.REPAIR, "")
            repaired, retry_truncated = await regenerate(
                build_repair_prompt(answer, check.rejections)
            )
            # The retry is judged on its own finish reason, not on the first attempt's. A retry
            # that was also cut off is not a repair, and inheriting the first attempt's flag
            # would either reject a good retry for something it did not do, or accept a bad
            # one for the same reason.
            second = check_answer(repaired, self._policy, truncated=retry_truncated)
            if second.speakable:
                return second
            return (
                native_fallback(self._policy, second.mood or check.mood or Mood.NEUTRAL) or second
            )

        def finish(answer: str, check: CheckResult) -> None:
            """Record the terminal state of a turn the gate has now judged."""
            if check.speakable:
                self._turns.set_state(turn_id, DeliveryState.ACCEPTED)
            else:
                # Fail closed. Nothing is yielded, so nothing reaches TTS and the transcript
                # never claims this text was delivered.
                logger.warning(
                    "miithii refused an answer: %s (language=%s)",
                    check.describe(),
                    self._policy.language,
                )
                self._turns.set_state(turn_id, DeliveryState.FAILED)

        reply_shortened = False

        async def gate() -> AsyncIterator[str | FlushSentinel]:
            """Validate complete sentences as the model produces them.

            The first sentence is the commit point. Before it, a malformed header or sentence
            can be regenerated once. After it, speech may already be playing, so a later bad
            sentence is dropped instead of rewriting a turn the user has begun to hear.
            """
            nonlocal reply_shortened
            raw_parts: list[str] = []
            pending = ""
            mood: Mood | None = None
            accepted: list[str] = []
            accepted_chars = 0
            sentence_index = 0
            failure: CheckResult | None = None
            budget_exhausted = False
            truncated = False
            saw_text = False

            async for chunk in result:
                if not self._turns.may_deliver(turn_id) or (
                    speech is not None and speech.interrupted
                ):
                    retire_interrupted_turn()
                    return
                truncated = was_truncated(chunk) or truncated

                if is_flush(chunk):
                    break

                text = chunk_text(chunk)
                if not text:
                    yield chunk
                    continue

                raw_parts.append(text)
                if not saw_text:
                    saw_text = True
                    self._timing.mark("llm_first")

                pending += text
                if mood is None:
                    prefix_mood, without_prefix = strip_mood_prefix(pending)
                    if prefix_mood is not None:
                        mood = prefix_mood
                        pending = without_prefix
                    if "\n" not in pending:
                        if mood is None:
                            continue
                    elif mood is None:
                        header, pending = pending.split("\n", 1)
                        mood, mood_error = parse_mood_line(header)
                        if mood_error is Rejection.MISSING_MOOD:
                            # The model skipped the optional delivery header. Put the line back
                            # into the spoken body and continue with neutral delivery; script,
                            # completeness, blocklist and budget checks still run exactly as before.
                            mood = Mood.NEUTRAL
                            pending = f"{header}\n{pending}"
                        elif mood_error is Rejection.INVALID_MOOD:
                            # The line was a control header but named a mood we do not support.
                            # Never speak the control text; neutral delivery is the safe
                            # deterministic fallback and does not justify regenerating
                            # otherwise valid language.
                            mood = Mood.NEUTRAL
                    assert mood is not None

                complete, pending = take_complete_sentences(pending)
                for sentence in complete:
                    sentence_index += 1
                    checked = check_sentence(
                        sentence,
                        mood,
                        self._policy,
                        sentence_index=sentence_index,
                    )
                    if not checked.speakable:
                        failure = checked
                        break

                    separator = 1 if accepted else 0
                    projected = accepted_chars + separator + len(checked.text)
                    if projected > self._policy.max_turn_chars:
                        budget_exhausted = True
                        break

                    if not accepted:
                        self._timing.mark("canonical_ready")
                        self._turns.set_state(turn_id, DeliveryState.ACCEPTED)
                    accepted.append(checked.text)
                    accepted_chars = projected

                    preview_piece = checked.text if len(accepted) == 1 else f" {checked.text}"
                    await self._preview.publish(
                        turn_id,
                        PreviewKind.DELTA,
                        preview_piece,
                        revision=0,
                    )
                    # The second and later chunks carry their leading separator, so a single
                    # sentence has no synthetic trailing whitespace while adjacent sentences
                    # still cannot be glued together by StreamAdapter.
                    yield preview_piece

                if failure is not None or budget_exhausted:
                    break

            self._timing.mark("llm_complete")
            answer = "".join(raw_parts)

            if accepted:
                reply_shortened = bool(failure or truncated or pending.strip() or budget_exhausted)
                final_text = " ".join(accepted)
                if failure is not None:
                    logger.warning(
                        "miithii dropped a later sentence after speech commit: %s (language=%s)",
                        failure.describe(),
                        self._policy.language,
                    )
                if truncated or pending.strip():
                    logger.warning(
                        "miithii withheld an incomplete model tail after %d accepted sentence(s) "
                        "(language=%s truncated=%s)",
                        len(accepted),
                        self._policy.language,
                        truncated,
                    )
                if budget_exhausted:
                    logger.info(
                        "miithii stopped at the turn budget after %d sentence(s) (language=%s)",
                        len(accepted),
                        self._policy.language,
                    )
                aggregate = CheckResult(
                    Verdict.REPAIRED
                    if failure is not None or truncated or pending.strip() or budget_exhausted
                    else Verdict.ACCEPTED,
                    final_text,
                    (),
                    tuple(accepted),
                    mood=mood,
                )
                await self._preview.publish_verdict(turn_id, aggregate)
                return

            # A one-line model answer has no newline, so the streaming header parser above never
            # got a chance to classify it. Full-answer validation treats that as ordinary speech
            # with neutral delivery rather than as a missing-control failure.
            if failure is None and mood is not None and pending.strip() and not truncated:
                failure = CheckResult(
                    Verdict.REJECTED,
                    "",
                    (Rejection.INCOMPLETE_SENTENCE,),
                    mood=mood,
                )

            check = await validate(
                answer,
                truncated=truncated,
                initial=failure,
            )
            if not check.speakable:
                await self._preview.publish_verdict(turn_id, check)
                finish(answer, check)
                return

            self._timing.mark("canonical_ready")
            if check.verdict is Verdict.REPAIRED:
                logger.info(
                    "miithii repaired an answer before speech: %d -> %d chars (%s)",
                    len(answer),
                    len(check.text),
                    self._policy.language,
                )
            await self._preview.publish(turn_id, PreviewKind.DELTA, check.text, revision=0)
            await self._preview.publish_verdict(turn_id, check)
            finish(answer, check)
            yield check.text

        async def tee() -> AsyncIterator[llm.ChatChunk | str | FlushSentinel]:
            accumulated: list[str] = []
            try:
                async for item in gate():
                    if not self._turns.may_deliver(turn_id) or (
                        speech is not None and speech.interrupted
                    ):
                        retire_interrupted_turn()
                        return
                    if isinstance(item, str):
                        accumulated.append(item)
                    yield item
            except (asyncio.CancelledError, GeneratorExit):
                retire_interrupted_turn()
                raise
            final_text = "".join(accumulated).strip()
            if final_text:
                await self._preview.publish(
                    turn_id, PreviewKind.END, final_text, shortened=reply_shortened,
                )

        return tee()


server = AgentServer(
    host="0.0.0.0",
    port=8081,
    # Modal gives the subprocess a bounded shutdown window. Keep LiveKit's own drain inside
    # that window so an update does not sit in a one-hour default drain and get killed by
    # the host afterwards.
    drain_timeout=25,
    # LiveKit's production default is eight idle job processes. That is wasteful inside a
    # single-CPU Modal container and shows up as a process-start burst after every deploy.
    # Keep one warm slot for the current alpha workload.
    num_idle_processes=1,
    # Each session holds a Sarvam websocket and a Bodhan-aware emitter, so the worker backs
    # off before it accepts more sessions than one warm container can serve.
    load_threshold=0.8,
    setup_fnc=setup,
)


@server.rtc_session(agent_name=configured_agent_name())
async def entrypoint(ctx: JobContext) -> None:
    # The reply language comes from the room, never from the process environment.
    #
    # One worker process serves every session, so a process-wide language would apply one
    # language to all of them: a Bodo user could have been answered in Assamese. The room name
    # is generated server-side for this session and is available at dispatch, before the client
    # participant joins. The token issuer writes the same canonical language into that
    # participant's signed attributes for the client to inspect; the worker does not read it.
    route = route_for_room(ctx.room.name)
    language = route.language
    voice_tier = route.voice_tier

    settings = load_settings()
    policy = get_policy(language)
    logger.info(
        "miithii session starting room=%s language=%s pack=%s tier=%s "
        "llm=%s/%s reasoning=%s stt=%s",
        ctx.room.name,
        policy.language,
        policy.version,
        voice_tier,
        settings.llm.provider,
        settings.llm.model,
        settings.llm.reasoning_effort or "default",
        policy.stt_locale,
    )

    # Built before the session so the TTS can be handed this session's timing sink. The agent
    # owns the turn clock; the TTS only reports its own latency into it.
    agent = MiithiiAgent(
        settings,
        policy,
        voice_tier,
        ctx.room,
        # `ctx.job` is a protobuf message; its identifier field is `id`, not `job_id`.
        session_id=ctx.job.id or ctx.room.name,
    )

    # Build TTS only after the agent exists, because Standard reports provider timing into that
    # session's clock. Provider/model/voice stay server-owned in `voice_tts`.
    tts_provider, tts_route = build_voice_tts(
        settings,
        policy,
        voice_tier,
        http_session=_shared_http_session(),
        on_bodhan_timing=agent._on_tts_timing,
    )
    logger.info(
        "miithii tts route language=%s tier=%s provider=%s model=%s voice=%s",
        policy.language,
        tts_route.tier,
        tts_route.provider,
        tts_route.model,
        tts_route.voice,
    )

    session = AgentSession(
        stt=build_stt(settings, policy),
        vad=vad_for(ctx.proc),
        llm=build_llm(settings.llm, policy),
        tts=tts_provider,
        turn_handling={
            # Explicit, because the auto-selected default is a turn detector that does not
            # support Assamese or Bodo.
            "turn_detection": "stt",
            "endpointing": {
                "min_delay": settings.min_endpointing_delay,
                "max_delay": settings.max_endpointing_delay,
            },
            # Every value here is set explicitly, because leaving them to defaults is what
            # produced the mid-sentence cutoffs.
            #
            # On any interruption LiveKit clears its shared audio output buffer, so whatever
            # audio was queued but unplayed is discarded. That is correct behaviour, and it
            # is why a false trigger is so expensive: it throws away real speech. These
            # settings decide how easily something is mistaken for the user taking the floor.
            #
            # `mode` is pinned to "vad" rather than auto-selected. Adaptive detection is
            # documented as a LiveKit Cloud feature; this agent runs on Modal, so relying on
            # the auto-selection risks getting neither adaptive behaviour nor the tuning built
            # around it.
            #
            # `min_duration` is raised because a phone speaker leaking into its own microphone
            # produces short blips, not 0.5s of speech. `min_words` requires a recognised
            # transcript, so a transient noise burst never becomes a turn. `false_interruption_
            # timeout` is raised so ordinary pauses between sentences are not classified as
            # the user cutting in, and `resume_false_interruption` restores the audio when
            # that happens, which is what turns a lost sentence back into a spoken one.
            "interruption": {
                "enabled": True,
                "mode": "vad",
                "min_duration": 0.8,
                "min_words": 2,
                "false_interruption_timeout": 3.0,
                "resume_false_interruption": True,
            },
            # TTS starts only once the turn is confirmed. Preemptive TTS would lower latency
            # but synthesise audio that is discarded on any correction, which is exactly the
            # waste that shows up as truncated speech.
            "preemptive_generation": {"preemptive_tts": False},
        },
        # Forward the TTS-aligned transcript so the client can highlight what is being said
        # in step with the audio rather than ahead of it.
        use_tts_aligned_transcript=True,
        # Canonical output has already passed Miithii's language gate. Let provider routing own
        # any delivery-only transformation instead of applying LiveKit's default text filters.
        tts_text_transforms=None,
    )
    session.on("agent_state_changed", agent._on_agent_state_changed)
    # llm_node binds retirement to the real SpeechHandle and generation cancellation.
    # A VAD overlap alone is not an interruption (it may be a resumable backchannel).
    session_closed = asyncio.Event()

    def on_session_closed(_event: Any) -> None:
        # A phone leaving or replacing the room is a real session boundary. Retire work
        # immediately, before a delayed provider response can publish another preview.
        agent.retire_session()
        session_closed.set()

    session.on("close", on_session_closed)

    # One tokenizer for the session rather than LiveKit's English-trained default.
    try:
        await session.start(
            room=ctx.room,
            agent=agent,
        )

        with contextlib.suppress(asyncio.CancelledError):
            await session_closed.wait()
    finally:
        # Worker cancellation and a failed start must also reject unfinished generation.
        if not session_closed.is_set():
            agent.retire_session()
        # The worker cancels an entrypoint before running its SDK shutdown callbacks.
        # Do not leave STT/TTS alive waiting for a close event that cleanup itself produces.
        try:
            await asyncio.wait_for(session.aclose(), timeout=10)
        except TimeoutError:
            logger.warning("session cleanup exceeded 10 seconds; turns already retired")


__all__ = [
    "MiithiiAgent",
    "build_llm",
    "build_stt",
    "build_tts",
    "build_vad",
    "entrypoint",
    "server",
]


if __name__ == "__main__":
    cli.run_app(server)
