-- Withdrawal security hardening: reserve the user's balance and create the withdrawal atomically.
-- Only trusted server-side Edge Functions may execute this function.
CREATE OR REPLACE FUNCTION public.create_withdrawal_atomic(
  p_telegram_id bigint,
  p_wallet_address text,
  p_amount numeric,
  p_fee_amount numeric,
  p_payout_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_withdrawal public.withdrawals%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid withdrawal amount';
  END IF;

  IF p_payout_amount IS NULL OR p_payout_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid payout amount';
  END IF;

  IF p_wallet_address IS NULL OR length(trim(p_wallet_address)) < 32 THEN
    RAISE EXCEPTION 'Invalid wallet address';
  END IF;

  SELECT *
    INTO v_user
    FROM public.users
   WHERE telegram_id = p_telegram_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RAISE EXCEPTION 'Account is banned';
  END IF;

  IF COALESCE(v_user.balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.users
     SET balance = COALESCE(balance, 0) - p_amount
   WHERE id = v_user.id;

  INSERT INTO public.withdrawals (
    user_id,
    wallet_address,
    amount,
    fee_amount,
    payout_amount,
    status
  )
  VALUES (
    v_user.id,
    trim(p_wallet_address),
    p_amount,
    COALESCE(p_fee_amount, 0),
    p_payout_amount,
    'pending'
  )
  RETURNING * INTO v_withdrawal;

  RETURN jsonb_build_object(
    'withdrawal', to_jsonb(v_withdrawal),
    'new_balance', COALESCE(v_user.balance, 0) - p_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal_atomic(bigint, text, numeric, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_withdrawal_atomic(bigint, text, numeric, numeric, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.create_withdrawal_atomic(bigint, text, numeric, numeric, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_atomic(bigint, text, numeric, numeric, numeric) TO service_role;
