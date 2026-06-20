'use client';

import { useRef, useEffect, KeyboardEvent } from 'react';
import { SendHorizonal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (text: string) => void;
  isLoading: boolean;
}

export function ChatInput({ input, setInput, onSubmit, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSubmit(input.trim());
        setInput('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  };

  const canSend = !isLoading && input.trim().length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && input.trim()) {
      onSubmit(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="flex items-end gap-3 border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4"
    >
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message Miithii..."
          rows={1}
          className={cn(
            'w-full resize-none rounded-xl border border-[#222] bg-[#111] px-4 py-3 text-sm text-white placeholder-[#525252]',
            'focus:outline-none focus:border-[#e879f9] transition-colors',
            'max-h-[120px] min-h-[48px] leading-relaxed'
          )}
        />
      </div>

      <button
        type="submit"
        disabled={!canSend}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
          canSend
            ? 'bg-[#e879f9] text-black hover:bg-[#d946ef] cursor-pointer'
            : 'bg-[#1a1a1a] text-[#525252] cursor-not-allowed'
        )}
        aria-label="Send message"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <SendHorizonal className="w-4 h-4" />
        )}
      </button>
    </form>
  );
}