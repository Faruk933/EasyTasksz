-- Emergency hardening: the browser must never be able to read or modify the users table.
-- All EasyTasksz user reads/writes are performed by server-side Edge Functions using service_role.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users FROM PUBLIC;
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.users FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;

-- No client policy is created intentionally: users must go through the verified Telegram Edge Functions.
