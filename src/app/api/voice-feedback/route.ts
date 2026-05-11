import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ratings = new Set([
  "perfect",
  "wrong_accent",
  "wrong_language",
  "bad_pronunciation",
  "skipped_words",
]);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const body = await req.json();

    if (!ratings.has(body?.rating)) {
      return NextResponse.json({ error: "Invalid feedback rating" }, { status: 400 });
    }

    const feedback = {
      userId: userId || "anonymous",
      languageCode: String(body.languageCode || "unknown"),
      script: String(body.script || "Unknown"),
      voiceGender: String(body.voiceGender || "unknown"),
      voiceName: String(body.voiceName || "unknown"),
      promptVersion: String(body.promptVersion || "unknown"),
      textLength: Number(body.textLength || 0),
      chunkCount: Number(body.chunkCount || 0),
      estimatedDurationSeconds: Number(body.estimatedDurationSeconds || 0),
      rating: body.rating,
      createdAt: new Date().toISOString(),
    };

    // Persist this to the generation QA table once storage is wired.
    console.info("voice-feedback", feedback);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("voice-feedback error", error);
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }
}
