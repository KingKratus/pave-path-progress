-- Add columns to sync_logs for retry chains and error stages
ALTER TABLE public.sync_logs
  ADD COLUMN IF NOT EXISTS parent_log_id uuid REFERENCES public.sync_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_stage text,
  ADD COLUMN IF NOT EXISTS attempt int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_sync_logs_parent ON public.sync_logs(parent_log_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_triggered_by ON public.sync_logs(triggered_by);

-- Realtime for sync_logs progress
ALTER TABLE public.sync_logs REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sync_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs';
  END IF;
END $$;

-- AI priorities cache
CREATE TABLE IF NOT EXISTS public.ai_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL,
  model text NOT NULL,
  provider text NOT NULL DEFAULT 'lovable',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_priorities_municipio ON public.ai_priorities(municipio_id, created_at DESC);

ALTER TABLE public.ai_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI priorities readable by everyone"
  ON public.ai_priorities FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert ai_priorities"
  ON public.ai_priorities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ai_priorities"
  ON public.ai_priorities FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Promote gazetalibertaria51@gmail.com to admin if account exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'gazetalibertaria51@gmail.com'
ON CONFLICT DO NOTHING;