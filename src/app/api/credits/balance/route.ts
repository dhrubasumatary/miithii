import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const TOKENS_PER_CREDIT = parseInt(process.env.TOKENS_PER_CREDIT || '20');
const FREE_TOKENS_DAILY = parseInt(process.env.FREE_TOKENS_DAILY || '500');

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabaseAdmin
      .from('credit_balances')
      .select('credits, free_tokens_used_today, free_tokens_reset_at')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching balance:', error);
      return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
    }

    const now = new Date();
    const resetAt = data?.free_tokens_reset_at ? new Date(data.free_tokens_reset_at) : null;
    const shouldReset = !resetAt || resetAt.toDateString() !== now.toDateString();

    const credits = data?.credits ?? 0;
    const freeTokensUsedToday = shouldReset ? 0 : (data?.free_tokens_used_today ?? 0);
    const freeTokensRemaining = Math.max(0, FREE_TOKENS_DAILY - freeTokensUsedToday);

    return NextResponse.json({
      credits,
      freeTokensUsedToday,
      freeTokensDaily: FREE_TOKENS_DAILY,
      freeTokensRemaining,
      tokensPerCredit: TOKENS_PER_CREDIT,
    });
  } catch (err) {
    console.error('Balance API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}