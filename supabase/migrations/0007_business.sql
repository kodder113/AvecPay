-- Avec for businesses: plans and billing, promo codes, team members,
-- merchants' own Stripe accounts (Connect), permanent / tip / ticket QRs,
-- Venmo / Cash App / PayPal handles, one-device Starter rule, AI reports.
--
-- Money rule unchanged: customers' payments go straight to the merchant
-- (their Stripe, bank or wallet app). Avec only charges merchants for the
-- software plan and, on Stripe payments, a small application fee.

-- ---------------------------------------------------------------------------
-- Payment methods: US focus. Adds Venmo, Cash App and PayPal handles.
-- Honduras-only methods stay in the catalog but are off for the Avec partner.
-- ---------------------------------------------------------------------------
alter table public.merchant_methods drop constraint merchant_methods_method_check;
alter table public.merchant_methods add constraint merchant_methods_method_check
  check (method in ('bank_transfer', 'tigo_money', 'card', 'lightning', 'usdt', 'zelle', 'venmo', 'cashapp', 'paypal'));
update public.partners
  set allowed_methods = array['card', 'zelle', 'venmo', 'cashapp', 'paypal', 'lightning', 'usdt']
  where id = 'avec';
alter table public.merchants alter column currency set default 'USD';

-- ---------------------------------------------------------------------------
-- Plans and billing (the merchant pays Avec). Existing shops keep working.
-- ---------------------------------------------------------------------------
alter table public.merchants
  add column plan text check (plan in ('starter', 'team', 'business')),
  -- Price list the merchant locked in when they first activated: launch or regular.
  add column price_tier text check (price_tier in ('launch', 'regular')),
  add column subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'comped')),
  -- Paid through (Stripe period end) or free-until (promo codes); null = no end for 'comped'.
  add column access_until timestamptz,
  add column past_due_since timestamptz,
  add column cancel_at_period_end boolean not null default false,
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  -- The merchant's own Stripe account (Connect, Standard): card payments go there.
  add column stripe_account_id text unique,
  add column stripe_charges_enabled boolean not null default false,
  add column stripe_details_submitted boolean not null default false,
  add column weekly_report boolean not null default true;

update public.merchants
  set plan = 'business', price_tier = 'launch', subscription_status = 'comped'
  where plan is null;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
-- Launch prices are offered until this date (null = until switched off).
insert into public.app_settings (key, value) values ('launch_pricing', '{"on": true, "until": null}');

-- ---------------------------------------------------------------------------
-- Promo codes: in-person activation (cash), free trials, discounts.
-- Managed by Avec admins through the server only (no client access).
-- ---------------------------------------------------------------------------
create table public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{3,32}$'),
  kind text not null check (kind in ('activation', 'trial', 'discount')),
  plan text check (plan in ('starter', 'team', 'business')),
  months int check (months between 1 and 36),
  days int check (days between 1 and 365),
  percent_off int check (percent_off between 1 and 100),
  max_uses int check (max_uses > 0),
  used_count int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'activation' or (plan is not null and months is not null)),
  check (kind <> 'trial' or (plan is not null and days is not null)),
  check (kind <> 'discount' or percent_off is not null)
);
alter table public.promo_codes enable row level security;

create table public.promo_redemptions (
  id bigint generated always as identity primary key,
  code text not null references public.promo_codes (code) on delete cascade,
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code, merchant_id)
);
alter table public.promo_redemptions enable row level security;

-- Atomically use one redemption of a code for a merchant. Service role only.
create function public.redeem_promo(p_code text, p_merchant uuid) returns public.promo_codes
language plpgsql security definer set search_path = public as $$
declare
  v public.promo_codes;
begin
  select * into v from public.promo_codes where code = upper(trim(p_code)) for update;
  if not found or not v.active then
    raise exception 'promo_invalid';
  end if;
  if v.expires_at is not null and v.expires_at < now() then
    raise exception 'promo_expired';
  end if;
  if v.max_uses is not null and v.used_count >= v.max_uses then
    raise exception 'promo_used_up';
  end if;
  if exists (select 1 from public.promo_redemptions where code = v.code and merchant_id = p_merchant) then
    raise exception 'promo_already_used';
  end if;
  insert into public.promo_redemptions (code, merchant_id) values (v.code, p_merchant);
  update public.promo_codes set used_count = used_count + 1 where code = v.code returning * into v;
  return v;
end;
$$;
revoke execute on function public.redeem_promo(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_promo(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Team members. The owner is also a member. One business per user.
-- ---------------------------------------------------------------------------
create table public.merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 200),
  display_name text check (char_length(display_name) <= 60),
  role text not null check (role in ('owner', 'manager', 'staff')),
  status text not null default 'active' check (status in ('invited', 'active')),
  created_at timestamptz not null default now(),
  unique (merchant_id, email)
);
create unique index merchant_members_one_business on public.merchant_members (user_id) where user_id is not null;
create index merchant_members_email_idx on public.merchant_members (email) where status = 'invited';
alter table public.merchant_members enable row level security;
create policy "merchant_members: self read" on public.merchant_members
  for select using (user_id = auth.uid());

