"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, Check, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import type { MiithiiMessage } from "@/app/api/chat/route";
import { cn } from "@/lib/utils";

export function MessageBubble({ message, index }: { message: MiithiiMessage; index: number }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  
  const getTextContent = () => {
    return message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map(p => p.text)
      .join("\n");
  };
  
  const copyToClipboard = async () => {
    const text = getTextContent();
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasTextContent = message.parts.some(p => p.type === "text");
  const hasReasoning = message.parts.some(p => p.type === "reasoning");
  
  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up" style={{ animationDelay: `${index * 15}ms` }}>
        <div className="max-w-[85%]">
          <div className="bg-white/[0.08] text-[var(--text-primary)] rounded-2xl rounded-br-md px-4 py-3">
            {message.parts.map((part, idx) => (
              <MessagePart key={`${message.id}-${idx}`} part={part} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ animationDelay: `${index * 15}ms` }}>
      {/* Reasoning - Collapsed section */}
      {hasReasoning && (
        <div className="mb-4">
          {message.parts
            .filter((p): p is { type: "reasoning"; text: string } => p.type === "reasoning")
            .map((part, idx) => (
              <ReasoningBlock key={`reasoning-${idx}`} text={part.text} />
            ))}
        </div>
      )}

      {/* Main response */}
      {hasTextContent && (
        <div className="group">
          <div className="flex gap-3">
            {/* Avatar */}
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#30D158] flex items-center justify-center">
              <span className="text-black text-xs font-bold" style={{ fontFamily: 'system-ui' }}>ম</span>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-[var(--text-primary)] text-[15px] leading-7">
                {message.parts
                  .filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((part, idx) => (
                    <div key={`text-${idx}`} className="whitespace-pre-wrap">
                      {part.text}
                    </div>
                  ))}
                {message.parts
                  .filter(p => p.type === "file")
                  .map((part, idx) => (
                    <MessagePart key={`file-${idx}`} part={part} />
                  ))}
              </div>

              {/* Actions - Minimal, on hover */}
              <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={copyToClipboard}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    copied 
                      ? "text-[#30D158]" 
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]"
                  )}
                  title={copied ? "Copied" : "Copy"}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04] transition-colors"
                  title="Retry"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessagePart({ part }: { part: MiithiiMessage["parts"][number] }) {
  switch (part.type) {
    case "text":
      return (
        <div className="whitespace-pre-wrap">
          {part.text}
        </div>
      );
      
    case "file":
      if (part.mediaType?.startsWith("image/")) {
        return (
          <div className="my-3 rounded-xl overflow-hidden inline-block">
            <Image
              src={part.url}
              alt={part.filename ?? "Image"}
              width={400}
              height={300}
              className="max-w-full h-auto"
            />
          </div>
        );
      }
      return null;
      
    default:
      return null;
  }
}

function ReasoningBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white/[0.02] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm text-[var(--text-tertiary)]">Thought process</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        )}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 animate-fade-in">
          <p className="text-xs text-[var(--text-tertiary)] whitespace-pre-wrap font-mono leading-relaxed">
            {text}
          </p>
        </div>
      )}
    </div>
  );
}
