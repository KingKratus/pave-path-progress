
-- Allow service role to insert/update/delete municipios
CREATE POLICY "Service role can insert municipios"
ON public.municipios FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update municipios"
ON public.municipios FOR UPDATE
USING (true);

CREATE POLICY "Service role can delete municipios"
ON public.municipios FOR DELETE
USING (true);

-- Allow service role to insert/update/delete vias
CREATE POLICY "Service role can insert vias"
ON public.vias FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update vias"
ON public.vias FOR UPDATE
USING (true);

CREATE POLICY "Service role can delete vias"
ON public.vias FOR DELETE
USING (true);

-- Allow service role to insert/update/delete ranking
CREATE POLICY "Service role can insert ranking"
ON public.ranking FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update ranking"
ON public.ranking FOR UPDATE
USING (true);

CREATE POLICY "Service role can delete ranking"
ON public.ranking FOR DELETE
USING (true);
