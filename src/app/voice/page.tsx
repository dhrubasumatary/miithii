"use client";

import Link from "next/link";
import {
  AlertCircle,
  Check,
  CreditCard,
  Download,
  FileAudio,
  History,
  Languages,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthControls } from "@/components/auth/AuthControls";
import { estimateGenerationBilling, FREE_TRIAL_MINUTES } from "@/lib/billing/pricing";
import { cn } from "@/lib/utils";

type Detection = {
  languageCode: string;
  languageName: string;
  nativeName: string;
  script: string;
  confidence: number;
  accentMode: string;
  qualityStatus: string;
};

type VoiceChunk = {
  index: number;
  audioBase64?: string;
  audioUrl?: string;
  fileId?: string;
  mimeType: string;
  textLength: number;
};

type VoiceResult = {
  languageCode: string;
  voiceGender: string;
  voiceName: string;
  promptVersion: string;
  estimatedDurationSeconds: number;
  billing?: {
    estimatedMinutes: number;
    roundedCredits: number;
    internalCostInr: number;
    costFloorInrPerMinute: number;
  };
  generationId?: string | null;
  balanceAfter?: number | null;
  chunks: VoiceChunk[];
};

type GenerationHistory = {
  balanceMinutes: number | null;
  generations: Array<{
    id: string;
    languageCode: string;
    voiceName: string;
    estimatedDurationSeconds: number;
    creditsDebited: number;
    status: string;
    createdAt: string;
    audioFiles?: Array<{
      id: string;
      chunkIndex: number;
      textLength: number;
      mimeType: string;
    }>;
  }>;
};

type FeedbackRating = "perfect" | "wrong_accent" | "wrong_language" | "bad_pronunciation" | "skipped_words";

const emotionOptions = [
  { value: "neutral", label: "Neutral" },
  { value: "cheerful", label: "Cheerful" },
  { value: "excited", label: "Excited" },
  { value: "sad", label: "Sad" },
  { value: "serious", label: "Serious" },
  { value: "whispering", label: "Whisper" },
] as const;

type EmotionValue = (typeof emotionOptions)[number]["value"];

const sampleTexts: Array<{ label: string; text: string; emotion: EmotionValue }> = [
  {
    label: "Reel intro",
    text: "নমস্কাৰ বন্ধুসকল, আজি মই তোমালোকক এটা বিশেষ কথা কম",
    emotion: "cheerful",
  },
  {
    label: "Business promo",
    text: "আমাৰ নতুন প্ৰডাক্ট এতিয়া উপলব্ধ। আজিয়েই অৰ্ডাৰ কৰক।",
    emotion: "excited",
  },
  {
    label: "Story narration",
    text: "বহুত দিনৰ আগতে, এখন সৰু গাঁৱত এজন ল'ৰা আছিল।",
    emotion: "neutral",
  },
  {
    label: "Latin demo",
    text: "Nomoskar bondhu hokolok, aaji moi tumalokak eta bisesh kotha kom",
    emotion: "cheerful",
  },
];

const feedbackOptions = [
  { value: "perfect", label: "Perfect" },
  { value: "wrong_accent", label: "Wrong accent" },
  { value: "wrong_language", label: "Wrong language" },
  { value: "bad_pronunciation", label: "Pronunciation" },
  { value: "skipped_words", label: "Skipped words" },
] as const;

function formatDuration(seconds: number) {
  if (!seconds) return "0s";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) return `${FREE_TRIAL_MINUTES.toFixed(1)} min`;
  return `${Number(value.toFixed(1))} min`;
}

function formatCredits(value: number) {
  if (!value) return "0 min";
  return `${Number(value.toFixed(2))} min`;
}

