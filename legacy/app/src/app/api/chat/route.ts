import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const MIITHII_API_URL = process.env.MIITHII_API_URL || 'https://api.miithii.in/v1/chat/completions';
const MIITHII_API_KEY = process.env.MIITHII_API_KEY;
const TOKENS_PER_CREDIT = parseInt(process.env.TOKENS_PER_CREDIT || '20');
const FREE_TOKENS_DAILY = parseInt(process.env.FREE_TOKENS_DAILY || '500');
const MAX_TOKENS = 1000;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  chatId?: string;
  stream?: boolean;
}

async function getOrCreateBalance(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('credit_balances')
    .select('credits, free_tokens_used_today, free_tokens_reset_at')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    const now = new Date().toISOString();
    await supabaseAdmin.from('credit_balances').insert({
      user_id: userId,
      credits: 0,
      total_spent: 0,
      free_tokens_used_today: 0,
      free_tokens_reset_at: now,
    });
    return { credits: 0, freeTokensUsedToday: 0, freeTokensResetAt: now };
  }

  const now = new Date();
  const resetAt = data.free_tokens_reset_at ? new Date(data.free_tokens_reset_at) : null;
  const shouldReset = !resetAt || resetAt.toDateString() !== now.toDateString();

  return {
    credits: data.credits,
    freeTokensUsedToday: shouldReset ? 0 : (data.free_tokens_used_today ?? 0),
    freeTokensResetAt: data.free_tokens_reset_at,
  };
}

async function deductChatTokens(
  userId: string,
  tokens: number,
  requestId?: string | null
): Promise<{ success: boolean; creditsUsed: number; balanceAfter: number }> {
  if (tokens <= 0) {
    return { success: true, creditsUsed: 0, balanceAfter: 0 };
  }

  const creditsUsed = Math.ceil(tokens / TOKENS_PER_CREDIT);

  // Get current balance
  const { data: balance, error: balanceError } = await supabaseAdmin
    .from('credit_balances')
    .select('credits, free_tokens_used_today, free_tokens_reset_at')
    .eq('user_id', userId)
    .single();

  if (balanceError && balanceError.code !== 'PGRST116') {
    console.error('Error fetching balance:', balanceError);
    return { success: false, creditsUsed, balanceAfter: 0 };
  }

  const now = new Date();
  const resetAt = balance?.free_tokens_reset_at ? new Date(balance.free_tokens_reset_at) : null;
  const shouldReset = !resetAt || resetAt.toDateString() !== now.toDateString();
  const freeTokensUsed = shouldReset ? 0 : (balance?.free_tokens_used_today ?? 0);
  const currentCredits = balance?.credits ?? 0;

  // Deduct from free tokens first, then from paid credits
  const freeTokensRemaining = Math.max(0, FREE_TOKENS_DAILY - freeTokensUsed);
  let creditsToDeduct = creditsUsed;
  let freeTokensDeducted = 0;

  if (freeTokensRemaining > 0) {
    freeTokensDeducted = Math.min(freeTokensRemaining, creditsToDeduct);
    creditsToDeduct -= freeTokensDeducted;
  }

  const newCredits = currentCredits - creditsToDeduct;
  const newFreeTokensUsed = freeTokensDeducted > 0 ? freeTokensUsed + freeTokensDeducted : freeTokensUsed;

  if (newCredits < 0) {
    return { success: false, creditsUsed, balanceAfter: currentCredits };
  }

  // Update balance
  const updateData: Record<string, unknown> = {
    credits: newCredits,
    updated_at: now.toISOString(),
  };

  if (shouldReset && freeTokensDeducted > 0) {
    updateData.free_tokens_used_today = freeTokensDeducted;
    updateData.free_tokens_reset_at = now.toISOString();
  } else if (freeTokensDeducted > 0) {
    updateData.free_tokens_used_today = newFreeTokensUsed;
  }

  const { error: updateError } = await supabaseAdmin
    .from('credit_balances')
    .update(updateData)
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error updating balance:', updateError);
    return { success: false, creditsUsed, balanceAfter: currentCredits };
  }

  // Insert transaction record
  await supabaseAdmin.from('credit_transactions').insert({
    user_id: userId,
    type: 'usage',
    amount: -(creditsUsed - freeTokensDeducted),
    balance_after: newCredits,
    description: `Token usage: ${tokens} tokens`,
    request_id: requestId ?? null,
    tokens_used: tokens,
  });

  return { success: true, creditsUsed, balanceAfter: newCredits };
}

