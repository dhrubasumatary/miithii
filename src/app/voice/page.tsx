"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Detection = { languageCode: string; languageName: string; nativeName: string; script: string; confidence: number; accentMode: string; qualityStatus: string; };

const samples = {
  Assamese: "মই আজি গুৱাহাটীলৈ গৈছোঁ। তুমি কেনে আছা?",
  Bodo: "Angni mwjang jwngni gwdanai khabwnai gwdan.",
  Manipuri: "ꯑꯩ ꯍꯧꯖꯤꯛ ꯏꯃꯥ ꯃꯅꯤꯄꯨꯔꯤ ꯋꯥꯍꯩ ꯁꯤꯡ ꯌꯥꯝꯂꯤ"
};

export default function VoicePage() {
  const [text, setText] = useState("");
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("female");
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (text.trim().length < 12) return;
    const t = setTimeout(async () => {
      setDetecting(true);
      const res = await fetch("/api/detect-language", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (res.ok) setDetection(data);
      setDetecting(false);
    }, 600);
    return () => clearTimeout(t);
  }, [text]);

  const est = useMemo(() => result?.estimatedDurationSeconds || Math.max(0, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 2.1)), [text, result]);

  async function generate() {
    setGenerating(true); setError(null);
    const res = await fetch("/api/generate-voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, languageCode: detection?.languageCode || "unknown", voiceGender }) });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Could not generate voice");
    else setResult(data);
    setGenerating(false);
  }

  return <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <header className="border-b border-white/[0.06]"><div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between"><Link href="/" className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-[#30D158] flex items-center justify-center"><span className="text-sm font-bold text-black">ম</span></div><span className="text-sm">Miithii Voice</span></Link><nav className="flex items-center gap-5 text-sm"><Link href="/chat" className="text-[var(--text-secondary)]">Chat</Link><Link href="/voice" className="text-white">Voice</Link><Link href="/contact" className="text-[var(--text-secondary)]">Contact</Link></nav></div></header>
    <main className="max-w-5xl mx-auto px-5 py-10 space-y-8">
      <section><h1 className="font-serif text-4xl">Make your text speak Northeast.</h1><p className="text-[var(--text-secondary)] mt-3">Paste Assamese, Bodo, Manipuri or other Indian-language text. Miithii detects the language and reads it aloud naturally.</p></section>
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
        <textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="Paste your text here..." className="w-full h-48 rounded-xl border border-white/[0.1] bg-black/20 p-4 outline-none" />
        <div className="flex gap-2">{Object.entries(samples).map(([k,v]) => <button key={k} onClick={()=>setText(v)} className="px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs">{k} sample</button>)}</div>
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm">
          <p className="text-xs text-[var(--text-tertiary)]">{detecting ? "Scanning language pattern…" : detection?.confidence && detection.confidence < 0.6 ? "Detection uncertain" : detection ? "Language locked" : "Paste text to detect"}</p>
          <p className="mt-1 font-medium">{detection ? `${detection.nativeName} ${detection.languageName}` : "—"}</p>
          <p className="text-[var(--text-secondary)]">Script: {detection?.script || "—"}</p>
          <p className="text-[var(--text-secondary)]">Accent mode: {detection?.accentMode || "—"}</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">{(["female","male"] as const).map((g)=><button key={g} onClick={()=>setVoiceGender(g)} className={`px-4 py-2 rounded-lg border ${voiceGender===g?"bg-[#30D158] text-black border-[#30D158]":"border-white/[0.1]"}`}>{g[0].toUpperCase()+g.slice(1)}</button>)}</div>
          <p className="text-sm text-[var(--text-secondary)]">Estimated audio: ~{est}s</p>
        </div>
        <button disabled={!text.trim() || !detection || generating} onClick={generate} className="w-full rounded-xl bg-[#30D158] text-black py-3 font-medium disabled:opacity-50">{generating ? "Crafting voice…" : "Generate Voice"}</button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
      {result && <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4"><p className="font-medium">Now speaking • {result.languageCode} • {voiceGender}</p>{result.chunks?.map((c:any)=><audio key={c.index} controls className="w-full" src={`data:${c.mimeType};base64,${c.audioBase64}`} />)}<div className="flex gap-2 flex-wrap">{["Perfect","Wrong accent","Wrong language","Bad pronunciation","Skipped words"].map((f)=><button key={f} className="px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs">{f}</button>)}</div></section>}
    </main>
  </div>;
}
