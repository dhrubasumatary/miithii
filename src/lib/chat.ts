import { supabaseAdmin } from './supabase';

const MIITHII_API_URL = process.env.MIITHII_API_URL || 'https://api.miithii.in/v1/chat/completions';
const MIITHII_API_KEY = process.env.MIITHII_API_KEY;
const TOKENS_PER_CREDIT = parseInt(process.env.TOKENS_PER_CREDIT || '20');
const FREE_TOKENS_DAILY = parseInt(process.env.FREE_TOKENS_DAILY || '500');

/**
 * Calls the Miithii proxy API with the given messages.
 * Returns the raw fetch Response.
 */
export async function callProxy(
  messages: Array<{ role: string; content: string }>,
  userId: string,
  stream: boolean = true
): Promise<Response> {
  const response = await fetch(MIITHII_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MIITHII_API_KEY}`,
      'X-Miithii-User-ID': userId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-5.2',
      messages,
      stream,
    }),
  });

  return response;
}

/**
 * Deducts credits from a user's balance.
 * Calculates credits used as ceil(tokens / TOKENS_PER_CREDIT).
 * Uses supabaseAdmin to bypass RLS.
 * 
 * Returns { success, creditsUsed, balanceAfter }
 */
export async function deductCredits(
  userId: string,
  tokens: number,
  requestId?: string | null
): Promise<{ success: boolean; creditsUsed: number; balanceAfter: number; error?: string }> {
  if (tokens <= 0) {
    return { success: true, creditsUsed: 0, balanceAfter: 0 };
  }

  const creditsUsed = Math.ceil(tokens / TOKENS_PER_CREDIT);

  try {
    // Use a transaction-like approach: read balance, deduct, insert transaction
    const { data: balance, error: balanceError } = await supabaseAdmin
      .from('credit_balances')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (balanceError && balanceError.code !== 'PGRST116') {
      console.error('Error fetching balance:', balanceError);
      return { success: false, creditsUsed, balanceAfter: 0, error: balanceError.message };
    }

    const currentBalance = balance?.credits ?? 0;

    if (currentBalance < creditsUsed) {
      return { success: false, creditsUsed, balanceAfter: currentBalance, error: 'Insufficient credits' };
    }

    const newBalance = currentBalance - creditsUsed;

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('credit_balances')
      .update({ credits: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return { success: false, creditsUsed, balanceAfter: currentBalance, error: updateError.message };
    }

    // Insert transaction record
    const { error: txError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'usage',
        amount: -creditsUsed,
        balance_after: newBalance,
        description: `Token usage: ${tokens} tokens`,
        request_id: requestId ?? null,
        tokens_used: tokens,
      });

    if (txError) {
      console.error('Error inserting transaction:', txError);
      // Balance was already deducted, log but don't fail
    }

    return { success: true, creditsUsed, balanceAfter: newBalance };
  } catch (err) {
    console.error('Unexpected error in deductCredits:', err);
    return { success: false, creditsUsed, balanceAfter: 0, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Saves user and assistant messages to the messages table.
 * Uses supabaseAdmin to bypass RLS.
 */
export async function saveMessages(
  userId: string,
  chatId: string,
  userContent: string | null,
  assistantContent: string | null,
  tokens?: number | null
): Promise<{ success: boolean; error?: string }> {
  try {
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

    if (messagesToInsert.length === 0) {
      return { success: true };
    }

    const { error } = await supabaseAdmin.from('messages').insert(messagesToInsert);

    if (error) {
      console.error('Error saving messages:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error in saveMessages:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Gets the credit balance for a user, including free tokens info.
 */
export async function getCreditBalance(userId: string): Promise<{
  credits: number;
  freeTokensUsedToday: number;
  freeTokensDaily: number;
  freeTokensResetAt: string | null;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_balances')
      .select('credits, free_tokens_used_today, free_tokens_reset_at')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching credit balance:', error);
      return { credits: 0, freeTokensUsedToday: 0, freeTokensDaily: FREE_TOKENS_DAILY, freeTokensResetAt: null };
    }

    // Check if we need to reset free tokens (new day)
    const now = new Date();
    const resetAt = data?.free_tokens_reset_at ? new Date(data.free_tokens_reset_at) : null;
    const shouldResetFreeTokens = !resetAt || resetAt.toDateString() !== now.toDateString();

    return {
      credits: data?.credits ?? 0,
      freeTokensUsedToday: shouldResetFreeTokens ? 0 : (data?.free_tokens_used_today ?? 0),
      freeTokensDaily: FREE_TOKENS_DAILY,
      freeTokensResetAt: shouldResetFreeTokens ? now.toISOString() : (data?.free_tokens_reset_at ?? null),
    };
  } catch (err) {
    console.error('Unexpected error in getCreditBalance:', err);
    return { credits: 0, freeTokensUsedToday: 0, freeTokensDaily: FREE_TOKENS_DAILY, freeTokensResetAt: null };
  }
}

/**
 * Gets or creates a credit balance row for a user.
 */
export async function getOrCreateBalance(userId: string): Promise<{
  credits: number;
  freeTokensUsedToday: number;
  freeTokensDaily: number;
  freeTokensResetAt: string | null;
}> {
  try {
    const existing = await getCreditBalance(userId);
    
    if (existing.freeTokensResetAt) {
      return existing;
    }

    // Create new balance row if none exists
    const now = new Date();
    const { error } = await supabaseAdmin
      .from('credit_balances')
      .insert({
        user_id: userId,
        credits: 0,
        total_spent: 0,
        free_tokens_used_today: 0,
        free_tokens_reset_at: now.toISOString(),
      });

    if (error && error.code !== '23505') { // Ignore duplicate key error
      console.error('Error creating balance:', error);
    }

    return {
      credits: 0,
      freeTokensUsedToday: 0,
      freeTokensDaily: FREE_TOKENS_DAILY,
      freeTokensResetAt: now.toISOString(),
    };
  } catch (err) {
    console.error('Unexpected error in getOrCreateBalance:', err);
    return { credits: 0, freeTokensUsedToday: 0, freeTokensDaily: FREE_TOKENS_DAILY, freeTokensResetAt: null };
  }
}

/**
 * Checks if a user has available credits (paid or free tier).
 */
export async function hasAvailableCredits(userId: string): Promise<{
  hasCredits: boolean;
  balance: number;
  freeTokensRemaining: number;
}> {
  const balance = await getOrCreateBalance(userId);
  
  const freeTokensRemaining = Math.max(0, balance.freeTokensDaily - balance.freeTokensUsedToday);
  const hasCredits = balance.credits > 0 || freeTokensRemaining > 0;

  return {
    hasCredits,
    balance: balance.credits,
    freeTokensRemaining,
  };
}

/**
 * Tracks free token usage for a user.
 */
export async function trackFreeTokens(userId: string, tokensUsed: number): Promise<void> {
  if (tokensUsed <= 0) return;

  try {
    const balance = await getOrCreateBalance(userId);
    const now = new Date();
    const resetAt = balance.freeTokensResetAt ? new Date(balance.freeTokensResetAt) : null;
    const shouldReset = !resetAt || resetAt.toDateString() !== now.toDateString();

    if (shouldReset) {
      // Reset free tokens for new day
      await supabaseAdmin
        .from('credit_balances')
        .update({
          free_tokens_used_today: tokensUsed,
          free_tokens_reset_at: now.toISOString(),
        })
        .eq('user_id', userId);
    } else {
      // Increment free tokens used
      const newUsed = (balance.freeTokensUsedToday || 0) + tokensUsed;
      await supabaseAdmin
        .from('credit_balances')
        .update({
          free_tokens_used_today: newUsed,
        })
        .eq('user_id', userId);
    }
  } catch (err) {
    console.error('Error tracking free tokens:', err);
  }
}