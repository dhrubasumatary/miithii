import { supabaseAdmin } from './supabase';

const TOKENS_PER_CREDIT = parseInt(process.env.TOKENS_PER_CREDIT || '20');
const FREE_TOKENS_DAILY = parseInt(process.env.FREE_TOKENS_DAILY || '500');

/**
 * Gets the credit balance for a user.
 */
export async function getCreditBalance(userId: string): Promise<{
  credits: number;
  totalSpent: number;
  freeTokensUsedToday: number;
  freeTokensResetAt: string | null;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_balances')
      .select('credits, total_spent, free_tokens_used_today, free_tokens_reset_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return { credits: 0, totalSpent: 0, freeTokensUsedToday: 0, freeTokensResetAt: null };
      }
      console.error('Error fetching credit balance:', error);
      throw error;
    }

    return {
      credits: data.credits,
      totalSpent: data.total_spent,
      freeTokensUsedToday: data.free_tokens_used_today,
      freeTokensResetAt: data.free_tokens_reset_at,
    };
  } catch (err) {
    console.error('Unexpected error in getCreditBalance:', err);
    throw err;
  }
}

/**
 * Atomically deducts credits from a user's balance.
 * Returns the new balance after deduction.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; balanceAfter: number; error?: string }> {
  try {
    // Get current balance
    const { data: balance, error: fetchError } = await supabaseAdmin
      .from('credit_balances')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return { success: false, balanceAfter: 0, error: fetchError.message };
    }

    const currentBalance = balance?.credits ?? 0;

    if (currentBalance < amount) {
      return { success: false, balanceAfter: currentBalance, error: 'Insufficient credits' };
    }

    const newBalance = currentBalance - amount;

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('credit_balances')
      .update({ credits: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      return { success: false, balanceAfter: currentBalance, error: updateError.message };
    }

    // Insert transaction record
    const { error: txError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'usage',
        amount: -amount,
        balance_after: newBalance,
        description: `Credits used: ${amount}`,
        metadata: metadata ?? null,
      });

    if (txError) {
      console.error('Error inserting transaction record:', txError);
      // Don't fail the main operation
    }

    return { success: true, balanceAfter: newBalance };
  } catch (err) {
    console.error('Unexpected error in deductCredits:', err);
    return { success: false, balanceAfter: 0, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Adds credits to a user's balance.
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: 'purchase' | 'bonus' | 'refund',
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; balanceAfter: number; error?: string }> {
  try {
    // Get or create balance
    const current = await getOrCreateBalance(userId);
    const newBalance = current + amount;

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('credit_balances')
      .update({ 
        credits: newBalance, 
        updated_at: new Date().toISOString(),
        ...(type === 'purchase' ? { total_spent: current } : {}), // Track spending for purchases
      })
      .eq('user_id', userId);

    if (updateError) {
      return { success: false, balanceAfter: current, error: updateError.message };
    }

    // Insert transaction record
    const { error: txError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type,
        amount,
        balance_after: newBalance,
        description: type === 'purchase' ? 'Credit purchase' : type === 'bonus' ? 'Bonus credits' : 'Refund',
        metadata: metadata ?? null,
      });

    if (txError) {
      console.error('Error inserting transaction record:', txError);
    }

    return { success: true, balanceAfter: newBalance };
  } catch (err) {
    console.error('Unexpected error in addCredits:', err);
    return { success: false, balanceAfter: 0, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Creates a new chat for a user.
 */
