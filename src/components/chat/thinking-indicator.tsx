"use client";

import { useState } from "react";

export function ThinkingIndicator({ liveReasoning }: { liveReasoning: string | null }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex items-start gap-3 max-w-[85%]">
        {/* Avatar with spinner */}
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#30D158]/15 flex items-center justify-center border border-[#30D158]/20">
          <div className="w-4 h-4 border-2 border-[#30D158] border-t-transparent rounded-full animate-spin" />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Label */}
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="text-[#30D158] text-xs font-medium">Miithii</span>
            {liveReasoning && (
              <>
                <span className="text-white/15">•</span>
                <button 
                  onClick={() => setExpanded(!expanded)}
                  className="text-[10px] text-white/40 hover:text-[#30D158] transition-colors font-mono"
                >
                  {expanded ? "hide thinking" : "show thinking"}
                </button>
              </>
            )}
          </div>
          
          {/* Content */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
            {/* Reasoning content - only show if we have real reasoning from Gemini */}
            {liveReasoning && expanded ? (
              <div className="px-4 py-3 max-h-32 overflow-y-auto no-scrollbar">
                <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2 font-medium">Thinking...</p>
                <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap">
                  {liveReasoning}
                  <span className="inline-block w-1 h-3 bg-[#30D158]/60 ml-0.5 animate-pulse" />
                </p>
              </div>
            ) : (
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-sm text-white/40">
                  {liveReasoning ? "Responding..." : "Thinking..."}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

