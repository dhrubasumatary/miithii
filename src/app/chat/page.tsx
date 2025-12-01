"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/chat/empty-state";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatInput } from "@/components/chat/chat-input";

export default function ChatPage() {
  const router = useRouter();

  const handleSend = useCallback((text: string) => {
    if (!text.trim()) return;
    
    // Generate a new conversation ID
    const conversationId = crypto.randomUUID();
    
    // Redirect to the conversation page with the initial message
    const encodedMessage = encodeURIComponent(text);
    router.push(`/chat/${conversationId}?m=${encodedMessage}`);
  }, [router]);

  const handleSuggestionClick = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  return (
    <div className="flex h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-8">
            <EmptyState onSuggestionClick={handleSuggestionClick} />
          </div>
        </div>

        {/* Input Area */}
        <div className="relative z-20 px-4 pb-6 pt-2">
          <div className="max-w-2xl mx-auto">
            <ChatInput
              onSend={handleSend}
              showAttach={false}
              showDisclaimer
              autoFocus
            />
          </div>
        </div>
      </main>
    </div>
  );
}
