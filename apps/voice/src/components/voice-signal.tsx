"use client";

import { useEffect, useRef } from "react";

export type VoiceSignalState = null | "listening" | "talking";

type VoiceSignalProps = {
  colors: [string, string];
  state: VoiceSignalState;
  inputLevelRef?: React.RefObject<number>;
  outputLevelRef?: React.RefObject<number>;
  className?: string;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function rgb(hex: string) {
  const normalized = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Full-screen audio-reactive edge. Zero measured audio means zero activity. */
export function VoiceSignal({
  colors,
  state,
  inputLevelRef,
  outputLevelRef,
  className
}: VoiceSignalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [primary, secondary] = colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let animationFrame = 0;
    let smoothedLevel = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const render = () => {
      const liveLevel = state === "listening"
        ? clamp01(inputLevelRef?.current ?? 0)
        : state === "talking"
          ? clamp01(outputLevelRef?.current ?? 0)
          : 0;
      const rate = liveLevel > smoothedLevel ? 0.4 : 0.14;
      smoothedLevel += (liveLevel - smoothedLevel) * rate;
      if (smoothedLevel < 0.001) smoothedLevel = 0;
      context.clearRect(0, 0, width, height);
      if (smoothedLevel > 0) {
        const inset = 5 + smoothedLevel * 2;
        const radius = Math.min(28, Math.max(18, Math.min(width, height) * 0.028));
        const gradient = context.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, rgba(primary, 0.9));
        gradient.addColorStop(0.48, rgba(primary, 0.36));
        gradient.addColorStop(0.52, rgba(secondary, 0.36));
        gradient.addColorStop(1, rgba(secondary, 0.9));

        context.save();
        context.strokeStyle = gradient;
        context.lineWidth = 1.2 + smoothedLevel * 5.8;
        context.shadowBlur = 10 + smoothedLevel * 34;
        context.shadowColor = rgba(state === "listening" ? primary : secondary, 0.7);
        context.globalAlpha = 0.18 + smoothedLevel * 0.82;
        context.beginPath();
        context.roundRect(inset, inset, Math.max(1, width - inset * 2), Math.max(1, height - inset * 2), radius);
        context.stroke();
        context.restore();

        const cornerRadius = Math.min(width, height) * (0.22 + smoothedLevel * 0.08);
        const glowA = context.createRadialGradient(0, 0, 0, 0, 0, cornerRadius);
        glowA.addColorStop(0, rgba(primary, 0.14 * smoothedLevel));
        glowA.addColorStop(1, rgba(primary, 0));
        context.fillStyle = glowA;
        context.fillRect(0, 0, cornerRadius, cornerRadius);

        const glowB = context.createRadialGradient(width, height, 0, width, height, cornerRadius);
        glowB.addColorStop(0, rgba(secondary, 0.14 * smoothedLevel));
        glowB.addColorStop(1, rgba(secondary, 0));
        context.fillStyle = glowB;
        context.fillRect(width - cornerRadius, height - cornerRadius, cornerRadius, cornerRadius);
      }

      if (state === "listening" || state === "talking" || smoothedLevel > 0) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    render();
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [inputLevelRef, outputLevelRef, primary, secondary, state]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
