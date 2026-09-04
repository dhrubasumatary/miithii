'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn, formatTokens } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
  createdAt?: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

// Lightweight markdown-like formatter: **bold**, _italic_, `code`
function formatContent(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="mx-1 rounded bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-xs text-[#e879f9]">$1</code>')
    .replace(/\n/g, '<br/>');
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#111]">
            <span className="text-xl font-bold text-[#e879f9]">M</span>
          </div>
          <p className="text-[#525252] text-sm">Start a conversation with Miithii</p>
          <p className="mt-1 text-[#333] text-xs">
            Ask in Assamese, English, or both
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((message) => {
          if (message.role === 'system') {
            return (
              <div
                key={message.id}
                className="text-center text-xs text-[#525252] py-2"
              >
                {message.content}
              </div>
            );
          }

          const isUser = message.role === 'user';

          return (
            <div
              key={message.id}
              className={cn(
                'flex items-start gap-3',
                isUser ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  isUser
                    ? 'bg-[#e879f9] text-black'
                    : 'bg-[#1a1a1a] text-[#e879f9]'
                )}
              >
                {isUser ? 'U' : 'M'}
              </div>

              {/* Bubble */}
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                  isUser
                    ? 'bg-[#1a1a1a] text-white rounded-tr-sm'
                    : 'bg-[#111] text-white rounded-tl-sm border border-[#1a1a1a]'
                )}
              >
                <div
                  className="[&_strong]:text-white [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                />
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-sm font-bold text-[#e879f9]">
              M
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-[#111] border border-[#1a1a1a] px-4 py-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[#525252] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-[#525252] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-[#525252] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}