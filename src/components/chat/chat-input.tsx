"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, Paperclip } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  isThinking?: boolean;
  onStop?: () => void;
  onFileSelect?: () => void;
  hasFiles?: boolean;
  placeholder?: string;
  showAttach?: boolean;
  showDisclaimer?: boolean;
  autoFocus?: boolean;
}

export function ChatInput({
  onSend,
  disabled = false,
  isThinking = false,
  onStop,
  onFileSelect,
  hasFiles = false,
  placeholder = "Ask me anything in Axomiya or English...",
  showAttach = true,
  showDisclaimer = false,
  autoFocus = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && !hasFiles) return;
    onSend(input);
    setInput("");
  }, [input, hasFiles, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || hasFiles) {
        onSend(input);
        setInput("");
      }
    }
  }, [input, hasFiles, onSend]);

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-end gap-1 p-2">
            {/* Attach Button */}
            {showAttach && onFileSelect && (
              <button
                type="button"
                onClick={onFileSelect}
                className="flex-shrink-0 p-2.5 rounded-xl text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition-colors"
                title="Attach image"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            )}
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isThinking}
              rows={1}
              className="flex-1 bg-transparent text-[var(--text-primary)] text-[15px] outline-none resize-none max-h-40 py-2.5 px-2 placeholder:text-[var(--text-muted)] disabled:opacity-50"
              style={{ caretColor: '#30D158' }}
            />
            
            {/* Send/Stop Button */}
            {isThinking && onStop ? (
              <button
                type="button"
                onClick={onStop}
                className="flex-shrink-0 p-2.5 rounded-xl bg-[#ff453a]/20 text-[#ff453a] hover:bg-[#ff453a]/30 transition-colors"
                title="Stop"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !hasFiles}
                className="flex-shrink-0 p-2.5 rounded-xl bg-[#30D158] text-black hover:bg-[#2ABF4E] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                title="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </form>
      
      {showDisclaimer && (
        <p className="text-center text-[11px] text-[var(--text-muted)] mt-3">
          Miithii can make mistakes. Please verify important information.
        </p>
      )}
    </div>
  );
}
