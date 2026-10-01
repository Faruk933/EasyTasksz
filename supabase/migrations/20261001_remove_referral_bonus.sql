-- Remove obsolete referral-bonus configuration and transaction type.
delete from public.settings where key = 'referral_bonus';

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type = any (array[
    'ad_reward'::text,
    'withdrawal'::text,
    'admin_adjustment'::text,
    'bonus'::text
  ]));