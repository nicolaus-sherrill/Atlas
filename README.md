# Atlas

A community-built map of places to work: cafes, libraries, coworking spaces and parks. Anyone can
add a spot, rate it, suggest an edit or report a problem. An Atmo Studio product.

**Live at [atlas.atmo.studio](https://atlas.atmo.studio).**

## How it runs

Everything sits on free tiers.

| Piece | Service | What it does |
|---|---|---|
| Website | Cloudflare Pages, project `atlas` | Serves the React app. `atlas.atmo.studio` is a CNAME at Porkbun |
| API | Pages Functions, `artifacts/atlas/functions/` | `/api/chat` (Plan my day) and `/api/spots/:id/summary` |
| AI | Cloudflare Workers AI, Gemma 4 26B | Stops for the day at the free 10,000-neuron limit; never bills |
| Database and sign-in | Supabase | Spots, ratings, edits, reports, crowd levels. Row-level security enforces who can do what |
| Keep-alive | Worker `atlas-keepalive`, `artifacts/atlas/keepalive/` | One read a day so the free Supabase project never pauses |
| Bot check | Cloudflare Turnstile | Runs before a visitor's first contribution and before admin sign-in; Supabase verifies it |
| Place search | Photon and OpenStreetMap | Suggests real places while someone types, and pre-fills hours, website and tags |
| Map | OpenFreeMap | Free vector map tiles |

## Who can do what

- **Anyone** reads the map, adds a spot, rates any spot (one rating per person, averaged), suggests
  an edit, reports a problem and reports how busy a spot is. Contributing quietly gives the browser
  an anonymous Supabase identity; there's no sign-up.
- **Admins** approve or reject edits, resolve reports, hide spam ratings (singly or everything from
  one rater) and remove or restore spots, at `/admin`.

Per-visitor limits: 10 new spots, 20 edits, 20 reports, 30 ratings and 30 crowd reports an hour.

## Repository

```
artifacts/atlas/        the app
  src/                  React front end (Vite)
  functions/            Cloudflare Pages Functions, routing /api/* to worker/api.ts
  worker/               API handlers and the AI prompts
  keepalive/            the daily keep-alive Worker
  wrangler.jsonc        Pages configuration
supabase/
  migrations/           the database schema, access rules and starter data
  config.toml           Supabase settings, mirrored from the live project
scripts/src/
  test-db-permissions.mjs   runs every migration in memory and checks the access rules
  ai-eval.ts                compares AI models on Atlas's real prompts
LICENSE-DATA.md         the data licence
```

## Working on it

Requires Node 22+ and pnpm (`npx pnpm@10` works without installing it).

```bash
pnpm install
pnpm --filter @workspace/atlas run dev          # the app at http://localhost:5173
pnpm --filter @workspace/atlas run build        # production build
pnpm run typecheck                              # everything, including the API
pnpm --filter @workspace/scripts run test-db    # database access-rule checks
```

The local app reads and writes the live Supabase project. The bot check only runs on the live
addresses, so adding or rating spots from localhost fails by design.

### Fonts

Atlas is set in Satoshi Variable, from [Fontshare](https://www.fontshare.com/fonts/satoshi). Its
licence allows serving it from the site but not putting the files on a public server, so they stay
out of this repository. Download Satoshi from Fontshare, convert the two variable files to WOFF2,
and save them as `artifacts/atlas/public/fonts/Satoshi-Variable.woff2` and
`Satoshi-VariableItalic.woff2`. Without them the app falls back to the system font, and
`pnpm run deploy` stops before building.

### Type

Atlas uses six of the design system's type roles: label 11, body-s 13, body-m 16, body-l 19,
body-xl 23 and subheading-s 28. Set a size with `font-size: var(--type-<role>-font-size)` and its
tracking with `var(--type-<role>-letter-spacing)`, or `var(--text-tracking-plus-6)` for caps.
`pnpm --filter @workspace/atlas run check:type` fails on any other size or tracking value in
`src/`, and `typecheck` and `deploy` run it.

### Database changes

Add a file to `supabase/migrations/`, add checks to `scripts/src/test-db-permissions.mjs`, run
`test-db`, then push with `npx supabase db push`.

Before any `npx supabase config push`, run `npx supabase config diff`. The file mirrors the live
settings, and pushing an unreviewed default can change live sign-in behaviour. The captcha secret
is read from the `SUPABASE_AUTH_CAPTCHA_SECRET` environment variable at push time and never lives
in the repository.

### Deploying

```bash
cd artifacts/atlas
pnpm run deploy --branch=main # build and deploy the site and API to atlas.atmo.studio
pnpm run deploy               # the same, as a preview at <branch>.atlas-68g.pages.dev
pnpm run deploy:keepalive     # only when the keep-alive changes
```

The Pages project's production branch is `main`, while this repository's is `master`. Without
`--branch=main`, Wrangler names the deployment after the current git branch, and it lands as a
preview that atlas.atmo.studio never serves.

Secrets are stored in Cloudflare, not in the repository: `SUPABASE_SECRET_KEY` on the Pages
project, which the API uses only to save AI summaries. The Supabase URL, the publishable key and
the Turnstile site key are public and live in `artifacts/atlas/.env` and `wrangler.jsonc`.

## Licences

The spot data is open under the [Open Database License](LICENSE-DATA.md), because place details
come from OpenStreetMap. Map data © OpenStreetMap contributors.
