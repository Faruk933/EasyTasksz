-- Remove obsolete referral-bonus naming while preserving referral commissions.
delete from public.settings where key = 'referral_bonus';

CREATE OR REPLACE FUNCTION public.add_referral_commission(ref_telegram_id bigint, commission_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_user_id bigint;
BEGIN
  IF ref_telegram_id IS NULL OR commission_amount IS NULL OR commission_amount <= 0 OR commission_amount > 1000000 THEN
    RAISE EXCEPTION 'Invalid referral commission';
  END IF;
  SELECT id INTO v_user_id FROM public.users WHERE telegram_id = ref_telegram_id FOR UPDATE;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Referrer not found'; END IF;
  UPDATE public.users
    SET balance = COALESCE(balance,0) + commission_amount,
        total_earned = COALESCE(total_earned,0) + commission_amount,
        referral_earnings = COALESCE(referral_earnings,0) + commission_amount
    WHERE id=v_user_id;
  INSERT INTO public.transactions(user_id,type,amount,description)
    VALUES(v_user_id,'referral_commission',commission_amount,'Referral commission');
END;
$function$;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
CHECK (type = ANY (ARRAY['ad_reward'::text,'referral_commission'::text,'withdrawal'::text,'admin_adjustment'::text,'bonus'::text]));

REVOKE ALL ON FUNCTION public.add_referral_commission(bigint,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_referral_commission(bigint,numeric) TO service_role;
