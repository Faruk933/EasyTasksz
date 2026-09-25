begin;

select plan(5);

-- Every public table must keep RLS enabled.
select is(
  (select count(*)::integer from pg_tables where schemaname='public' and not rowsecurity),
  0,
  'All public tables have RLS enabled'
);

-- Browser roles must not receive write privileges on public application tables.
select is(
  (select count(*)::integer
   from information_schema.role_table_grants
   where table_schema='public'
     and grantee in ('anon','authenticated')
     and privilege_type in ('INSERT','UPDATE','DELETE')),
  0,
  'anon/authenticated have no direct write grants'
);

-- Browser roles must not execute public functions by default.
select is(
  (select count(*)::integer
   from information_schema.routine_privileges
   where routine_schema='public'
     and grantee in ('anon','authenticated')
     and privilege_type='EXECUTE'),
  0,
  'anon/authenticated have no public function EXECUTE grants'
);

-- SECURITY DEFINER functions in public must pin search_path.
select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prosecdef
     and not coalesce(p.proconfig::text,'') like '%search_path%'),
  0,
  'All public SECURITY DEFINER functions pin search_path'
);

-- No anonymous users should exist in this Telegram-only application.
select is(
  (select count(*)::integer from auth.users where is_anonymous = true),
  0,
  'No anonymous auth users exist'
);

select * from finish();
rollback;