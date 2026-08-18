"use client";

import { useMemo, useState } from "react";
import { Captions, Download, FileAudio, Languages, Play, Upload } from "lucide-react";
import { Button, StatusBadge } from "@miithii/ui";
import { getUploadPolicy } from "@miithii/uploads";

const sampleCaptions = [
  {
    time: "00:00:04",
    text: "Welcome back. This is the first clean Miithii subtitles workspace."
  },
  {
    time: "00:00:11",
    text: "Upload a clip, choose languages, review the transcript, then export captions."
  },
  {
    time: "00:00:19",
    text: "The real Sarvam and UploadThing pipeline will plug into this screen next."
  }
];

export function SubtitleWorkspace() {
  const [fileName, setFileName] = useState<string>("No file selected");
  const policy = useMemo(() => getUploadPolicy("subtitle-source"), []);

  return (
    <section className="subtitles-workspace" aria-label="Subtitle workspace">
      <div className="subtitles-panel">
        <div className="subtitles-panel__header">
          <div>
            <h1 className="subtitles-panel__title">Caption workspace</h1>
            <p className="subtitles-panel__copy">
              Source language, translation, review, and export stay in one focused flow.
            </p>
          </div>
          <StatusBadge tone="warning">Prototype shell</StatusBadge>
        </div>

        <div style={{ padding: 18 }}>
          <label className="upload-zone">
            <input
              accept={policy.allowedMimeTypes.join(",")}
              aria-label="Upload audio or video"
              style={{ display: "none" }}
              type="file"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "No file selected")}
            />
            <FileAudio aria-hidden="true" size={34} strokeWidth={1.8} />
            <h2>Drop audio or video</h2>
            <p>{fileName}</p>
          </label>

          <div className="control-grid">
            <div className="field">
              <label htmlFor="source-language">Source language</label>
              <select id="source-language" defaultValue="as">
                <option value="as">Assamese</option>
                <option value="hi">Hindi</option>
                <option value="en">English</option>
                <option value="bn">Bengali</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="target-language">Subtitle output</label>
              <select id="target-language" defaultValue="en">
                <option value="en">English SRT</option>
                <option value="hi">Hindi SRT</option>
                <option value="as">Assamese SRT</option>
                <option value="source">Transcript only</option>
              </select>
            </div>
          </div>

          <div className="pipeline" aria-label="Subtitle pipeline">
            <PipelineStep icon={<Upload size={16} />} label="Upload" meta="UploadThing boundary" status="Ready" />
            <PipelineStep icon={<Captions size={16} />} label="Transcribe" meta="Sarvam route" status="Next" />
            <PipelineStep icon={<Languages size={16} />} label="Translate" meta="Shared LLM router" status="Next" />
            <PipelineStep icon={<Download size={16} />} label="Export" meta="SRT, VTT, transcript" status="Next" />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
            <Button icon={<Play />} variant="primary">
              Start job
            </Button>
            <Button icon={<Download />}>Export sample</Button>
          </div>
        </div>
      </div>

      <div className="subtitles-panel" style={{ marginTop: 18 }}>
        <div className="subtitles-panel__header">
          <div>
            <h2 className="subtitles-panel__title">Transcript review</h2>
            <p className="subtitles-panel__copy">Timecoded rows use the shared mono token from Pulse.</p>
          </div>
          <StatusBadge tone="success">3 cues</StatusBadge>
        </div>
        <div className="timeline">
          {sampleCaptions.map((caption) => (
            <article className="caption-row" key={caption.time}>
              <time>{caption.time}</time>
              <p>{caption.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PipelineStep({
  icon,
  label,
  meta,
  status
}: {
  icon: React.ReactNode;
  label: string;
  meta: string;
  status: string;
}) {
  return (
    <article className="pipeline-step">
      <span className="pipeline-step__icon">{icon}</span>
      <div>
        <p className="pipeline-step__name">{label}</p>
        <p className="pipeline-step__meta">{meta}</p>
      </div>
      <StatusBadge>{status}</StatusBadge>
    </article>
  );
}

