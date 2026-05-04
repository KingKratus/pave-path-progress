-- AI Provider Settings (singleton)
CREATE TABLE IF NOT EXISTS public.ai_provider_settings (
  id text PRIMARY KEY DEFAULT 'default',
  provider text NOT NULL DEFAULT 'lovable',
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_provider_singleton CHECK (id = 'default'),
  CONSTRAINT ai_provider_valid CHECK (provider IN ('lovable','gemini','openai','openrouter'))
);

ALTER TABLE public.ai_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI provider settings readable by everyone"
  ON public.ai_provider_settings FOR SELECT USING (true);

CREATE POLICY "Admins can insert ai provider settings"
  ON public.ai_provider_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update ai provider settings"
  ON public.ai_provider_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.ai_provider_settings (id, provider, model)
VALUES ('default', 'lovable', 'google/gemini-2.5-flash')
ON CONFLICT (id) DO NOTHING;

-- Vias quality columns
ALTER TABLE public.vias ADD COLUMN IF NOT EXISTS centroid_lat double precision;
ALTER TABLE public.vias ADD COLUMN IF NOT EXISTS centroid_lng double precision;
ALTER TABLE public.vias ADD COLUMN IF NOT EXISTS nome_status text NOT NULL DEFAULT 'ok';
ALTER TABLE public.vias ADD COLUMN IF NOT EXISTS bairro text;

-- Indexes / trigram for search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS vias_municipio_surface_idx ON public.vias(municipio_id, surface);
CREATE INDEX IF NOT EXISTS vias_nome_trgm_idx ON public.vias USING gin (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS vias_bairro_trgm_idx ON public.vias USING gin (bairro gin_trgm_ops);
CREATE INDEX IF NOT EXISTS municipios_nome_trgm_idx ON public.municipios USING gin (nome gin_trgm_ops);