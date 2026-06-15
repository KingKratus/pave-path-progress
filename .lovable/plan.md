## Objetivo
Avançar a experiência de busca/mapa, habilitar exploração bairro-a-bairro sem inchar o banco, expor estatísticas amplas (estado/país) e corrigir o bug de permissão em `vias` que aparece nos logs.

## 1. Correções urgentes (bugs e segurança)
- **RLS de `vias`**: hoje a policy SELECT está restrita a `authenticated`, mas falta `GRANT SELECT ... TO authenticated` — daí o `permission denied for table vias` no log de `MunicipioDetail`. Adicionar o GRANT e, conforme decisão anterior, manter leitura só para usuários logados.
- **`ai_provider_settings`**: policy SELECT pública expõe configuração (e potencialmente chaves). Restringir leitura a admin (`has_role`) e remover GRANT SELECT do `anon`.
- **`admin_settings`**: idem — leitura só para admin.
- Rodar `supabase--linter` e tratar avisos restantes.

## 2. Barra de busca sobreposta (header)
- Mover a busca para um componente flutuante na `Navbar` com `position: sticky` + `z-50` e backdrop-blur, sobrepondo o hero/bento sem empurrar o layout.
- Autocomplete unificado (cidade + bairro + rua) com debounce, navegação via teclado e atalho `/`.
- Persistência de filtros em query string já existe no `/buscar`; espelhar nesse autocomplete global.

## 3. Bairros dinâmicos sobre o mapa
- Em `MunicipioDetail`, adicionar painel lateral "Bairros" que lista bairros distintos do município (query agregada em `vias` por `bairro`).
- Carregar **polígonos sob demanda** via Nominatim (`polygon_geojson=1`) ao passar o mouse / clicar — sem persistir no banco; usar cache em memória (Map) durante a sessão.
- Sobrepor o polígono como GeoJSON no `LeafletMap` com cor por % de pavimentação do bairro.
- Clique no bairro → filtra ruas, abre insights e atualiza URL (`?bairro=`).

## 4. Histórico Overpass sob demanda (sem cache pesado)
- Novo edge function `overpass-history` que aceita `{ osm_id | bbox, date }` e consulta Overpass com `[date:"YYYY-MM-DDT00:00:00Z"]` (suporte attic) — retorna ruas e a tag `surface` naquela data.
- Resposta **não é persistida**; só devolvida para o client renderizar a timeline do bairro/rua.
- UI: gráfico de linha mostrando km não pavimentado por ano (consulta 1x por ponto sob demanda, com loader por ano).

## 5. Insights por bairro sob demanda
- `BairroInsights.tsx`: estatísticas (total ruas, km, surfaces predominantes, top ruas) computadas client-side a partir das `vias` já carregadas do município.
- Gráfico de evolução mensal usando `vias_snapshots` filtrado por `bairro`.
- Botão "Carregar histórico OSM" chama `overpass-history` (passo 4).

## 6. Estatísticas amplas (estado/país) sem estourar memória
- Criar tabela materializada `stats_agregadas` (uf, total_km_unpaved, total_km_paved, municipios_sincronizados, atualizado_em) e equivalente nacional.
- Edge function `refresh-stats` (cron) recalcula via SQL `SUM(length_m) GROUP BY uf` — escreve poucas linhas (~27).
- Páginas `Index`, `EstadoDetail` e nova seção "Brasil" leem somente essa tabela em vez de varrer `vias`.
- Adicionar índices em `vias(municipio_id, surface)` se ainda não houver.

## 7. Endpoints Overpass adicionais
Novos helpers no edge `overpass-proxy` (ou funções dedicadas), todos sob demanda:
- `pontes-sem-pavimento`: `way[highway][bridge=yes][surface~"unpaved|dirt"]`
- `escolas-acesso-precario`: `node[amenity=school]` + raio + ruas sem pavimento próximas
- `saude-acesso`: `node[amenity~"hospital|clinic"]` + idem
- `transporte-publico`: paradas em vias não pavimentadas
- `relief`/`smoothness`: tag `smoothness` para qualidade da via
- `historico-attic`: passo 4

Expor cada um como tab opcional em `MunicipioDetail` → "Camadas extras".

## 8. Testes e verificação
- Atualizar `e2e/smoke.spec.ts` com fluxo: busca → cidade → bairro → polígono visível.
- Rodar `supabase--linter` e `security--run_security_scan` ao final.
- Validar no preview que o erro `permission denied for table vias` sumiu.

## Detalhes técnicos
- **Migração SQL**: GRANT em `vias`, ajuste de policies/grants em `ai_provider_settings` e `admin_settings`, criação de `stats_agregadas` + índices.
- **Edge functions novas**: `overpass-history`, `refresh-stats`, `overpass-layers` (camadas extras).
- **Frontend novo**: `GlobalSearchBar.tsx`, `BairroInsights.tsx`, `BairroPanel.tsx`, atualização em `LeafletMap.tsx` para polígonos sob demanda.
- **Sem cache de histórico**: respostas do `overpass-history` retornam com `Cache-Control: no-store`.

## Fora de escopo nesta rodada
- Substituir Nominatim por fonte oficial de limites (IBGE setores) — pode entrar depois se rate limit incomodar.
- Excel export (.xlsx) — fica para próxima.

Confirma que posso seguir com essa ordem?
