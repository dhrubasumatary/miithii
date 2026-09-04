import { Navbar } from '@/components/navbar';
import { ChatInterface } from '@/components/chat-interface';

export default function ChatPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <Navbar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col">
          <ChatInterface />
        </div>
      </main>
    </div>
  );
}