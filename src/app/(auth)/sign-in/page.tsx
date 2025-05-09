import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto w-full max-w-[480px] p-4",
            card: "rounded-xl shadow-md",
          },
        }}
      />
    </div>
  );
} 