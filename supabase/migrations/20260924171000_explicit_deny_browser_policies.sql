-- Explicit deny-all RLS policies for browser roles.
-- EasyTasksz uses verified Edge Functions for all public-data access.
-- service_role remains able to access these tables server-side.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'campaign_user_records',
    'campaigns',
    'ggagency_transactions',
    'monetag_ad_rewards',
    'offerwall_transactions',
    'referrals',
    'settings',
    'task_submissions',
    'tasks',
    'transactions',
    'users',
    'withdrawals'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_browser_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY deny_browser_access ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;
