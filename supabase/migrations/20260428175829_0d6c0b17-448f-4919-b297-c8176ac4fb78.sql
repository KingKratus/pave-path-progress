
-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add columns to municipios
ALTER TABLE public.municipios
  ADD COLUMN IF NOT EXISTS uf TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- vias_snapshots
CREATE TABLE IF NOT EXISTS public.vias_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id UUID NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_km_unpaved DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_vias INTEGER NOT NULL DEFAULT 0,
  data_jsonb JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vias_snapshots_municipio ON public.vias_snapshots(municipio_id, snapshot_at DESC);
ALTER TABLE public.vias_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Snapshots are publicly readable"
  ON public.vias_snapshots FOR SELECT USING (true);
CREATE POLICY "Service role can insert snapshots"
  ON public.vias_snapshots FOR INSERT WITH CHECK (true);

-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- admin_settings (singleton)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_municipios UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings readable by everyone"
  ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings"
  ON public.admin_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert settings"
  ON public.admin_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed Duque de Caxias and admin_settings row
INSERT INTO public.municipios (nome, estado, uf, regiao, populacao)
SELECT 'Duque de Caxias', 'Rio de Janeiro', 'RJ', 'Sudeste', 924624
WHERE NOT EXISTS (
  SELECT 1 FROM public.municipios WHERE nome = 'Duque de Caxias' AND estado = 'Rio de Janeiro'
);

INSERT INTO public.admin_settings (sync_interval_minutes, auto_sync_enabled, enabled_municipios)
SELECT 60, true, ARRAY(SELECT id FROM public.municipios WHERE nome = 'Duque de Caxias' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_settings);
