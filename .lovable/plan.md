# Expansão completa — Ranking de Pavimentação

Plano consolidado cobrindo todas as solicitações: promoção de admin, melhorias na comparação, retry e observabilidade no admin, progresso em tempo real, filtros, IA personalizada para priorização, mapa restrito à cidade, correção de bugs de navegação e refatoração visual do front-end.

---

## 1. Promover gazetalibertaria51@gmail.com como admin

- Insert direto em `user_roles` selecionando `id` de `auth.users` pelo e-mail (apenas se a conta já existir).
- Caso o e-mail ainda não tenha conta cadastrada: instruir o usuário a criar em `/auth` e então rodar a promoção (ou criar uma edge function `bootstrap-admin` protegida por código secreto, executada uma vez).

## 2. Aba "Comparação" do município — versão avançada

Expandir `PeriodComparison.tsx` e `compare-periods` edge function:

- **Lista de ruas alteradas** entre dois snapshots:
  - Pavimentadas (existiam como unpaved no "from", sumiram no "to")
  - Novas vias não pavimentadas (apareceram no "to")
  - Mudança de superfície (ex.: dirt → gravel)
- **Filtros**: por tipo de superfície (dirt, gravel, earth, ground, compacted, sand, mud), por presença de nome, por comprimento mínimo (m).
- **Busca por nome** da rua.
- **Mini-mapa** opcional destacando as ruas alteradas (ícone de "ver no mapa").
- Edge function passa a retornar `roads_changed: { paved: [...], new_unpaved: [...], surface_changed: [...] }` além dos agregados atuais.

## 3. Admin — Retry de sincronização que falhou

- Botão **"Tentar novamente"** em cada linha do histórico com `status='error'`.
- Chama `admin-trigger-sync` com `municipio`, `uf` e `triggered_by='retry:<log_id>'`.
- Nova coluna `parent_log_id` em `sync_logs` para encadear tentativas (migração).
- UI mostra badge "Tentativa #N" agrupando logs pelo `parent_log_id`.

## 4. Sync por UF — progresso em tempo real

