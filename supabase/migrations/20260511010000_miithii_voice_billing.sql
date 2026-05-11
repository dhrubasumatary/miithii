create extension if not exists "pgcrypto";

do $$
begin
  create type public.credit_ledger_type as enum ('purchase', 'free_grant', 'generation_debit', 'refund', 'expiry', 'admin_adjustment');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.generation_status as enum ('queued', 'success', 'failed', 'refunded');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null default 'razorpay',
  provider_order_id text not null,
  provider_payment_id text,
  pack_id text not null,
  amount_inr numeric(10,2) not null,
  minutes_purchased numeric(10,2) not null,
  status text not null default 'created',
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_order_id, provider_payment_id)
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null,
  model text not null,
  language_code text not null,
  voice_name text not null,
  voice_gender text not null,
  prompt_version text not null,
  input_chars integer not null,
  estimated_duration_seconds integer not null,
  billable_minutes numeric(10,2) not null,
  credits_debited numeric(10,2) not null default 0,
  api_cost_inr_estimate numeric(10,2) not null default 0,
  chunk_count integer not null default 0,
  status public.generation_status not null default 'success',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.audio_files (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id text not null,
  chunk_index integer not null default 0,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null,
  text_length integer not null default 0,
  download_count integer not null default 0,
  last_downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type public.credit_ledger_type not null,
  minutes_delta numeric(10,2) not null,
  amount_inr numeric(10,2),
  pack_id text,
  payment_id uuid references public.payments(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,
  balance_after numeric(10,2),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cost_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  generation_id uuid references public.generations(id) on delete cascade,
  provider text not null,
  model text not null,
  event_type text not null,
  units numeric(12,4) not null,
  unit text not null,
  cost_inr_estimate numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create or replace view public.user_credit_balances as
select
  user_id,
  coalesce(sum(minutes_delta), 0)::numeric(10,2) as balance_minutes
from public.credit_ledger
group by user_id;

create or replace view public.daily_profitability as
with payment_days as (
  select
    date_trunc('day', created_at)::date as day,
    sum(amount_inr)::numeric(12,2) as revenue_inr
  from public.payments
  where status = 'paid'
  group by 1
),
generation_days as (
  select
    date_trunc('day', created_at)::date as day,
    sum(billable_minutes)::numeric(12,2) as generated_minutes
  from public.generations
  where status = 'success'
  group by 1
),
cost_days as (
  select
    date_trunc('day', created_at)::date as day,
    sum(cost_inr_estimate)::numeric(12,2) as estimated_api_cost_inr
  from public.cost_events
  group by 1
)
select
  coalesce(p.day, g.day, c.day) as day,
  coalesce(p.revenue_inr, 0)::numeric(12,2) as revenue_inr,
  coalesce(g.generated_minutes, 0)::numeric(12,2) as generated_minutes,
  coalesce(c.estimated_api_cost_inr, 0)::numeric(12,2) as estimated_api_cost_inr,
  (coalesce(p.revenue_inr, 0) - coalesce(c.estimated_api_cost_inr, 0))::numeric(12,2) as gross_profit_before_gateway_inr
from payment_days p
full outer join generation_days g on p.day = g.day
full outer join cost_days c on coalesce(p.day, g.day) = c.day;

create index if not exists payments_user_id_created_at_idx on public.payments(user_id, created_at desc);
create index if not exists generations_user_id_created_at_idx on public.generations(user_id, created_at desc);
create index if not exists audio_files_generation_id_idx on public.audio_files(generation_id);
create index if not exists credit_ledger_user_id_created_at_idx on public.credit_ledger(user_id, created_at desc);
create unique index if not exists credit_ledger_one_free_grant_per_user_idx
  on public.credit_ledger(user_id)
  where type = 'free_grant';
create index if not exists cost_events_generation_id_idx on public.cost_events(generation_id);

alter table public.payments enable row level security;
alter table public.generations enable row level security;
alter table public.audio_files enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.cost_events enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'miithii-audio',
  'miithii-audio',
  false,
  52428800,
  array['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
