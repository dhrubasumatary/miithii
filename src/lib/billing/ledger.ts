import { CreditPack, FREE_TRIAL_MINUTES } from "./pricing";
import { insertRow, isSupabaseConfigured, selectRows, updateRows, uploadPrivateAudioObject } from "@/lib/supabase/server";

export type GenerationCostInput = {
  userId: string;
  provider: "gemini" | "sarvam" | "mock";
  model: string;
  languageCode: string;
  voiceName: string;
  voiceGender: string;
  promptVersion: string;
  inputChars: number;
  estimatedDurationSeconds: number;
  billableMinutes: number;
  creditsDebited: number;
  apiCostInrEstimate: number;
  chunkCount: number;
  status: "success" | "failed";
};

type CreditLedgerRow = {
  minutes_delta: number | string;
  type?: string;
};

type PaymentRow = {
  id: string;
};

type ExistingGrantRow = {
  id: string;
};

type AudioFileDownloadRow = {
  download_count: number | string;
};

export async function getUserCreditBalance(userId: string) {
  if (!isSupabaseConfigured()) return null;

  const rows = await selectRows<CreditLedgerRow>(
    "credit_ledger",
    `user_id=eq.${encodeURIComponent(userId)}&select=minutes_delta`
  );

  return rows.reduce((sum, row) => sum + Number(row.minutes_delta || 0), 0);
}

export async function getUserCreditSummary(userId: string) {
  if (!isSupabaseConfigured()) {
    return {
      balanceMinutes: null,
      purchasedMinutes: 0,
      freeGrantMinutes: 0,
    };
  }

  const rows = await selectRows<CreditLedgerRow>(
    "credit_ledger",
    `user_id=eq.${encodeURIComponent(userId)}&select=type,minutes_delta`
  );

  return rows.reduce(
    (summary, row) => {
      const delta = Number(row.minutes_delta || 0);
      summary.balanceMinutes = Number(((summary.balanceMinutes || 0) + delta).toFixed(2));
      if (row.type === "purchase" && delta > 0) summary.purchasedMinutes += delta;
      if (row.type === "free_grant" && delta > 0) summary.freeGrantMinutes += delta;
      return summary;
    },
    {
      balanceMinutes: 0 as number | null,
      purchasedMinutes: 0,
      freeGrantMinutes: 0,
    }
  );
}

export async function grantFreeTrialIfNeeded(userId: string) {
  if (!isSupabaseConfigured()) return null;

  const existing = await selectRows<ExistingGrantRow>(
    "credit_ledger",
    `user_id=eq.${encodeURIComponent(userId)}&type=eq.free_grant&select=id&limit=1`
  );

  if (existing.length > 0) {
    return { granted: false, balanceAfter: await getUserCreditBalance(userId) };
  }

  const currentBalance = await getUserCreditBalance(userId);
  const balanceAfter = Number((Number(currentBalance || 0) + FREE_TRIAL_MINUTES).toFixed(2));

  try {
    await insertRow("credit_ledger", {
      user_id: userId,
      type: "free_grant",
      minutes_delta: FREE_TRIAL_MINUTES,
      balance_after: balanceAfter,
    });
  } catch {
    return { granted: false, balanceAfter: await getUserCreditBalance(userId) };
  }

  return { granted: true, balanceAfter };
}

