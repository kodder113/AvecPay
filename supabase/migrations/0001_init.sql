-- AvecPay initial schema.
--
-- Design notes
-- * AvecPay never custodies funds. `transfers` records an off-ramp order that
--   lives at a payout provider (MoonPay first). The provider issues the deposit
--   address; the sender pays it directly from their own wallet.
-- * Status and deposit fields are written only by the server (service role),
--   never by the browser. Users get read-only access to their own transfers.
-- * Every provider deposit address is unique across all transfers. The unique
--   index below is the last line of defence against address reuse.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  country_code char(2) not null default 'US',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: owner update" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles: owner insert" on public.profiles
  for insert with check (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Recipients (managed by the sender)
-- ---------------------------------------------------------------------------
create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  country_code char(2) not null,
  created_at timestamptz not null default now(),
  constraint recipients_contact_required check (email is not null or phone is not null)
);

create index recipients_user_idx on public.recipients (user_id);

alter table public.recipients enable row level security;

create policy "recipients: owner all" on public.recipients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Transfers
-- ---------------------------------------------------------------------------
create type public.transfer_status as enum (
  'created',
  'awaiting_usdt',
  'usdt_received',
  'processing',
  'payout_initiated',
  'completed',
  'failed'
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references public.recipients (id) on delete restrict,

  provider text not null,                 -- e.g. 'moonpay'
  status public.transfer_status not null default 'created',

  -- What the sender is sending
  crypto_currency_code text not null,     -- provider code, e.g. 'usdt_trx'
  crypto_network text,                    -- e.g. 'tron'
  crypto_amount numeric(36, 18) not null,
  recipient_country char(2) not null,
  payout_method text not null,            -- e.g. 'credit_debit_card'
  refund_wallet_address text not null,    -- sender-owned wallet for provider refunds

  -- Estimate shown to the sender at creation time (from the provider quote)
  est_fiat_currency text,
  est_fiat_amount numeric(36, 8),
  est_exchange_rate numeric(36, 8),
  est_provider_fee numeric(36, 8),
  est_network_fee numeric(36, 8),
  est_avecpay_fee numeric(36, 8),
  quote_raw jsonb,

  -- Recipient claim link (secret, unguessable)
  claim_token text not null unique,

  -- Provider order, filled once the provider creates it
  provider_transaction_id text unique,
  deposit_address text,
  deposit_address_tag text,
  deposit_hash text,
  final_fiat_currency text,
  final_fiat_amount numeric(36, 8),
  failure_reason text,
  provider_raw jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transfers_user_idx on public.transfers (user_id, created_at desc);

-- Never reuse a deposit address (address + optional memo/tag) across orders.
create unique index transfers_unique_deposit_address
  on public.transfers (provider, crypto_currency_code, deposit_address, coalesce(deposit_address_tag, ''))
  where deposit_address is not null;

alter table public.transfers enable row level security;

create policy "transfers: owner read" on public.transfers
  for select using (auth.uid() = user_id);
-- No insert/update/delete policies: writes happen server-side with the service role.

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transfers_touch before update on public.transfers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Transfer status history
-- ---------------------------------------------------------------------------
create table public.transfer_events (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.transfers (id) on delete cascade,
  status public.transfer_status not null,
  source text not null,                   -- 'system' | 'webhook' | 'poll' | 'redirect'
  detail jsonb,
  created_at timestamptz not null default now()
);

create index transfer_events_transfer_idx on public.transfer_events (transfer_id, created_at);

alter table public.transfer_events enable row level security;

create policy "transfer_events: owner read" on public.transfer_events
  for select using (
    exists (select 1 from public.transfers t where t.id = transfer_id and t.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Raw webhook log (server only; no RLS policies = no client access)
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_type text,
  signature_valid boolean not null,
  payload jsonb,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.webhook_events enable row level security;
