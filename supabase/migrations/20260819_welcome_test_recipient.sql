-- Welcome campaign test recipients reuse campaigns.target_user_id.
-- No schema change is required; this migration documents the intended semantics.
comment on column public.campaigns.target_user_id is 'Specific one-time target user, or optional test recipient for automatic welcome campaigns';
