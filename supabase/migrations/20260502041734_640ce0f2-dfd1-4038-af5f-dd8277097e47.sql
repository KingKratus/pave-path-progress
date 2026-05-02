
-- Sync logs table
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid REFERENCES public.municipios(id) ON DELETE CASCADE,
  municipio_nome text NOT NULL,
  uf text,
  status text NOT NULL CHECK (status IN ('ok','error','running')),
  message text,
  total_vias integer DEFAULT 0,
  total_km numeric DEFAULT 0,
  duration_ms integer,
  triggered_by text DEFAULT 'manual',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX idx_sync_logs_municipio ON public.sync_logs(municipio_id, started_at DESC);
CREATE INDEX idx_sync_logs_started ON public.sync_logs(started_at DESC);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync_logs" ON public.sync_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Revoke GraphQL/anon visibility on admin tables
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.admin_settings FROM anon;
REVOKE SELECT ON public.sync_logs FROM anon, authenticated;

-- Revoke direct EXECUTE of has_role (it still works in RLS as the function owner)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
