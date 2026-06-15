
-- 1. GRANT em vias (corrige permission denied)
GRANT SELECT ON public.vias TO authenticated;
GRANT ALL ON public.vias TO service_role;
GRANT SELECT ON public.vias_snapshots TO anon, authenticated;
GRANT ALL ON public.vias_snapshots TO service_role;
GRANT SELECT ON public.municipios TO anon, authenticated;
GRANT ALL ON public.municipios TO service_role;
GRANT SELECT ON public.ranking TO anon, authenticated;
GRANT ALL ON public.ranking TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_priorities TO authenticated;
GRANT ALL ON public.ai_priorities TO service_role;

-- 2. ai_provider_settings: somente admin pode ler
DROP POLICY IF EXISTS "AI provider settings readable by everyone" ON public.ai_provider_settings;
CREATE POLICY "Admins can read ai_provider_settings"
  ON public.ai_provider_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.ai_provider_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_settings TO authenticated;
GRANT ALL ON public.ai_provider_settings TO service_role;

-- 3. admin_settings: somente admin
DROP POLICY IF EXISTS "Settings readable by everyone" ON public.admin_settings;
CREATE POLICY "Admins can read admin_settings"
  ON public.admin_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.admin_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;

-- 4. Stats agregadas (UF + BR)
CREATE TABLE IF NOT EXISTS public.stats_agregadas (
  scope text NOT NULL,            -- 'uf' | 'br'
  key text NOT NULL,              -- UF sigla ou 'BR'
  total_km_unpaved numeric NOT NULL DEFAULT 0,
  total_km_paved numeric NOT NULL DEFAULT 0,
  total_vias int NOT NULL DEFAULT 0,
  municipios_sincronizados int NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);
GRANT SELECT ON public.stats_agregadas TO anon, authenticated;
GRANT ALL ON public.stats_agregadas TO service_role;
ALTER TABLE public.stats_agregadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stats publicly readable"
  ON public.stats_agregadas FOR SELECT
  USING (true);

-- 5. Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_vias_municipio_surface ON public.vias (municipio_id, surface);
CREATE INDEX IF NOT EXISTS idx_vias_bairro ON public.vias (bairro) WHERE bairro IS NOT NULL;