export async function createChat(userId: string, title?: string): Promise<{ id: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('chats')
      .insert({
        user_id: userId,
        title: title || 'New Chat',
        model: 'glm-5.2',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating chat:', error);
      return { id: '', error: error.message };
    }

    return { id: data.id };
  } catch (err) {
    console.error('Unexpected error in createChat:', err);
    return { id: '', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Saves a message to a chat.
 */
export async function saveMessage(
  chatId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  tokens?: number | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chatId,
        role,
        content,
        tokens_used: tokens ?? null,
      });

    if (error) {
      console.error('Error saving message:', error);
      return { success: false, error: error.message };
    }

    // Update chat's updated_at timestamp
    await supabaseAdmin
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    return { success: true };
  } catch (err) {
    console.error('Unexpected error in saveMessage:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Lists all chats for a user.
 */
export async function getChats(userId: string): Promise<{ chats: Array<{
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}>; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('chats')
      .select('id, title, model, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching chats:', error);
      return { chats: [], error: error.message };
    }

    return {
      chats: data.map(chat => ({
        id: chat.id,
        title: chat.title,
        model: chat.model,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
      })),
    };
  } catch (err) {
    console.error('Unexpected error in getChats:', err);
    return { chats: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Lists all messages for a chat.
 */
export async function getMessages(chatId: string): Promise<{ messages: Array<{
  id: string;
  role: string;
  content: string;
  tokensUsed: number | null;
  createdAt: string;
}>; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id, role, content, tokens_used, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return { messages: [], error: error.message };
    }

    return {
      messages: data.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        tokensUsed: msg.tokens_used,
        createdAt: msg.created_at,
      })),
    };
  } catch (err) {
    console.error('Unexpected error in getMessages:', err);
    return { messages: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Gets or creates a credit balance row for a user.
 * Returns the current credit balance.
 */
export async function getOrCreateBalance(userId: string): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_balances')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found, create one
        const now = new Date();
        const { error: insertError } = await supabaseAdmin
          .from('credit_balances')
          .insert({
            user_id: userId,
            credits: 0,
            total_spent: 0,
            free_tokens_used_today: 0,
            free_tokens_reset_at: now.toISOString(),
          });

        if (insertError && insertError.code !== '23505') {
          console.error('Error creating balance row:', insertError);
          throw insertError;
        }

        return 0;
      }
      console.error('Error fetching balance:', error);
      throw error;
    }

    return data.credits;
  } catch (err) {
    console.error('Unexpected error in getOrCreateBalance:', err);
    return 0;
  }
}

/**
 * Gets full balance info including free tokens status.
 */
export async function getFullBalance(userId: string): Promise<{
  credits: number;
  freeTokensUsedToday: number;
  freeTokensDaily: number;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_balances')
      .select('credits, free_tokens_used_today, free_tokens_reset_at')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching balance:', error);
      return { credits: 0, freeTokensUsedToday: 0, freeTokensDaily: FREE_TOKENS_DAILY };
    }

    if (!data) {
      return { credits: 0, freeTokensUsedToday: 0, freeTokensDaily: FREE_TOKENS_DAILY };
    }

    // Check if we need to reset free tokens (new day)
    const now = new Date();
    const resetAt = data.free_tokens_reset_at ? new Date(data.free_tokens_reset_at) : null;
    const shouldReset = !resetAt || resetAt.toDateString() !== now.toDateString();

    return {
      credits: data.credits,
      freeTokensUsedToday: shouldReset ? 0 : (data.free_tokens_used_today ?? 0),
      freeTokensDaily: FREE_TOKENS_DAILY,
    };
  } catch (err) {
    console.error('Unexpected error in getFullBalance:', err);
    return { credits: 0, freeTokensUsedToday: 0, freeTokensDaily: FREE_TOKENS_DAILY };
  }
}

// ─── Razorpay order helpers ───────────────────────────────────────────────────

export interface RazorpayOrderRecord {
  id: string;
  user_id: string;
  razorpay_order_id: string;
  amount_paise: number;
  credits_to_add: number;
  status: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  created_at: string;
  paid_at: string | null;
}

export async function createRazorpayOrder(
  userId: string,
  razorpayOrderId: string,
  amountPaise: number,
  creditsToAdd: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('razorpay_orders')
      .insert({
        user_id: userId,
        razorpay_order_id: razorpayOrderId,
        amount_paise: amountPaise,
        credits_to_add: creditsToAdd,
        status: 'created',
      });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[createRazorpayOrder]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function markRazorpayOrderPaid(
  razorpayOrderId: string,
  paymentId: string,
  signature: string
): Promise<{ success: boolean; creditsToAdd?: number; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('razorpay_orders')
      .update({
        status: 'paid',
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        paid_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpayOrderId)
      .select('credits_to_add')
      .single();

    if (error) throw error;
    return { success: true, creditsToAdd: data.credits_to_add };
  } catch (err) {
    console.error('[markRazorpayOrderPaid]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function getRazorpayOrderByOrderId(
  razorpayOrderId: string
): Promise<RazorpayOrderRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('razorpay_orders')
    .select('*')
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RazorpayOrderRecord;
}

export async function getRazorpayOrderByPaymentId(
  paymentId: string
): Promise<RazorpayOrderRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('razorpay_orders')
    .select('*')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RazorpayOrderRecord;
}