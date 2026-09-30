-- Real-money mode ("live") alongside the demo.
--
-- * Zelle: the customer pays from their own bank app, taps "Ya pagué", and
--   the merchant confirms after seeing the money arrive ("reported" -> "paid").
--   Avec never touches the money and can't see the merchant's bank.
-- * Card / Apple Pay: Stripe Checkout; Stripe's signed webhook marks the
--   charge paid. (Single owner account for testing; Stripe Connect later.)

-- New method: Zelle (US).
alter table public.merchant_methods drop constraint merchant_methods_method_check;
alter table public.merchant_methods add constraint merchant_methods_method_check
  check (method in ('bank_transfer', 'tigo_money', 'card', 'lightning', 'usdt', 'zelle'));
update public.partners
  set allowed_methods = array_append(allowed_methods, 'zelle')
  where id = 'avec' and not ('zelle' = any (allowed_methods));

-- Merchant: demo or real, and USD as well as HNL.
alter table public.merchants
  add column mode text not null default 'demo' check (mode in ('demo', 'live'));
alter table public.merchants
  add constraint merchants_currency_check check (currency in ('HNL', 'USD'));

-- Charges: the "customer says they paid" step, and the Stripe session.
alter table public.charges drop constraint charges_status_check;
alter table public.charges add constraint charges_status_check
  check (status in ('pending', 'reported', 'paid', 'cancelled'));
alter table public.charges
  add column reported_at timestamptz,
  add column stripe_session_id text unique;

-- Customer (signed in or not) reports a Zelle payment on a live charge.
create function public.live_report_payment(p_code text, p_tip numeric, p_payer_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_charge public.charges;
  v_tip numeric(14, 2) := round(coalesce(p_tip, 0), 2);
  v_name text := nullif(trim(coalesce(p_payer_name, '')), '');
begin
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
  if not ('zelle' = any (v_charge.allowed_methods)) then
    raise exception 'method_not_allowed';
  end if;
  if v_tip < 0 or v_tip > v_charge.amount or (v_tip > 0 and not v_charge.tips_allowed) then
    raise exception 'invalid_tip';
  end if;
  if v_name is not null and char_length(v_name) > 60 then
    v_name := left(v_name, 60);
  end if;

  update public.charges
    set status = 'reported',
        paid_method = 'zelle',
        tip_amount = v_tip,
        payer_user_id = auth.uid(),
        payer_name = coalesce(v_name, public.demo_display_name(auth.uid()), 'Cliente'),
        reported_at = now()
    where id = v_charge.id;

  return jsonb_build_object('total', v_charge.amount + v_tip, 'currency', v_charge.currency);
end;
$$;

revoke execute on function public.live_report_payment(text, numeric, text) from public;
grant execute on function public.live_report_payment(text, numeric, text) to anon, authenticated;
