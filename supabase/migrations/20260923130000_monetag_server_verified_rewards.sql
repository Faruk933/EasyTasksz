-- Secure Monetag rewarded-ad accounting with server-side postback confirmation.
CREATE TABLE IF NOT EXISTS public.monetag_ad_rewards (
  ymid text PRIMARY KEY,
  telegram_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','valued','rewarded')),
  estimated_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  valued_at timestamptz,
  rewarded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);
ALTER TABLE public.monetag_ad_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.monetag_ad_rewards FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.monetag_ad_rewards TO service_role;

CREATE OR REPLACE FUNCTION public.reward_monetag_ad_atomic(p_ymid text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_ad public.monetag_ad_rewards%ROWTYPE; v_user public.users%ROWTYPE; v_today date:=CURRENT_DATE; v_ads integer; v_limit integer; v_reward numeric; v_balance numeric; v_total numeric; v_pct numeric;
BEGIN
 IF p_ymid IS NULL OR length(trim(p_ymid))<16 OR length(trim(p_ymid))>128 THEN RAISE EXCEPTION 'Invalid ad event'; END IF;
 SELECT * INTO v_ad FROM public.monetag_ad_rewards WHERE ymid=trim(p_ymid) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ad event not found'; END IF;
 IF v_ad.status='rewarded' THEN
   SELECT * INTO v_user FROM public.users WHERE telegram_id=v_ad.telegram_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
   RETURN jsonb_build_object('processed',false,'user',jsonb_build_object('id',v_user.id,'telegram_id',v_user.telegram_id,'username',v_user.username,'first_name',v_user.first_name,'last_name',v_user.last_name,'photo_url',v_user.photo_url,'balance',v_user.balance,'total_earned',v_user.total_earned,'ads_watched',v_user.ads_watched,'ads_watched_today',v_user.ads_watched_today,'last_ad_date',v_user.last_ad_date,'referral_code',v_user.referral_code,'referral_count',v_user.referral_count,'referral_earnings',v_user.referral_earnings,'referred_by',v_user.referred_by));
 END IF;
 IF v_ad.status<>'valued' OR v_ad.expires_at<now() THEN RAISE EXCEPTION 'Ad reward not confirmed'; END IF;
 SELECT * INTO v_user FROM public.users WHERE telegram_id=v_ad.telegram_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
 IF COALESCE(v_user.is_banned,false) THEN RAISE EXCEPTION 'Account is banned'; END IF;
 SELECT COALESCE(value::integer,1) INTO v_limit FROM public.settings WHERE key='daily_ad_limit' LIMIT 1; v_limit:=COALESCE(v_limit,1);
 SELECT COALESCE(value::numeric,0.01) INTO v_reward FROM public.settings WHERE key='reward_per_ad' LIMIT 1; v_reward:=COALESCE(v_reward,0.01);
 v_ads:=CASE WHEN v_user.last_ad_date=v_today THEN COALESCE(v_user.ads_watched_today,0) ELSE 0 END;
 IF v_ads>=v_limit THEN RAISE EXCEPTION 'Daily ad limit reached'; END IF;
 v_balance:=COALESCE(v_user.balance,0)+v_reward; v_total:=COALESCE(v_user.total_earned,0)+v_reward;
 UPDATE public.users SET balance=v_balance,total_earned=v_total,ads_watched=COALESCE(v_user.ads_watched,0)+1,ads_watched_today=v_ads+1,last_ad_date=v_today WHERE id=v_user.id;
 UPDATE public.monetag_ad_rewards SET status='rewarded',rewarded_at=now() WHERE ymid=trim(p_ymid);
 IF v_user.referred_by IS NOT NULL THEN
   SELECT COALESCE(value::numeric,3) INTO v_pct FROM public.settings WHERE key='referral_commission_percent' LIMIT 1;
   PERFORM public.add_referral_commission(v_user.referred_by,v_reward*(COALESCE(v_pct,3)/100));
 END IF;
 RETURN jsonb_build_object('processed',true,'user',jsonb_build_object('id',v_user.id,'telegram_id',v_user.telegram_id,'username',v_user.username,'first_name',v_user.first_name,'last_name',v_user.last_name,'photo_url',v_user.photo_url,'balance',v_balance,'total_earned',v_total,'ads_watched',COALESCE(v_user.ads_watched,0)+1,'ads_watched_today',v_ads+1,'last_ad_date',v_today,'referral_code',v_user.referral_code,'referral_count',v_user.referral_count,'referral_earnings',v_user.referral_earnings,'referred_by',v_user.referred_by));
END $$;
REVOKE ALL ON FUNCTION public.reward_monetag_ad_atomic(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reward_monetag_ad_atomic(text) TO service_role;