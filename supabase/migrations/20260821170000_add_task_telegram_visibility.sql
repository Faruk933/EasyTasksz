ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS target_telegram_id bigint;
CREATE INDEX IF NOT EXISTS tasks_target_telegram_id_idx ON public.tasks(target_telegram_id);
