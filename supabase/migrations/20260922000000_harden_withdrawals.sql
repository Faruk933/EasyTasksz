-- Withdrawal security hardening: reserve the user's balance and create withdrawals atomically.
CREATE OR REPLACE FUNCTION public.create_withdrawal_atomic(
  p_telegram_id bigint, p_wallet_address text, p_amount numeric, p_fee_amount numeric, p_payout_amount numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_user public.users%ROWTYPE; v_withdrawal public.withdrawals%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid withdrawal amount'; END IF;
  IF p_payout_amount IS NULL OR p_payout_amount <= 0 THEN RAISE EXCEPTION 'Invalid payout amount'; END IF;
  IF p_wallet_address IS NULL OR length(trim(p_wallet_address)) < 32 THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;
  SELECT * INTO v_user FROM public.users WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF COALESCE(v_user.is_banned, false) THEN RAISE EXCEPTION 'Account is banned'; END IF;
  IF COALESCE(v_user.balance, 0) < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.users SET balance = COALESCE(balance, 0) - p_amount WHERE id = v_user.id;
  INSERT INTO public.withdrawals (user_id, wallet_address, amount, fee_amount, payout_amount, status)
  VALUES (v_user.id, trim(p_wallet_address), p_amount, COALESCE(p_fee_amount, 0), p_payout_amount, 'pending')
  RETURNING * INTO v_withdrawal;
  RETURN jsonb_build_object('withdrawal', to_jsonb(v_withdrawal), 'new_balance', COALESCE(v_user.balance, 0) - p_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal_atomic(bigint, text, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_atomic(bigint, text, numeric, numeric, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.transition_withdrawal(p_withdrawal_id bigint, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_withdrawal public.withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;

  IF p_action = 'approve' THEN
    IF v_withdrawal.status <> 'pending' OR v_withdrawal.payout_status = 'processing' THEN
      RAISE EXCEPTION 'Withdrawal is already being processed or completed';
    END IF;
    UPDATE public.withdrawals SET payout_status = 'processing'
     WHERE id = p_withdrawal_id AND status = 'pending' AND COALESCE(payout_status, '') <> 'processing';

  ELSIF p_action = 'reject' THEN
    IF v_withdrawal.status <> 'pending' THEN
      RAISE EXCEPTION 'Withdrawal is already being processed or completed';
    END IF;
    UPDATE public.withdrawals SET status = 'rejected', processed_at = now()
     WHERE id = p_withdrawal_id AND status = 'pending';
    UPDATE public.users SET balance = COALESCE(balance, 0) + v_withdrawal.amount
     WHERE id = v_withdrawal.user_id;

  ELSE
    RAISE EXCEPTION 'Invalid withdrawal action';
  END IF;

  SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id;
  RETURN to_jsonb(v_withdrawal);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_withdrawal(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_withdrawal(bigint, text) TO service_role;