- Substituir polling fixo por **Supabase Realtime** em `sync_logs` filtrando por `triggered_by like 'uf-batch:<id>%'`.
- Habilitar realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;` e `REPLICA IDENTITY FULL`.
- Calcular e exibir:
  - **Taxa**: municípios/min (média móvel dos últimos 5).
  - **ETA**: `(restantes / taxa)` formatado em min/seg.
  - **Sucesso vs erro** (contadores ao vivo).
- Fallback de polling a cada 5s caso o canal realtime caia.

## 5. Histórico de sync — detalhamento por etapa

- Nova coluna `error_stage` em `sync_logs`: `overpass | ingest | calc | unknown`.
- Edge function `sync-municipio` marca o estágio onde falhou (try/catch por bloco).
- UI no admin:
  - Agrupamento por município mostrando todas as tentativas (`parent_log_id`).
  - Contadores de erro por etapa (Overpass / Ingestão / Cálculo).
  - Botão "Ver erro completo" abrindo Dialog com `message` integral + `duration_ms` + `triggered_by`.

## 6. Filtros de busca (município, ranking, vias)

- **Home `/`**: autocomplete IBGE já existe — adicionar filtros por UF e por "somente municípios já sincronizados".
- **Ranking `/ranking`**: filtros por UF, faixa de população, intervalo de score, ordenar por score / km pavimentados / km não pavimentados.
- **Detalhe do município → aba Lista**: filtros por superfície, comprimento mínimo, "com nome" / "sem nome", busca textual.

## 7. Mapa restrito à cidade + estilos alternativos

- `sync-municipio` passa a buscar e armazenar a **geometria do limite municipal** (`relation["boundary"="administrative"]["admin_level"~"7|8"]["name"="X"]`) em `municipios.geom_geojson`.
- `LeafletMap` recebe `boundaryGeoJson` e:
  - Aplica `map.fitBounds(boundary)` e desenha o polígono em destaque.
  - Adiciona uma máscara escura (polígono inverso) para esmaecer o que está fora da cidade.
  - Faz `setMaxBounds` para impedir scroll/zoom para fora.
- **Seletor de estilo de mapa** (controle no canto): OSM padrão (atual) | Carto Light | Carto Dark | Esri Satellite | OpenTopoMap. Persistido em `localStorage`.

## 8. Resolver "ruas sem nome" e evitar geometrias erradas

Estratégias combinadas:

- **Nome via tags alternativas**: se `tags.name` ausente, tentar `tags["name:pt"]`, `tags.ref`, `tags.alt_name`, `tags.loc_name`. Caso contrário marcar `nome=null` mas exibir como "Via sem nome (ID OSM)".
- **Filtragem geográfica**: descartar ways cujo centróide esteja fora do `boundary` da cidade (point-in-polygon usando `@turf/boolean-point-in-polygon`).
- **Reverse geocoding opcional**: edge function `enrich-vias` chama Nominatim apenas para vias sem nome, em batch limitado (rate-limit 1 req/s), e preenche um nome aproximado tipo "Próximo a Rua X". Acionado manualmente pelo admin para evitar abuso.
- **Filtro highway**: excluir `highway in (footway, path, cycleway, track service para fazendas)` que costumam aparecer fora de áreas urbanas — manter apenas `residential, unclassified, tertiary, secondary, primary, living_street`.

## 9. Integração com IA personalizada (Gemini / OpenRouter / OpenAI) — Áreas prioritárias

- **Lovable AI por padrão** (sem chave do usuário). Modelos disponíveis no gateway: `google/gemini-3-flash-preview` (default), `openai/gpt-5`, etc.
- **BYOK opcional** ("Use minha chave"): tela em `/admin → IA` para colar chave própria de Gemini, OpenRouter ou OpenAI; armazenada apenas como Supabase secret nominal (`USER_GEMINI_KEY`, `USER_OPENROUTER_KEY`, `USER_OPENAI_KEY`) via `add_secret`.
- Edge function `ai-prioritize`:
  - Recebe `municipio_id`.
  - Monta payload com agregados (km por superfície, top 50 vias por comprimento, densidade por bairro/quadrante).
  - Pede ao modelo um JSON estruturado (tool calling) com `priorities: [{ area, score, justificativa, vias_ids }]`.
  - Salva resultado em nova tabela `ai_priorities` (cacheado por município + modelo + data).
- UI no município: nova aba **"Prioridades (IA)"** com cards rankeados, justificativa em PT-BR, e destaque dessas vias no mapa.

## 10. Bug fix — abas não aparecem (Mapa/Lista/Comparação e abas do Admin)

Investigar e corrigir:

- Verificar overflow horizontal em mobile (375px) — `TabsList` provavelmente está estourando. Aplicar `overflow-x-auto` + `flex-nowrap` + ScrollArea, ou trocar para `Select` em telas `<sm`.
- Garantir que `MunicipioDetail` renderize `<Tabs>` mesmo quando `roads.length === 0` (atualmente pode estar condicionado).
- Admin: confirmar que `useUserRole` resolveu antes de renderizar tabs (loading state explícito).
- Confirmar registro das rotas `/admin` e `/auth` no `App.tsx`.

## 11. Refatoração de front-end + correção de bugs gerais

- Padronizar layout com container responsivo, espaçamentos consistentes (Tailwind tokens já no `index.css`).
- Componentes reutilizáveis: `PageHeader`, `StatCard`, `EmptyState`, `LoadingState`, `ErrorState`.
- Home: hero mais limpo, busca destacada, cards de "Cidades em destaque" puxando do ranking.
- Ranking: tabela com sticky header, badges de variação (▲▼).
- Município: header com nome/UF/última sync, KPIs, tabs em ScrollArea.
- Admin: sidebar lateral em desktop, tabs em mobile.
- Toasts consistentes em todas as ações (sucesso/erro).
- Tema civic (verde/amarelo) preservado, melhor contraste, modo claro como padrão.

---

## Detalhes técnicos (resumo)

**Migrações SQL**
- `ALTER TABLE sync_logs ADD COLUMN parent_log_id uuid, ADD COLUMN error_stage text;`
- `CREATE TABLE ai_priorities (id, municipio_id, model, created_at, payload jsonb);` + RLS leitura pública.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;` + `ALTER TABLE sync_logs REPLICA IDENTITY FULL;`
- Insert do admin via `auth.users` lookup.

**Edge functions novas/atualizadas**
- `sync-municipio` — try/catch por estágio, captura boundary, filtra ways fora.
- `compare-periods` — retorna ruas alteradas com classificação.
- `ai-prioritize` — Lovable AI Gateway por padrão, BYOK opcional.
- `enrich-vias` — Nominatim opcional para nomear ruas.

**Frontend**
- `PeriodComparison` reescrito com filtros e lista de ruas.
- `LeafletMap` com boundary + mask + seletor de estilo.
- `Admin` com retry, realtime, agrupamento por tentativa.
- Refatoração visual geral.

**Stack adicional**
- `@turf/boolean-point-in-polygon` para filtragem geográfica.
- Supabase Realtime no front (`supabase.channel`).

---

## Ordem de implementação

1. Migrações + promoção de admin
2. Bug de navegação (abas) — desbloqueia teste
3. Mapa restrito à cidade + estilos
4. Filtros (home, ranking, lista)
5. Comparação avançada com lista de ruas + filtros
6. Retry + estágios de erro + realtime no admin
7. Resolução de ruas sem nome + filtragem geográfica
8. Integração IA (Lovable AI default + BYOK)
9. Refatoração visual final + QA