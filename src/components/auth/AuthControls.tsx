"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

type AuthControlsProps = {
  compact?: boolean;
};

export function AuthControls({ compact = false }: AuthControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="hidden min-h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-black/58 transition-colors hover:bg-white hover:text-black sm:inline-flex">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="inline-flex min-h-9 items-center justify-center rounded-md bg-[#111311] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-black">
            {compact ? "Join" : "Create account"}
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-9 w-9 rounded-md",
            },
          }}
        />
      </Show>
    </div>
  );
}
