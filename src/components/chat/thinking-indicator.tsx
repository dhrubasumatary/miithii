"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThinkingIndicator({ liveReasoning }: { liveReasoning: string | null }) {
  const [expanded, setExpanded] = useState(true);
  const [thinkingTime, setThinkingTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setThinkingTime(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="animate-fade-in">
      <div className="bg-white/[0.02] rounded-xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Pulsing dot */}
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-[#30D158]" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#30D158] animate-ping opacity-50" />
            </div>
            
            <span className="text-sm text-[var(--text-secondary)]">Thinking</span>
            <span className="text-xs text-[var(--text-muted)] font-mono">{formatTime(thinkingTime)}</span>
          </div>

          {liveReasoning && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-muted)]">
                {expanded ? 'Hide' : 'Show'}
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </div>
          )}
        </button>

        {/* Reasoning content */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            expanded && liveReasoning ? "max-h-48" : "max-h-0"
          )}
        >
          {liveReasoning && (
            <div className="px-4 pb-4">
              <div className="max-h-36 overflow-y-auto no-scrollbar">
                <p className="text-xs text-[var(--text-tertiary)] whitespace-pre-wrap font-mono leading-relaxed">
                  {liveReasoning}
                  <span className="inline-block w-0.5 h-3.5 bg-[#30D158] ml-0.5 animate-pulse-subtle align-middle" />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
