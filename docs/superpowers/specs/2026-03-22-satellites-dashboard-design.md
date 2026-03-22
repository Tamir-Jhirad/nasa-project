# Satellites Dashboard — Design Spec
**Date:** 2026-03-22
**Status:** Approved (v2 — post spec-review fixes)

---

## Overview

Add a `/satellites` page to NEO-Guardian that tracks active Earth-orbiting satellites using CelesTrak's GP element set API. The page mirrors the asteroid dashboard's architecture (Server Component → API proxy → Client dashboard) and reuses the existing `react-globe.gl` + THREE.js Earth globe. Users can filter by constellation/orbit class, search by name, select a satellite to see its full orbital ring, and watch its live position animate in real time.

---

## User-Approved Decisions

| Question | Decision |
|---|---|
| Satellite population | Active payloads only (~8,000 satellites) |
| Analytics depth | Globe + Smart Analytics (2 charts + constellation bar + detail panel) |
| Orbit visualization | Real-time live position dot (`satellite.js`, every 2 s) — selected only |
| Selection UX | Sidebar group filters + search box |
| Globe component | Same `react-globe.gl` + THREE.js as asteroid dashboard |
| Earth texture | Blue Marble daytime (`earth-blue-marble.jpg`) |
| Live position scope | Selected satellite only; all others shown as static dots at page-load position |

---

## Architecture & Data Flow

```
CelesTrak GP API  →  /api/satellites/route.ts  →  app/satellites/page.tsx
   (JSON, active)      ISR: revalidate=3600          Server Component (Node.js runtime)
                                                          ↓ direct import
                                                  SatelliteDashboardClient
                                                  (Client, owns all state)
                            ┌─────────────────────────────┴──────────────────┐
                     SatelliteGlobe            SatelliteSidebar              │
                     (react-globe.gl           (group filters                │
                      + THREE.js)               + search)                    │
                     satellite.js ← selected                         ┌───────┴──────────┐
                     propagation                              OrbitClassDonut  LaunchTimeline
                                                             (Recharts Pie)   (Recharts Bar)
                                                                     │
                                                             ConstellationBar  SatelliteDetailPanel
                                                             (Recharts Bar)    (live lat/lng, stats)
```

### Navigation

A `SiteNav` Client Component (two `<Link>` tabs using `usePathname()`) is added to `app/layout.tsx`, rendered above page content. Tabs: `☄ Asteroids` (→ `/`) and `🛰 Satellites` (→ `/satellites`). Active tab highlighted in `neo-accent` blue.

### API Route — `/api/satellites/route.ts`

- Fetches `https://celestrak.org/gp.php?GROUP=active&FORMAT=json`
- Filters to `OBJECT_TYPE === "PAYLOAD"` only
- Normalises each record into `SatelliteObject[]`
- Returns `SatelliteResponse` with `count`, `revalidatedAt`, `objects`
- `export const revalidate = 3600` (1-hour ISR)
- **Runtime: Node.js (default).** Do NOT add `export const runtime = "edge"`. The CelesTrak response for ~8,000 active payloads is approximately 3–4 MB uncompressed. Edge Functions have a 4 MB response body limit which may be exceeded; Node.js Functions have no such limit.
- Timeout 10 s + error logging pattern from existing `/api/orbit/route.ts`

### Page — `app/satellites/page.tsx`

Server Component. Imports the route handler directly (same pattern as home page — avoids `VERCEL_URL` pitfall). Renders `SatelliteTopBar` + `SatelliteDashboardClientWrapper` (dynamic import, `ssr: false`, for Three.js safety).

---

## Data Model

### `lib/celestrak/types.ts`

```typescript
export type OrbitClass = "LEO" | "MEO" | "GEO" | "HEO";

export type Constellation =
  | "Starlink" | "OneWeb" | "GPS" | "Galileo" | "GLONASS"
  | "Space Station" | "Weather" | "Science" | "Other";

export interface SatelliteObject {
  noradId: number;           // NORAD_CAT_ID
  name: string;              // OBJECT_NAME (trimmed)
  intlDesignator: string;    // OBJECT_ID e.g. "1998-067A"
  countryCode: string;       // COUNTRY_CODE
  launchDate: string;        // LAUNCH_DATE ISO e.g. "1998-11-20"
  launchYear: number;        // derived: parseInt(LAUNCH_DATE.slice(0,4))
  orbitClass: OrbitClass;
  apogeeKm: number;          // APOAPSIS
  perigeeKm: number;         // PERIAPSIS
  inclinationDeg: number;    // INCLINATION
  periodMin: number;         // derived: 1440 / MEAN_MOTION (MEAN_MOTION in rev/day)
  eccentricity: number;      // ECCENTRICITY
  raanDeg: number;           // RA_OF_ASC_NODE — required for orbit ring
  argOfPericenterDeg: number; // ARG_OF_PERICENTER — required for orbit ring
  constellation: Constellation;
  tleLine1: string;          // TLE_LINE1 — required for satellite.js propagation
  tleLine2: string;          // TLE_LINE2
}

export interface SatelliteResponse {
  count: number;
  revalidatedAt: string;
  objects: SatelliteObject[];
}
```

