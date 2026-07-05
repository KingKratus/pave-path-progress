
-- 1) stats_agregadas: adicionar período mensal
ALTER TABLE public.stats_agregadas
  ADD COLUMN IF NOT EXISTS periodo date NOT NULL DEFAULT date_trunc('month', now())::date;

DROP INDEX IF EXISTS stats_agregadas_scope_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS stats_agregadas_scope_key_periodo_uidx
  ON public.stats_agregadas (scope, key, periodo);
CREATE INDEX IF NOT EXISTS stats_agregadas_scope_periodo_idx
  ON public.stats_agregadas (scope, periodo DESC);

-- 2) Rate limits (uso interno pelas edge functions)
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.edge_rate_limits TO service_role;
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access rate_limits" ON public.edge_rate_limits
  FOR ALL USING (false) WITH CHECK (false);

-- 3) Configuração de cache externo (Nostr/IPFS)
DO $$ BEGIN
  CREATE TYPE public.cache_provider AS ENUM ('none','nostr','ipfs','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.external_cache_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.cache_provider NOT NULL DEFAULT 'none',
  nostr_relays text[] NOT NULL DEFAULT ARRAY['wss://relay.damus.io','wss://nos.lol','wss://relay.snort.social'],
  nostr_pubkey text,
  ipfs_gateway text NOT NULL DEFAULT 'https://ipfs.io',
  enabled boolean NOT NULL DEFAULT false,
  extra_cities text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_cache_config TO authenticated;
GRANT ALL ON public.external_cache_config TO service_role;
ALTER TABLE public.external_cache_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read cache config" ON public.external_cache_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin write cache config" ON public.external_cache_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.external_cache_config (provider, enabled)
SELECT 'both', false
WHERE NOT EXISTS (SELECT 1 FROM public.external_cache_config);

-- 4) Seed admin para e-mail informado (se já existir usuário confirmado)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = lower('Gazetalibertaria51@gmail.com')
  AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger para conceder admin automaticamente quando esse e-mail confirmar
CREATE OR REPLACE FUNCTION public.grant_admin_for_seed_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = lower('Gazetalibertaria51@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_seed_admin_insert ON auth.users;
CREATE TRIGGER on_auth_user_seed_admin_insert
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_seed_email();

DROP TRIGGER IF EXISTS on_auth_user_seed_admin_update ON auth.users;
CREATE TRIGGER on_auth_user_seed_admin_update
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_seed_email();
