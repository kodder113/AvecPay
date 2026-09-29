-- Avec Cobros: merchants charge with a QR; customers pay by the merchant's
-- chosen methods. Avec never holds money: in live mode payments go straight
-- to the merchant's bank account or wallet and Avec only records the
-- confirmation. Demo mode simulates that with "Banco Demo", a separate fake
-- bank whose transfers confirm charges the same way a partner bank will.

-- ---------------------------------------------------------------------------
-- Partners: who a merchant signs up through (Avec direct, or a bank's
-- white-label). allowed_methods is the top-level on/off switch; a bank
-- partner can be fiat-only.
-- ---------------------------------------------------------------------------
create table public.partners (
  id text primary key,
  name text not null,
  allowed_methods text[] not null,
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;
create policy "partners: signed-in read" on public.partners
  for select to authenticated using (true);

insert into public.partners (id, name, allowed_methods) values
  ('avec', 'Avec', array['bank_transfer', 'tigo_money', 'card', 'lightning', 'usdt']);

-- ---------------------------------------------------------------------------
-- Merchants (one per user for now) and their per-method switches/details
-- ---------------------------------------------------------------------------
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  partner_id text not null default 'avec' references public.partners (id),
  business_name text not null check (char_length(business_name) between 2 and 80),
  country_code char(2) not null default 'HN',
  currency char(3) not null default 'HNL',
  created_at timestamptz not null default now()
);

alter table public.merchants enable row level security;
create policy "merchants: owner read" on public.merchants
  for select using (auth.uid() = user_id);
create policy "merchants: owner insert" on public.merchants
  for insert with check (auth.uid() = user_id and partner_id = 'avec');
create policy "merchants: owner update" on public.merchants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.merchant_methods (
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  method text not null check (method in ('bank_transfer', 'tigo_money', 'card', 'lightning', 'usdt')),
  enabled boolean not null default true,
  -- Live-mode payout details (bank account, Tigo number, wallet address…)
  details jsonb not null default '{}'::jsonb,
  primary key (merchant_id, method)
);

