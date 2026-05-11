import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { markGenerationDownload } from "@/lib/billing/ledger";
import { createSignedAudioUrl, isSupabaseConfigured, selectRows } from "@/lib/supabase/server";

type AudioFileRow = {
  id: string;
  storage_path: string;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to download audio" }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Audio storage is not configured" }, { status: 503 });
    }

    const { id } = await params;
    const url = new URL(req.url);
    const fileId = url.searchParams.get("fileId");
    const fileQuery = [
      `generation_id=eq.${encodeURIComponent(id)}`,
      `user_id=eq.${encodeURIComponent(userId)}`,
      "select=id,storage_path",
      "order=chunk_index.asc",
      "limit=1",
    ];

    if (fileId) fileQuery.push(`id=eq.${encodeURIComponent(fileId)}`);

    const files = await selectRows<AudioFileRow>("audio_files", fileQuery.join("&"));
    const file = files[0];
    if (!file) {
      return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
    }

    const signedUrl = await createSignedAudioUrl(file.storage_path);
    if (!signedUrl) {
      return NextResponse.json({ error: "Could not create download URL" }, { status: 500 });
    }

    await markGenerationDownload(file.id);

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("generation download error", error);
    return NextResponse.json({ error: "Could not prepare download" }, { status: 500 });
  }
}
