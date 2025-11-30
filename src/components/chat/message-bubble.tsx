"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, Check } from "lucide-react";
import type { MiithiiMessage } from "@/app/api/chat/route";

export function MessageBubble({ message, index }: { message: MiithiiMessage; index: number }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  
  // Extract text content for copying
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
  
  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <div className={`max-w-[85%] ${isUser ? "" : "flex gap-3"}`}>
        {/* AI Avatar */}
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#30D158]/15 flex items-center justify-center mt-1 border border-[#30D158]/20">
            <span className="text-[#30D158] text-xs font-mono font-bold">M</span>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          {/* AI Label with timestamp */}
          {!isUser && (
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="text-[#30D158] text-xs font-medium">Miithii</span>
              <span className="text-white/15">•</span>
              <span className="text-[10px] text-white/25">just now</span>
            </div>
          )}
          
          {/* Message Content Container */}
          <div className="relative">
            <div className={`rounded-2xl px-4 py-3 ${
              isUser 
                ? "bg-[#1A1A1C] rounded-tr-md border border-white/[0.05]" 
                : "bg-white/[0.02] border border-white/[0.05]"
            }`}>
              {message.parts.map((part, idx) => (
                <MessagePart key={`${message.id}-${idx}`} part={part} />
              ))}
            </div>
            
            {/* Copy Button - Shows on hover for AI messages with text */}
            {!isUser && hasTextContent && (
              <button
                onClick={copyToClipboard}
                className={`absolute -right-2 -top-2 p-2 rounded-xl border transition-all duration-200 ${
                  copied 
                    ? "bg-[#30D158]/20 border-[#30D158]/30 opacity-100" 
                    : "bg-[#0A0A0A] border-white/10 opacity-0 group-hover:opacity-100 hover:border-[#30D158]/30 hover:bg-[#30D158]/10"
                }`}
                title={copied ? "Copied!" : "Copy message"}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#30D158]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagePart({ part }: { part: MiithiiMessage["parts"][number] }) {
  switch (part.type) {
    case "text":
      return (
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#EDEDED]">
          {part.text}
        </div>
      );
      
    case "reasoning":
      return <ReasoningBlock text={part.text} />;
      
    case "file":
      if (part.mediaType?.startsWith("image/")) {
        return (
          <div className="my-2 rounded-lg overflow-hidden border border-white/10">
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
      // Handle tool parts
      if (part.type.startsWith("tool-")) {
        return <ToolPart part={part} />;
      }
      return null;
  }
}

function ReasoningBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-white/40 hover:text-[#30D158] transition-colors font-mono"
      >
        <span className="text-[#30D158]">{expanded ? "−" : "+"}</span>
        <span>thinking</span>
      </button>
      
      {expanded && (
        <div className="mt-2 pl-4 border-l border-white/10 text-sm text-white/50 whitespace-pre-wrap font-mono animate-fade-in">
          {text}
        </div>
      )}
    </div>
  );
}

function ToolPart({ part }: { part: MiithiiMessage["parts"][number] }) {
  const toolName = part.type.replace("tool-", "");
  // Cast to any to access tool-specific properties (state, output, errorText)
  const toolPart = part as { state?: string; output?: unknown; errorText?: string };
  
  if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40 my-2 font-mono">
        <span className="text-[#30D158]">$</span>
        <span>{toolName}</span>
        <span className="animate-pulse text-[#30D158]">▊</span>
      </div>
    );
  }
  
  if (toolPart.state === "output-available") {
    return (
      <div className="bg-[#0A0A0A] border border-white/5 rounded-lg p-3 my-2">
        <div className="flex items-center gap-2 text-xs text-[#30D158] mb-2 font-mono">
          <span>→</span>
          <span>{toolName}</span>
        </div>
        <ToolOutput toolName={toolName} output={toolPart.output} />
      </div>
    );
  }
  
  if (toolPart.state === "output-error") {
    return (
      <div className="text-sm text-red-400 font-mono my-2">
        error: {String(toolPart.errorText)}
      </div>
    );
  }
  
  return null;
}

function ToolOutput({ toolName, output }: { toolName: string; output: unknown }) {
  const data = output as Record<string, unknown>;
  
  if (data.error) {
    return <span className="text-red-400 font-mono text-sm">{String(data.error)}</span>;
  }
  
  switch (toolName) {
    case "calculator":
      return (
        <div className="font-mono text-sm">
          <span className="text-white/50">{String(data.expression)} = </span>
          <span className="text-[#30D158] font-medium">{String(data.result)}</span>
        </div>
      );
      
    case "getCurrentTime":
      return (
        <div className="font-mono text-sm">
          <div className="text-[#EDEDED]">{String(data.datetime)}</div>
          <div className="text-xs text-white/40 mt-1">{String(data.timezone)}</div>
        </div>
      );
      
    case "generateUUID":
      return (
        <code className="font-mono text-[#30D158] text-sm select-all">
          {String(data.uuid)}
        </code>
      );
      
    case "convertUnits":
      return (
        <div className="font-mono text-sm">
          <span className="text-white/50">{String(data.value)} {String(data.from)} = </span>
          <span className="text-[#30D158]">
            {typeof data.result === "number" ? data.result.toFixed(4) : String(data.result)} {String(data.to)}
          </span>
        </div>
      );
      
    case "runCode":
      return (
        <div className="space-y-2 text-sm">
          <pre className="bg-black/50 p-2 rounded text-xs overflow-auto font-mono text-white/70">
            {String(data.code)}
          </pre>
          <div className="font-mono">
            <span className="text-white/40">→ </span>
            <span className="text-[#30D158]">{String(data.output)}</span>
          </div>
        </div>
      );
      
    case "analyzeText":
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono">
          <span className="text-white/40">words</span>
          <span className="text-[#30D158]">{String(data.wordCount)}</span>
          <span className="text-white/40">chars</span>
          <span className="text-[#30D158]">{String(data.characterCount)}</span>
          <span className="text-white/40">read time</span>
          <span className="text-[#30D158]">{String(data.readingTimeMinutes)}m</span>
        </div>
      );
      
    default:
      return (
        <pre className="text-xs overflow-auto font-mono text-white/60">
          {JSON.stringify(output, null, 2)}
        </pre>
      );
  }
}

