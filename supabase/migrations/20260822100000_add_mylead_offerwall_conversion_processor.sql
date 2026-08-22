create or replace function public.process_mylead_offerwall_conversion(p_transaction_id text, p_player_id text, p_payout_usd numeric, p_status text)
returns table(processed boolean, user_id bigint, user_share numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_share numeric;
  v_commission_percent numeric;
  v_commission numeric;
begin
  if p_transaction_id is null or length(trim(p_transaction_id)) < 1 or p_payout_usd is null or p_payout_usd < 0 then
    return query select false, null::bigint, 0::numeric;
    return;
  end if;
  if lower(coalesce(p_status,'')) not in ('approved','completed','complete','confirmed','converted','') then
    return query select false, null::bigint, 0::numeric;
    return;
  end if;
  if exists (select 1 from public.offerwall_transactions where click_id=p_transaction_id) then
    return query select false, null::bigint, 0::numeric;
    return;
  end if;
  begin
    select * into v_user from public.users where telegram_id = trim(p_player_id)::bigint for update;
  exception when invalid_text_representation then
    v_user := null;
  end;
  if v_user.id is null then
    return query select false, null::bigint, 0::numeric;
    return;
  end if;
  v_share := round(p_payout_usd * 0.60, 6);
  update public.users
    set balance=coalesce(balance,0)+v_share,
        total_earned=coalesce(total_earned,0)+v_share
    where id=v_user.id;
  if v_user.referred_by is not null then
    select coalesce((select value::numeric from public.settings where key='referral_commission_percent' limit 1),3)
      into v_commission_percent;
    v_commission := v_share * (v_commission_percent/100);
    perform public.add_referral_commission(v_user.referred_by,v_commission);
  end if;
  insert into public.offerwall_transactions(click_id,user_id,payout_usd,user_share)
    values (p_transaction_id,v_user.id,p_payout_usd,v_share);
  return query select true,v_user.id,v_share;
end;
$$;
