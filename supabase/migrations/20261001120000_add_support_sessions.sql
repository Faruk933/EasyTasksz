create table if not exists public.support_sessions (
  telegram_id bigint primary key,
  active_until timestamptz not null,
  history jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint support_sessions_history_array check (jsonb_typeof(history) = 'array'),
  constraint support_sessions_message_count_nonnegative check (message_count >= 0)
);

alter table public.support_sessions enable row level security;

revoke all on public.support_sessions from anon, authenticated, public;
grant all on public.support_sessions to service_role;
