# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build (fetches NASA API at build time)
npm run start        # serve production build locally
npm test             # run all Jest tests
npx jest __tests__/nasa/riskScore.test.ts   # run a single test file
npx tsc --noEmit     # TypeScript check without emitting
```

## Architecture

### Data flow

NASA's APIs are never called from the browser. The two API routes act as backend proxies:

- `app/api/close-approaches/route.ts` — calls NASA CAD API, normalizes the raw array-of-arrays format via `parseCadResponse`, returns `CloseApproachesResponse`
- `app/api/sentry/route.ts` — calls NASA Sentry API, sorts by impact probability, returns top 50 as `SentryResponse`

Both routes carry `export const revalidate = 43200` (12-hour ISR).

The dashboard page (`app/page.tsx`) **imports the close-approaches route handler directly** (`import("@/app/api/close-approaches/route")`) rather than fetching over HTTP. This avoids the `VERCEL_URL` pitfall where the URL changes per deployment and is the correct App Router pattern for same-project server-to-server calls.

### Server / Client boundary

`app/page.tsx` is a Server Component. It renders `TopBar` (also a Server Component) plus `DashboardClientWrapper`. The wrapper exists solely because `next/dynamic` with `ssr: false` is not allowed directly inside Server Components — it holds the `dynamic()` call in a Client Component boundary, which then loads `DashboardClient` (Recharts requires a browser).

`DashboardClient` owns all filter state (`useState`) and memoized filtering (`useMemo`), and composes the three charts, table, and methodology section.

### Data science layer (`lib/nasa/`)

| File | Purpose |
|---|---|
| `types.ts` | Shared interfaces: `NeoObject`, `SentryObject`, `CloseApproachesResponse`, `SentryResponse`, `RiskCategory` |
| `cadParser.ts` | Normalizes CAD array-of-arrays → `NeoObject[]` (calls dateUtils, diameterEstimate, riskScore) |
| `dateUtils.ts` | Parses NASA's custom date format `"2026-Jan-01 15:44"` → ISO 8601 |
| `diameterEstimate.ts` | Estimates diameter from H magnitude: `D = (1329/√0.14) × 10^(-H/5)` km. Used for ~99% of CAD objects which lack a measured diameter |
| `riskScore.ts` | Computes `log₁₀((mass_kg × vel_m/s) / dist_m² + 1)`. Critical ≥ 3.0, Watchlist ≥ 1.5, Safe < 1.5 |

All lib modules have unit tests in `__tests__/nasa/`. Tests use `ts-jest` with the `@/*` path alias.

### Tailwind

Tailwind v3 is pinned (`^3.4.19`). **Do not upgrade to v4** — it removes `tailwind.config.ts` and `@tailwind` directives. Custom colors are under `space-{950,900,800,700,600}` and `neo-{safe,watchlist,critical,accent}`.

### NASA API notes

- CAD API returns `{ fields: string[], data: (string|null)[][] }` — array-of-arrays aligned to a field header. Dates are `"2026-Jan-01 15:44"`, not Julian.
- Sentry API returns `{ data: object[] }` — array-of-objects. `diameter` is always present; `v_inf` (velocity) may be absent for some objects (`velocityKmS` typed as `number | null`).
- `FilterState` (min diameter + risk categories) is defined in `components/layout/Sidebar.tsx` and imported from there by `DashboardClient`.
