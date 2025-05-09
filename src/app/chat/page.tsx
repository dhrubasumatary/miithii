"use client";

import React, { useState, useRef, useCallback } from "react";
import { UserButton, useUser, SignInButton, SignUpButton } from "@clerk/nextjs";
import { api } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
}

const Message = React.memo(function Message({ msg }: { msg: ChatMessage }) {
  return (
    <div
      className={`p-4 rounded-2xl w-fit max-w-[80%] text-base break-words shadow-md transition-all duration-100
        ${msg.sender === "user"
          ? "ml-auto bg-gradient-to-br from-blue-500/80 to-blue-700/80 text-white"
          : "mr-auto bg-white/80 dark:bg-zinc-800/80 text-gray-900 dark:text-gray-100 border border-border"}
      `}
      style={{ wordBreak: "break-word" }}
    >
      {msg.content}
    </div>
  );
});

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isLoaded, isSignedIn } = useUser();

  const sendMessage = api.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), content: data.message, sender: "ai" },
      ]);
      setMessage("");
      inputRef.current?.focus();
    },
  });

  const handleSend = useCallback(() => {
    if (message.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), content: message, sender: "user" },
      ]);
      sendMessage.mutate({ content: message });
    }
  }, [message, sendMessage]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 px-2 py-8">
      {/* Auth controls and modals */}
      <div className="absolute top-6 right-8 flex items-center gap-3 z-20">
        {isLoaded && (
          isSignedIn ? (
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "ring-2 ring-blue-500" } }} />
          ) : (
            <>
              <SignInButton mode="modal">
                <Button variant="ghost" className="text-white/80 hover:text-white">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="outline" className="border-white/40 text-white/80 hover:text-white">Sign up</Button>
              </SignUpButton>
            </>
          )
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" className="rounded-xl shadow-md">History</Button>
          </DialogTrigger>
          <DialogContent className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-0">
            <DialogHeader>
              <DialogTitle>Chat History</DialogTitle>
            </DialogHeader>
            <Button
              onClick={() => {
                setMessages([]);
                setMessage("");
                inputRef.current?.focus();
              }}
              className="mt-4"
            >
              New Chat
            </Button>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" className="rounded-xl shadow-md">Settings</Button>
          </DialogTrigger>
          <DialogContent className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-0">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <p>Settings placeholder</p>
          </DialogContent>
        </Dialog>
      </div>
      {/* Chat box */}
      <div className="w-full max-w-2xl flex flex-col flex-1 justify-end items-center mt-24 mb-8">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-white drop-shadow-lg">How can I help you?</h1>
        <div className="flex-1 w-full space-y-4 overflow-y-auto px-2 py-4 rounded-3xl bg-white/10 dark:bg-zinc-900/30 shadow-2xl backdrop-blur-xl border border-white/10">
          {messages.length === 0 ? (
            <div className="text-center text-lg text-white/60 py-12">Start a conversation…</div>
          ) : (
            messages.map((msg) => <Message key={msg.id} msg={msg} />)
          )}
        </div>
        <form
          className="w-full flex gap-2 mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          autoComplete="off"
        >
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-2xl bg-white/80 dark:bg-zinc-800/80 border-none shadow-md focus:ring-2 focus:ring-blue-500/60 text-gray-900 dark:text-gray-100"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sendMessage.status === 'pending'}
          />
          <Button type="submit" className="rounded-2xl px-6 py-2 font-semibold text-lg bg-gradient-to-br from-blue-600 to-blue-400 text-white shadow-lg hover:from-blue-700 hover:to-blue-500 transition-all duration-150" disabled={sendMessage.status === 'pending'}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
} 