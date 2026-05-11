"use client";

import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  FileAudio,
  History,
  Languages,
  Loader2,
  Mic2,
  Play,
  Share2,
  Sparkles,
  X,
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

const voiceOptions = [
  { value: "female", label: "Warm female", description: "Soft narration for stories, lessons, reels" },
  { value: "male", label: "Clear male", description: "Crisp narration for explainers and demos" },
] as const;

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
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory | null>(null);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
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
  const detectedLanguageReady = Boolean(detection && detection.languageCode !== "unknown");
  const canGenerate = Boolean(textReady && detectedLanguageReady && !detecting && !generating);
  const selectedVoice = voiceOptions.find((voice) => voice.value === voiceGender) || voiceOptions[0];

  useEffect(() => {
    if (trimmedText.length < 12) {
      setDetecting(false);
      setDetection(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setDetecting(true);
      setError(null);

      try {
        const res = await fetch("/api/detect-language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmedText }),
        });
        const data = await res.json();
        if (!cancelled && res.ok) setDetection(data);
      } catch {
        if (!cancelled) setError("Language detection is unavailable.");
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
    if (!window.matchMedia("(max-width: 767px)").matches) return;

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
          languageCode: detection?.languageCode || "unknown",
          voiceGender,
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
      link.download = `${safeFileName(trimmedText)}-${chunk.index + 1}.${ext}`;
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
    link.download = `${safeFileName(trimmedText)}-${chunk.index + 1}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function downloadAllChunks() {
    result?.chunks.forEach((chunk, index) => {
      window.setTimeout(() => downloadChunk(chunk), index * 160);
    });
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

      const file = new File([blob], `${safeFileName(trimmedText)}-${chunk.index + 1}.${ext}`, {
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

  return (
    <div className="min-h-screen overflow-y-auto bg-[#f4f5ef] text-[#111311]">

      <AppHeader activeCredits={activeCredits} availableMinutes={availableMinutes} />

      <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-2 pb-28 pt-3 sm:px-5 sm:pb-6 sm:pt-5">
        <section className="w-full min-w-0 overflow-hidden rounded-[1.1rem] border border-[#d9d4c9] bg-[#fbfaf6] shadow-[0_18px_70px_rgba(16,17,15,0.08)] sm:rounded-[1.25rem]">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#ded9cd] bg-white px-3 sm:px-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#30D158] text-black">
                  <FileAudio className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold sm:text-base">New voice export</h1>
                  <p className="truncate text-xs text-black/45">Assamese-first · WAV download · Gemini TTS</p>
                </div>
              </div>
            </div>
            <Link href="/pricing" className="hidden rounded-full border border-[#d9d4c9] bg-[#fbfaf6] px-3 py-2 text-xs font-semibold text-black/58 transition-colors hover:text-black sm:inline-flex">
              Buy minutes
            </Link>
          </div>

          <div className="grid min-h-[calc(100svh-9.5rem)] min-w-0 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 overflow-hidden border-b border-[#ded9cd] bg-[#f7f8f2] p-2 lg:border-b-0 lg:border-r lg:p-4">
              <VoiceComposer
                activeCredits={activeCredits}
                detection={detection}
                detecting={detecting}
                estimatedSeconds={estimatedSeconds}
                generating={generating}
                onTextChange={updateText}
                selectedVoice={selectedVoice.label}
                text={text}
              />
            </div>

            <ExportPanel
              activeCredits={activeCredits}
              availableMinutes={availableMinutes}
              canGenerate={canGenerate}
              detection={detection}
              detecting={detecting}
              error={error}
              feedbackRating={feedbackRating}
              feedbackState={feedbackState}
              generating={generating}
              history={history}
              onDownload={downloadChunk}
              onDownloadAll={downloadAllChunks}
              onDownloadStored={downloadStoredGeneration}
              onFeedback={sendFeedback}
              onGenerate={generate}
              onShare={shareChunk}
              onVoicePickerOpen={() => setVoicePickerOpen(true)}
              result={result}
              selectedVoice={selectedVoice.label}
              textReady={textReady}
            />
          </div>
        </section>
      </main>

      <VoicePickerSheet
        open={voicePickerOpen}
        onClose={() => setVoicePickerOpen(false)}
        onVoiceGenderChange={setVoiceGender}
        voiceGender={voiceGender}
      />
    </div>
  );
}

function AppHeader({ activeCredits, availableMinutes }: { activeCredits: number; availableMinutes: number }) {
  return (
    <header className="sticky top-0 z-50 overflow-x-hidden border-b border-[#ddd8cc]/80 bg-[#f6f5ef]/86 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
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

function VoiceComposer({
  activeCredits,
  detection,
  detecting,
  estimatedSeconds,
  generating,
  onTextChange,
  selectedVoice,
  text,
}: {
  activeCredits: number;
  detection: Detection | null;
  detecting: boolean;
  estimatedSeconds: number;
  generating: boolean;
  onTextChange: (value: string) => void;
  selectedVoice: string;
  text: string;
}) {
  const empty = !text.trim();

  return (
    <div className="relative h-full min-h-[360px] min-w-0 sm:min-h-[430px]">
      <DetectionOrbitBadge detection={detection} detecting={detecting} />

      <div
        className={cn(
          "group relative flex h-full min-h-[320px] min-w-0 flex-col overflow-hidden rounded-[0.9rem] border bg-white shadow-sm transition-all duration-500 sm:min-h-[560px] sm:rounded-[1rem]",
          detecting && "border-[#b8c9e8] shadow-[0_30px_90px_rgba(25,88,184,0.11)]",
          detection && "border-[#93dba5] shadow-[0_30px_90px_rgba(48,209,88,0.16)]",
          !detecting && !detection && "border-[#d9d4c9]",
          generating && "scale-[0.985] border-[#30D158] bg-[#edf9ef]/88"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(48,209,88,0.12),transparent_44%)] opacity-80" />
        <div className="relative z-20 flex min-w-0 items-center justify-between gap-2 border-b border-[#ebe6dc] px-3 py-3 sm:gap-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/36">Script</p>
            <p className="mt-0.5 truncate text-sm font-medium text-[#111311]">Paste or write text</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf9ef] px-2 py-1 text-[11px] font-semibold text-[#147a35] sm:px-2.5">
              <Sparkles className="h-3 w-3" />
              Auto
            </span>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Paste Assamese text here. Bodo, Manipuri, Hindi, Bengali, and English are detected automatically."
          disabled={generating}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
          data-ms-editor="false"
          className={cn(
            "relative z-10 min-h-0 w-full min-w-0 flex-1 resize-none bg-transparent px-3 pb-16 pt-4 text-[16px] leading-7 text-[#111311] outline-none placeholder:text-black/28 sm:px-6 sm:pb-20 sm:pt-6 sm:text-[24px] sm:leading-10",
            generating && "text-black/32"
          )}
        />

        {generating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#edf9ef]/88 px-8 text-center backdrop-blur-xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-[#30D158] text-black shadow-sm">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-xl font-semibold text-[#111311]">Rendering {detection?.languageName || "regional"} voice</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-black/52">Preserving original words, accent, and sentence rhythm.</p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[#ebe6dc] bg-white/76 px-3 py-3 text-xs text-black/38 backdrop-blur sm:px-6">
          <span>{empty ? "Assamese first" : `${text.length} chars`}</span>
          <span>{empty ? "WAV export" : selectedVoice}</span>
        </div>
      </div>

      {!empty && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-black/36">
          <span>{formatDuration(estimatedSeconds)}</span>
          <span>·</span>
          <span>uses {formatCredits(activeCredits)}</span>
        </div>
      )}
    </div>
  );
}

function DetectionOrbitBadge({
  detection,
  detecting,
}: {
  detection: Detection | null;
  detecting: boolean;
}) {
  if (detecting) {
    return (
      <div className="absolute right-2 top-3 z-30 inline-flex max-w-[48%] animate-slide-up items-center gap-1.5 truncate rounded-full border border-[#b8c9e8] bg-[#eef5ff]/96 px-2 py-1.5 text-xs font-semibold text-[#1958b8] shadow-[0_10px_30px_rgba(25,88,184,0.16)] backdrop-blur sm:right-3 sm:max-w-none sm:gap-2 sm:px-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Detecting
      </div>
    );
  }

  if (detection) {
    const unknown = detection.languageCode === "unknown";
    return (
      <div className={cn(
        "absolute right-2 top-3 z-30 inline-flex max-w-[54%] animate-slide-up items-center gap-1.5 rounded-full border px-2 py-1.5 text-xs font-semibold shadow-[0_10px_30px_rgba(48,209,88,0.18)] backdrop-blur sm:right-3 sm:max-w-none sm:gap-2 sm:px-3",
        unknown
          ? "border-[#e1dccf] bg-white/96 text-black/56"
          : "border-[#93dba5] bg-[#edf9ef]/96 text-[#147a35]"
      )}>
        {unknown ? <Languages className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        <span className="truncate">{unknown ? "Language unclear" : detection.languageName}</span>
        <span className="hidden rounded-full bg-white/76 px-1.5 py-0.5 font-mono text-[10px] uppercase text-black/46 sm:inline">{detection.languageCode}</span>
      </div>
    );
  }

  return null;
}

function ExportPanel({
  activeCredits,
  availableMinutes,
  canGenerate,
  detection,
  detecting,
  error,
  feedbackRating,
  feedbackState,
  generating,
  history,
  onDownload,
  onDownloadAll,
  onDownloadStored,
  onFeedback,
  onGenerate,
  onShare,
  onVoicePickerOpen,
  result,
  selectedVoice,
  textReady,
}: {
  activeCredits: number;
  availableMinutes: number;
  canGenerate: boolean;
  detection: Detection | null;
  detecting: boolean;
  error: string | null;
  feedbackRating: FeedbackRating | null;
  feedbackState: "idle" | "sending" | "sent" | "error";
  generating: boolean;
  history: GenerationHistory | null;
  onDownload: (chunk: VoiceChunk) => void;
  onDownloadAll: () => void;
  onDownloadStored: (generationId: string, fileId?: string) => void;
  onFeedback: (rating: FeedbackRating) => void;
  onGenerate: () => void;
  onShare: (chunk: VoiceChunk) => void;
  onVoicePickerOpen: () => void;
  result: VoiceResult | null;
  selectedVoice: string;
  textReady: boolean;
}) {
  const languageLabel = detecting
    ? "Detecting"
    : detection?.languageCode === "unknown"
      ? "Needs clearer text"
      : detection?.languageName || "Not detected";
  const generateLabel = generating
    ? "Rendering voice"
    : detecting
      ? "Detecting language"
    : detection?.languageCode && detection.languageCode !== "unknown"
      ? `${result ? "Regenerate" : "Generate"} ${detection.languageName} voice`
      : detection?.languageCode === "unknown"
        ? "Use clearer text"
      : textReady
        ? "Waiting for language"
        : "Paste text first";

  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white lg:min-h-[420px]">
      <div className="hidden grid-cols-2 border-b border-[#ded9cd] sm:grid">
        <PanelMetric label="Credits left" value={`${formatMinutes(availableMinutes)} left`} />
        <PanelMetric label="Will use" value={formatCredits(activeCredits)} />
      </div>

      <div className="space-y-3 border-b border-[#ded9cd] p-3 sm:p-4">
        {error && <ErrorNotice message={error} />}

        <button
          onClick={onVoicePickerOpen}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#d9d4c9] bg-white px-3 text-sm font-semibold text-black/64 transition-colors hover:border-black/20 hover:text-black"
        >
          <span className="inline-flex items-center gap-2">
            <Mic2 className="h-4 w-4" />
            {selectedVoice}
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>

        <button
          disabled={!canGenerate || generating}
          onClick={onGenerate}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#111311] px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(17,19,17,0.16)] transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-black/16 disabled:text-black/42 disabled:shadow-none"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileAudio className="h-4 w-4" />}
          {generateLabel}
        </button>

        <div className="rounded-xl border border-[#e5e0d6] bg-[#fbfaf6] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-black/36">Language</span>
            <span className={cn(
              "rounded-full px-2 py-1 text-xs font-semibold",
              detection?.languageCode && detection.languageCode !== "unknown"
                ? "bg-[#edf9ef] text-[#147a35]"
                : "bg-[#f1efe5] text-black/48"
            )}>
              {detection?.languageCode && detection.languageCode !== "unknown" ? detection.languageCode : "auto"}
            </span>
          </div>
          <p className="text-base font-semibold text-[#111311]">{languageLabel}</p>
          <p className="mt-1 text-sm leading-5 text-black/48">
            {detection?.languageCode === "unknown"
              ? "Paste a longer Assamese, Bodo, Manipuri, Hindi, Bengali, or English line."
              : detection
                ? `${detection.accentMode} · ${detection.script}`
              : "Detection starts automatically after enough text is entered."}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {result ? (
          <GeneratedVoice
            detection={detection}
            feedbackRating={feedbackRating}
            feedbackState={feedbackState}
            onDownload={onDownload}
            onDownloadAll={onDownloadAll}
            onFeedback={onFeedback}
            onShare={onShare}
            result={result}
          />
        ) : (
          <RecentExports history={history} onDownload={onDownloadStored} />
        )}
      </div>
    </aside>
  );
}

function PanelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/34">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-[#111311]">{value}</p>
    </div>
  );
}

function GeneratedVoice({
  detection,
  feedbackRating,
  feedbackState,
  onDownload,
  onDownloadAll,
  onFeedback,
  onShare,
  result,
}: {
  detection: Detection | null;
  feedbackRating: FeedbackRating | null;
  feedbackState: "idle" | "sending" | "sent" | "error";
  onDownload: (chunk: VoiceChunk) => void;
  onDownloadAll: () => void;
  onFeedback: (rating: FeedbackRating) => void;
  onShare: (chunk: VoiceChunk) => void;
  result: VoiceResult;
}) {
  return (
    <div id="generated-voice" className="scroll-mt-16 rounded-xl border border-[#d9d4c9] bg-[#fbfaf6] p-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{detection?.languageName || result.languageCode} voice ready</p>
          <p className="mt-1 truncate text-xs text-black/42">
            {formatDuration(result.estimatedDurationSeconds)} · {result.voiceName} · {result.promptVersion}
          </p>
        </div>
        {result.chunks.length > 1 && (
          <button
            onClick={onDownloadAll}
            className="inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-full bg-[#111311] px-4 text-xs font-semibold text-white transition-colors hover:bg-black"
          >
            <Download className="h-3.5 w-3.5" />
            All
          </button>
        )}
      </div>

      <div className="space-y-3">
        {result.chunks.map((chunk) => (
          <AudioObject key={chunk.index} chunk={chunk} onDownload={onDownload} onShare={onShare} />
        ))}
      </div>

      <AccentFeedback feedbackRating={feedbackRating} feedbackState={feedbackState} onFeedback={onFeedback} />
    </div>
  );
}

function AudioObject({
  chunk,
  onDownload,
  onShare,
}: {
  chunk: VoiceChunk;
  onDownload: (chunk: VoiceChunk) => void;
  onShare: (chunk: VoiceChunk) => void;
}) {
  const audioSrc = chunk.audioUrl || (chunk.audioBase64 ? `data:${chunk.mimeType};base64,${chunk.audioBase64}` : undefined);

  return (
    <div className="rounded-xl border border-[#e2ded3] bg-white p-3">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#111311] text-white">
          <Play className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Audio {chunk.index + 1}</p>
          <p className="truncate text-xs text-black/42">{chunk.textLength} chars · WAV</p>
        </div>
        <button
          onClick={() => onShare(chunk)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8d3c7] bg-white text-black/68 transition-colors hover:bg-[#111311] hover:text-white"
          aria-label={`Share audio ${chunk.index + 1}`}
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDownload(chunk)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8d3c7] bg-white text-black/68 transition-colors hover:bg-[#111311] hover:text-white"
          aria-label={`Download audio ${chunk.index + 1}`}
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      {audioSrc ? (
        <audio controls className="w-full" src={audioSrc} />
      ) : (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-black/48">Audio is stored in history. Use download to fetch a fresh link.</p>
      )}
    </div>
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
  if (generations.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-[#d9d4c9] bg-[#fbfaf6] p-4">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef5ff] text-[#1958b8]">
          <History className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold">No exports yet</h2>
        <p className="mt-1 text-sm leading-5 text-black/48">Generated files will appear here for replay and free re-download.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#d9d4c9] bg-[#fbfaf6] p-3">
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
                <p className="truncate text-sm font-semibold">{generation.languageCode} · {formatDuration(generation.estimatedDurationSeconds)}</p>
                <p className="mt-0.5 truncate text-xs text-black/42">
                  {formatCredits(generation.creditsDebited)} used · {new Date(generation.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </p>
              </div>
              <button
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

function VoicePickerSheet({
  onClose,
  onVoiceGenderChange,
  open,
  voiceGender,
}: {
  onClose: () => void;
  onVoiceGenderChange: (gender: "male" | "female") => void;
  open: boolean;
  voiceGender: "male" | "female";
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/24 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-[1.8rem] border border-[#d9d4c9] bg-[#fbfaf6] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">Choose voice</p>
            <p className="mt-1 text-sm text-black/48">Miithii keeps the accent prompt layer separate from voice tone.</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black/56 transition-colors hover:text-black" aria-label="Close voice picker">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {voiceOptions.map((voice) => (
            <button
              key={voice.value}
              onClick={() => {
                onVoiceGenderChange(voice.value);
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-[1.2rem] border p-3 text-left transition-colors",
                voiceGender === voice.value ? "border-[#30D158] bg-[#edf9ef]" : "border-[#e2ded3] bg-white hover:border-black/18"
              )}
            >
              <span className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl", voiceGender === voice.value ? "bg-[#30D158] text-black" : "bg-[#f1eee5] text-black/54")}>
                <Mic2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{voice.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-black/46">{voice.description}</span>
              </span>
              {voiceGender === voice.value && <Check className="h-4 w-4 text-[#147a35]" />}
            </button>
          ))}
        </div>
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
