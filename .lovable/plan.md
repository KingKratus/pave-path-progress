
# Plano de implementação

## 1. Rankings com variação temporal (agregados)

**Tabela `stats_agregadas`** já existe com `scope` (BR/UF/MUN/BAIRRO). Estender:
- Adicionar coluna `periodo` (date, primeiro dia do mês) e reindex por `(scope, key, periodo)`.
- Edge `refresh-stats` grava snapshot mensal (não sobrescreve) — permite calcular variação (`Δkm_unpaved`, `Δkm_paved`) sem escanear `vias`.

**UI**:
- `src/pages/Ranking.tsx`: abas **Nacional | Por Estado | Por Bairro**, lendo apenas `stats_agregadas` + join leve com `municipios`. Cada linha mostra km atual, variação mês/mês e sparkline (recharts) com últimos 12 pontos do agregado.
- Filtros: UF, top N, ordenação por Δpavimentado ou km_unpaved.
- Ranking de bairro é limitado ao município selecionado (evita scan global).

## 2. Rate limiting em Edge Functions

Aviso: o backend não tem primitivo padrão de rate limiting. Implementação ad-hoc conforme solicitado:

- Nova tabela `edge_rate_limits (key text pk, window_start timestamptz, count int)` com GRANT ao `service_role`, RLS bloqueando cliente.
- Helper `supabase/functions/_shared/rateLimit.ts` (chave = `user_id || ip`, janela deslizante). Aplicado em `overpass-history` e `overpass-layers`:
  - `overpass-history`: 10 req/min, 100/dia por chave.
  - `overpass-layers`: 20 req/min, 200/dia.
- Retorna `429` com `Retry-After` e mensagem clara na UI.

## 3. Busca global por bairro

- Novo endpoint edge `search-bairros` que consulta:
  1. `vias` (distinct `bairro` filtrado por trigram, usa índice existente),
  2. Nominatim (`class=place, type=suburb/neighbourhood`) como fallback on-demand.
- `GlobalSearchBar.tsx`: sugestões em 3 seções — **Municípios | Bairros | Ruas** com ícones. Selecionar bairro navega para `/municipio/:nome?uf=..&bairro=..` (rota já suportada) e dispara carga sob demanda de:
  - polígono via Nominatim (já implementado no `LeafletMap`),
  - `BairroPanel` insights,
  - `BairroHistory` (attic Overpass).

## 4. Admin — desbloqueio e refino

Diagnóstico: bloqueio provavelmente é a política restritiva recém-aplicada em `admin_settings`/`ai_provider_settings` exigindo `has_role(auth.uid(),'admin')`, mas o role pode não ter sido criado corretamente. Ações:

- Migração idempotente que cria `user_roles` para o e-mail informado (ou primeiro usuário) com role `admin` via `on conflict do nothing`.
- Trigger `grant_role_for_verified_domain` opcional (padrão do sistema): garantir que só users com `email_confirmed_at` ganhem admin.
- `src/pages/Admin.tsx`: mostrar diagnóstico do próprio usuário (`useUserRole`) — se não for admin, exibir passos e botão "Verificar minha role". Nunca depender de localStorage.
- Nova aba **"Cache externo"** (ver §5) e **"Rate limits"** (ver §2) com contadores.

## 5. Cache externo Nostr / IPFS (poupar Supabase)

Para histórico Overpass (Duque de Caxias e capitais). Nunca cachear no Supabase; usar rede pública com compressão.

- Nova tabela `external_cache_config (id, provider enum('nostr','ipfs','none'), endpoint text, pubkey text, enabled bool, updated_at)`. RLS: apenas admin lê/escreve. Painel Admin controla.
- Providers com endpoints gratuitos:
  - **Nostr**: relays públicos (`wss://relay.damus.io`, `wss://nos.lol`) — evento kind 30078 (app-specific data) com `d` tag = chave do cache.
  - **IPFS**: gateway público via **web3.storage** (requer token — pedir via `add_secret` se admin ativar) ou **Pinata público**. Leitura por qualquer gateway `https://ipfs.io/ipfs/<cid>`.
