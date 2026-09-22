-- Comprehensive security hardening for EasyTasksz.
-- Browser roles must never reach public tables/functions; all access is through verified Edge Functions.
-- Balance credits are performed atomically inside the database to prevent replay/race-condition abuse.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.oid::regclass AS rel
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.rel);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.reward_ad_atomic(p_telegram_id bigint,p_reward numeric,p_daily_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user public.users%ROWTYPE; v_today date:=CURRENT_DATE; v_ads integer; v_balance numeric; v_total numeric;
BEGIN
 IF p_reward IS NULL OR p_reward<=0 OR p_reward>100 THEN RAISE EXCEPTION 'Invalid reward amount'; END IF;
 IF p_daily_limit IS NULL OR p_daily_limit<=0 OR p_daily_limit>100000 THEN RAISE EXCEPTION 'Invalid daily ad limit'; END IF;
 SELECT * INTO v_user FROM public.users WHERE telegram_id=p_telegram_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
 IF COALESCE(v_user.is_banned,false) THEN RAISE EXCEPTION 'Account is banned'; END IF;
 v_ads:=CASE WHEN v_user.last_ad_date=v_today THEN COALESCE(v_user.ads_watched_today,0) ELSE 0 END;
 IF v_ads>=p_daily_limit THEN RAISE EXCEPTION 'Daily ad limit reached'; END IF;
 v_balance:=COALESCE(v_user.balance,0)+p_reward; v_total:=COALESCE(v_user.total_earned,0)+p_reward;
 UPDATE public.users SET balance=v_balance,total_earned=v_total,ads_watched=COALESCE(v_user.ads_watched,0)+1,ads_watched_today=v_ads+1,last_ad_date=v_today WHERE id=v_user.id;
 RETURN jsonb_build_object('user',jsonb_build_object('id',v_user.id,'telegram_id',v_user.telegram_id,'username',v_user.username,'first_name',v_user.first_name,'last_name',v_user.last_name,'photo_url',v_user.photo_url,'balance',v_balance,'total_earned',v_total,'ads_watched',COALESCE(v_user.ads_watched,0)+1,'ads_watched_today',v_ads+1,'last_ad_date',v_today,'referral_code',v_user.referral_code,'referral_count',v_user.referral_count,'referral_earnings',v_user.referral_earnings,'referred_by',v_user.referred_by),'referred_by',v_user.referred_by);
END $$;

CREATE OR REPLACE FUNCTION public.credit_offerwall_atomic(p_click_id text,p_telegram_id bigint,p_payout_usd numeric,p_user_share numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user public.users%ROWTYPE; v_balance numeric;
BEGIN
 IF p_click_id IS NULL OR length(trim(p_click_id))<1 OR length(trim(p_click_id))>128 THEN RAISE EXCEPTION 'Invalid transaction ID'; END IF;
 IF p_telegram_id IS NULL OR p_telegram_id<=0 THEN RAISE EXCEPTION 'Invalid user ID'; END IF;
 IF p_payout_usd IS NULL OR p_payout_usd<0 OR p_payout_usd>100000 THEN RAISE EXCEPTION 'Invalid payout'; END IF;
 IF p_user_share IS NULL OR p_user_share<=0 OR p_user_share>100000 THEN RAISE EXCEPTION 'Invalid reward'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(trim(p_click_id)));
 IF EXISTS(SELECT 1 FROM public.offerwall_transactions WHERE click_id=trim(p_click_id)) THEN RETURN jsonb_build_object('processed',false); END IF;
 SELECT * INTO v_user FROM public.users WHERE telegram_id=p_telegram_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
 IF COALESCE(v_user.is_banned,false) THEN RAISE EXCEPTION 'Account is banned'; END IF;
 v_balance:=COALESCE(v_user.balance,0)+p_user_share;
 UPDATE public.users SET balance=v_balance,total_earned=COALESCE(v_user.total_earned,0)+p_user_share WHERE id=v_user.id;
 INSERT INTO public.offerwall_transactions(click_id,user_id,payout_usd,user_share) VALUES(trim(p_click_id),v_user.id,p_payout_usd,p_user_share);
 RETURN jsonb_build_object('processed',true,'user_id',v_user.id,'referred_by',v_user.referred_by,'new_balance',v_balance);
END $$;

REVOKE ALL ON FUNCTION public.reward_ad_atomic(bigint,numeric,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reward_ad_atomic(bigint,numeric,integer) TO service_role;
REVOKE ALL ON FUNCTION public.credit_offerwall_atomic(text,bigint,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.credit_offerwall_atomic(text,bigint,numeric,numeric) TO service_role;

-- Explicitly keep existing server-only RPCs locked down.
REVOKE ALL ON FUNCTION public.process_offer_conversion(text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_offer_conversion(text,text,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.process_mobidea_conversion(text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_mobidea_conversion(text,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.process_mylead_offerwall_conversion(text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_mylead_offerwall_conversion(text,text,numeric,text) TO service_role;
REVOKE ALL ON FUNCTION public.create_withdrawal_atomic(bigint,text,numeric,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_atomic(bigint,text,numeric,numeric,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.transition_withdrawal(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_withdrawal(bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_welcome_campaign(bigint,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_campaign_bonus(bigint,bigint,numeric) TO service_role;

DO $$
BEGIN
 IF to_regprocedure('public.add_referral_commission(bigint,numeric)') IS NOT NULL THEN
   REVOKE ALL ON FUNCTION public.add_referral_commission(bigint,numeric) FROM PUBLIC,anon,authenticated;
   GRANT EXECUTE ON FUNCTION public.add_referral_commission(bigint,numeric) TO service_role;
 END IF;
END $$;

-- Harden the legacy offer-conversion processors too: validate payouts, block banned accounts,
-- use an empty search_path, and keep referral accounting server-side.
CREATE OR REPLACE FUNCTION public.process_offer_conversion(p_provider text,p_click_id text,p_payout_usd numeric)
RETURNS TABLE(processed boolean,user_id bigint,user_share numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_click public.offer_clicks%rowtype; v_user public.users%rowtype; v_share numeric; v_pct numeric;
BEGIN
 IF p_provider IS NULL OR p_click_id IS NULL OR length(trim(p_click_id))<8 OR length(trim(p_click_id))>128 OR p_payout_usd IS NULL OR p_payout_usd<=0 OR p_payout_usd>100000 THEN RETURN QUERY SELECT false,NULL::bigint,0::numeric; RETURN; END IF;
 SELECT * INTO v_click FROM public.offer_clicks WHERE provider=lower(trim(p_provider)) AND click_id=trim(p_click_id) FOR UPDATE;
 IF NOT FOUND OR v_click.status='converted' THEN RETURN QUERY SELECT false,CASE WHEN FOUND THEN v_click.user_id ELSE NULL::bigint END,0::numeric; RETURN; END IF;
 SELECT * INTO v_user FROM public.users WHERE id=v_click.user_id FOR UPDATE;
 IF NOT FOUND OR COALESCE(v_user.is_banned,false) THEN RETURN QUERY SELECT false,NULL::bigint,0::numeric; RETURN; END IF;
 v_share:=round(p_payout_usd*0.60,6);
 UPDATE public.users SET balance=COALESCE(balance,0)+v_share,total_earned=COALESCE(total_earned,0)+v_share WHERE id=v_user.id;
 UPDATE public.offer_clicks SET status='converted',converted_at=now(),payout_usd=p_payout_usd WHERE id=v_click.id;
 IF v_user.referred_by IS NOT NULL THEN
   SELECT COALESCE((SELECT value::numeric FROM public.settings WHERE key='referral_commission_percent' LIMIT 1),3) INTO v_pct;
   PERFORM public.add_referral_commission(v_user.referred_by,v_share*(v_pct/100));
 END IF;
 RETURN QUERY SELECT true,v_user.id,v_share;
END $$;

CREATE OR REPLACE FUNCTION public.process_mobidea_conversion(p_click_id text,p_payout_usd numeric)
RETURNS TABLE(processed boolean,user_id bigint,user_share numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_click public.mobidea_clicks%rowtype; v_user public.users%rowtype; v_share numeric; v_pct numeric;
BEGIN
 IF p_click_id IS NULL OR length(trim(p_click_id))<8 OR length(trim(p_click_id))>64 OR p_payout_usd IS NULL OR p_payout_usd<=0 OR p_payout_usd>100000 THEN RETURN QUERY SELECT false,NULL::bigint,0::numeric; RETURN; END IF;
 SELECT * INTO v_click FROM public.mobidea_clicks WHERE click_id=trim(p_click_id) FOR UPDATE;
 IF NOT FOUND OR v_click.status='converted' THEN RETURN QUERY SELECT false,CASE WHEN FOUND THEN v_click.user_id ELSE NULL::bigint END,0::numeric; RETURN; END IF;
 SELECT * INTO v_user FROM public.users WHERE id=v_click.user_id FOR UPDATE;
 IF NOT FOUND OR COALESCE(v_user.is_banned,false) THEN RETURN QUERY SELECT false,NULL::bigint,0::numeric; RETURN; END IF;
 v_share:=round(p_payout_usd*0.60,6);
 UPDATE public.users SET balance=COALESCE(balance,0)+v_share,total_earned=COALESCE(total_earned,0)+v_share WHERE id=v_user.id;
 UPDATE public.mobidea_clicks SET status='converted',converted_at=now(),payout_usd=p_payout_usd WHERE id=v_click.id;
 IF v_user.referred_by IS NOT NULL THEN
   SELECT COALESCE((SELECT value::numeric FROM public.settings WHERE key='referral_commission_percent' LIMIT 1),3) INTO v_pct;
   PERFORM public.add_referral_commission(v_user.referred_by,v_share*(v_pct/100));
 END IF;
 RETURN QUERY SELECT true,v_user.id,v_share;
END $$;

CREATE OR REPLACE FUNCTION public.process_mylead_offerwall_conversion(p_transaction_id text,p_player_id text,p_payout_usd numeric,p_status text)
RETURNS TABLE(processed boolean,user_id bigint,user_share numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user public.users%rowtype; v_share numeric;
BEGIN
 IF p_transaction_id IS NULL OR length(trim(p_transaction_id))<1 OR length(trim(p_transaction_id))>128 OR p_payout_usd IS NULL OR p_payout_usd<=0 OR p_payout_usd>100000 OR lower(coalesce(p_status,'')) NOT IN ('approved','completed','complete','confirmed','converted','') THEN RETURN QUERY SELECT false,NULL::bigint,0::numeric; RETURN; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(trim(p_transaction_id)));
 IF EXISTS(SELECT 1 FROM public.offerwall_transactions WHERE click_id=trim(p_transaction_id)) THEN RETURN QUERY SELECT false,NULL::bigint,0::numeric; RETURN; END IF;
 BEGIN SELECT * INTO v_user FROM public.users WHERE telegram_id=trim(p_player_id)::bigint FOR UPDATE;
 EXCEPTION WHEN invalid_text_representation THEN v_user:=NULL; END;
 IF v_user.id IS NULL OR COALESCE(v_user.is_banned,false) THEN RETURN QUERY SELECT false,NULL::bigint,0::numeric; RETURN; END IF;
 v_share:=round(p_payout_usd*0.60,6);
 UPDATE public.users SET balance=COALESCE(balance,0)+v_share,total_earned=COALESCE(total_earned,0)+v_share WHERE id=v_user.id;
 INSERT INTO public.offerwall_transactions(click_id,user_id,payout_usd,user_share) VALUES(trim(p_transaction_id),v_user.id,p_payout_usd,v_share);
 RETURN QUERY SELECT true,v_user.id,v_share;
END $$;

REVOKE ALL ON FUNCTION public.process_offer_conversion(text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_offer_conversion(text,text,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.process_mobidea_conversion(text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_mobidea_conversion(text,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.process_mylead_offerwall_conversion(text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_mylead_offerwall_conversion(text,text,numeric,text) TO service_role;
