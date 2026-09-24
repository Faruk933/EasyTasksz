-- Next-stage security hardening for EasyTasksz.
-- Browser roles already have no table/function grants; remove stale users policies as defense-in-depth.
-- Also pin search_path for remaining mutable functions.

DROP POLICY IF EXISTS "anon can read users" ON public.users;
DROP POLICY IF EXISTS "anon can insert users" ON public.users;

CREATE OR REPLACE FUNCTION public.add_referral_commission(ref_telegram_id bigint, commission_amount numeric)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.users
  SET balance = COALESCE(balance, 0) + commission_amount,
      total_earned = COALESCE(total_earned, 0) + commission_amount,
      referral_earnings = COALESCE(referral_earnings, 0) + commission_amount
  WHERE telegram_id = ref_telegram_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_referral_count(ref_telegram_id bigint)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.users
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE telegram_id = ref_telegram_id;
END;
$function$;

ALTER FUNCTION public.lock_users_admin_flag() SET search_path = '';

ALTER FUNCTION public.apply_campaign_bonus(bigint, bigint, numeric, text) SET search_path = '';
ALTER FUNCTION public.claim_welcome_campaign(bigint, bigint) SET search_path = '';

REVOKE ALL ON FUNCTION public.add_referral_commission(bigint, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_referral_commission(bigint, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.increment_referral_count(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_referral_count(bigint) TO service_role;

REVOKE ALL ON FUNCTION public.lock_users_admin_flag() FROM PUBLIC, anon, authenticated, service_role;
