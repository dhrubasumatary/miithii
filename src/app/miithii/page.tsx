"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { MiithiiMessage } from "@/app/api/miithii/route";
import Image from "next/image";

export default function MiithiiPage() {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat<MiithiiMessage>({
    transport: new DefaultChatTransport({
      api: "/api/miithii",
    }),
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Handle file selection
  const handleFileChange = useCallback((selectedFiles: FileList | null) => {
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(selectedFiles);
      const file = selectedFiles[0];
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target?.result as string);
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const clearFile = useCallback(() => {
    setFiles(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && !files) return;
    sendMessage({ text: input, files: files || undefined });
    setInput("");
    clearFile();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || files) {
        e.currentTarget.form?.requestSubmit();
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileChange(e.dataTransfer.files);
  }, [handleFileChange]);

  const isThinking = status === "submitted" || status === "streaming";
  
  // Get the last assistant message (if any) while streaming
  const lastAssistantMessage = messages.filter(m => m.role === "assistant").slice(-1)[0];
  
  // Extract reasoning from the streaming assistant message
  const liveReasoning = isThinking && lastAssistantMessage
    ? lastAssistantMessage.parts
        ?.filter(p => p.type === "reasoning")
        .map(p => (p as { type: "reasoning"; text: string }).text)
        .join("") || null
    : null;
  
  // Check if assistant has started producing actual text content (not just reasoning)
  const hasTextContent = lastAssistantMessage?.parts?.some(p => p.type === "text" && (p as { text: string }).text.trim().length > 0);
  
  // Show thinking indicator when:
  // 1. We're in thinking/streaming state AND
  // 2. Either: no assistant message yet, OR assistant message has no text content yet (only reasoning)
  const showThinkingIndicator = isThinking && (!lastAssistantMessage || !hasTextContent);

  return (
    <div 
      className="min-h-screen min-h-dvh flex flex-col relative overflow-hidden bg-black"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[#1e3a8a] -top-32 -right-32 blur-[80px] opacity-20 animate-float" />
        <div className="absolute w-[350px] h-[350px] rounded-full bg-[#064e3b] bottom-20 -left-32 blur-[80px] opacity-20 animate-float-slow" />
        <div className="grid-overlay" />
      </div>

      {/* Header - Minimal */}
      <header className="sticky top-0 z-50 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#30D158] flex items-center justify-center">
            <span className="text-black font-mono font-bold text-sm">M</span>
          </div>
          <span className="text-[#EDEDED] font-medium">Miithii</span>
        </div>
      </header>

      {/* Drag Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-40 bg-black/95 flex items-center justify-center animate-fade-in">
          <div className="border-2 border-dashed border-[#30D158]/50 rounded-2xl p-16 text-center">
            <UploadIcon className="w-12 h-12 mx-auto mb-4 text-[#30D158]" />
            <p className="text-[#EDEDED]">Drop image here</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 relative z-10 no-scrollbar">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <EmptyState onSuggestionClick={setInput} />
          ) : (
            <>
              {messages.map((message, idx) => {
                // Skip rendering the last assistant message if it has no text yet (only reasoning)
                // The ThinkingIndicator will show the reasoning instead
                const isLastMessage = idx === messages.length - 1;
                const isStreamingAssistant = isLastMessage && message.role === "assistant" && showThinkingIndicator;
                
                if (isStreamingAssistant) {
                  return null; // Don't render - ThinkingIndicator will handle it
                }
                
                return (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    index={idx}
                  />
                );
              })}
              
              {/* Thinking Indicator with Live Reasoning */}
              {showThinkingIndicator && <ThinkingIndicator liveReasoning={liveReasoning} />}
            </>
          )}
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm font-mono">{error.message}</p>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="sticky bottom-0 z-50 px-4 pb-4 pt-2">
        <div className="max-w-2xl mx-auto">
          {/* Image Preview */}
          {imagePreview && (
            <div className="mb-3">
              <div className="relative inline-block">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  width={64}
                  height={64}
                  className="rounded-lg object-cover border border-white/10"
                />
                <button
                  onClick={clearFile}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black border border-white/20 text-white/60 flex items-center justify-center hover:text-white transition-colors"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="glass-slab flex items-end gap-2 p-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e.target.files)}
                className="hidden"
              />
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={isThinking}
                rows={1}
                className="flex-1 bg-transparent border-none text-[#EDEDED] text-base outline-none resize-none max-h-40 py-2 placeholder:text-white/30"
                style={{ caretColor: '#30D158' }}
              />
              
              {isThinking ? (
                <button
                  type="button"
                  onClick={stop}
                  className="flex-shrink-0 p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <StopIcon className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && !files}
                  className="flex-shrink-0 p-2 rounded-lg bg-[#30D158] text-black hover:bg-[#2ABF4E] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}

// Empty State Component - Enhanced with Cultural Touch
function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    { text: "15% of 847 ki hobo?", icon: "🧮", category: "Math" },
    { text: "Mok roast kor", icon: "🔥", category: "Fun" },
    { text: "Recipe likhi diya", icon: "🍛", category: "Help" },
    { text: "Code debug kor", icon: "💻", category: "Tech" },
  ];

  const features = ["Image Analysis", "Calculator", "Code Help", "Roast Mode"];

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 animate-fade-in">
      {/* Animated Logo with Glow */}
      <div className="relative mb-8">
        <div className="absolute inset-0 w-20 h-20 rounded-3xl bg-[#30D158] blur-2xl opacity-40 animate-pulse" />
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-[#30D158] to-[#1A9B4B] flex items-center justify-center shadow-[0_0_60px_rgba(48,209,88,0.25)]">
          <span className="text-black font-mono font-bold text-3xl select-none">म</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#30D158] flex items-center justify-center animate-pulse-green">
          <span className="text-black text-[10px]">✓</span>
        </div>
      </div>
      
      {/* Greeting with Assamese Flavor */}
      <h1 className="text-3xl font-bold text-[#EDEDED] mb-2 tracking-tight">
        Namaskar! <span className="inline-block animate-wave">🙏</span>
      </h1>
      <p className="text-white/50 text-center max-w-sm mb-3 leading-relaxed">
        Moi <span className="text-[#30D158] font-medium">Miithii</span>, tur AI buddy from Guwahati.
      </p>
      <p className="text-white/30 text-sm text-center max-w-xs mb-8">
        Assamese, English, or mix both — muk hudhibi, moi dim! 
      </p>
      
      {/* Feature Pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {features.map((f) => (
          <span 
            key={f} 
            className="px-3 py-1.5 text-[11px] rounded-full bg-white/[0.03] text-white/40 border border-white/[0.06] font-medium tracking-wide"
          >
            {f}
          </span>
        ))}
      </div>
      
      {/* Suggestion Cards Grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {suggestions.map((s, idx) => (
          <button
            key={s.text}
            onClick={() => onSuggestionClick(s.text)}
            className="group relative p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-left hover:border-[#30D158]/40 hover:bg-[#30D158]/[0.03] transition-all duration-300 overflow-hidden"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {/* Hover glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#30D158]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <span className="relative text-2xl mb-3 block transform group-hover:scale-110 transition-transform duration-200">{s.icon}</span>
            <p className="relative text-sm text-white/60 group-hover:text-white/90 transition-colors leading-snug mb-1">{s.text}</p>
            <span className="relative text-[10px] text-white/25 uppercase tracking-wider font-medium">{s.category}</span>
          </button>
        ))}
      </div>
      
      {/* Subtle Brand Footer */}
      <p className="mt-12 text-[10px] text-white/15 tracking-widest uppercase">
        Built by Prompt Mafia Inc.
      </p>
    </div>
  );
}

// Simple Thinking Indicator - Shows real reasoning from Gemini when available
function ThinkingIndicator({ liveReasoning }: { liveReasoning: string | null }) {
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

// Message Bubble Component with Copy Button
function MessageBubble({ message, index }: { message: MiithiiMessage; index: number }) {
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
                <MessagePart key={`${message.id}-${idx}`} part={part} messageId={message.id} index={idx} />
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
                  <CheckIcon className="w-3.5 h-3.5 text-[#30D158]" />
                ) : (
                  <CopyIcon className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Part Component
function MessagePart({ part, messageId, index }: { part: MiithiiMessage["parts"][number]; messageId: string; index: number }) {
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

// Reasoning Block
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

// Tool Part Component
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

// Tool Output Renderer
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

// Icons (thin stroke, Lucide-style)
function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15L16 10L5 21" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18" /><path d="M6 6L18 18" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
