# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── atlas/              # Atlas - Community-powered work spot map
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Atlas (`artifacts/atlas`)

Community-powered map web app for finding great remote work spots. Built with React + Vite, Leaflet.js + OpenStreetMap, and localStorage for persistence.

### Features
- **Browse View** (landing page): Distraction-free table layout inspired by placestoread.xyz with search, city/category/tag filter chips, expandable detail rows, and coordinates links
- Interactive Leaflet map with custom-styled markers
- Browse, search, and filter locations by category (cafe, library, coworking, park)
- Submit new spots with workability ratings (WiFi, Power, Noise, Coffee, Lighting, Seating, Outlets)
- Amenity toggles: Food, Drinks, ADA accessibility
- Transit access: Walking, Biking, Driving, Train, Bus
- **Workability Score**: Computed from all 7 rating dimensions (0-5 scale)
- **AI Summaries**: OpenAI-generated spot summaries via api-server `/api/summarize` endpoint (gpt-4o-mini)
- "Get Directions" links to Google Maps and Apple Maps
- Export spots as GeoJSON or KML for use in other map apps
- localStorage persistence (key: `atlas_spots_v2`) with 10 pre-seeded NYC sample locations
- **Sliding map panel**: Single FAB arrow toggles map in/out from the right. Browse view fills full width when map is hidden; condenses to sidebar when map is shown. On mobile, sidebar hides completely when map is open.

### Design
- Color palette: off-white (#F5F3EF), near-black (#1A1A18), warm stone (#C8B89A), muted sage (#8A9E8C)
- Typography: Inter from Google Fonts
- Map tiles: CARTO Light (OpenStreetMap-based)

### Key Files
- `src/App.tsx` — Main app shell with sliding panel layout (mapOpen toggle), spot state management, AI summary generation
- `src/components/BrowseView.tsx` — Table landing page with filters and expandable rows
- `src/components/MapView.tsx` — Leaflet map with markers and popups
- `src/components/Sidebar.tsx` — Search, filter, spot list, export, workability scores
- `src/components/SpotForm.tsx` — Add new spot form with ratings, amenities, transit
- `src/lib/types.ts` — TypeScript types, constants, computeWorkabilityScore(), getSpotTags()
- `src/lib/store.ts` — localStorage data layer with seed data (10 NYC spots)
- `src/lib/ai.ts` — Client-side AI summary generation via /api/summarize
- `src/lib/export.ts` — GeoJSON/KML export and map app deep links
- `src/index.css` — All styles (custom CSS, no Tailwind)

### Data Model (WorkSpot)
- Basic: id, name, category, city, address, lat, lng, description
- Ratings (1-5): wifi, power, noise, coffee, lighting, seating, outlets
- Booleans: food, drink, ada
- Transit: walking, biking, driving, train, bus
- aiSummary: AI-generated summary string

### API Server AI Endpoint
- `POST /api/summarize` — Rate-limited (10 req/min per IP), validated input, generates spot summary via OpenAI
- Uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`); `src/routes/summarize.ts` exposes `POST /summarize` (full path: `/api/summarize`) for AI summary generation
- Depends on: `@workspace/db`, `@workspace/api-zod`, `openai`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
