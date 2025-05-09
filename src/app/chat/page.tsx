import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 flex flex-col gap-8">
        <h1 className="text-3xl font-bold text-center mb-2">Miithii Chat</h1>
        {/* Chat UI will go here */}
        <div className="flex-1 flex flex-col justify-center items-center text-muted-foreground text-lg">
          Start chatting...
        </div>
      </div>
    </div>
  );
} 