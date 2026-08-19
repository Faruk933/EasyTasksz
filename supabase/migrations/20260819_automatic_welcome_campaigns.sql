ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'one_time';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_campaign_type_check CHECK (campaign_type IN ('one_time','welcome'));
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type = ANY (ARRAY['ad_reward'::text, 'referral_bonus'::text, 'withdrawal'::text, 'admin_adjustment'::text, 'bonus'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS campaign_user_records_campaign_user_unique ON public.campaign_user_records (campaign_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_one_active_welcome_unique ON public.campaigns (campaign_type) WHERE campaign_type = 'welcome' AND is_active = true;
CREATE OR REPLACE FUNCTION public.claim_welcome_campaign(p_campaign_id bigint, p_user_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.campaigns%ROWTYPE; inserted_id bigint; amount numeric;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id = p_campaign_id AND campaign_type = 'welcome' AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  amount := COALESCE(c.bonus_amount, 0);
  INSERT INTO public.campaign_user_records (campaign_id, user_id, bonus_given, notification_sent)
  VALUES (c.id, p_user_id, amount > 0, false)
  ON CONFLICT (campaign_id, user_id) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN RETURN false; END IF;
  IF amount > 0 THEN
    UPDATE public.users SET balance = COALESCE(balance, 0) + amount, total_earned = COALESCE(total_earned, 0) + amount WHERE id = p_user_id;
    INSERT INTO public.transactions (user_id, type, amount, description) VALUES (p_user_id, 'bonus', amount, 'Welcome Bonus Campaign: ' || c.title);
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_welcome_campaign(bigint, bigint) FROM PUBLIC;