- Nova edge `history-cache`:
  1. Recebe `{scope, key, dates}`;
  2. Tenta ler do provider ativo (chave = `sha256(scope|key|date)`);
  3. Miss → chama `overpass-history`, comprime (`gzip` via `CompressionStream` + base64) e publica no provider;
  4. Retorna série ao cliente.
- Payload comprimido: JSON reduzido (apenas `date,total_km_unpaved,vias`), `gzip`, ~80% menor.
- Capitais + Duque de Caxias marcadas em constante `CACHED_CITIES` — apenas essas passam pelo cache; demais vão direto ao Overpass.

## 6. Duque de Caxias — delimitação e bairros

- `sync-municipio` já busca boundary via Nominatim; garantir persistência em `municipios.boundary_geojson` para DC (rodar sync).
- Lista de bairros oficiais de DC: usar Overpass (`admin_level=10` dentro da área do município) — nova query em `overpass-layers` (layer `bairros`) retornando polígonos, exibidos como choropleth colorido por % pavimentado.
- `LeafletMap`: quando `?bairro=` presente, destaca polígono do bairro (fluxo já existente) + rótulos dos vizinhos ao redor.
- `BairroPanel`: incluir contagem de vias, km pav/não pav, botão "Ver histórico" (attic 7 anos).

## 7. Refinos de mapa

- Legend atualizada com faixa "% pavimentado por bairro".
- Zoom-to-bairro suave (já implementado, ajustar `maxZoom` para 15 em capitais grandes).
- Toggle "Mostrar limites de bairro" no controle superior direito.

---

## Detalhes técnicos

**Novos/alterados arquivos**
- `supabase/migrations/<ts>_rankings_ratelimit_cache.sql` — coluna `periodo`, tabelas `edge_rate_limits`, `external_cache_config`, seed admin, GRANTs.
- `supabase/functions/_shared/rateLimit.ts` (novo).
- `supabase/functions/search-bairros/index.ts` (novo).
- `supabase/functions/history-cache/index.ts` (novo, usa Nostr/IPFS).
- `supabase/functions/overpass-history/index.ts` — chamado internamente pelo `history-cache`.
- `supabase/functions/overpass-layers/index.ts` — adicionar layer `bairros` (admin_level=10).
- `supabase/functions/refresh-stats/index.ts` — inserir snapshot mensal.
- `supabase/config.toml` — registrar `search-bairros`, `history-cache` (`verify_jwt = false`).
- `src/pages/Ranking.tsx` — abas + variação temporal + sparklines.
- `src/pages/Admin.tsx` — diagnóstico de role, painel cache externo, painel rate limits.
- `src/components/GlobalSearchBar.tsx` — busca unificada municípios/bairros/ruas.
- `src/components/BairroPanel.tsx`, `BairroHistory.tsx` — consumir `history-cache`.
- `src/components/LeafletMap.tsx` — camada de polígonos de bairros com choropleth.

**Segredos possivelmente necessários** (perguntarei antes de solicitar): `WEB3_STORAGE_TOKEN` (se IPFS via web3.storage for escolhido) ou `NOSTR_PRIVKEY` (para publicar no Nostr; leitura é anônima).

**Fora de escopo**
- Migrar tudo para IBGE geometrias oficiais.
- Rate limiting distribuído (usaremos contador em tabela — bom o bastante para o uso atual).
- Excel export.

## Perguntas antes de implementar

1. Cache externo: prefere **Nostr** (sem token, mais simples) ou **IPFS via web3.storage** (requer criar token grátis)?
2. Qual e-mail deve receber `admin` na migração inicial (para desbloquear você agora)?
3. Além de Duque de Caxias e capitais, quer incluir alguma outra cidade na lista de cache?
