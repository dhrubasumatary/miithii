import { NextResponse } from "next/server";
import type { UIMessage } from "ai";

export type MiithiiMessage = UIMessage;

export async function POST() {
  return NextResponse.json(
    {
      error: "Miithii Chat is offline while the product focuses on Voice export.",
    },
    { status: 410 }
  );
}
