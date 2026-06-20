-- =============================================================================
-- Miithii Database Schema
-- Execute this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- =============================================================================

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Credit balances (one row per user)
CREATE TABLE IF NOT EXISTS credit_balances (
  user_id          TEXT        NOT NULL PRIMARY KEY,
  credits          INTEGER     NOT NULL DEFAULT 0,
  total_spent      INTEGER     NOT NULL DEFAULT 0,
  free_tokens_used_today INTEGER NOT NULL DEFAULT 0,
  free_tokens_reset_at    DATE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit transactions (audit trail)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
  amount      INTEGER     NOT NULL,
  balance_after INTEGER   NOT NULL,
  description TEXT,
  request_id  TEXT,
  tokens_used INTEGER,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Razorpay orders
CREATE TABLE IF NOT EXISTS razorpay_orders (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT        NOT NULL,
  razorpay_order_id    TEXT        NOT NULL UNIQUE,
  amount_paise         INTEGER     NOT NULL,
  credits_to_add       INTEGER     NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'created'
                                       CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
  razorpay_payment_id  TEXT,
  razorpay_signature   TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at              TIMESTAMPTZ
);

-- Chats
CREATE TABLE IF NOT EXISTS chats (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL,
  title      TEXT,
  model      TEXT        NOT NULL DEFAULT 'glm-5.2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     UUID        NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT        NOT NULL,
  tokens_used INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chats_user_id           ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id        ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_user_id ON razorpay_orders(user_id);

-- Fast lookup of razorpay orders by payment ID (webhook idempotency)
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_payment_id ON razorpay_orders(razorpay_payment_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE credit_balances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE razorpay_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;

-- credit_balances: only the user can read/write their own
CREATE POLICY "Users read own balance"       ON credit_balances FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users insert own balance"     ON credit_balances FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users update own balance"     ON credit_balances FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- credit_transactions: only the user can read their own
CREATE POLICY "Users read own transactions"  ON credit_transactions FOR SELECT USING (user_id = (SELECT auth.uid()));

-- razorpay_orders: only the user can read their own; service role key used for writes
CREATE POLICY "Users read own orders"        ON razorpay_orders FOR SELECT USING (user_id = (SELECT auth.uid()));

-- chats: only the user can read/write their own
CREATE POLICY "Users read own chats"         ON chats FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users insert own chats"       ON chats FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users update own chats"       ON chats FOR UPDATE USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users delete own chats"       ON chats FOR DELETE USING (user_id = (SELECT auth.uid()));

-- messages: user must own the parent chat
CREATE POLICY "Users read own messages"      ON messages FOR SELECT USING (
  chat_id IN (SELECT id FROM chats WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY "Users insert own messages"    ON messages FOR INSERT WITH CHECK (
  chat_id IN (SELECT id FROM chats WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY "Users delete own messages"    ON messages FOR DELETE USING (
  chat_id IN (SELECT id FROM chats WHERE user_id = (SELECT auth.uid()))
);

-- ─── RPC Functions ────────────────────────────────────────────────────────────

-- deduct_credits: atomically deduct credits and insert a transaction record
-- Returns the updated balance row
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id    TEXT,
  p_amount     INTEGER,
  p_description TEXT,
  p_tokens_used INTEGER DEFAULT NULL,
  p_metadata   JSONB   DEFAULT NULL
)
RETURNS credit_balances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance INTEGER;
  result      credit_balances;
BEGIN
  -- Lock the balance row for update to prevent concurrent over-drafts
  SELECT credits INTO new_balance
  FROM credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If no balance row exists, create one with 0 credits
  IF new_balance IS NULL THEN
    INSERT INTO credit_balances (user_id, credits) VALUES (p_user_id, 0)
    RETURNING credits INTO new_balance;
  END IF;

  -- Fail if insufficient credits
  IF new_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  new_balance := new_balance - p_amount;

  UPDATE credit_balances
  SET credits = new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, tokens_used, metadata)
  VALUES (p_user_id, 'usage', -p_amount, new_balance, p_description, p_tokens_used, p_metadata);

  SELECT * INTO result FROM credit_balances WHERE user_id = p_user_id;
  RETURN result;
END;
$$;

-- add_credits: atomically add credits and insert a transaction record
-- Returns the updated balance row
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id  TEXT,
  p_amount   INTEGER,
  p_type     TEXT,  -- 'purchase' | 'refund' | 'bonus'
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB  DEFAULT NULL
)
RETURNS credit_balances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance INTEGER;
  result      credit_balances;
BEGIN
  -- Lock or create the balance row
  SELECT credits INTO new_balance
  FROM credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF new_balance IS NULL THEN
    INSERT INTO credit_balances (user_id, credits) VALUES (p_user_id, 0)
    RETURNING credits INTO new_balance;
  END IF;

  new_balance := new_balance + p_amount;

  UPDATE credit_balances
  SET credits = new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (p_user_id, p_type, p_amount, new_balance, p_description, p_metadata);

  SELECT * INTO result FROM credit_balances WHERE user_id = p_user_id;
  RETURN result;
END;
$$;

-- ─── Notes ────────────────────────────────────────────────────────────────────
-- Service role key bypasses RLS — use supabaseAdmin in server-side code.
-- anon key is used by client-side code with RLS policies enforced.
-- Ensure the auth.uid() helper in RLS policies is populated by setting
-- supabase.auth.jwt() — Clerk JWTs must be configured in Supabase Auth settings.
-- =============================================================================