insert into public.merchant_members (merchant_id, user_id, email, role, status)
select m.id, m.user_id, lower(u.email), 'owner', 'active'
from public.merchants m join auth.users u on u.id = m.user_id
on conflict do nothing;

-- Role of the signed-in user in a business, or null.
create function public.member_role(p_merchant uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.merchant_members
  where merchant_id = p_merchant and user_id = auth.uid() and status = 'active';
$$;
revoke execute on function public.member_role(uuid) from public, anon;
grant execute on function public.member_role(uuid) to authenticated;

create policy "merchants: member read" on public.merchants
  for select using (public.member_role(id) is not null);

-- ---------------------------------------------------------------------------
-- Charges: ticket / invoice QRs, permanent-QR charges, who created them.
-- ---------------------------------------------------------------------------
create table public.pay_links (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  kind text not null check (kind in ('pay', 'tip')),
  label text check (char_length(label) <= 60),
  -- Employee QR: sales and tips are credited to this team member.
  member_user_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index pay_links_merchant_idx on public.pay_links (merchant_id);
alter table public.pay_links enable row level security;

alter table public.charges
  add column kind text not null default 'quick' check (kind in ('quick', 'ticket', 'link')),
  add column ticket_ref text check (char_length(ticket_ref) <= 40),
  add column customer_name text check (char_length(customer_name) <= 80),
  add column customer_email text check (char_length(customer_email) <= 200),
  add column created_by uuid references auth.users (id) on delete set null,
  add column pay_link_id uuid references public.pay_links (id) on delete set null,
  -- A "tip" QR payment: the whole amount is a tip (no Avec fee).
  add column tip_only boolean not null default false,
  add column platform_fee numeric(14, 2) not null default 0,
  add column reminders_sent int not null default 0,
  add column last_reminder_at timestamptz;
create index charges_ticket_idx on public.charges (merchant_id, ticket_ref) where ticket_ref is not null;
create index charges_created_by_idx on public.charges (merchant_id, created_by);
create index charges_open_tickets_idx on public.charges (status, kind) where kind = 'ticket';

-- Managers and owners see all of the business's charges; staff see their own.
create policy "charges: member read" on public.charges
  for select using (
    public.member_role(merchant_id) in ('owner', 'manager')
    or (public.member_role(merchant_id) = 'staff' and created_by = auth.uid())
  );

-- Customer reports a payment sent from their own app (Zelle, Venmo, Cash App,
-- PayPal) on a live charge. Replaces the Zelle-only version.
drop function public.live_report_payment(text, numeric, text);
create function public.live_report_payment(p_code text, p_tip numeric, p_payer_name text, p_method text default 'zelle')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_charge public.charges;
  v_tip numeric(14, 2) := round(coalesce(p_tip, 0), 2);
  v_name text := left(nullif(trim(coalesce(p_payer_name, '')), ''), 60);
begin
  if p_method not in ('zelle', 'venmo', 'cashapp', 'paypal') then
    raise exception 'method_not_allowed';
  end if;
  select * into v_charge from public.charges where code = upper(p_code) for update;
  if not found then
    raise exception 'charge_not_found';
  end if;
  if v_charge.mode <> 'live' then
    raise exception 'not_live';
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
  if v_tip < 0 or v_tip > v_charge.amount or (v_tip > 0 and not v_charge.tips_allowed) then
    raise exception 'invalid_tip';
  end if;

  update public.charges
    set status = 'reported',
        paid_method = p_method,
        tip_amount = v_tip,
        payer_user_id = auth.uid(),
        payer_name = coalesce(v_name, public.demo_display_name(auth.uid()), 'Cliente'),
        reported_at = now()
    where id = v_charge.id;

  return jsonb_build_object('total', v_charge.amount + v_tip, 'currency', v_charge.currency);
end;
$$;
revoke execute on function public.live_report_payment(text, numeric, text, text) from public;
grant execute on function public.live_report_payment(text, numeric, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starter plan: one signed-in device at a time (newest sign-in wins).
-- ---------------------------------------------------------------------------
create table public.user_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  user_agent text,
  place text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  superseded_at timestamptz,
  primary key (user_id, session_id)
);
alter table public.user_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- AI reports and questions (Business plan).
-- ---------------------------------------------------------------------------
create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  kind text not null check (kind in ('weekly', 'question')),
  question text check (char_length(question) <= 500),
  answer text not null,
  lang text not null default 'en' check (lang in ('en', 'es')),
  period_start timestamptz,
  period_end timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_reports_merchant_idx on public.ai_reports (merchant_id, created_at desc);
alter table public.ai_reports enable row level security;
