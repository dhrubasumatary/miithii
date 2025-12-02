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
  placeholder = "Message...",
  showAttach = true,
  showDisclaimer = false,
  autoFocus = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-scroll input into view on mobile when focused
  const handleFocus = useCallback(() => {
    if (textareaRef.current && window.innerWidth < 768) {
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300); // Delay for keyboard animation
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && !hasFiles) return;
    onSend(input);
    setInput("");
    
    // Reset height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, hasFiles, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || hasFiles) {
        onSend(input);
        setInput("");
        
        // Reset height
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  }, [input, hasFiles, onSend]);

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="bg-[var(--bg-secondary)] rounded-xl sm:rounded-2xl shadow-lg border border-white/[0.04]">
          <div className="flex items-end gap-0.5 sm:gap-1 p-1.5 sm:p-2">
            {/* Attach Button */}
            {showAttach && onFileSelect && (
              <button
                type="button"
                onClick={onFileSelect}
                className="flex-shrink-0 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors touch-manipulation"
                title="Attach image"
              >
                <Paperclip className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>
            )}
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              placeholder={placeholder}
              disabled={disabled || isThinking}
              rows={1}
              className="flex-1 bg-transparent text-[var(--text-primary)] text-base outline-none resize-none max-h-32 py-2.5 px-2 placeholder:text-[var(--text-muted)] disabled:opacity-50 touch-manipulation"
              style={{ 
                caretColor: '#30D158',
                fontSize: '16px', // Prevents iOS zoom on focus
                minHeight: '44px' // Better touch target
              }}
            />
            
            {/* Send/Stop Button */}
            {isThinking && onStop ? (
              <button
                type="button"
                onClick={onStop}
                className="flex-shrink-0 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#ff453a]/20 text-[#ff453a] hover:bg-[#ff453a]/30 active:bg-[#ff453a]/40 transition-colors touch-manipulation"
                title="Stop"
              >
                <Square className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !hasFiles}
                className="flex-shrink-0 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#30D158] text-black hover:bg-[#2ABF4E] active:bg-[#28A846] transition-colors disabled:opacity-20 disabled:cursor-not-allowed touch-manipulation"
                title="Send"
              >
                <Send className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
        </div>
      </form>
      
      {showDisclaimer && (
        <p className="text-center text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-2 sm:mt-3">
          Miithii can make mistakes. Please verify important information.
        </p>
      )}
    </div>
  );
}
