
-- Municipios table
CREATE TABLE public.municipios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  estado TEXT NOT NULL,
  regiao TEXT,
  populacao INTEGER,
  geom_geojson TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Municipios are publicly readable"
ON public.municipios FOR SELECT
USING (true);

-- Vias table
CREATE TABLE public.vias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  osm_id BIGINT NOT NULL,
  municipio_id UUID NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  nome TEXT,
  surface TEXT NOT NULL,
  length_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  geom_geojson TEXT,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vias are publicly readable"
ON public.vias FOR SELECT
USING (true);

CREATE INDEX idx_vias_municipio ON public.vias(municipio_id);
CREATE INDEX idx_vias_surface ON public.vias(surface);

-- Ranking table
CREATE TABLE public.ranking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipio_id UUID NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  km_unpaved DOUBLE PRECISION NOT NULL DEFAULT 0,
  km_paved_added DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ranking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ranking is publicly readable"
ON public.ranking FOR SELECT
USING (true);

CREATE INDEX idx_ranking_municipio ON public.ranking(municipio_id);
CREATE INDEX idx_ranking_score ON public.ranking(score DESC);
