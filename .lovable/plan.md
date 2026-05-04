# Plano — Refresh UX + IA configurável + Busca global + Comparação interativa

## Visão geral

Reformular o visual (mantendo identidade cívica BR), permitir configurar provedores de IA no admin, escalar a aba de Comparação para milhares de ruas com paginação/virtualização e filtros persistentes, integrar destaque de via no mapa ao clicar, criar página de busca global (cidades/ruas/bairros) e adicionar painel de insights por município. Também melhorar a qualidade dos dados (nomes de ruas e coordenadas precisas).

---

## 1. Refresh de UX e estilo

- **Design tokens (`src/index.css` + `tailwind.config.ts`)**: paleta cívica refinada (verde #0F7A3C, amarelo #F2C200, azul institucional #143A7B), tipografia Inter + Space Grotesk para títulos, raio `--radius: 0.75rem`, sombra suave reutilizável.
- **Componentes base**:
  - `PageHeader` (título + breadcrumb + ações) usado em Index, Ranking, Município, Admin, Busca.
  - `StatCard` padronizado (ícone + valor + delta).
  - `EmptyState`, `SectionTitle`, `Chip` (badge clicável para filtros).
  - Atualizar `Navbar` com layout sticky, busca rápida embutida e indicador de ambiente (admin).
- **Index**: hero mais limpo, cards de cidades em destaque, atalho "Buscar tudo" → `/buscar`.
- **MunicipioDetail**: tabs com ícones, header com gradiente sutil + status de última sync + botão de exportar.
- **Admin**: sidebar vertical (em vez de tabs horizontais lotadas) com seções: Sincronização, Municípios, Sync por UF, Histórico, Ranking, **IA Providers** (nova).
- **Mobile**: revisão de breakpoints (375px alvo do viewport atual), tabs com scroll horizontal já existente; ajustar padding e tamanhos.

## 2. Tela de IA Providers no admin

- Nova aba `/admin` → "IA Providers".
- Form para escolher provider padrão (Lovable / Gemini / OpenAI / OpenRouter), modelo, e inserir API key.
- **Armazenamento**: tabela `ai_provider_settings` (singleton via `id = 'default'`):
  - `provider text`, `model text`, `updated_by uuid`, `updated_at timestamptz`.
  - Chaves vão como **secrets** do projeto (`USER_GEMINI_KEY`, `USER_OPENAI_KEY`, `USER_OPENROUTER_KEY`) — usar `add_secret`. Tabela apenas registra qual está ativo + modelo.
- Botão "Validar conexão" → chama edge function `ai-validate` que faz uma chamada teste e devolve ok/erro.
- `AiPriorities.tsx` passa a ler o provider padrão (via select que vem pré-preenchido pela tabela). Usuário pode sobrescrever na hora se for admin.
- RLS: SELECT público do registro (sem expor chaves), INSERT/UPDATE só admin.

## 3. Lista de ruas alteradas — paginação, virtualização, filtros persistentes

Em `PeriodComparison.tsx`:

- Adicionar `**@tanstack/react-virtual**` (`bun add @tanstack/react-virtual`) para virtualizar listas longas dentro de cada tab (paved/new/changed).
- Paginação server-side opcional via `compare-periods` (params `page`, `page_size`, `surface`, `q`, `min_len_m`); por padrão devolve até 5.000 itens, mas com filtros server-side aplicados.
- **Filtros persistentes** via URL params (`useSearchParams`) + `localStorage`:
  - superfície (multi-select), busca textual, comprimento mínimo, "somente com nome".
- Ordenação: por comprimento desc, alfabética, por mudança de superfície.
- Toolbar sticky no topo da lista com contadores e botão "limpar filtros".

## 4. Destaque de via no mapa ao clicar

- `MunicipioDetail` mantém estado `highlightedOsmId` + `focusedGeometry`.
- Ao clicar numa rua na aba Comparação (ou na lista do mapa), setar esse estado e:
  - Trocar para a aba "Mapa".
  - Em `LeafletMap`, novo prop `focusOsmId` → encontrar a feature, abrir popup, `map.fitBounds(layer.getBounds(), { maxZoom: 18, padding: [40,40] })`, e estilo realçado (peso 6, cor `--accent`, glow via `className`).
- Já existe `highlightOsmIds: Set<number>`; estendemos para também aceitar foco com animação (`flyToBounds`).

## 5. Qualidade dos dados (nomes e coordenadas)

Edge function `enrich-vias` (nova) + ajustes no `sync-municipio`:

- **Coordenadas precisas**: já usamos `out geom;` do Overpass (geometria real da via). Garantir que cada via salve o `geom_geojson` LineString com os nós reais; calcular um `centroid_lat/lng` (ponto médio do LineString) e persistir nas colunas novas `centroid_lat double precision`, `centroid_lng double precision` em `vias`. Isso elimina coordenadas "aleatórias".
- **Nomes ausentes**: pipeline em camadas:
  1. Tags OSM: `name`, `name:pt`, `alt_name`, `official_name`, `loc_name`, `ref`, `addr:street`.
  2. Se ainda vazio, query Overpass por `way(around:25, lat, lng)[highway][name]` no centroid → herda nome de via contígua mesma direção.
  3. Reverse geocoding com **Nominatim** (`https://nominatim.openstreetmap.org/reverse`) com User-Agent próprio e rate-limit 1 req/s, lendo `address.road`.
  4. Como último recurso, marcar `nome_status = 'sem_nome'` (nova coluna) — UI mostra "Via sem nome (próxima a X)" usando bairro.
- Botão no admin "Enriquecer nomes" por município (dispara `enrich-vias`).

Migração:

```sql
alter table vias add column if not exists centroid_lat double precision;
alter table vias add column if not exists centroid_lng double precision;
alter table vias add column if not exists nome_status text default 'ok';
alter table vias add column if not exists bairro text;
create index if not exists vias_municipio_surface_idx on vias(municipio_id, surface);
create index if not exists vias_nome_trgm_idx on vias using gin (nome gin_trgm_ops);
create extension if not exists pg_trgm;
```

## 6. Página de busca global `/buscar`

- Rota nova `src/pages/Buscar.tsx`.
- Campo único + filtros: tipo (cidade / rua / bairro), UF, superfície, "somente sem nome".
- Busca com debounce 300ms; usa Supabase:
  - cidades: `municipios` (`ilike`).
  - ruas: `vias` (`ilike` sobre `nome`, com trigram).
  - bairros: `vias.bairro` distinct.
- Resultado em tabs ou seções com chips e atalhos:
  - cidade → `/municipio/:nome`
  - rua → `/municipio/:nome?focus=<osm_id>` (abre mapa focado).
- Atalho `Ctrl/Cmd+K` na Navbar abre um Command (`cmdk`) com busca rápida.

## 7. Insights por município

- Nova seção (tab "Insights") em `MunicipioDetail`:
  - **Cards automáticos** (sem IA): top 5 ruas mais longas sem pavimentação, % de vias sem nome, distribuição por superfície (bar chart com `recharts`), evolução do score (linha — usando `ranking` por período).
  - **Insights IA**: reaproveita `ai-prioritize` mas com prompt expandido para gerar bullet points de oportunidades (ex.: "Bairro X concentra 32% das vias dirt"). Guardar em `ai_priorities.payload.insights`.
- Botão "Gerar insights" usa o provider padrão configurado no admin.

---

## Backend / migrações resumidas

1. `ai_provider_settings` (singleton) + RLS.
2. `vias`: colunas `centroid_lat`, `centroid_lng`, `nome_status`, `bairro` + índices + extensão `pg_trgm`.
3. Novas edge functions:
  - `ai-validate` — testa chave do provider.
  - `enrich-vias` — recalcula nomes/centroides para um município.
4. `compare-periods` — aceita filtros e paginação server-side.
5. `sync-municipio` — passa a popular centroid + bairro (via tag `addr:suburb` quando disponível).

## Frontend resumido

- Novos arquivos: `src/components/PageHeader.tsx`, `StatCard.tsx`, `EmptyState.tsx`, `CommandPalette.tsx`, `pages/Buscar.tsx`, `components/MunicipioInsights.tsx`, `components/admin/AiProvidersPanel.tsx`, `components/VirtualRoadList.tsx`.
- Editados: `index.css`, `tailwind.config.ts`, `Navbar.tsx`, `Index.tsx`, `Ranking.tsx`, `MunicipioDetail.tsx`, `PeriodComparison.tsx`, `LeafletMap.tsx`, `Admin.tsx`, `AiPriorities.tsx`, `App.tsx` (rota `/buscar`).

## Dependências

- `@tanstack/react-virtual`
- `cmdk` (provavelmente já presente via shadcn `command`)
- `recharts` (se ainda não instalado)

## Critérios de aceite

- Aba Comparação rola fluido com 10k+ itens; filtros persistem ao recarregar.
- Clicar numa rua leva ao mapa com a via destacada e zoom no trecho exato.
- Admin → IA Providers permite trocar provider padrão e validar a chave; AiPriorities respeita o padrão.
- Página `/buscar` retorna cidades, ruas e bairros em <500ms para termos comuns.
- Vias sem nome caem para <10% após `enrich-vias` em Duque de Caxias; nenhuma via aparece com coordenadas fora do polígono.
- Visual atualizado consistente em mobile (375px) e desktop.
- Corrija bugs e verifique se os dados são reais ou fictícios
- Crie uma opção com mapa em SVG (ACHE UMA BIBLIOTECA DISSO) 