
-- Promote gazetalibertaria51@gmail.com to admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('2c627bed-fa58-4f2a-b937-23f3558afba0', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Tighten RLS: require authentication for `vias` and `ai_priorities`
DROP POLICY IF EXISTS "Vias are publicly readable" ON public.vias;
CREATE POLICY "Vias readable by authenticated users"
  ON public.vias FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "AI priorities readable by everyone" ON public.ai_priorities;
CREATE POLICY "AI priorities readable by authenticated users"
  ON public.ai_priorities FOR SELECT
  TO authenticated
  USING (true);

-- Revoke explicit grants from anon role
REVOKE SELECT ON public.vias FROM anon;
REVOKE SELECT ON public.ai_priorities FROM anon;
