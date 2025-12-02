"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import type { MiithiiMessage } from "@/app/api/chat/route";
import Image from "next/image";
import { 
  UploadCloud, 
  X,
  ArrowDown
} from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatInput } from "@/components/chat/chat-input";

export default function ConversationPage() {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("m");
  
  const [files, setFiles] = useState<FileList | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasSentInitialRef = useRef(false);

  const { messages, sendMessage, status, error, stop } = useChat<MiithiiMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  // Auto-send initial message from URL params (only once)
  useEffect(() => {
    if (initialMessage && !hasSentInitialRef.current) {
      hasSentInitialRef.current = true;
      const decodedMessage = decodeURIComponent(initialMessage);
      sendMessage({ text: decodedMessage });
      
      // Clean up URL (remove ?m= param)
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [initialMessage, sendMessage]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  }, []);

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

  const handleSend = useCallback((text: string) => {
    if (!text.trim() && !files) return;
    sendMessage({ text, files: files || undefined });
    clearFile();
  }, [files, sendMessage, clearFile]);

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
  const lastAssistantMessage = messages.filter(m => m.role === "assistant").slice(-1)[0];
  
  const liveReasoning = isThinking && lastAssistantMessage
    ? lastAssistantMessage.parts
        ?.filter(p => p.type === "reasoning")
        .map(p => (p as { type: "reasoning"; text: string }).text)
        .join("") || null
    : null;
  
  const hasTextContent = lastAssistantMessage?.parts?.some(p => p.type === "text" && (p as { text: string }).text.trim().length > 0);
  const showThinkingIndicator = isThinking && (!lastAssistantMessage || !hasTextContent);

  return (
    <div className="flex h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      
      <main 
        className="flex-1 flex flex-col relative min-w-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-40 bg-[var(--bg-primary)]/95 flex items-center justify-center animate-fade-in backdrop-blur-sm">
            <div className="border-2 border-dashed border-[#30D158]/40 rounded-2xl p-12 sm:p-16 text-center bg-white/[0.02]">
              <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 sm:mb-4 text-[#30D158]" />
              <p className="text-[var(--text-primary)] font-medium text-sm sm:text-base">Drop image here</p>
              <p className="text-[var(--text-tertiary)] text-xs sm:text-sm mt-1">PNG, JPG up to 10MB</p>
            </div>
          </div>
        )}

        {/* Messages Area - iOS-style scrolling */}
        <div 
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain webkit-overflow-scrolling-touch"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            height: '100%'
          }}
        >
          <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="space-y-6 sm:space-y-8">
              {messages.map((message, idx) => {
                const isLastMessage = idx === messages.length - 1;
                const isStreamingAssistant = isLastMessage && message.role === "assistant" && showThinkingIndicator;
                
                if (isStreamingAssistant) return null;
                
                return (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    index={idx}
                  />
                );
              })}
              
              {showThinkingIndicator && <ThinkingIndicator liveReasoning={liveReasoning} />}
            </div>
            
            {error && (
              <div className="mt-4 sm:mt-6 bg-[#ff453a]/10 border border-[#ff453a]/20 rounded-xl p-3 sm:p-4">
                <p className="text-[#ff453a] text-xs sm:text-sm font-mono">{error.message}</p>
              </div>
            )}
            
            {/* Spacer for bottom input - larger on mobile */}
            <div ref={messagesEndRef} className="h-40 md:h-32" />
          </div>
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-28 sm:bottom-36 left-1/2 -translate-x-1/2 z-30 p-2 sm:p-2.5 rounded-full bg-[var(--bg-elevated)] border border-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-xl animate-fade-in"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Input Area - Fixed bottom with safe area support */}
        <div className="relative z-20 bg-[var(--bg-primary)] border-t border-white/[0.04] safe-area-bottom">
          <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-safe">
            {/* Image Preview */}
            {imagePreview && (
              <div className="mb-2 sm:mb-3">
                <div className="relative inline-block">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    width={64}
                    height={64}
                    className="rounded-lg sm:rounded-xl object-cover"
                  />
                  <button
                    onClick={clearFile}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center justify-center hover:text-[var(--text-primary)] transition-colors shadow-lg"
                  >
                    <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              </div>
            )}
            
            <ChatInput
              onSend={handleSend}
              disabled={isThinking}
              isThinking={isThinking}
              onStop={stop}
              onFileSelect={() => fileInputRef.current?.click()}
              hasFiles={!!files}
              placeholder="Message..."
            />
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e.target.files)}
              className="hidden"
            />
            
            <p className="text-center text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-2 sm:mt-2.5">
              Miithii can make mistakes. Verify important info.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
