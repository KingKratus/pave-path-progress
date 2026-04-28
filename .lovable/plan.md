

# Expansão: Ranking de Pavimentação — Piloto Duque de Caxias

## Visão Geral

Transformar o MVP atual em um piloto completo focado em **Duque de Caxias (RJ)**, com:
- Legenda visual no mapa
- Cálculo automático de ranking
- Autocomplete real via API do IBGE
- Painel administrativo para gerenciar sincronização
- Sincronização automática a cada 1 hora (intervalo ajustável)
- Várias edge functions para diferentes responsabilidades

---

## 1. Legenda do Mapa por Tipo de Superfície

Novo componente `MapLegend` sobreposto ao mapa (canto inferior direito) mostrando:

```text
┌─────────────────────────┐
│ Tipo de Superfície      │
├─────────────────────────┤
│ ■ Terra (dirt)          │
│ ■ Cascalho (gravel)     │
│ ■ Não pavimentada       │
│ ■ Solo (ground/earth)   │
│ ■ Compactada            │
└─────────────────────────┘
```

Cores reaproveitadas de `SURFACE_COLORS` em `LeafletMap.tsx`. Legenda colapsável em telas pequenas.

---

## 2. Autocomplete Real (API IBGE)

Substituir a lista hardcoded `BRAZILIAN_CITIES` em `Index.tsx` por busca na API pública do IBGE:

- Endpoint: `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`
- Carregar uma vez via `react-query` (cache de 24h), gerar índice em memória
- Filtrar localmente por nome com debounce de 250ms
- Mostrar até 8 sugestões com **Município — UF**
- Ao selecionar: navegar com `nome` + `uf` na URL (`/municipio/Duque%20de%20Caxias?uf=RJ`) para evitar ambiguidade

---

## 3. Edge Functions (várias, separadas por responsabilidade)

### 3.1 `sync-municipio` (nova)
Versão evoluída de `overpass-proxy`. Recebe `{ municipio, uf }`, busca dados Overpass com bounding box quando disponível para precisão maior, grava snapshot em `vias_snapshots` (nova tabela) e atualiza `vias` (estado atual). Marca em `municipios.last_sync_at`.

### 3.2 `calculate-ranking` (nova)
- Itera todos municípios com dados
- Compara último snapshot vs snapshot anterior para calcular `km_paved_added` (vias que mudaram de não pavimentado para pavimentado/sumiram)
- Aplica fórmula: `Score = (0.5 * km_paved_added) + (0.3 * eficiencia) - (0.2 * km_unpaved)`
  - `eficiencia` = `km_paved_added / km_unpaved_inicial` (0 se sem dados)
- Grava em `ranking` com `posicao` calculada
- Retorna resumo

### 3.3 `scheduled-sync` (nova, chamada por cron)
- Lê `admin_settings.sync_interval_minutes` e `admin_settings.enabled_municipios`
- Para cada município habilitado cuja `last_sync_at` esteja vencida, dispara `sync-municipio`
- Após sync, dispara `calculate-ranking`

### 3.4 `admin-trigger-sync` (nova)
- Endpoint chamado pelo painel admin para forçar sync imediato de um município
- Valida JWT e role `admin`

### 3.5 `overpass-proxy` (mantida)
Continua servindo a busca pública on-demand quando o município ainda não foi sincronizado.

---

## 4. Banco de Dados (novas tabelas/colunas)

### Novas tabelas
- `vias_snapshots`: `id`, `municipio_id`, `snapshot_at`, `total_km_unpaved`, `total_vias`, `data_jsonb` (resumo por surface)
- `admin_settings`: singleton (`id` fixo), `sync_interval_minutes` (default 60), `auto_sync_enabled` (bool), `enabled_municipios` (uuid[]), `updated_at`, `updated_by`
- `user_roles`: padrão Lovable (enum `app_role`: `admin`, `user`) + função `has_role()` security definer

### Colunas adicionadas
- `municipios.last_sync_at timestamptz`
- `municipios.uf text`
- `municipios.area_km2 numeric` (opcional, futuro)

### RLS
- `vias_snapshots`: leitura pública, escrita apenas service role
- `admin_settings`: leitura/escrita apenas para `has_role(auth.uid(), 'admin')`
- `user_roles`: usuário lê seus próprios papéis; apenas admin escreve

### Cron
Habilitar `pg_cron` + `pg_net` e agendar `scheduled-sync` a cada minuto (ele decide se dispara baseado nas settings — permite intervalo dinâmico sem recriar o cron).

---

## 5. Autenticação + Painel Admin

### Auth
- Página `/auth` com email/senha (signup + login)
- Auto-confirm habilitado (piloto interno)
- Primeiro usuário a se registrar pode ser promovido manualmente via SQL; depois admins promovem outros pelo painel

### Página `/admin` (protegida por role `admin`)
Aba 1 — **Configurações de Sync**
- Toggle: sync automático on/off
- Slider/input: intervalo em minutos (15–1440)
- Lista de municípios habilitados (multiselect)
- Botão "Salvar"

Aba 2 — **Municípios**
- Tabela com nome, UF, último sync, total km não pavimentado
- Botão "Sincronizar agora" por linha (chama `admin-trigger-sync`)
- Botão "Adicionar município" (busca via IBGE)

Aba 3 — **Ranking**
- Botão "Recalcular ranking agora"
- Visualização do ranking atual

Aba 4 — **Usuários**
- Lista usuários, permite promover/remover admin

---

## 6. Piloto Duque de Caxias

Migração de seed:
- Inserir Duque de Caxias (RJ) em `municipios` com `uf='RJ'`
- Habilitar em `admin_settings.enabled_municipios`
- Disparar primeiro sync automaticamente após deploy (via chamada inicial no painel)

Página inicial: card destacado "Município piloto: Duque de Caxias" com link direto.

---

## 7. Indicador de "Tempo Real"

Em `MunicipioDetail`:
- Badge mostrando "Atualizado há X min" baseado em `last_sync_at`
- Auto-refresh dos dados via `react-query` `refetchInterval: 60s` quando a aba está visível

---

## Stack Técnica

- **Frontend**: React + react-query + react-leaflet (já instalado) + shadcn (Tabs, Switch, Slider, Table, Dialog)
- **Backend**: 5 edge functions Deno
- **DB**: Supabase com pg_cron + pg_net
- **Auth**: Supabase Auth (email/senha)
- **Roles**: tabela `user_roles` + função `has_role()` security definer (padrão seguro)

---

## Ordem de Implementação

1. Migração: `user_roles`, `admin_settings`, `vias_snapshots`, colunas em `municipios`, RLS, pg_cron
2. Auth (`/auth`) + ProtectedRoute + hook `useUserRole`
3. Edge functions: `sync-municipio`, `calculate-ranking`, `scheduled-sync`, `admin-trigger-sync`
4. Painel `/admin` (4 abas)
5. Legenda do mapa (`MapLegend`)
6. Autocomplete IBGE + badge "atualizado há X min"
7. Seed de Duque de Caxias + sync inicial
8. Teste end-to-end pesquisando "Duque de Caxias"

