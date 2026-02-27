# Ranking Nacional de Prefeitos - Pavimentação

## Overview

A public-facing web app that lets citizens search any Brazilian municipality, visualize unpaved roads on an interactive map, and see how cities rank in paving performance — all powered by OpenStreetMap data via the Overpass API.

## Pages & Features

### 1. Home / Search Page

- Hero section with title "Ranking Nacional de Pavimentação" and a prominent municipality search bar with autocomplete
- Quick stats summary (total municipalities analyzed, total km unpaved nationally)
- Top 10 ranking preview cards showing best-performing cities

### 2. Municipality Detail Page

- **Interactive Leaflet Map** showing the municipality boundaries with unpaved roads highlighted in red/orange
- Summary cards: total km unpaved, total roads analyzed, surface type breakdown
- Road list table with street name, surface type, and length
- Export buttons for GeoJSON and CSV download

### 3. National Ranking Page

- Sortable/filterable table of all municipalities with scores
- Filters by state (UF), region, and population range
- Score breakdown showing km_unpaved, km_paved_added, and efficiency metrics
- Search within the ranking

### 4. About / Methodology Page

- Explanation of the scoring formula and data sources
- How OpenStreetMap data is collected and processed

## Backend (Lovable Cloud + Supabase)

### Edge Functions

- **overpass-proxy**: Fetches unpaved road data from Overpass API for a given municipality, caches results in the database
- **calculate-ranking**: Computes scores based on the scoring formula and stores results

### Database Tables

- **municipios**: id, nome, estado, region, population, geom (as GeoJSON text)
- **vias**: osm_id, municipio_id, surface, length_m, geom (as GeoJSON text), snapshot_date
- **ranking**: municipio_id, periodo, score, km_unpaved, km_paved_added

### Data Flow

1. User searches a municipality → edge function queries Overpass API → stores results in DB → returns data to frontend
2. Results are cached in the database to avoid repeated API calls
3. Ranking is calculated periodically from stored snapshots

## Design & UX

- Clean, modern design with a Brazilian civic/government feel
- Green and yellow accent colors (national colors)
- Mobile-responsive for citizens checking on phones
- Loading states while Overpass API queries are processed (can take several seconds)
- Portuguese language throughout

## Technical Approach

- Leaflet for interactive maps (via react-leaflet)
- Overpass API called through Supabase Edge Functions (to handle timeouts and caching)
- GeoJSON stored as text in Supabase PostgreSQL (simplified alternative to PostGIS)
- Distance calculations done in the edge function using Haversine formula
- Snapshot comparison for detecting paving changes over time

Linguagem em português do Brasil 

&nbsp;