import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserCreditBalance, grantFreeTrialIfNeeded } from "@/lib/billing/ledger";
import { isSupabaseConfigured, selectRows } from "@/lib/supabase/server";

type GenerationRow = {
  id: string;
  language_code: string;
  voice_name: string;
  voice_gender: string;
  estimated_duration_seconds: number;
  credits_debited: number;
  api_cost_inr_estimate: number;
  status: string;
  created_at: string;
  audio_files?: Array<{
    id: string;
    chunk_index: number;
    text_length: number;
    mime_type: string;
  }>;
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view generation history" }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ balanceMinutes: null, generations: [] });
    }

    await grantFreeTrialIfNeeded(userId);

    const [balance, generations] = await Promise.all([
      getUserCreditBalance(userId),
      selectRows<GenerationRow>(
        "generations",
        `user_id=eq.${encodeURIComponent(userId)}&select=id,language_code,voice_name,voice_gender,estimated_duration_seconds,credits_debited,api_cost_inr_estimate,status,created_at,audio_files(id,chunk_index,text_length,mime_type)&order=created_at.desc&limit=30`
      ),
    ]);

    return NextResponse.json({
      balanceMinutes: Number(balance || 0),
      generations: generations.map((generation) => ({
        id: generation.id,
        languageCode: generation.language_code,
        voiceName: generation.voice_name,
        voiceGender: generation.voice_gender,
        estimatedDurationSeconds: generation.estimated_duration_seconds,
        creditsDebited: generation.credits_debited,
        apiCostInrEstimate: generation.api_cost_inr_estimate,
        status: generation.status,
        createdAt: generation.created_at,
        audioFiles: (generation.audio_files || [])
          .sort((a, b) => Number(a.chunk_index) - Number(b.chunk_index))
          .map((file) => ({
            id: file.id,
            chunkIndex: file.chunk_index,
            textLength: file.text_length,
            mimeType: file.mime_type,
          })),
      })),
    });
  } catch (error) {
    console.error("generation history error", error);
    return NextResponse.json({ error: "Could not load generation history" }, { status: 500 });
  }
}
