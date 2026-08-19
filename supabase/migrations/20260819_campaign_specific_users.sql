alter table public.campaigns add column if not exists target_user_id bigint references public.users(id);
create index if not exists campaigns_target_user_id_idx on public.campaigns(target_user_id);
