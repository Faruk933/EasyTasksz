-- Emergency hardening: the browser must never be able to read or modify the users table.
-- All EasyTasksz user reads/writes are performed by server-side Edge Functions using service_role.
-- The owner Telegram ID is the only identity allowed to use privileged admin operations.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users FROM PUBLIC;
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.users FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;

-- Normalize the admin flag before locking it so no existing or future account can self-promote.
-- The owner account is the only admin account.
DROP TRIGGER IF EXISTS trg_lock_users_admin_flag ON public.users;
UPDATE public.users SET is_admin = (telegram_id = 1115177381);

CREATE OR REPLACE FUNCTION public.lock_users_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'is_admin is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_users_admin_flag ON public.users;
CREATE TRIGGER trg_lock_users_admin_flag
BEFORE INSERT OR UPDATE OF is_admin ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.lock_users_admin_flag();

-- No client policy is created intentionally: users must go through the verified Telegram Edge Functions.


-- Lock down all SECURITY DEFINER reward/conversion RPCs.
-- These functions can change user balances and must never be callable by browser roles.
REVOKE ALL ON FUNCTION public.process_offer_conversion(text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_offer_conversion(text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.process_offer_conversion(text, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_offer_conversion(text, text, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.process_mobidea_conversion(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_mobidea_conversion(text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.process_mobidea_conversion(text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_mobidea_conversion(text, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.process_mylead_offerwall_conversion(text, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_mylead_offerwall_conversion(text, text, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.process_mylead_offerwall_conversion(text, text, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_mylead_offerwall_conversion(text, text, numeric, text) TO service_role;