alter table public.merchant_methods enable row level security;
create policy "merchant_methods: owner all" on public.merchant_methods
  for all using (exists (select 1 from public.merchants m where m.id = merchant_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.merchants m where m.id = merchant_id and m.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Charges: one QR / payment link each
-- ---------------------------------------------------------------------------
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  amount numeric(14, 2) not null check (amount > 0 and amount <= 1000000),
  currency char(3) not null,
  description text check (char_length(description) <= 140),
  -- Methods offered, fixed at creation (partner switch ∩ merchant switch)
  allowed_methods text[] not null check (cardinality(allowed_methods) > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_method text,
  paid_reference text,
  payer_user_id uuid references auth.users (id) on delete set null,
  payer_name text,
  paid_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now()
);

create index charges_merchant_idx on public.charges (merchant_id, created_at desc);

alter table public.charges enable row level security;
create policy "charges: merchant read" on public.charges
  for select using (exists (select 1 from public.merchants m where m.id = merchant_id and m.user_id = auth.uid()));
create policy "charges: payer read" on public.charges
  for select using (payer_user_id = auth.uid());
-- Created and cancelled server-side after authorization checks; paid only by
-- the demo bank function below (or, later, a partner bank's confirmation).

-- ---------------------------------------------------------------------------
-- Banco Demo: a separate, fake bank. Not part of Avec's records of real money.
-- ---------------------------------------------------------------------------
create table public.demo_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  account_number text not null unique,
  holder_name text not null,
  balance numeric(14, 2) not null default 10000 check (balance >= 0),
  currency char(3) not null default 'HNL',
  created_at timestamptz not null default now()
);

alter table public.demo_bank_accounts enable row level security;
create policy "demo_bank_accounts: owner read" on public.demo_bank_accounts
  for select using (auth.uid() = user_id);

create table public.demo_bank_transfers (
  id bigint generated always as identity primary key,
  from_account uuid not null references public.demo_bank_accounts (id) on delete cascade,
  to_account uuid not null references public.demo_bank_accounts (id) on delete cascade,
  from_name text not null,
  to_name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  reference text not null,
  method text not null,
  charge_id uuid references public.charges (id) on delete set null,
  created_at timestamptz not null default now()
);

create index demo_bank_transfers_from_idx on public.demo_bank_transfers (from_account, created_at desc);
create index demo_bank_transfers_to_idx on public.demo_bank_transfers (to_account, created_at desc);

alter table public.demo_bank_transfers enable row level security;
create policy "demo_bank_transfers: party read" on public.demo_bank_transfers
  for select using (
    exists (
      select 1 from public.demo_bank_accounts a
      where a.user_id = auth.uid() and a.id in (from_account, to_account)
    )
  );

-- Display name for a user: profile name, else the part of the email before @.
create function public.demo_display_name(p_user uuid) returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    nullif(trim(p.full_name), ''),
    split_part(u.email, '@', 1),
    'Usuario'
  )
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user;
$$;

create function public.demo_ensure_account_for(p_user uuid) returns public.demo_bank_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_account public.demo_bank_accounts;
begin
  select * into v_account from public.demo_bank_accounts where user_id = p_user;
  if found then
    return v_account;
  end if;
  insert into public.demo_bank_accounts (user_id, account_number, holder_name)
  values (
    p_user,
    'DEMO-' || lpad((floor(random() * 1e10))::bigint::text, 10, '0'),
    coalesce(public.demo_display_name(p_user), 'Usuario')
  )
  on conflict (user_id) do nothing
  returning * into v_account;
  if v_account.id is null then
    select * into v_account from public.demo_bank_accounts where user_id = p_user;
  end if;
  return v_account;
end;
$$;

-- Callable by the signed-in user: open (or fetch) their Banco Demo account.
create function public.demo_ensure_account() returns public.demo_bank_accounts
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  return public.demo_ensure_account_for(auth.uid());
end;
$$;

-- Refill the signed-in user's Banco Demo account to L 10,000.
create function public.demo_reset_account() returns public.demo_bank_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_account public.demo_bank_accounts;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  perform public.demo_ensure_account_for(auth.uid());
  update public.demo_bank_accounts set balance = 10000 where user_id = auth.uid()
  returning * into v_account;
  return v_account;
end;
$$;

-- Pay a demo charge from the signed-in user's Banco Demo account.
-- Atomic: the transfer, both balances and the charge confirmation commit
-- together or not at all. Raises a short error code on any rule violation.
create function public.demo_pay_charge(p_code text, p_method text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_payer uuid := auth.uid();
  v_charge public.charges;
  v_merchant_user uuid;
  v_payer_acct public.demo_bank_accounts;
  v_merchant_acct public.demo_bank_accounts;
  v_reference text;
  v_payer_name text;
begin
  if v_payer is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_charge from public.charges where code = upper(p_code) for update;
  if not found then
    raise exception 'charge_not_found';
  end if;
  if v_charge.mode <> 'demo' then
    raise exception 'not_demo';
  end if;
  if v_charge.status <> 'pending' then
    raise exception 'charge_not_pending';
  end if;
  if v_charge.expires_at < now() then
    raise exception 'charge_expired';
  end if;
  if not (p_method = any (v_charge.allowed_methods)) then
    raise exception 'method_not_allowed';
  end if;

  select user_id into v_merchant_user from public.merchants where id = v_charge.merchant_id;
  if v_merchant_user = v_payer then
    raise exception 'cannot_pay_own_charge';
  end if;

  perform public.demo_ensure_account_for(v_payer);
  perform public.demo_ensure_account_for(v_merchant_user);

  -- Lock both accounts in a fixed order so concurrent payments can't deadlock.
  perform 1 from public.demo_bank_accounts
    where user_id in (v_payer, v_merchant_user)
    order by id
    for update;
  select * into v_payer_acct from public.demo_bank_accounts where user_id = v_payer;
  select * into v_merchant_acct from public.demo_bank_accounts where user_id = v_merchant_user;

  if v_payer_acct.balance < v_charge.amount then
    raise exception 'insufficient_funds';
  end if;

  update public.demo_bank_accounts set balance = balance - v_charge.amount where id = v_payer_acct.id;
  update public.demo_bank_accounts set balance = balance + v_charge.amount where id = v_merchant_acct.id;

  v_reference := lpad((floor(random() * 1e8))::bigint::text, 8, '0');
  v_payer_name := coalesce(public.demo_display_name(v_payer), 'Usuario');

  insert into public.demo_bank_transfers
    (from_account, to_account, from_name, to_name, amount, reference, method, charge_id)
  values
    (v_payer_acct.id, v_merchant_acct.id, v_payer_acct.holder_name, v_merchant_acct.holder_name,
     v_charge.amount, v_reference, p_method, v_charge.id);

  update public.charges
    set status = 'paid',
        paid_method = p_method,
        paid_reference = v_reference,
        payer_user_id = v_payer,
        payer_name = v_payer_name,
        paid_at = now()
    where id = v_charge.id;

  return jsonb_build_object(
    'reference', v_reference,
    'amount', v_charge.amount,
    'currency', v_charge.currency,
    'method', p_method
  );
end;
$$;

-- Only signed-in users may call the demo functions; nobody may call the helpers.
revoke execute on function public.demo_display_name(uuid) from public, anon, authenticated;
revoke execute on function public.demo_ensure_account_for(uuid) from public, anon, authenticated;
revoke execute on function public.demo_ensure_account() from public, anon;
revoke execute on function public.demo_reset_account() from public, anon;
revoke execute on function public.demo_pay_charge(text, text) from public, anon;
grant execute on function public.demo_ensure_account() to authenticated;
grant execute on function public.demo_reset_account() to authenticated;
grant execute on function public.demo_pay_charge(text, text) to authenticated;
