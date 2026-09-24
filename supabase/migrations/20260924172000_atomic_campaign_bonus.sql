-- Make one-time campaign bonus accounting fully atomic.
-- The record claim, user balance/total_earned update, and transaction ledger insert
-- now succeed or fail together.
CREATE OR REPLACE FUNCTION public.apply_campaign_bonus_atomic(
  p_campaign_id bigint,
  p_user_id bigint,
  p_amount numeric,
  p_description text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed boolean := false;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.campaign_user_records
  SET bonus_given = true
  WHERE campaign_id = p_campaign_id
    AND user_id = p_user_id
    AND bonus_given = false;

  claimed := FOUND;
  IF NOT claimed THEN
    RETURN false;
  END IF;

  UPDATE public.users
  SET balance = COALESCE(balance, 0) + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign bonus target user not found';
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', p_amount, p_description);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_campaign_bonus_atomic(bigint, bigint, numeric, text) FROM PUBLIC;