### CelesTrak GP JSON → SatelliteObject field mapping

The `gp.php?FORMAT=json` response is an extended GP record that includes supplemental catalog metadata alongside the orbital elements.

| GP JSON field | SatelliteObject field | Notes |
|---|---|---|
| `NORAD_CAT_ID` | `noradId` | number |
| `OBJECT_NAME` | `name` | trimmed |
| `OBJECT_ID` | `intlDesignator` | e.g. `"1998-067A"` |
| `COUNTRY_CODE` | `countryCode` | present in extended GP JSON; may be absent — fall back to `""` |
| `LAUNCH_DATE` | `launchDate` | present in extended GP JSON; may be absent — fall back to `""` |
| `OBJECT_ID.slice(0,4)` | `launchYear` | **always use this**, not `LAUNCH_DATE` — derivable from `intlDesignator` even when `LAUNCH_DATE` is absent (e.g. `"1998-067A"` → `1998`) |
| `APOAPSIS` | `apogeeKm` | km |
| `PERIAPSIS` | `perigeeKm` | km |
| `INCLINATION` | `inclinationDeg` | degrees |
| `1440 / MEAN_MOTION` | `periodMin` | MEAN_MOTION in rev/day |
| `ECCENTRICITY` | `eccentricity` | |
| `RA_OF_ASC_NODE` | `raanDeg` | degrees |
| `ARG_OF_PERICENTER` | `argOfPericenterDeg` | degrees |
| `TLE_LINE1` | `tleLine1` | |
| `TLE_LINE2` | `tleLine2` | |
| computed | `orbitClass` | via `classifyOrbit()` |
| computed | `constellation` | via `detectConstellation()` |

### `lib/celestrak/orbitClass.ts`

Classification applied in this priority order:

```
GEO  — apogeeKm ∈ [35_500, 36_200] AND eccentricity < 0.01
HEO  — eccentricity > 0.25 (AND not already GEO)
LEO  — perigeeKm < 2_000
MEO  — everything else
```

### `lib/celestrak/constellationDetect.ts`

Name-based rules (applied in order, all comparisons on `name.toUpperCase()`):
```
name.startsWith("STARLINK")                                         → Starlink
name.startsWith("ONEWEB")                                           → OneWeb
name.includes("GPS") || name.includes("NAVSTAR")                    → GPS
name.startsWith("GALILEO")                                          → Galileo
name.startsWith("GLONASS")                                          → GLONASS
name.includes("ISS") || name.includes("TIANGONG")
  || name.includes("CSS")                                           → Space Station
name.includes("NOAA") || name.includes("GOES")
  || name.includes("METEOSAT") || name.includes("METEOR")           → Weather
name.includes("HUBBLE") || name.includes("CHANDRA")                 → Science
default                                                             → Other
```

### `lib/celestrak/gpParser.ts`

Normalises raw CelesTrak JSON array → `SatelliteObject[]`. Calls `classifyOrbit()` and `detectConstellation()`.

**TLE validation:** Filter out any record where:
- `TLE_LINE1` or `TLE_LINE2` is null, undefined, or empty string
- `TLE_LINE1.length !== 69` or `TLE_LINE2.length !== 69`

Malformed TLE lines that pass through will be caught at render time by the `posVel.position === false` guard in the animation loop.

---

## Orbit Ring Math

### Frame

`computeOrbitPoints()` in `lib/nasa/orbitUtils.ts` uses **heliocentric ecliptic J2000** coordinates. Satellite orbits use **geocentric equatorial (ECI)** coordinates, which differ from the ecliptic frame by the ~23.4° obliquity of the ecliptic. Reusing `computeOrbitPoints()` as-is would produce orbit rings tilted by ~23.4° — incorrect for all satellites.

**Fix:** Add `computeOrbitPointsGeo()` to a new file `lib/celestrak/orbitUtils.ts`. This function uses the same Keplerian arithmetic but in the geocentric equatorial frame (z-axis = celestial north pole):