async function saveChatMessages(
  userId: string,
  chatId: string,
  userContent: string | null,
  assistantContent: string | null,
  tokens?: number | null
): Promise<void> {
  const messagesToInsert = [];

  if (userContent) {
    messagesToInsert.push({
      chat_id: chatId,
      role: 'user',
      content: userContent,
      tokens_used: tokens ? Math.floor(tokens / 2) : null,
    });
  }

  if (assistantContent) {
    messagesToInsert.push({
      chat_id: chatId,
      role: 'assistant',
      content: assistantContent,
      tokens_used: tokens ? Math.ceil(tokens / 2) : null,
    });
  }

  if (messagesToInsert.length === 0) return;

  await supabaseAdmin.from('messages').insert(messagesToInsert);
}

async function createNewChat(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('chats')
    .insert({ user_id: userId, title: 'New Chat', model: 'glm-5.2' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    const body: ChatRequest = await req.json();
    const { messages, chatId, stream = true } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 });
    }

    if (messages.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 messages allowed' }, { status: 400 });
    }

    for (const msg of messages) {
      if (!msg.content || msg.content.length > 8192) {
        return NextResponse.json({ error: 'Each message must have content ≤ 8192 chars' }, { status: 400 });
      }
    }

    // 3. Get or create chat
    const actualChatId = chatId || await createNewChat(userId);

    // 4. Check credits
    const balance = await getOrCreateBalance(userId);
    const freeTokensRemaining = Math.max(0, FREE_TOKENS_DAILY - balance.freeTokensUsedToday);
    const hasCredits = balance.credits > 0 || freeTokensRemaining > 0;

    if (!hasCredits) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // 5. Call proxy
    const upstream = await fetch(MIITHII_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MIITHII_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Miithii-User-ID': userId,
      },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages,
        stream,
        max_tokens: MAX_TOKENS,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('Proxy error:', upstream.status, err);
      return new Response(err, { status: upstream.status });
    }

    // 6. Extract tokens from headers (available before body is consumed)
    const totalTokens = parseInt(upstream.headers.get('X-Miithii-Total-Tokens') ?? '0') || 0;
    const requestId = upstream.headers.get('X-Miithii-Request-ID');
    const creditsUsed = totalTokens > 0 ? Math.ceil(totalTokens / TOKENS_PER_CREDIT) : 0;

    // 7. Save user message immediately (fire-and-forget is fine)
    // TODO (P014): In streaming mode, assistantContent is not saved because the full
    // response isn't available until the stream completes. This creates a gap where only
    // the user message is persisted. Fix by switching to a Vercel Edge Function that
    // streams and persists incrementally, or use a streaming parser that accumulates
    // the full response before saving.
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      saveChatMessages(userId, actualChatId, lastUserMsg.content, null, null).catch(console.error);
    }

    // 8. Stream response
    if (stream) {
      // Deduct credits before streaming (pre-auth model)
      if (creditsUsed > 0) {
        deductChatTokens(userId, totalTokens, requestId).catch(err => {
          console.error('Credit deduction failed:', err);
        });
      }

      // Return the SSE stream directly to the client
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Miithii-Credits-Used': String(creditsUsed),
          'X-Miithii-Request-ID': requestId ?? '',
        },
      });
    }

    // 9. Non-streaming: read JSON response
    const completion = await upstream.json();
    const assistantContent = completion.choices?.[0]?.message?.content ?? '';

    // 10. Deduct credits
    if (creditsUsed > 0) {
      await deductChatTokens(userId, totalTokens, requestId);
    }

    // 11. Save both messages
    if (lastUserMsg) {
      await saveChatMessages(userId, actualChatId, lastUserMsg.content, assistantContent, totalTokens);
    }

    // 12. Return response
    return NextResponse.json(completion, {
      status: 200,
      headers: {
        'X-Miithii-Credits-Used': String(creditsUsed),
        'X-Miithii-Request-ID': requestId ?? '',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}