-- Tips: the customer may add a tip (10/15/20% or a typed amount) when paying.
-- The merchant can switch tips off; each charge keeps the setting it was
-- created with. The tip travels in the same transfer as the charge.

alter table public.merchants
  add column tips_enabled boolean not null default true;

alter table public.charges
  add column tips_allowed boolean not null default true,
  add column tip_amount numeric(14, 2) not null default 0 check (tip_amount >= 0);

-- Replace the 2-argument payment function with one that takes a tip.
drop function public.demo_pay_charge(text, text);

create function public.demo_pay_charge(p_code text, p_method text, p_tip numeric default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_payer uuid := auth.uid();
  v_charge public.charges;
  v_merchant_user uuid;
  v_payer_acct public.demo_bank_accounts;
  v_merchant_acct public.demo_bank_accounts;
  v_tip numeric(14, 2) := round(coalesce(p_tip, 0), 2);
  v_total numeric(14, 2);
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
  -- A tip must be allowed, not negative, and at most the charge itself
  -- (catches typos like an extra zero).
  if v_tip < 0 or v_tip > v_charge.amount or (v_tip > 0 and not v_charge.tips_allowed) then
    raise exception 'invalid_tip';
  end if;

  select user_id into v_merchant_user from public.merchants where id = v_charge.merchant_id;
  if v_merchant_user = v_payer then
    raise exception 'cannot_pay_own_charge';
  end if;

  perform public.demo_ensure_account_for(v_payer);
  perform public.demo_ensure_account_for(v_merchant_user);

  perform 1 from public.demo_bank_accounts
    where user_id in (v_payer, v_merchant_user)
    order by id
    for update;
  select * into v_payer_acct from public.demo_bank_accounts where user_id = v_payer;
  select * into v_merchant_acct from public.demo_bank_accounts where user_id = v_merchant_user;

  v_total := v_charge.amount + v_tip;
  if v_payer_acct.balance < v_total then
    raise exception 'insufficient_funds';
  end if;

  update public.demo_bank_accounts set balance = balance - v_total where id = v_payer_acct.id;
  update public.demo_bank_accounts set balance = balance + v_total where id = v_merchant_acct.id;

  v_reference := lpad((floor(random() * 1e8))::bigint::text, 8, '0');
  v_payer_name := coalesce(public.demo_display_name(v_payer), 'Usuario');

  insert into public.demo_bank_transfers
    (from_account, to_account, from_name, to_name, amount, reference, method, charge_id)
  values
    (v_payer_acct.id, v_merchant_acct.id, v_payer_acct.holder_name, v_merchant_acct.holder_name,
     v_total, v_reference, p_method, v_charge.id);

  update public.charges
    set status = 'paid',
        tip_amount = v_tip,
        paid_method = p_method,
        paid_reference = v_reference,
        payer_user_id = v_payer,
        payer_name = v_payer_name,
        paid_at = now()
    where id = v_charge.id;

  return jsonb_build_object(
    'reference', v_reference,
    'amount', v_charge.amount,
    'tip', v_tip,
    'total', v_total,
    'currency', v_charge.currency,
    'method', p_method
  );
end;
$$;

revoke execute on function public.demo_pay_charge(text, text, numeric) from public, anon;
grant execute on function public.demo_pay_charge(text, text, numeric) to authenticated;