```typescript
// lib/celestrak/orbitUtils.ts
// Computes orbit points in geocentric equatorial frame (ECI).
// Input: a in Earth radii (dimensionless), e, i/om/w in degrees.
// Output: points in Earth radii — same unit as a.
export function computeOrbitPointsGeo(
  elements: SatelliteOrbitalElements,
  nPoints = 120
): Array<{ x: number; y: number; z: number }>
```

The P/Q vector rotation convention is identical to `computeOrbitPoints` — only the reference frame label changes. The math is frame-agnostic given consistent Keplerian elements in that frame. CelesTrak GP elements (INCLINATION, RA_OF_ASC_NODE, ARG_OF_PERICENTER) are already defined in the ECI frame.

### Semi-major axis

```
μ  = 398600.4418 km³/s²
T  = periodMin × 60          (seconds)
a_km = (μ × (T / (2π))²)^(1/3)
a_ER = a_km / 6371            (Earth radii, dimensionless)
```

### Input to `computeOrbitPointsGeo`

```typescript
// SatelliteOrbitalElements — separate from OrbitalElements (which uses AU)
export interface SatelliteOrbitalElements {
  a: number;   // semi-major axis in Earth radii
  e: number;   // eccentricity
  i: number;   // inclination (degrees)
  om: number;  // RAAN — RA_OF_ASC_NODE (degrees)
  w: number;   // argument of pericenter — ARG_OF_PERICENTER (degrees)
}
```

### THREE.js coordinate mapping

`react-globe.gl` uses a Y-up scene where the globe's polar axis is the THREE.js Y axis. The required axis swap (matching the existing `EarthGlobe.tsx` convention) is:

```
x_three = x_orbital × GLOBE_ER_SCALE
y_three = z_orbital × GLOBE_ER_SCALE    ← swap y↔z
z_three = −y_orbital × GLOBE_ER_SCALE   ← negate
```

`GLOBE_ER_SCALE = 100` (globe radius = 100 THREE.js units = 1 Earth radius).

---

## Live Position Animation

```typescript
// Every 2 seconds when a satellite is selected:
import { twoline2satrec, propagate, gstime, eciToGeodetic } from 'satellite.js';

// satrec is created ONCE when selection changes, not re-parsed each tick
const satrec = twoline2satrec(sat.tleLine1, sat.tleLine2);

// In the interval callback:
const now    = new Date();                        // single Date for both calls
const posVel = propagate(satrec, now);            // ECI position at `now`
const gmst   = gstime(now);                       // GMST at same `now` — must match

// Guard: propagation can fail for degenerate TLEs
if (!posVel || posVel.position === false) return;

const geo = eciToGeodetic(posVel.position as EciVec3<Kilometer>, gmst);

// satellite.js returns radians — convert for react-globe.gl (expects degrees)
const latDeg = geo.latitude  * (180 / Math.PI);
const lngDeg = geo.longitude * (180 / Math.PI);  // already in [-π, π], no wrapping needed
const altKm  = geo.height;
```

- `satrec` is created once when the satellite is selected and reused across ticks (not re-parsed every 2 s)
- Globe dot position updated via `useRef` to avoid triggering React re-renders on each tick
- Interval cleared in `useEffect` cleanup when satellite is deselected or component unmounts

---

## Components

### `components/satellites/SatelliteGlobe.tsx`

`react-globe.gl` + THREE.js. Key differences from `EarthGlobe`:
- `globeImageUrl` → `//unpkg.com/three-globe/example/img/earth-blue-marble.jpg`
- Points data: all visible satellites as small dots, color-coded by orbit class
  - LEO: `#38bdf8`, GEO: `#22c55e`, MEO: `#f59e0b`, HEO: `#a78bfa`
- When satellite selected:
  - Draws orbit ring via `computeOrbitPointsGeo()` (new function, ECI frame)
  - Applies axis swap `(x, z, -y) × GLOBE_ER_SCALE` to each point before adding to THREE.js `BufferGeometry`
  - Starts 2-second interval for live position animation (see Live Position Animation above)
  - Live dot: larger point radius + glow overlay on the globe points layer
- Globe cap: `pointsData` limited to current filter set

### `components/satellites/SatelliteSidebar.tsx`
- Search input: case-insensitive filter on `name` or `noradId.toString()`
- Constellation group list with color dot + count badge; clicking sets active constellation filter
- Orbit class multi-select (LEO / MEO / GEO / HEO)
- "All Active" button clears all filters