function safeFileName(text: string) {
  const cleaned = text
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 36);
  return cleaned || "miithii-voice";
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export default function VoicePage() {
  const [text, setText] = useState("");
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("female");
  const [emotion, setEmotion] = useState<EmotionValue>("neutral");
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating | null>(null);
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const trimmedText = text.trim();
  const textReady = trimmedText.length >= 12;
  const wordCount = useMemo(() => trimmedText.split(/\s+/).filter(Boolean).length, [trimmedText]);
  const estimatedSeconds = useMemo(
    () => result?.estimatedDurationSeconds || Math.max(0, Math.round(wordCount / 2.1)),
    [result, wordCount]
  );
  const estimatedCredits = useMemo(
    () => (estimatedSeconds > 0 ? estimateGenerationBilling(estimatedSeconds).roundedCredits : 0),
    [estimatedSeconds]
  );
  const activeCredits = result?.billing?.roundedCredits || estimatedCredits;
  const availableMinutes = result?.balanceAfter ?? history?.balanceMinutes ?? FREE_TRIAL_MINUTES;
  const canGenerate = Boolean(textReady && !generating);

  useEffect(() => {
    if (trimmedText.length < 12) {
      setDetecting(false);
      setDetection(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setDetecting(true);

      try {
        const res = await fetch("/api/detect-language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmedText }),
        });
        const data = await res.json();
        if (!cancelled && res.ok) setDetection(data);
      } catch {
        // Detection is non-blocking; ignore failures.
      } finally {
        if (!cancelled) setDetecting(false);
      }
    }, 360);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmedText]);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    setFeedbackRating(null);
    setFeedbackState("idle");
  }, [result]);

  useEffect(() => {
    if (!result || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      document.getElementById("generated-voice")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [result]);

  async function loadHistory() {
    try {
      const res = await fetch("/api/generations");
      if (!res.ok) return;
      setHistory(await res.json());
    } catch {
      // Optional until Supabase is connected.
    }
  }

  function updateText(value: string) {
    setText(value);
    setDetection(null);
    setResult(null);
    setError(null);
  }

  function applySample(sample: (typeof sampleTexts)[number]) {
    setText(sample.text);
    setEmotion(sample.emotion);
    setDetection(null);
    setResult(null);
    setError(null);
  }

  async function generate() {
    if (!canGenerate) return;

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmedText,
          languageCode: detection?.languageCode || "as-IN",
          voiceGender,
          emotion,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not generate voice.");
      } else {
        setResult(data);
        loadHistory();
      }
    } catch {
      setError("Voice generation is unavailable.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadChunk(chunk: VoiceChunk) {
    if (chunk.audioUrl) {
      const link = document.createElement("a");
      const ext = chunk.mimeType.includes("wav") ? "wav" : "audio";
      link.href = chunk.audioUrl;
      link.download = `${safeFileName(trimmedText)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    if (!chunk.audioBase64) {
      setError("Download URL is not available. Try the export history.");
      return;
    }

    const link = document.createElement("a");
    const ext = chunk.mimeType.includes("wav") ? "wav" : "audio";
    link.href = `data:${chunk.mimeType};base64,${chunk.audioBase64}`;
    link.download = `${safeFileName(trimmedText)}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function shareChunk(chunk: VoiceChunk) {
    try {
      const ext = chunk.mimeType.includes("wav") ? "wav" : "audio";
      const blob = chunk.audioUrl
        ? await fetch(chunk.audioUrl).then((response) => response.blob())
        : chunk.audioBase64
          ? base64ToBlob(chunk.audioBase64, chunk.mimeType)
          : null;

      if (!blob) {
        setError("Sharing is not available for this audio file yet. Download it instead.");
        return;
      }

      const file = new File([blob], `${safeFileName(trimmedText)}.${ext}`, {
        type: chunk.mimeType,
      });
      const shareData: ShareData = {
        title: "Miithii Voice",
        text: `${detection?.languageName || "Regional"} voice generated with Miithii`,
        files: [file],
      };
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.share && (!nav.canShare || nav.canShare(shareData))) {
        await nav.share(shareData);
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: shareData.title, text: shareData.text });
        return;
      }
      setError("Sharing is not supported in this browser. Download the file instead.");
    } catch (shareError) {
      if ((shareError as Error)?.name !== "AbortError") setError("Could not open sharing. Download the file instead.");
    }
  }

  async function downloadStoredGeneration(generationId: string, fileId?: string) {
    try {
      const params = fileId ? `?fileId=${encodeURIComponent(fileId)}` : "";
      const res = await fetch(`/api/generations/${generationId}/download${params}`);
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || "Could not prepare this download.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Could not prepare this download.");
    }
  }

  async function sendFeedback(rating: FeedbackRating) {
    if (!result) return;

    setFeedbackRating(rating);
    setFeedbackState("sending");

    try {
      const res = await fetch("/api/voice-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          languageCode: result.languageCode,
          script: detection?.script || "Unknown",
          voiceGender: result.voiceGender,
          voiceName: result.voiceName,
          promptVersion: result.promptVersion,
          textLength: trimmedText.length,
          chunkCount: result.chunks.length,
          estimatedDurationSeconds: result.estimatedDurationSeconds,
        }),
      });
      setFeedbackState(res.ok ? "sent" : "error");
    } catch {
      setFeedbackState("error");
    }
  }

  const generateLabel = generating ? "Rendering..." : result ? "Regenerate voice" : "Generate voice";
  const primaryChunk = result?.chunks?.[0];

  return (
    <div className="min-h-screen bg-[#f4f5ef] text-[#111311]">
      <AppHeader activeCredits={activeCredits} availableMinutes={availableMinutes} />

      <main className="mx-auto w-full max-w-3xl px-3 pb-40 pt-4 sm:px-5 sm:pb-10 sm:pt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">Generate voice</h1>
            <p className="truncate text-xs text-black/45 sm:text-sm">
              Paste Assamese, Bodo, Manipuri, Hindi, Bengali, or English text.
            </p>
          </div>
          <DetectionBadge detection={detection} detecting={detecting} />
        </div>

        <div className="relative">
          <textarea
            value={text}
            onChange={(event) => updateText(event.target.value)}
            placeholder="Paste your script here. Tap a sample below to try a template."
            disabled={generating}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            data-ms-editor="false"
            className={cn(
              "block min-h-[160px] w-full resize-y rounded-2xl border border-[#d9d4c9] bg-white px-4 py-4 text-[16px] leading-7 text-[#111311] shadow-sm outline-none placeholder:text-black/28 focus:border-[#30D158] focus:ring-2 focus:ring-[#30D158]/30 sm:min-h-[200px] sm:text-[18px]",
              generating && "text-black/32"
            )}
          />
          <div className="pointer-events-none absolute bottom-3 right-4 text-xs text-black/38">
            {text.length} chars
          </div>
        </div>

        <SampleRow onApply={applySample} disabled={generating} />

        <InlineControls
          voiceGender={voiceGender}
          onVoiceGenderChange={setVoiceGender}
          emotion={emotion}
          onEmotionChange={setEmotion}
          disabled={generating}
        />

        {!textReady && trimmedText.length > 0 && (
          <p className="mt-3 text-xs text-black/45">Add a bit more text to enable Generate.</p>
        )}

        {error && (
          <div className="mt-4">
            <ErrorNotice message={error} />
          </div>
        )}

        <div className="mt-4 hidden sm:block">
          <GenerateButton
            generating={generating}
            disabled={!canGenerate}
            onClick={generate}
            label={generateLabel}
          />
          {textReady && (
            <p className="mt-2 text-center text-xs text-black/42">
              {formatDuration(estimatedSeconds)} · uses {formatCredits(activeCredits)} · {formatMinutes(availableMinutes)} left
            </p>
          )}
        </div>

        {result && primaryChunk && (
          <GeneratedVoice
            chunk={primaryChunk}
            detection={detection}
            feedbackRating={feedbackRating}
            feedbackState={feedbackState}
            onDownload={downloadChunk}
            onFeedback={sendFeedback}
            onShare={shareChunk}
            result={result}
          />
        )}

        <RecentExports history={history} onDownload={downloadStoredGeneration} />
      </main>

      {textReady && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d9d4c9] bg-[#f4f5ef]/96 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-md sm:hidden">
          <GenerateButton
            generating={generating}
            disabled={!canGenerate}
            onClick={generate}
            label={generateLabel}
          />
          <p className="mt-2 text-center text-xs text-black/42">
            {formatDuration(estimatedSeconds)} · uses {formatCredits(activeCredits)}
          </p>
        </div>
      )}
    </div>
  );
}

