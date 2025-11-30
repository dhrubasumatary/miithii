"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { MiithiiMessage } from "@/app/api/chat/route";
import Image from "next/image";
import { Image as ImageIcon, Send, Square, UploadCloud, X } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { EmptyState } from "@/components/chat/empty-state";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat<MiithiiMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
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
      <header className="hidden" />

      {/* Drag Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-40 bg-black/95 flex items-center justify-center animate-fade-in">
          <div className="border-2 border-dashed border-[#30D158]/50 rounded-2xl p-16 text-center">
            <UploadCloud className="w-12 h-12 mx-auto mb-4 text-[#30D158]" />
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
                  <X className="w-3 h-3" />
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
                  <Square className="w-5 h-5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && !files}
                  className="flex-shrink-0 p-2 rounded-lg bg-[#30D158] text-black hover:bg-[#2ABF4E] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}