### `components/satellites/SatelliteDetailPanel.tsx`
Rendered when `selectedNoradId !== null`. Displays:
- Name, NORAD ID, international designator, country, launch date, constellation
- Orbit class badge, altitude range (`perigeeKm`–`apogeeKm` km), inclination, period
- Live current position (lat/lng in degrees, updates every 2 s)
- Orbital speed estimate: `v ≈ √(μ / a_km)` km/s

### `components/satellites/OrbitClassDonut.tsx`
Recharts `PieChart` (`innerRadius={50}`, `outerRadius={75}`). LEO/MEO/GEO/HEO segments. Centered label: dominant class + percentage.

### `components/satellites/LaunchTimeline.tsx`
Recharts `BarChart` grouped by launch year. Starlink bars (year ≥ 2019) in `#0ea5e9`; others in `#1e3a5f`. Annotation at 2019 marking the Starlink era.

### `components/satellites/ConstellationBar.tsx`
Recharts horizontal `BarChart`. Top 8 constellations by satellite count. Each bar a distinct accent color. Starlink bar intentionally dominant to convey scale.

### `components/satellites/SatelliteDashboardClient.tsx`
Client root. Owns:
- `FilterState` (active constellation set, active orbit class set, search string)
- `selectedNoradId: number | null` (default `null` — all deselected)
- `useMemo`-derived `filteredObjects`

### `components/layout/SiteNav.tsx`
Client Component. Two Next.js `<Link>` tabs, `usePathname()` for active highlight.

### `components/satellites/SatelliteTopBar.tsx`
4 KPI stat cards: Total Active Satellites, Countries with Assets, LEO Count (with % of total), Starlink Share (count + % of total).

---

## New Files

```
app/
  satellites/
    page.tsx
  api/
    satellites/
      route.ts

components/
  layout/
    SiteNav.tsx
  satellites/
    SatelliteDashboardClient.tsx
    SatelliteDashboardClientWrapper.tsx
    SatelliteGlobe.tsx
    SatelliteSidebar.tsx
    SatelliteDetailPanel.tsx
    SatelliteTopBar.tsx
    OrbitClassDonut.tsx
    LaunchTimeline.tsx
    ConstellationBar.tsx

lib/
  celestrak/
    types.ts
    gpParser.ts
    orbitClass.ts
    constellationDetect.ts
    orbitUtils.ts        ← computeOrbitPointsGeo() (ECI frame, NOT heliocentric)

__tests__/
  celestrak/
    orbitClass.test.ts
    constellationDetect.test.ts
    gpParser.test.ts
    orbitMath.test.ts    ← semi-major axis derivation + orbit point sanity check
```

### Modified Files

```
app/layout.tsx              — add <SiteNav /> above {children}
package.json                — add satellite.js dependency
```

---

## New Dependencies

| Package | Purpose |
|---|---|
| `satellite.js` | TLE propagation (SGP4): TLE → ECI → geodetic |
| `@types/satellite.js` | TypeScript types |

---

## Testing

| Test file | What it covers |
|---|---|
| `orbitClass.test.ts` | LEO/MEO/GEO/HEO boundary values; GEO priority over HEO check |
| `constellationDetect.test.ts` | Each name-match rule; case-insensitivity; "Other" fallback |
| `gpParser.test.ts` | Full GP record normalisation; filters missing/short TLE lines; derives `periodMin` from `MEAN_MOTION` |
| `orbitMath.test.ts` | ISS: MEAN_MOTION = 15.49 rev/day → periodMin ≈ 92.96 min → a_km ≈ 6,798 km → a_ER ≈ 1.067; orbit points array length = nPoints+1; first point ≈ last point (closed ring, within float epsilon) |

No live API calls in tests. All use fixture data.

---

## ISR & Caching

- `/api/satellites` — `revalidate = 3600` (1 hour). CelesTrak updates TLEs daily; 1-hour ISR is sufficient.
- TLE data is fetched once at build/revalidation and stored in the route response. Live positions are computed entirely client-side via `satellite.js` — no per-session API calls.

---

## Error Handling

| Scenario | Handling |
|---|---|
| CelesTrak timeout (>10 s) | Route returns 503 `{ error: "CelesTrak unavailable" }` |
| CelesTrak non-200 | Same 503 response |
| Missing / short TLE lines | Filtered in `gpParser.ts` (line length ≠ 69 chars) |
| Malformed TLE reaching propagator | `posVel.position === false` guard in animation interval — skip tick silently |
| Page-level data fetch failure | Fallback UI: empty globe + "Satellite data temporarily unavailable" banner |