function AppHeader({ activeCredits, availableMinutes }: { activeCredits: number; availableMinutes: number }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#ddd8cc]/80 bg-[#f6f5ef]/86 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-5">
        <Link href="/voice" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80">
          <BrandMark />
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">Miithii</span>
            <span className="hidden truncate text-[11px] text-black/42 sm:block">Assamese voice</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <QuotaMini activeCredits={activeCredits} availableMinutes={availableMinutes} />
          <AuthControls compact />
        </div>
      </div>
    </header>
  );
}

function SampleRow({
  onApply,
  disabled,
}: {
  onApply: (sample: (typeof sampleTexts)[number]) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-3 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <div className="flex gap-2 pb-1">
        {sampleTexts.map((sample) => (
          <button
            key={sample.label}
            type="button"
            disabled={disabled}
            onClick={() => onApply(sample)}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#d9d4c9] bg-white px-3 py-2 text-xs font-semibold text-black/64 transition-colors hover:border-black/22 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-3 w-3 text-[#147a35]" />
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function InlineControls({
  voiceGender,
  onVoiceGenderChange,
  emotion,
  onEmotionChange,
  disabled,
}: {
  voiceGender: "male" | "female";
  onVoiceGenderChange: (gender: "male" | "female") => void;
  emotion: EmotionValue;
  onEmotionChange: (emotion: EmotionValue) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-[#d9d4c9] bg-white p-3 sm:p-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-black/42">Voice</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onVoiceGenderChange("female")}
            className={cn(
              "rounded-full px-3 py-2 text-xs font-semibold transition-colors",
              voiceGender === "female"
                ? "bg-[#30D158] text-black"
                : "border border-[#d9d4c9] text-black/52 hover:text-black"
            )}
          >
            ♀ Female
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onVoiceGenderChange("male")}
            className={cn(
              "rounded-full px-3 py-2 text-xs font-semibold transition-colors",
              voiceGender === "male"
                ? "bg-[#30D158] text-black"
                : "border border-[#d9d4c9] text-black/52 hover:text-black"
            )}
          >
            ♂ Male
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-black/42">Emotion</p>
        <div className="-mx-1 flex flex-wrap gap-2 px-1">
          {emotionOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onEmotionChange(option.value)}
              className={cn(
                "inline-flex h-9 flex-shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition-colors",
                emotion === option.value
                  ? "border-[#30D158] bg-[#30D158] text-black"
                  : "border-[#d8d3c7] bg-white text-black/52 hover:border-black/20 hover:text-black"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenerateButton({
  generating,
  disabled,
  onClick,
  label,
}: {
  generating: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#30D158] px-4 text-sm font-semibold text-black shadow-[0_12px_28px_rgba(48,209,88,0.28)] transition-colors hover:bg-[#28b14b] disabled:cursor-not-allowed disabled:bg-black/16 disabled:text-black/42 disabled:shadow-none"
    >
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileAudio className="h-4 w-4" />}
      {label}
    </button>
  );
}

function DetectionBadge({
  detection,
  detecting,
}: {
  detection: Detection | null;
  detecting: boolean;
}) {
  if (detecting) {
    return (
      <div className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#b8c9e8] bg-[#eef5ff] px-2.5 py-1 text-[11px] font-semibold text-[#1958b8]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Detecting
      </div>
    );
  }

  if (!detection) return null;
  if (detection.languageCode === "unknown") {
    return (
      <div className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#d9d4c9] bg-white px-2.5 py-1 text-[11px] font-semibold text-black/52">
        <Languages className="h-3 w-3" />
        Auto-detect
      </div>
    );
  }

  return (
    <div className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#93dba5] bg-[#edf9ef] px-2.5 py-1 text-[11px] font-semibold text-[#147a35]">
      <Check className="h-3 w-3" />
      Detected: {detection.languageName}
    </div>
  );
}

function GeneratedVoice({
  chunk,
  detection,
  feedbackRating,
  feedbackState,
  onDownload,
  onFeedback,
  onShare,
  result,
}: {
  chunk: VoiceChunk;
  detection: Detection | null;
  feedbackRating: FeedbackRating | null;
  feedbackState: "idle" | "sending" | "sent" | "error";
  onDownload: (chunk: VoiceChunk) => void;
  onFeedback: (rating: FeedbackRating) => void;
  onShare: (chunk: VoiceChunk) => void;
  result: VoiceResult;
}) {
  const audioSrc = chunk.audioUrl || (chunk.audioBase64 ? `data:${chunk.mimeType};base64,${chunk.audioBase64}` : undefined);

  return (
    <section
      id="generated-voice"
      className="mt-6 scroll-mt-20 rounded-2xl border border-[#93dba5] bg-[#fbfaf6] p-3 shadow-[0_18px_60px_rgba(48,209,88,0.12)] sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">
            {detection?.languageName || result.languageCode} voice ready
          </p>
          <p className="mt-0.5 truncate text-xs text-black/42">
            {formatDuration(result.estimatedDurationSeconds)} · {result.voiceName} · {result.promptVersion}
          </p>
        </div>
      </div>

      {audioSrc ? (
        <audio autoPlay controls className="w-full" src={audioSrc} />
      ) : (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-black/48">
          Audio is stored in history. Use download to fetch a fresh link.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onDownload(chunk)}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#30D158] px-4 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(48,209,88,0.24)] transition-colors hover:bg-[#28b14b]"
        >
          <Download className="h-4 w-4" />
          Download WAV
        </button>
        <button
          type="button"
          onClick={() => onShare(chunk)}
          aria-label="Share audio"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-[#d8d3c7] bg-white text-black/68 transition-colors hover:bg-[#111311] hover:text-white"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      <AccentFeedback feedbackRating={feedbackRating} feedbackState={feedbackState} onFeedback={onFeedback} />
    </section>
  );
}

function RecentExports({
  history,
  onDownload,
}: {
  history: GenerationHistory | null;
  onDownload: (generationId: string, fileId?: string) => void;
}) {
  const generations = history?.generations || [];
  if (generations.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-[#d9d4c9] bg-[#fbfaf6] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef5ff] text-[#1958b8]">
            <History className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Recent exports</h2>
            <p className="text-xs text-black/42">Re-downloads do not use credits.</p>
          </div>
        </div>
        <Link href="/pricing" className="text-xs font-semibold text-[#147a35] hover:text-[#0c5d27]">
          Add minutes
        </Link>
      </div>

      <div className="space-y-2">
        {generations.slice(0, 4).map((generation) => {
          const firstFile = generation.audioFiles?.[0];
          return (
            <div key={generation.id} className="flex items-center gap-3 rounded-xl border border-[#ece8dc] bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {generation.languageCode} · {formatDuration(generation.estimatedDurationSeconds)}
                </p>
                <p className="mt-0.5 truncate text-xs text-black/42">
                  {formatCredits(generation.creditsDebited)} used ·{" "}
                  {new Date(generation.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDownload(generation.id, firstFile?.id)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#d8d3c7] bg-white text-black/68 transition-colors hover:bg-[#111311] hover:text-white"
                aria-label={`Download export ${generation.id}`}
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AccentFeedback({
  feedbackRating,
  feedbackState,
  onFeedback,
}: {
  feedbackRating: FeedbackRating | null;
  feedbackState: "idle" | "sending" | "sent" | "error";
  onFeedback: (rating: FeedbackRating) => void;
}) {
  return (
    <div className="mt-4 border-t border-[#ebe6dc] pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">How was the accent?</p>
        {feedbackState === "sending" && <Loader2 className="h-4 w-4 animate-spin text-black/36" />}
        {feedbackState === "sent" && <span className="text-xs font-semibold text-[#147a35]">Saved</span>}
        {feedbackState === "error" && <span className="text-xs font-semibold text-[#9b2c25]">Try again</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {feedbackOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onFeedback(option.value)}
            className={cn(
              "inline-flex h-9 flex-shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition-colors",
              feedbackRating === option.value
                ? "border-[#30D158] bg-[#30D158] text-black"
                : "border-[#d8d3c7] bg-white text-black/52 hover:border-black/20 hover:text-black"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuotaMini({ activeCredits, availableMinutes }: { activeCredits: number; availableMinutes: number }) {
  const progress = Math.max(8, Math.min(100, (availableMinutes / FREE_TRIAL_MINUTES) * 100));

  return (
    <Link
      href="/pricing"
      aria-label={`${formatMinutes(availableMinutes)} voice credits left. Buy more minutes.`}
      className="group inline-flex h-11 min-w-[116px] flex-col justify-center rounded-xl border border-[#d9d4c9] bg-white/90 px-3 shadow-sm backdrop-blur transition-colors hover:border-black/20 sm:min-w-[142px]"
    >
      <span className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/38">
        Credits
        <CreditCard className="h-3.5 w-3.5" />
      </span>
      <span className="mb-1 truncate text-xs font-semibold text-[#111311]">{formatMinutes(availableMinutes)} left</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-[#ece8dc]">
        <span className="block h-full rounded-full bg-[#30D158]" style={{ width: `${progress}%` }} />
      </span>
      {activeCredits > 0 && <span className="sr-only">Current text uses {formatCredits(activeCredits)}</span>}
    </Link>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex gap-2 rounded-xl border border-[#d93f35]/20 bg-[#fff1ef] p-3 text-sm text-[#9b2c25]">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#30D158] text-black shadow-sm">
      <span className="text-base font-black leading-none" style={{ fontFamily: "system-ui" }}>
        ম
      </span>
    </div>
  );
}
