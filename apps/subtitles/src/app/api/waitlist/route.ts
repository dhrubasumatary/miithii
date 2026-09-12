import { NextResponse } from "next/server";

export const runtime = "edge";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const key = process.env.WAITLIST_KEY;
  if (!key) {
    return NextResponse.json(
      { message: "Waitlist is being connected. Please try again shortly." },
      { status: 503 }
    );
  }

  let email = "";
  try {
    const body = await request.json() as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://waitlister.me/s/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email })
    });

    if (!response.ok) {
      throw new Error("Waitlister rejected the request");
    }

    return NextResponse.json({ message: "Joined" });
  } catch (error) {
    console.error("waitlist_submission_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ message: "Could not join right now. Please try again." }, { status: 502 });
  }
}
