
-- municipios
DROP POLICY IF EXISTS "Service role can insert municipios" ON public.municipios;
DROP POLICY IF EXISTS "Service role can update municipios" ON public.municipios;
DROP POLICY IF EXISTS "Service role can delete municipios" ON public.municipios;

-- vias
DROP POLICY IF EXISTS "Service role can insert vias" ON public.vias;
DROP POLICY IF EXISTS "Service role can update vias" ON public.vias;
DROP POLICY IF EXISTS "Service role can delete vias" ON public.vias;

-- ranking
DROP POLICY IF EXISTS "Service role can insert ranking" ON public.ranking;
DROP POLICY IF EXISTS "Service role can update ranking" ON public.ranking;
DROP POLICY IF EXISTS "Service role can delete ranking" ON public.ranking;

-- snapshots
DROP POLICY IF EXISTS "Service role can insert snapshots" ON public.vias_snapshots;