export async function recordPaymentCreditGrant({
  amountInr,
  pack,
  razorpayOrderId,
  razorpayPaymentId,
  userId,
}: {
  amountInr: number;
  pack: CreditPack;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  userId: string;
}) {
  if (!isSupabaseConfigured()) return null;

  const existingPayments = await selectRows<PaymentRow>(
    "payments",
    [
      `provider=eq.razorpay`,
      `provider_order_id=eq.${encodeURIComponent(razorpayOrderId)}`,
      `provider_payment_id=eq.${encodeURIComponent(razorpayPaymentId)}`,
      "select=id",
      "limit=1",
    ].join("&")
  );

  if (existingPayments.length > 0) {
    return {
      balanceAfter: await getUserCreditBalance(userId),
      payment: existingPayments[0],
      duplicate: true,
    };
  }

  const payment = await insertRow("payments", {
    user_id: userId,
    provider: "razorpay",
    provider_order_id: razorpayOrderId,
    provider_payment_id: razorpayPaymentId,
    pack_id: pack.id,
    amount_inr: amountInr,
    minutes_purchased: pack.minutes,
    status: "paid",
    raw_event: {},
  }).catch(async () => {
    const duplicate = await selectRows<PaymentRow>(
      "payments",
      [
        `provider=eq.razorpay`,
        `provider_order_id=eq.${encodeURIComponent(razorpayOrderId)}`,
        `provider_payment_id=eq.${encodeURIComponent(razorpayPaymentId)}`,
        "select=id",
        "limit=1",
      ].join("&")
    );

    return duplicate[0] || null;
  });

  if (!payment) {
    return {
      balanceAfter: await getUserCreditBalance(userId),
      payment: null,
      duplicate: true,
    };
  }

  const currentBalance = await getUserCreditBalance(userId);
  const balanceAfter = Number((Number(currentBalance || 0) + pack.minutes).toFixed(2));

  await insertRow("credit_ledger", {
    user_id: userId,
    type: "purchase",
    minutes_delta: pack.minutes,
    amount_inr: amountInr,
    pack_id: pack.id,
    payment_id: payment?.id || null,
    balance_after: balanceAfter,
  });

  return { balanceAfter, payment };
}

export async function recordGenerationSuccess({
  audioFiles,
  generation,
}: {
  generation: GenerationCostInput;
  audioFiles: Array<{
    audio: Buffer;
    chunkIndex: number;
    mimeType: string;
    textLength: number;
  }>;
}) {
  if (!isSupabaseConfigured()) return null;

  const row = await insertRow("generations", {
    user_id: generation.userId,
    provider: generation.provider,
    model: generation.model,
    language_code: generation.languageCode,
    voice_name: generation.voiceName,
    voice_gender: generation.voiceGender,
    prompt_version: generation.promptVersion,
    input_chars: generation.inputChars,
    estimated_duration_seconds: generation.estimatedDurationSeconds,
    billable_minutes: generation.billableMinutes,
    credits_debited: generation.creditsDebited,
    api_cost_inr_estimate: generation.apiCostInrEstimate,
    chunk_count: generation.chunkCount,
    status: generation.status,
  });

  const generationId = row?.id;
  if (!generationId) return null;

  const uploadedFiles = [];
  for (const file of audioFiles) {
    const extension = file.mimeType.includes("wav") ? "wav" : "audio";
    const path = `${generation.userId}/${generationId}/${file.chunkIndex}.${extension}`;
    const uploaded = await uploadPrivateAudioObject({
      body: file.audio,
      contentType: file.mimeType,
      path,
    }).catch((error) => {
      console.error("audio upload failed", error);
      return null;
    });

    if (!uploaded) continue;

    const audioRow = await insertRow("audio_files", {
      generation_id: generationId,
      user_id: generation.userId,
      chunk_index: file.chunkIndex,
      storage_bucket: uploaded.bucket,
      storage_path: uploaded.path,
      mime_type: file.mimeType,
      size_bytes: uploaded.bytes,
      text_length: file.textLength,
    });

    uploadedFiles.push(audioRow);
  }

  const currentBalance = await getUserCreditBalance(generation.userId);
  const balanceAfter = Number((Number(currentBalance || 0) - generation.creditsDebited).toFixed(2));

  await insertRow("credit_ledger", {
    user_id: generation.userId,
    type: "generation_debit",
    minutes_delta: -generation.creditsDebited,
    generation_id: generationId,
    balance_after: balanceAfter,
  });

  await insertRow("cost_events", {
    user_id: generation.userId,
    generation_id: generationId,
    provider: generation.provider,
    model: generation.model,
    event_type: "tts_generation",
    units: generation.billableMinutes,
    unit: "generated_minute",
    cost_inr_estimate: generation.apiCostInrEstimate,
  });

  return {
    generationId,
    uploadedFiles,
    balanceAfter,
  };
}

export async function markGenerationDownload(fileId: string) {
  if (!isSupabaseConfigured()) return null;

  const rows = await selectRows<AudioFileDownloadRow>(
    "audio_files",
    `id=eq.${encodeURIComponent(fileId)}&select=download_count&limit=1`
  );
  const nextDownloadCount = Number(rows[0]?.download_count || 0) + 1;

  return updateRows(
    "audio_files",
    `id=eq.${encodeURIComponent(fileId)}`,
    {
      download_count: nextDownloadCount,
      last_downloaded_at: new Date().toISOString(),
    }
  );
}
