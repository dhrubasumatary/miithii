'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';

export function ChatInterface() {
  const { isSignedIn } = useAuth();
  const [input, setInput] = useState('');
  const chatReturn = useChat({
    api: '/api/chat',
  });

  // Use type assertions for v6-style API properties
  const { messages, sendMessage, status } = chatReturn as typeof chatReturn & {
    sendMessage: (message: { text: string }) => void;
    status: 'submitted' | 'streaming' | 'ready' | 'error';
  };

  const isLoading = status === 'submitted' || status === 'streaming';

  // Convert AI SDK messages to Message[] type
  const convertedMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system' | 'data',
    content: msg.content,
  }));

  const handleSubmit = (text: string) => {
    sendMessage({ text });
  };

  if (!isSignedIn) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-[#a3a3a3] mb-4">Sign in to start chatting</p>
          <Link
            href="/sign-in"
            className="text-[#e879f9] hover:underline text-sm"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={convertedMessages} isLoading={isLoading} />
      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}