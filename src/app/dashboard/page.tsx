import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TestComponents } from "@/components/TestComponents";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();
  
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        Welcome, {user?.firstName || "User"}!
      </h1>
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Component Testing</h2>
        <TestComponents />
      </div>
    </div>
  );
} 