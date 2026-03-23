# Satellites Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/satellites` page to NEO-Guardian that shows ~8,000 active Earth-orbiting satellites on a 3D globe with real-time orbit animation, filters, and analytics charts — all sourced from CelesTrak's GP element set API.

**Architecture:** Server Component page at `/satellites` fetches CelesTrak GP data via a proxying API route (`revalidate=3600`, Node.js runtime), passes it to a client-side dashboard that owns filter/search/selection state. A selected satellite gets a THREE.js orbit ring drawn in the ECI frame plus a live position dot updated every 2 seconds via `satellite.js` SGP4 propagation. Charts (Recharts) and a detail panel complete the layout.

**Tech Stack:** Next.js 16 (App Router), React 19, `react-globe.gl`, THREE.js, `satellite.js`, Recharts, Tailwind v3, `ts-jest`

**Spec:** `docs/superpowers/specs/2026-03-22-satellites-dashboard-design.md`

---

## File Map

### New files (lib)
| File | Responsibility |
|---|---|
| `lib/celestrak/types.ts` | `SatelliteObject`, `SatelliteResponse`, `OrbitClass`, `Constellation`, `SatelliteOrbitalElements` types |
| `lib/celestrak/orbitClass.ts` | `classifyOrbit(apogeeKm, perigeeKm, eccentricity) → OrbitClass` |
| `lib/celestrak/constellationDetect.ts` | `detectConstellation(name) → Constellation` |
| `lib/celestrak/gpParser.ts` | `parseGpResponse(raw[]) → SatelliteObject[]` |
| `lib/celestrak/orbitUtils.ts` | `computeOrbitPointsGeo(elements, nPoints) → {x,y,z}[]` in ECI frame |

### New files (API + page)
| File | Responsibility |
|---|---|
| `app/api/satellites/route.ts` | Fetches CelesTrak, filters payloads, returns `SatelliteResponse` |
| `app/satellites/page.tsx` | Server Component — direct-imports route, renders TopBar + ClientWrapper |

### New files (components)
| File | Responsibility |
|---|---|
| `components/layout/SiteNav.tsx` | Tab nav (Asteroids / Satellites), `usePathname` for active state |
| `components/satellites/SatelliteDashboardClientWrapper.tsx` | `dynamic(() => SatelliteDashboardClient, { ssr: false })` |
| `components/satellites/SatelliteDashboardClient.tsx` | Client root — filter/search/selection state, `useMemo` filter |
| `components/satellites/SatelliteTopBar.tsx` | 4 KPI stat cards |
| `components/satellites/SatelliteSidebar.tsx` | Search input + constellation + orbit-class filters |
| `components/satellites/SatelliteGlobe.tsx` | `react-globe.gl` + THREE.js orbit ring + live position animation |
| `components/satellites/SatelliteDetailPanel.tsx` | Selected satellite info + live lat/lng |
| `components/satellites/OrbitClassDonut.tsx` | Recharts `PieChart` — LEO/MEO/GEO/HEO distribution |
| `components/satellites/LaunchTimeline.tsx` | Recharts `BarChart` — launches per year |
| `components/satellites/ConstellationBar.tsx` | Recharts horizontal `BarChart` — top constellations |

### Modified files
| File | Change |
|---|---|
| `app/layout.tsx` | Add `<SiteNav />` above `{children}` |
| `package.json` | Add `satellite.js` (no `@types/satellite.js` — ships bundled types) |

### New test files
| File | Covers |
|---|---|
| `__tests__/celestrak/orbitClass.test.ts` | Boundary values for all 4 classes |
| `__tests__/celestrak/constellationDetect.test.ts` | Each name-match rule + "Other" fallback |
| `__tests__/celestrak/gpParser.test.ts` | Full record normalisation + TLE filtering |
| `__tests__/celestrak/orbitUtils.test.ts` | Semi-major axis math + closed ring check |

---

## Task 1: Install `satellite.js`

**Files:** `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install satellite.js
```

- [ ] **Step 2: Verify TypeScript sees the bundled types**

```bash
npx tsc --noEmit
```

Expected: no new errors (the package ships its own `.d.ts`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add satellite.js for TLE propagation"
```

---

## Task 2: Types

**Files:**
- Create: `lib/celestrak/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// lib/celestrak/types.ts

export type OrbitClass = "LEO" | "MEO" | "GEO" | "HEO";

/**
 * Constellation values produced by detectConstellation().
 * Detection is name-based — see constellationDetect.ts.
 */
export type Constellation =
  | "Starlink"       // name starts with "STARLINK"
  | "OneWeb"         // name starts with "ONEWEB"
  | "GPS"            // name includes "GPS" or "NAVSTAR"
  | "Galileo"        // name starts with "GALILEO"
  | "GLONASS"        // name starts with "GLONASS"
  | "Space Station"  // name includes "ISS", "TIANGONG", or "CSS"
  | "Weather"        // name includes "NOAA", "GOES", "METEOSAT", or "METEOR"
  | "Science"        // name includes "HUBBLE" or "CHANDRA"
  | "Other";

/** Keplerian elements for a geocentric ECI orbit (NOT heliocentric ecliptic). */
export interface SatelliteOrbitalElements {
  a: number;   // semi-major axis in Earth radii (dimensionless)
  e: number;   // eccentricity (dimensionless)
  i: number;   // inclination in degrees
  om: number;  // RAAN (right ascension of ascending node) in degrees
  w: number;   // argument of pericenter in degrees
}

/** Normalised active satellite from CelesTrak GP JSON. */
export interface SatelliteObject {
  noradId: number;
  name: string;
  intlDesignator: string;    // e.g. "1998-067A"
  countryCode: string;       // may be "" if absent from GP response
  launchDate: string;        // may be "" if absent from GP response
  launchYear: number;        // parseInt(intlDesignator.slice(0,4)) || 0
  orbitClass: OrbitClass;
  apogeeKm: number;
  perigeeKm: number;
  inclinationDeg: number;
  periodMin: number;         // 1440 / MEAN_MOTION (MEAN_MOTION in rev/day)
  eccentricity: number;
  raanDeg: number;           // RA_OF_ASC_NODE
  argOfPericenterDeg: number; // ARG_OF_PERICENTER
  constellation: Constellation;
  tleLine1: string;
  tleLine2: string;
}

export interface SatelliteResponse {
  count: number;
  revalidatedAt: string;
  objects: SatelliteObject[];
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/celestrak/types.ts
git commit -m "feat(satellites): add CelesTrak type definitions"
```

---

## Task 3: Orbit Class Classifier (TDD)

**Files:**
- Create: `lib/celestrak/orbitClass.ts`
- Create: `__tests__/celestrak/orbitClass.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/celestrak/orbitClass.test.ts
import { classifyOrbit } from "@/lib/celestrak/orbitClass";

describe("classifyOrbit", () => {
  // GEO: apogee in [35500,36200], eccentricity < 0.01 — checked FIRST
  it("classifies GEO correctly", () => {
    expect(classifyOrbit(35786, 35786, 0.0001)).toBe("GEO");
  });
  it("classifies upper-edge GEO correctly", () => {
    expect(classifyOrbit(36200, 35900, 0.005)).toBe("GEO");
  });
  it("does not classify GEO when eccentricity >= 0.01", () => {
    expect(classifyOrbit(35786, 35000, 0.01)).not.toBe("GEO");
  });

  // HEO: eccentricity > 0.25 (and not GEO)
  it("classifies HEO correctly", () => {
    expect(classifyOrbit(40000, 500, 0.8)).toBe("HEO");
  });

  // LEO: perigee < 2000 (and not GEO or HEO)
  it("classifies ISS as LEO", () => {
    expect(classifyOrbit(423, 418, 0.0004)).toBe("LEO");
  });
  it("classifies LEO at boundary (perigee=1999)", () => {
    expect(classifyOrbit(2100, 1999, 0.001)).toBe("LEO");
  });

  // MEO: everything else
  it("classifies GPS as MEO", () => {
    expect(classifyOrbit(20200, 20180, 0.001)).toBe("MEO");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/celestrak/orbitClass.test.ts
```

Expected: `Cannot find module '@/lib/celestrak/orbitClass'`

- [ ] **Step 3: Implement the classifier**

```typescript
// lib/celestrak/orbitClass.ts
import type { OrbitClass } from "./types";

/**
 * Classifies a satellite's orbit. Priority order matters:
 * GEO first, then HEO, then LEO, then MEO as the catch-all.
 */
export function classifyOrbit(
  apogeeKm: number,
  perigeeKm: number,
  eccentricity: number
): OrbitClass {
  // GEO: geostationary band, near-circular
  if (apogeeKm >= 35_500 && apogeeKm <= 36_200 && eccentricity < 0.01) {
    return "GEO";
  }
  // HEO: highly elliptical (Molniya-type)
  if (eccentricity > 0.25) {
    return "HEO";
  }
  // LEO: low Earth orbit
  if (perigeeKm < 2_000) {
    return "LEO";
  }
  // MEO: everything else (GPS, Galileo, GLONASS altitudes)
  return "MEO";
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/celestrak/orbitClass.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/celestrak/orbitClass.ts __tests__/celestrak/orbitClass.test.ts
git commit -m "feat(satellites): add orbit class classifier with tests"
```

---

## Task 4: Constellation Detector (TDD)

**Files:**
- Create: `lib/celestrak/constellationDetect.ts`
- Create: `__tests__/celestrak/constellationDetect.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/celestrak/constellationDetect.test.ts
import { detectConstellation } from "@/lib/celestrak/constellationDetect";

describe("detectConstellation", () => {
  it("detects Starlink", () => {
    expect(detectConstellation("STARLINK-1234")).toBe("Starlink");
  });
  it("detects OneWeb", () => {
    expect(detectConstellation("ONEWEB-0100")).toBe("OneWeb");
  });
  it("detects GPS via GPS keyword", () => {
    expect(detectConstellation("GPS BIIR-2 (PRN 13)")).toBe("GPS");
  });
  it("detects GPS via NAVSTAR", () => {
    expect(detectConstellation("NAVSTAR 43 (PRN 13)")).toBe("GPS");
  });
  it("detects Galileo", () => {
    expect(detectConstellation("GALILEO-FOC FM3")).toBe("Galileo");
  });
  it("detects GLONASS", () => {
    expect(detectConstellation("GLONASS-M")).toBe("GLONASS");
  });
  it("detects ISS", () => {
    expect(detectConstellation("ISS (ZARYA)")).toBe("Space Station");
  });
  it("detects Tiangong", () => {
    expect(detectConstellation("TIANHE (CSS)")).toBe("Space Station");
  });
  it("detects NOAA weather sat", () => {
    expect(detectConstellation("NOAA 19")).toBe("Weather");
  });
  it("detects GOES weather sat", () => {
    expect(detectConstellation("GOES 16")).toBe("Weather");
  });
  it("detects Hubble", () => {
    expect(detectConstellation("HST (HUBBLE SPACE TELESCOPE)")).toBe("Science");
  });
  it("falls back to Other", () => {
    expect(detectConstellation("ASTRA 2E")).toBe("Other");
  });
  it("is case-insensitive", () => {
    expect(detectConstellation("starlink-9999")).toBe("Starlink");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/celestrak/constellationDetect.test.ts
```

Expected: `Cannot find module '@/lib/celestrak/constellationDetect'`

- [ ] **Step 3: Implement the detector**

```typescript
// lib/celestrak/constellationDetect.ts
import type { Constellation } from "./types";

export function detectConstellation(rawName: string): Constellation {
  const name = rawName.toUpperCase();

  if (name.startsWith("STARLINK"))                                      return "Starlink";
  if (name.startsWith("ONEWEB"))                                        return "OneWeb";
  if (name.includes("GPS") || name.includes("NAVSTAR"))                 return "GPS";
  if (name.startsWith("GALILEO"))                                       return "Galileo";
  if (name.startsWith("GLONASS"))                                       return "GLONASS";
  if (name.includes("ISS") || name.includes("TIANGONG") || name.includes("CSS")) return "Space Station";
  if (name.includes("NOAA") || name.includes("GOES") ||
      name.includes("METEOSAT") || name.includes("METEOR"))             return "Weather";
  if (name.includes("HUBBLE") || name.includes("CHANDRA"))              return "Science";
  return "Other";
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/celestrak/constellationDetect.test.ts
```

Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/celestrak/constellationDetect.ts __tests__/celestrak/constellationDetect.test.ts
git commit -m "feat(satellites): add constellation detector with tests"
```

---

## Task 5: GP Parser (TDD)

**Files:**
- Create: `lib/celestrak/gpParser.ts`
- Create: `__tests__/celestrak/gpParser.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/celestrak/gpParser.test.ts
import { parseGpResponse } from "@/lib/celestrak/gpParser";

// Minimal valid ISS-like GP record
const validRecord = {
  OBJECT_NAME: "ISS (ZARYA)",
  OBJECT_ID: "1998-067A",
  NORAD_CAT_ID: 25544,
  OBJECT_TYPE: "PAYLOAD",
  MEAN_MOTION: 15.49,
  ECCENTRICITY: 0.0004,
  INCLINATION: 51.6421,
  RA_OF_ASC_NODE: 45.2,
  ARG_OF_PERICENTER: 60.3,
  APOAPSIS: 423.0,
  PERIAPSIS: 418.0,
  COUNTRY_CODE: "ISS",
  LAUNCH_DATE: "1998-11-20",
  TLE_LINE1: "1 25544U 98067A   26081.25000000  .00006000  00000-0  11111-3 0  9990",
  TLE_LINE2: "2 25544  51.6421  45.2000 0004000  60.3000 300.0000 15.49000000999990",
};

describe("parseGpResponse", () => {
  it("normalises a valid record correctly", () => {
    const result = parseGpResponse([validRecord]);
    expect(result).toHaveLength(1);
    const sat = result[0];
    expect(sat.noradId).toBe(25544);
    expect(sat.name).toBe("ISS (ZARYA)");
    expect(sat.intlDesignator).toBe("1998-067A");
    expect(sat.launchYear).toBe(1998);
    expect(sat.orbitClass).toBe("LEO");
    expect(sat.constellation).toBe("Space Station");
    expect(sat.periodMin).toBeCloseTo(92.96, 1);
    expect(sat.raanDeg).toBe(45.2);
    expect(sat.argOfPericenterDeg).toBe(60.3);
  });

  it("filters records with missing TLE_LINE1", () => {
    const bad = { ...validRecord, TLE_LINE1: null };
    expect(parseGpResponse([bad])).toHaveLength(0);
  });

  it("filters records with TLE_LINE1 length != 69", () => {
    const bad = { ...validRecord, TLE_LINE1: "short" };
    expect(parseGpResponse([bad])).toHaveLength(0);
  });

  it("filters non-PAYLOAD object types", () => {
    const debris = { ...validRecord, OBJECT_TYPE: "DEBRIS" };
    expect(parseGpResponse([debris])).toHaveLength(0);
  });

  it("handles absent OBJECT_ID — launchYear = 0", () => {
    const no_id = { ...validRecord, OBJECT_ID: null };
    const result = parseGpResponse([no_id]);
    expect(result[0].launchYear).toBe(0);
  });

  it("handles absent COUNTRY_CODE — countryCode = ''", () => {
    const no_cc = { ...validRecord, COUNTRY_CODE: null };
    const result = parseGpResponse([no_cc]);
    expect(result[0].countryCode).toBe("");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/celestrak/gpParser.test.ts
```

Expected: `Cannot find module '@/lib/celestrak/gpParser'`

- [ ] **Step 3: Implement the parser**

```typescript
// lib/celestrak/gpParser.ts
import type { SatelliteObject } from "./types";
import { classifyOrbit } from "./orbitClass";
import { detectConstellation } from "./constellationDetect";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGpResponse(raw: any[]): SatelliteObject[] {
  const results: SatelliteObject[] = [];

  for (const r of raw) {
    // Only active payloads
    if (r.OBJECT_TYPE !== "PAYLOAD") continue;

    // TLE validation — both lines required, exactly 69 chars each
    const line1: string = r.TLE_LINE1 ?? "";
    const line2: string = r.TLE_LINE2 ?? "";
    if (line1.length !== 69 || line2.length !== 69) continue;

    const intlDesignator: string = r.OBJECT_ID ?? "";
    const launchYear = intlDesignator
      ? parseInt(intlDesignator.slice(0, 4), 10) || 0
      : 0;

    const meanMotion: number = r.MEAN_MOTION ?? 0;
    const periodMin = meanMotion > 0 ? 1440 / meanMotion : 0;

    const apogeeKm: number = r.APOAPSIS ?? 0;
    const perigeeKm: number = r.PERIAPSIS ?? 0;
    const eccentricity: number = r.ECCENTRICITY ?? 0;

    results.push({
      noradId: r.NORAD_CAT_ID,
      name: (r.OBJECT_NAME ?? "").trim(),
      intlDesignator,
      countryCode: r.COUNTRY_CODE ?? "",
      launchDate: r.LAUNCH_DATE ?? "",
      launchYear,
      orbitClass: classifyOrbit(apogeeKm, perigeeKm, eccentricity),
      apogeeKm,
      perigeeKm,
      inclinationDeg: r.INCLINATION ?? 0,
      periodMin,
      eccentricity,
      raanDeg: r.RA_OF_ASC_NODE ?? 0,
      argOfPericenterDeg: r.ARG_OF_PERICENTER ?? 0,
      constellation: detectConstellation(r.OBJECT_NAME ?? ""),
      tleLine1: line1,
      tleLine2: line2,
    });
  }

  return results;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/celestrak/gpParser.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/celestrak/gpParser.ts __tests__/celestrak/gpParser.test.ts
git commit -m "feat(satellites): add GP parser with TLE validation and tests"
```

---

## Task 6: Orbit Utils — ECI Frame (TDD)

**Files:**
- Create: `lib/celestrak/orbitUtils.ts`
- Create: `__tests__/celestrak/orbitUtils.test.ts`

**Important:** Do NOT modify `lib/nasa/orbitUtils.ts`. That function works in heliocentric ecliptic coordinates (for asteroids). This new file works in geocentric equatorial (ECI) coordinates (for satellites). The math is the same; the frame labelling differs.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/celestrak/orbitUtils.test.ts
import { computeOrbitPointsGeo } from "@/lib/celestrak/orbitUtils";

// ISS orbital elements (approximate)
const ISS_ELEMENTS = {
  a: 1.067,         // Earth radii (~6798 km / 6371 km)
  e: 0.0004,
  i: 51.6421,
  om: 45.2,
  w: 60.3,
};

describe("computeOrbitPointsGeo", () => {
  it("returns nPoints+1 points (closed ring)", () => {
    const pts = computeOrbitPointsGeo(ISS_ELEMENTS, 120);
    expect(pts).toHaveLength(121);
  });

  it("first point approximately equals last point (closed)", () => {
    const pts = computeOrbitPointsGeo(ISS_ELEMENTS, 120);
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(Math.abs(first.x - last.x)).toBeLessThan(1e-10);
    expect(Math.abs(first.y - last.y)).toBeLessThan(1e-10);
    expect(Math.abs(first.z - last.z)).toBeLessThan(1e-10);
  });

  it("all points are at approximately the right distance from origin for circular orbit", () => {
    // For a near-circular orbit (e≈0), all points should be ≈ a from origin
    const circular = { a: 1.067, e: 0.0001, i: 51.6, om: 0, w: 0 };
    const pts = computeOrbitPointsGeo(circular, 60);
    for (const p of pts) {
      const r = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
      expect(r).toBeCloseTo(1.067, 3);
    }
  });

  it("semi-major axis from MEAN_MOTION=15.49 is approximately 1.067 ER", () => {
    const MU = 398600.4418;          // km³/s²
    const EARTH_RADIUS_KM = 6371;
    const meanMotion = 15.49;        // rev/day
    const periodSec = (1440 / meanMotion) * 60;
    const a_km = (MU * (periodSec / (2 * Math.PI)) ** 2) ** (1 / 3);
    const a_ER = a_km / EARTH_RADIUS_KM;
    expect(a_ER).toBeCloseTo(1.067, 2);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/celestrak/orbitUtils.test.ts
```

Expected: `Cannot find module '@/lib/celestrak/orbitUtils'`

- [ ] **Step 3: Implement `computeOrbitPointsGeo`**

```typescript
// lib/celestrak/orbitUtils.ts
import type { SatelliteOrbitalElements } from "./types";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Computes nPoints+1 positions along a Keplerian orbit in geocentric
 * equatorial (ECI) J2000 coordinates (Earth radii). The last point
 * equals the first, producing a closed ring for THREE.js BufferGeometry.
 *
 * Input elements must be in the ECI frame (as provided by CelesTrak GP data):
 *   a  — semi-major axis in Earth radii
 *   e  — eccentricity
 *   i  — inclination (degrees)
 *   om — RAAN, right ascension of ascending node (degrees)
 *   w  — argument of pericenter (degrees)
 *
 * This is NOT the same as lib/nasa/orbitUtils.ts, which uses heliocentric
 * ecliptic coordinates for asteroid orbits. Do not merge these files.
 */
export function computeOrbitPointsGeo(
  elements: SatelliteOrbitalElements,
  nPoints = 120
): Array<{ x: number; y: number; z: number }> {
  const { a, e, i, om, w } = elements;

  const iRad  = i  * DEG_TO_RAD;
  const omRad = om * DEG_TO_RAD;
  const wRad  = w  * DEG_TO_RAD;

  const cosOm = Math.cos(omRad), sinOm = Math.sin(omRad);
  const cosI  = Math.cos(iRad),  sinI  = Math.sin(iRad);
  const cosW  = Math.cos(wRad),  sinW  = Math.sin(wRad);

  // P and Q unit vectors — rotate orbital plane into ECI frame
  const Px =  cosOm * cosW - sinOm * sinW * cosI;
  const Py =  sinOm * cosW + cosOm * sinW * cosI;
  const Pz =  sinW * sinI;

  const Qx = -cosOm * sinW - sinOm * cosW * cosI;
  const Qy = -sinOm * sinW + cosOm * cosW * cosI;
  const Qz =  cosW * sinI;

  const semiLatus = a * (1 - e * e);
  const points: Array<{ x: number; y: number; z: number }> = [];

  for (let k = 0; k <= nPoints; k++) {
    const theta = (2 * Math.PI * k) / nPoints;
    const r = semiLatus / (1 + e * Math.cos(theta));
    const X = r * Math.cos(theta);
    const Y = r * Math.sin(theta);
    points.push({
      x: Px * X + Qx * Y,
      y: Py * X + Qy * Y,
      z: Pz * X + Qz * Y,
    });
  }

  return points;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/celestrak/orbitUtils.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/celestrak/orbitUtils.ts __tests__/celestrak/orbitUtils.test.ts
git commit -m "feat(satellites): add ECI orbit utils with tests"
```

---

## Task 7: API Route

**Files:**
- Create: `app/api/satellites/route.ts`

- [ ] **Step 1: Implement the route**

```typescript
// app/api/satellites/route.ts
import { NextResponse } from "next/server";
import { parseGpResponse } from "@/lib/celestrak/gpParser";
import type { SatelliteResponse } from "@/lib/celestrak/types";

const GP_URL = "https://celestrak.org/gp.php?GROUP=active&FORMAT=json";
const TIMEOUT_MS = 10_000;

// Node.js runtime (NOT edge) — response can be 3-4 MB, edge limit is 4 MB
export const revalidate = 3600; // 1 hour

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(GP_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[satellites] CelesTrak error ${res.status}:`, text);
      return NextResponse.json(
        { error: `CelesTrak API error: ${res.status}` },
        { status: 503 }
      );
    }

    const raw = await res.json();

    if (!Array.isArray(raw)) {
      console.error("[satellites] CelesTrak returned unexpected shape");
      return NextResponse.json(
        { error: "CelesTrak returned unexpected shape" },
        { status: 503 }
      );
    }

    const objects = parseGpResponse(raw);

    const body: SatelliteResponse = {
      count: objects.length,
      revalidatedAt: new Date().toISOString(),
      objects,
    };

    return NextResponse.json(body);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "CelesTrak timeout" }, { status: 503 });
    }
    console.error("[satellites] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/satellites/route.ts
git commit -m "feat(satellites): add CelesTrak GP API route with 1-hour ISR"
```

---

## Task 8: Site Navigation

**Files:**
- Create: `components/layout/SiteNav.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create SiteNav**

```tsx
// components/layout/SiteNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/",           label: "☄ Asteroids" },
    { href: "/satellites", label: "🛰 Satellites" },
  ];

  return (
    <nav className="flex border-b border-space-600 bg-space-950">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={[
              "px-5 py-2 text-xs font-mono uppercase tracking-widest border-r border-space-700 transition-colors",
              active
                ? "bg-space-800 text-neo-accent border-b-2 border-b-neo-accent"
                : "text-slate-500 hover:text-slate-300 hover:bg-space-900",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Add SiteNav to layout**

In `app/layout.tsx`, add `<SiteNav />` as the first child of `<body>`:

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteNav } from "@/components/layout/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEO-Guardian | Asteroid Proximity & Risk Dashboard",
  description:
    "Real-time Near-Earth Object tracking with custom Impact Hazard Scoring. Data powered by NASA's Small-Body Database.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEO-Guardian",
  },
};

export const viewport: Viewport = {
  themeColor: "#38bdf8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-space-950 text-slate-200 font-sans antialiased min-h-screen">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Start dev server and verify tabs appear**

```bash
npm run dev
```

Open http://localhost:3000. Confirm the two tabs appear at the top. The Satellites tab will 404 (page not created yet) — that's expected.

- [ ] **Step 5: Commit**

```bash
git add components/layout/SiteNav.tsx app/layout.tsx
git commit -m "feat(satellites): add site navigation tabs"
```

---

## Task 9: Satellites Page Skeleton

**Files:**
- Create: `app/satellites/page.tsx`
- Create: `components/satellites/SatelliteDashboardClientWrapper.tsx`
- Create: `components/satellites/SatelliteDashboardClient.tsx` (stub)
- Create: `components/satellites/SatelliteTopBar.tsx`

- [ ] **Step 1: Create the client wrapper (same pattern as DashboardClientWrapper)**

```tsx
// components/satellites/SatelliteDashboardClientWrapper.tsx
"use client";

import dynamic from "next/dynamic";
import type { SatelliteObject } from "@/lib/celestrak/types";

const SatelliteDashboardClient = dynamic(
  () =>
    import("@/components/satellites/SatelliteDashboardClient").then(
      (m) => m.SatelliteDashboardClient
    ),
  { ssr: false }
);

interface Props {
  initialObjects: SatelliteObject[];
}

export function SatelliteDashboardClientWrapper({ initialObjects }: Props) {
  return <SatelliteDashboardClient initialObjects={initialObjects} />;
}
```

- [ ] **Step 2: Create a stub SatelliteDashboardClient**

```tsx
// components/satellites/SatelliteDashboardClient.tsx
"use client";

import type { SatelliteObject } from "@/lib/celestrak/types";

interface Props {
  initialObjects: SatelliteObject[];
}

export function SatelliteDashboardClient({ initialObjects }: Props) {
  return (
    <div className="p-6 font-mono text-slate-400">
      Satellites loaded: {initialObjects.length}
    </div>
  );
}
```

- [ ] **Step 3: Create SatelliteTopBar**

```tsx
// components/satellites/SatelliteTopBar.tsx
import { Satellite, Globe, Layers, Zap } from "lucide-react";
import { StatCard } from "@/components/cards/StatCard";
import type { SatelliteObject } from "@/lib/celestrak/types";

interface Props {
  objects: SatelliteObject[];
  revalidatedAt: string;
}

export function SatelliteTopBar({ objects, revalidatedAt }: Props) {
  const leoCount = objects.filter((o) => o.orbitClass === "LEO").length;
  const countryCount = new Set(objects.map((o) => o.countryCode).filter(Boolean)).size;
  const starlinkCount = objects.filter((o) => o.constellation === "Starlink").length;
  const starlinkPct = objects.length ? Math.round((starlinkCount / objects.length) * 100) : 0;

  return (
    <header className="border-b border-space-600 bg-space-900">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-space-700">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Satellite className="text-neo-accent shrink-0" size={24} />
            <span className="font-mono font-bold text-lg tracking-widest text-neo-accent uppercase">
              Satellite Tracker
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block">
            CelesTrak active payloads · Updates every hour
          </p>
        </div>
        <span className="hidden sm:block text-xs font-mono text-slate-500">
          Updated: {new Date(revalidatedAt).toUTCString()}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 py-3 sm:py-4">
        <StatCard label="Active Satellites" value={objects.length} sub="Active payloads only" icon={Satellite} />
        <StatCard label="Countries" value={countryCount} sub="with active assets" icon={Globe} />
        <StatCard
          label="LEO Satellites"
          value={leoCount}
          sub={`${objects.length ? Math.round((leoCount / objects.length) * 100) : 0}% of total — below 2,000 km`}
          icon={Layers}
          iconColor="text-neo-watchlist"
        />
        <StatCard
          label="Starlink Share"
          value={`${starlinkPct}%`}
          sub={`${starlinkCount} satellites — SpaceX`}
          icon={Zap}
          iconColor="text-neo-critical"
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create the page**

```tsx
// app/satellites/page.tsx
import { SatelliteTopBar } from "@/components/satellites/SatelliteTopBar";
import { SatelliteDashboardClientWrapper } from "@/components/satellites/SatelliteDashboardClientWrapper";
import type { SatelliteResponse } from "@/lib/celestrak/types";

export const revalidate = 3600;

async function getData(): Promise<SatelliteResponse> {
  const { GET } = await import("@/app/api/satellites/route");
  const response = await GET();
  if (!response.ok) throw new Error("Failed to fetch satellites");
  return response.json();
}

export default async function SatellitesPage() {
  const data = await getData();

  return (
    <div className="min-h-screen flex flex-col">
      <SatelliteTopBar objects={data.objects} revalidatedAt={data.revalidatedAt} />
      <SatelliteDashboardClientWrapper initialObjects={data.objects} />
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Dev server smoke test**

```bash
npm run dev
```

Navigate to http://localhost:3000/satellites. Confirm:
- SiteNav shows "🛰 Satellites" as active
- KPI cards appear with satellite counts
- Stub text shows satellite count (may be 0 if CelesTrak is unreachable in dev — that's OK)

- [ ] **Step 7: Commit**

```bash
git add app/satellites/page.tsx components/satellites/SatelliteDashboardClientWrapper.tsx components/satellites/SatelliteDashboardClient.tsx components/satellites/SatelliteTopBar.tsx
git commit -m "feat(satellites): add page skeleton, TopBar, and client wrapper"
```

---

## Task 10: Satellite Sidebar

**Files:**
- Create: `components/satellites/SatelliteSidebar.tsx`

- [ ] **Step 1: Implement SatelliteSidebar**

```tsx
// components/satellites/SatelliteSidebar.tsx
import type { SatelliteObject, Constellation, OrbitClass } from "@/lib/celestrak/types";

export interface SatelliteFilterState {
  search: string;
  constellations: Set<Constellation>;  // empty = show all
  orbitClasses: Set<OrbitClass>;        // empty = show all
}

export const DEFAULT_SATELLITE_FILTERS: SatelliteFilterState = {
  search: "",
  constellations: new Set(),
  orbitClasses: new Set(),
};

interface Props {
  filters: SatelliteFilterState;
  onChange: (f: SatelliteFilterState) => void;
  allObjects: SatelliteObject[];
  onClose?: () => void;
}

const CONSTELLATION_COLORS: Record<Constellation, string> = {
  Starlink: "#0ea5e9",
  OneWeb: "#a78bfa",
  GPS: "#22c55e",
  Galileo: "#f59e0b",
  GLONASS: "#ef4444",
  "Space Station": "#ec4899",
  Weather: "#06b6d4",
  Science: "#8b5cf6",
  Other: "#475569",
};

const ORBIT_CLASS_COLORS: Record<OrbitClass, string> = {
  LEO: "#38bdf8",
  MEO: "#f59e0b",
  GEO: "#22c55e",
  HEO: "#a78bfa",
};

const CONSTELLATIONS: Constellation[] = [
  "Starlink", "OneWeb", "GPS", "Galileo", "GLONASS",
  "Space Station", "Weather", "Science", "Other",
];
const ORBIT_CLASSES: OrbitClass[] = ["LEO", "MEO", "GEO", "HEO"];

export function SatelliteSidebar({ filters, onChange, allObjects, onClose }: Props) {
  const countFor = (c: Constellation) => allObjects.filter((o) => o.constellation === c).length;
  const countOrbit = (o: OrbitClass) => allObjects.filter((s) => s.orbitClass === o).length;

  const toggleConstellation = (c: Constellation) => {
    const next = new Set(filters.constellations);
    next.has(c) ? next.delete(c) : next.add(c);
    onChange({ ...filters, constellations: next });
  };

  const toggleOrbit = (o: OrbitClass) => {
    const next = new Set(filters.orbitClasses);
    next.has(o) ? next.delete(o) : next.add(o);
    onChange({ ...filters, orbitClasses: next });
  };

  const clearAll = () => onChange(DEFAULT_SATELLITE_FILTERS);

  return (
    <aside className="w-52 shrink-0 bg-space-900 border-r border-space-700 flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-space-700 flex items-center justify-between">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Filters</span>
        <button onClick={clearAll} className="text-xs text-slate-500 hover:text-neo-accent font-mono">
          Clear all
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-space-700">
        <input
          type="text"
          placeholder="Search name / NORAD ID…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full bg-space-800 border border-space-600 text-slate-300 placeholder-slate-600 font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-neo-accent"
        />
      </div>

      {/* Constellations */}
      <div className="p-3 border-b border-space-700">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Constellation</p>
        {CONSTELLATIONS.map((c) => {
          const active = filters.constellations.has(c);
          return (
            <button
              key={c}
              onClick={() => toggleConstellation(c)}
              className={`w-full flex items-center gap-2 px-2 py-1 text-left rounded transition-colors ${active ? "bg-space-800" : "hover:bg-space-800/50"}`}
            >
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: CONSTELLATION_COLORS[c] }}
              />
              <span className={`flex-1 text-xs font-mono ${active ? "text-white" : "text-slate-400"}`}>{c}</span>
              <span className="text-xs text-slate-600 font-mono">{countFor(c)}</span>
            </button>
          );
        })}
      </div>

      {/* Orbit class */}
      <div className="p-3">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Orbit Class</p>
        {ORBIT_CLASSES.map((o) => {
          const active = filters.orbitClasses.has(o);
          return (
            <button
              key={o}
              onClick={() => toggleOrbit(o)}
              className={`w-full flex items-center gap-2 px-2 py-1 text-left rounded transition-colors ${active ? "bg-space-800" : "hover:bg-space-800/50"}`}
            >
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: ORBIT_CLASS_COLORS[o] }}
              />
              <span className={`flex-1 text-xs font-mono ${active ? "text-white" : "text-slate-400"}`}>{o}</span>
              <span className="text-xs text-slate-600 font-mono">{countOrbit(o)}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/satellites/SatelliteSidebar.tsx
git commit -m "feat(satellites): add sidebar with search and filter controls"
```

---

## Task 11: Satellite Globe

**Files:**
- Create: `components/satellites/SatelliteGlobe.tsx`

This is the most complex component. It does three distinct things:
1. Renders colored dots for all visible satellites
2. When a satellite is selected, draws its orbit ring as a THREE.js Line
3. When a satellite is selected, starts a 2-second interval that propagates its TLE and updates the live dot position

- [ ] **Step 1: Implement SatelliteGlobe**

```tsx
// components/satellites/SatelliteGlobe.tsx
"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
} from "satellite.js";
import type { SatelliteObject, OrbitClass } from "@/lib/celestrak/types";
import { computeOrbitPointsGeo } from "@/lib/celestrak/orbitUtils";

interface Props {
  objects: SatelliteObject[];
  selectedNoradId: number | null;
  onSelectNoradId: (id: number | null) => void;
  onLivePosition?: (lat: number, lng: number) => void; // fired every 2 s — drives detail panel
  width?: number;
  height?: number;
}

interface GlobeInstance {
  pointOfView: (pov: { lat: number; lng: number; altitude: number }, ms: number) => void;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
  scene: () => THREE.Scene;
}

interface GlobePoint {
  noradId: number;
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
}

const ORBIT_CLASS_COLOR: Record<OrbitClass, string> = {
  LEO: "#38bdf8",
  MEO: "#f59e0b",
  GEO: "#22c55e",
  HEO: "#a78bfa",
};

// react-globe.gl renders its Earth sphere at radius 100 THREE.js units
const GLOBE_ER_SCALE = 100; // 1 Earth radius = 100 THREE.js units
const EARTH_RADIUS_KM = 6371;
const MU_KM3_S2 = 398600.4418;

function deriveOrbitalElements(sat: SatelliteObject) {
  const T = sat.periodMin * 60; // seconds
  const a_km = (MU_KM3_S2 * (T / (2 * Math.PI)) ** 2) ** (1 / 3);
  const a_ER = a_km / EARTH_RADIUS_KM;
  return {
    a: a_ER,
    e: sat.eccentricity,
    i: sat.inclinationDeg,
    om: sat.raanDeg,
    w: sat.argOfPericenterDeg,
  };
}

export function SatelliteGlobe({
  objects,
  selectedNoradId,
  onSelectNoradId,
  onLivePosition,
  width = 480,
  height = 480,
}: Props) {
  const globeEl = useRef<GlobeInstance | null>(null);
  const orbitMeshRef = useRef<THREE.Line | null>(null);
  const liveDotRef = useRef<THREE.Mesh | null>(null);

  // Initial camera position
  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    g.pointOfView({ lat: 15, lng: 30, altitude: 2.5 }, 0);
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.3;
  }, []);

  // Orbit ring + live position animation
  useEffect(() => {
    const globe = globeEl.current;

    function removeOrbit() {
      if (orbitMeshRef.current && globe) {
        globe.scene().remove(orbitMeshRef.current);
        orbitMeshRef.current.geometry.dispose();
        const mat = orbitMeshRef.current.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
        orbitMeshRef.current = null;
      }
      if (liveDotRef.current && globe) {
        globe.scene().remove(liveDotRef.current);
        (liveDotRef.current.geometry as THREE.BufferGeometry).dispose();
        (liveDotRef.current.material as THREE.Material).dispose();
        liveDotRef.current = null;
      }
    }

    removeOrbit();

    const sat = selectedNoradId
      ? objects.find((o) => o.noradId === selectedNoradId) ?? null
      : null;

    if (!sat || !globe) return removeOrbit;

    // Draw static orbit ring
    const elements = deriveOrbitalElements(sat);
    const pts = computeOrbitPointsGeo(elements, 180);
    const positions = new Float32Array(pts.length * 3);
    pts.forEach(({ x, y, z }, idx) => {
      // THREE.js axis swap: x→x, y→z, z→-y (Y-up ECI to Y-up globe frame)
      positions[idx * 3]     = x * GLOBE_ER_SCALE;
      positions[idx * 3 + 1] = z * GLOBE_ER_SCALE;
      positions[idx * 3 + 2] = -y * GLOBE_ER_SCALE;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const ringColor = ORBIT_CLASS_COLOR[sat.orbitClass] ?? "#94a3b8";
    const mat = new THREE.LineBasicMaterial({ color: ringColor, linewidth: 1.5 });
    const orbitLine = new THREE.Line(geo, mat);
    orbitMeshRef.current = orbitLine;
    globe.scene().add(orbitLine);

    // Live position dot
    const dotGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: ringColor });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    liveDotRef.current = dot;
    globe.scene().add(dot);

    // TLE propagation — satrec created once per selection
    let satrec: ReturnType<typeof twoline2satrec> | null = null;
    try {
      satrec = twoline2satrec(sat.tleLine1, sat.tleLine2);
    } catch {
      satrec = null;
    }

    function updateLivePosition() {
      if (!satrec || !liveDotRef.current) return;
      const now = new Date();
      const posVel = propagate(satrec, now);
      const gmst = gstime(now);
      if (!posVel || posVel.position === false) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geo = eciToGeodetic(posVel.position as any, gmst);
      const latRad = geo.latitude;
      const lngRad = geo.longitude;
      const altKm = geo.height;

      // Convert geodetic to THREE.js Cartesian (same axis convention as orbit ring)
      const altER = 1 + altKm / EARTH_RADIUS_KM; // altitude in Earth radii from center
      const cosLat = Math.cos(latRad);
      const x_eci = altER * cosLat * Math.cos(lngRad);
      const y_eci = altER * cosLat * Math.sin(lngRad);
      const z_eci = altER * Math.sin(latRad);

      liveDotRef.current.position.set(
        x_eci * GLOBE_ER_SCALE,
        z_eci * GLOBE_ER_SCALE,
        -y_eci * GLOBE_ER_SCALE
      );

      // Notify parent so detail panel shows same position (single source of truth)
      onLivePosition?.(latRad * (180 / Math.PI), lngRad * (180 / Math.PI));
    }

    updateLivePosition();
    const interval = setInterval(updateLivePosition, 2000);

    return () => {
      clearInterval(interval);
      removeOrbit();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoradId]);

  // Compute page-load positions once — propagate every satellite to now at mount
  const initPositions = useMemo(() => {
    const now = new Date();
    const gmst = gstime(now);
    const map = new Map<number, { lat: number; lng: number }>();
    for (const o of objects) {
      try {
        const rec = twoline2satrec(o.tleLine1, o.tleLine2);
        const posVel = propagate(rec, now);
        if (!posVel || posVel.position === false) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geo = eciToGeodetic(posVel.position as any, gmst);
        map.set(o.noradId, {
          lat: (geo.latitude * 180) / Math.PI,
          lng: (geo.longitude * 180) / Math.PI,
        });
      } catch {
        // skip satellites with bad TLEs
      }
    }
    return map;
  }, [objects]); // recompute only when objects change (not on selection)

  // Satellite dots — color by orbit class
  const points: GlobePoint[] = useMemo(
    () =>
      objects.map((o) => {
        const pos = initPositions.get(o.noradId);
        return {
          noradId: o.noradId,
          lat: pos?.lat ?? 0,
          lng: pos?.lng ?? 0,
          size: o.noradId === selectedNoradId ? 0.6 : 0.2,
          color: ORBIT_CLASS_COLOR[o.orbitClass],
          label: `${o.name} (${o.orbitClass})`,
        };
      }),
    [objects, selectedNoradId, initPositions]
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as GlobePoint;
      onSelectNoradId(p.noradId === selectedNoradId ? null : p.noradId);
    },
    [selectedNoradId, onSelectNoradId]
  );

  return (
    <Globe
      ref={globeEl}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.12}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={0.01}
      pointRadius="size"
      pointColor="color"
      pointLabel="label"
      onPointClick={handlePointClick}
    />
  );
}
```

**Note on dot positions:** Satellite dots are placed at their page-load SGP4 position (computed once at mount in `initPositions`). Satellites with invalid TLEs fall back to 0,0. The selected satellite's dot additionally animates live via the THREE.js sphere updated every 2 s.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/satellites/SatelliteGlobe.tsx
git commit -m "feat(satellites): add SatelliteGlobe with orbit ring and live position"
```

---

## Task 12: Satellite Detail Panel

**Files:**
- Create: `components/satellites/SatelliteDetailPanel.tsx`

- [ ] **Step 1: Implement SatelliteDetailPanel**

```tsx
// components/satellites/SatelliteDetailPanel.tsx
"use client";

import { X } from "lucide-react";
import type { SatelliteObject } from "@/lib/celestrak/types";

interface Props {
  satellite: SatelliteObject;
  onClose: () => void;
  /** Live lat/lng fed from SatelliteGlobe's single SGP4 interval — avoids duplicate propagation */
  liveLatLng: { lat: number; lng: number } | null;
}

const ORBIT_CLASS_COLORS = {
  LEO: "text-neo-accent",
  MEO: "text-neo-watchlist",
  GEO: "text-neo-safe",
  HEO: "text-purple-400",
};

export function SatelliteDetailPanel({ satellite: sat, onClose, liveLatLng }: Props) {
  // Format live position for display
  const position = liveLatLng
    ? {
        lat: `${Math.abs(liveLatLng.lat).toFixed(2)}° ${liveLatLng.lat >= 0 ? "N" : "S"}`,
        lng: `${Math.abs(liveLatLng.lng).toFixed(2)}° ${liveLatLng.lng >= 0 ? "E" : "W"}`,
      }
    : null;

  // Orbital speed estimate: v ≈ √(μ/a) for circular orbit
  const MU = 398600.4418;
  const T = sat.periodMin * 60;
  const a_km = (MU * (T / (2 * Math.PI)) ** 2) ** (1 / 3);
  const speedKmS = Math.sqrt(MU / a_km);

  return (
    <div className="bg-space-800 border border-neo-accent/40 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-mono text-white leading-snug">{sat.name}</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5">{sat.intlDesignator}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          aria-label="Deselect satellite"
        >
          <X size={14} />
        </button>
      </div>

      <dl className="space-y-1.5 text-xs font-mono">
        <Row label="NORAD ID" value={sat.noradId.toString()} accent />
        <Row label="Orbit class" value={sat.orbitClass} className={ORBIT_CLASS_COLORS[sat.orbitClass]} />
        <Row label="Constellation" value={sat.constellation} />
        <Row label="Country" value={sat.countryCode || "—"} />
        <Row label="Launched" value={sat.launchDate || sat.launchYear.toString() || "—"} />
        <Row label="Altitude" value={`${sat.perigeeKm.toFixed(0)}–${sat.apogeeKm.toFixed(0)} km`} />
        <Row label="Inclination" value={`${sat.inclinationDeg.toFixed(2)}°`} />
        <Row label="Period" value={`${sat.periodMin.toFixed(1)} min`} />
        <Row label="Speed" value={`${speedKmS.toFixed(2)} km/s`} />
      </dl>

      {position && (
        <div className="mt-3 p-2 bg-space-900/60 rounded border border-space-600">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Live position</p>
          <p className="text-xs font-mono text-neo-accent">
            {position.lat} / {position.lng}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">updates every 2 s</p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={[className ?? (accent ? "text-neo-accent" : "text-slate-300"), "text-right"].join(" ")}>
        {value}
      </dd>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/satellites/SatelliteDetailPanel.tsx
git commit -m "feat(satellites): add satellite detail panel with live position"
```

---

## Task 13: Analytics Charts

**Files:**
- Create: `components/satellites/OrbitClassDonut.tsx`
- Create: `components/satellites/LaunchTimeline.tsx`
- Create: `components/satellites/ConstellationBar.tsx`

- [ ] **Step 1: OrbitClassDonut**

```tsx
// components/satellites/OrbitClassDonut.tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { SatelliteObject, OrbitClass } from "@/lib/celestrak/types";

const COLORS: Record<OrbitClass, string> = {
  LEO: "#38bdf8",
  GEO: "#22c55e",
  MEO: "#f59e0b",
  HEO: "#a78bfa",
};

interface Props { objects: SatelliteObject[] }

export function OrbitClassDonut({ objects }: Props) {
  const counts: Record<OrbitClass, number> = { LEO: 0, GEO: 0, MEO: 0, HEO: 0 };
  for (const o of objects) counts[o.orbitClass]++;

  const data = (["LEO", "GEO", "MEO", "HEO"] as OrbitClass[])
    .filter((k) => counts[k] > 0)
    .map((k) => ({ name: k, value: counts[k] }));

  const total = objects.length;
  const dominant = data[0];

  return (
    <div className="bg-space-900 border border-space-700 rounded-xl p-4">
      <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
        Orbit Class Distribution
      </h2>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" strokeWidth={0}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name as OrbitClass]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11, fontFamily: "monospace" }}
                formatter={(v: number) => [`${v} (${total ? Math.round((v / total) * 100) : 0}%)`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          {dominant && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-mono font-bold text-white">
                {total ? Math.round((dominant.value / total) * 100) : 0}%
              </span>
              <span className="text-xs font-mono text-slate-500">{dominant.name}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-sm" style={{ background: COLORS[entry.name as OrbitClass] }} />
              <span className="text-slate-400 w-8">{entry.name}</span>
              <span className="text-slate-300">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: LaunchTimeline**

```tsx
// components/satellites/LaunchTimeline.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SatelliteObject } from "@/lib/celestrak/types";

interface Props { objects: SatelliteObject[] }

export function LaunchTimeline({ objects }: Props) {
  const byYear: Record<number, number> = {};
  for (const o of objects) {
    if (o.launchYear > 0) byYear[o.launchYear] = (byYear[o.launchYear] ?? 0) + 1;
  }
  const data = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, count]) => ({ year: Number(year), count }));

  return (
    <div className="bg-space-900 border border-space-700 rounded-xl p-4">
      <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
        Launches Per Year
      </h2>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} barCategoryGap={1}>
          <XAxis
            dataKey="year"
            tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v % 5 === 0 ? String(v) : "")}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11, fontFamily: "monospace" }}
            labelFormatter={(v) => `Year: ${v}`}
            formatter={(v: number) => [v, "launches"]}
          />
          <Bar dataKey="count" radius={[1, 1, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.year}
                fill={entry.year >= 2019 ? "#0ea5e9" : "#1e3a5f"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs font-mono text-slate-600 mt-1">
        <span className="inline-block w-2 h-2 bg-sky-500 mr-1 rounded-sm" />
        Blue = Starlink era (2019+)
      </p>
    </div>
  );
}
```

- [ ] **Step 3: ConstellationBar**

```tsx
// components/satellites/ConstellationBar.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SatelliteObject, Constellation } from "@/lib/celestrak/types";

const COLORS: Partial<Record<Constellation, string>> = {
  Starlink: "#0ea5e9",
  OneWeb: "#a78bfa",
  GPS: "#22c55e",
  Galileo: "#f59e0b",
  GLONASS: "#ef4444",
  "Space Station": "#ec4899",
  Weather: "#06b6d4",
  Science: "#8b5cf6",
  Other: "#475569",
};

interface Props { objects: SatelliteObject[] }

export function ConstellationBar({ objects }: Props) {
  const counts: Partial<Record<Constellation, number>> = {};
  for (const o of objects) counts[o.constellation] = (counts[o.constellation] ?? 0) + 1;

  const data = Object.entries(counts)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return (
    <div className="bg-space-900 border border-space-700 rounded-xl p-4">
      <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
        Top Constellations
      </h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11, fontFamily: "monospace" }}
            formatter={(v: number) => [v.toLocaleString(), "satellites"]}
          />
          <Bar dataKey="count" radius={[0, 2, 2, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name as Constellation] ?? "#475569"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/satellites/OrbitClassDonut.tsx components/satellites/LaunchTimeline.tsx components/satellites/ConstellationBar.tsx
git commit -m "feat(satellites): add analytics charts (donut, timeline, constellation bar)"
```

---

## Task 14: Wire Up SatelliteDashboardClient

**Files:**
- Modify: `components/satellites/SatelliteDashboardClient.tsx`

Replace the stub from Task 9 with the full implementation.

- [ ] **Step 1: Implement the full client**

```tsx
// components/satellites/SatelliteDashboardClient.tsx
"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { SatelliteObject } from "@/lib/celestrak/types";
import {
  SatelliteSidebar,
  DEFAULT_SATELLITE_FILTERS,
  type SatelliteFilterState,
} from "@/components/satellites/SatelliteSidebar";
import { SatelliteDetailPanel } from "@/components/satellites/SatelliteDetailPanel";
import { OrbitClassDonut } from "@/components/satellites/OrbitClassDonut";
import { LaunchTimeline } from "@/components/satellites/LaunchTimeline";
import { ConstellationBar } from "@/components/satellites/ConstellationBar";

const SatelliteGlobe = dynamic(
  () => import("@/components/satellites/SatelliteGlobe").then((m) => m.SatelliteGlobe),
  { ssr: false, loading: () => <GlobePlaceholder /> }
);

function GlobePlaceholder() {
  return (
    <div className="w-full flex items-center justify-center h-[480px]">
      <div className="w-48 h-48 rounded-full bg-space-800 border border-space-600 animate-pulse" />
    </div>
  );
}

interface Props {
  initialObjects: SatelliteObject[];
}

export function SatelliteDashboardClient({ initialObjects }: Props) {
  const [filters, setFilters] = useState<SatelliteFilterState>(DEFAULT_SATELLITE_FILTERS);
  const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null);
  // Single source of truth for live position — fed by SatelliteGlobe's SGP4 interval
  const [liveLatLng, setLiveLatLng] = useState<{ lat: number; lng: number } | null>(null);

  const filtered = useMemo(() => {
    let result = initialObjects;

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        (o) => o.name.toLowerCase().includes(q) || o.noradId.toString().includes(q)
      );
    }
    if (filters.constellations.size > 0) {
      result = result.filter((o) => filters.constellations.has(o.constellation));
    }
    if (filters.orbitClasses.size > 0) {
      result = result.filter((o) => filters.orbitClasses.has(o.orbitClass));
    }

    return result;
  }, [initialObjects, filters]);

  const selected = selectedNoradId
    ? filtered.find((o) => o.noradId === selectedNoradId) ?? null
    : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <SatelliteSidebar
        filters={filters}
        onChange={setFilters}
        allObjects={initialObjects}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Globe + charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Globe — takes 2/3 width on large screens */}
          <section className="lg:col-span-2 bg-space-900 border border-space-700 rounded-xl p-4">
            <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">
              Live Orbital Positions
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Dots are color-coded by orbit class. Select a satellite to see its orbit ring
              and live position (updated every 2 s via TLE propagation).
            </p>
            <SatelliteGlobe
              objects={filtered}
              selectedNoradId={selectedNoradId}
              onSelectNoradId={(id) => {
                setSelectedNoradId(id);
                if (id === null) setLiveLatLng(null); // clear when deselected
              }}
              onLivePosition={(lat, lng) => setLiveLatLng({ lat, lng })}
              width={600}
              height={480}
            />
          </section>

          {/* Charts column */}
          <div className="flex flex-col gap-4">
            <OrbitClassDonut objects={initialObjects} />
            <LaunchTimeline objects={initialObjects} />
          </div>
        </div>

        {/* Bottom row: constellation bar + detail panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ConstellationBar objects={initialObjects} />
          </div>
          <div>
            {selected ? (
              <SatelliteDetailPanel
                satellite={selected}
                onClose={() => { setSelectedNoradId(null); setLiveLatLng(null); }}
                liveLatLng={liveLatLng}
              />
            ) : (
              <div className="bg-space-900 border border-space-700 rounded-xl p-4 flex items-center justify-center h-full min-h-[120px]">
                <p className="text-xs font-mono text-slate-600 text-center">
                  Select a satellite on the globe to see details and live position.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Filter summary */}
        <p className="text-xs font-mono text-slate-600">
          Showing {filtered.length.toLocaleString()} of {initialObjects.length.toLocaleString()} active satellites
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Full dev server test**

```bash
npm run dev
```

Open http://localhost:3000/satellites. Verify:
1. Navigation tabs work — both pages load
2. KPI cards show correct counts
3. Globe renders (blue-marble texture, dots)
4. Sidebar filters update the satellite count
5. Search filters by name
6. Donut, timeline, and bar charts render with data
7. Click any point on the globe → detail panel appears with live position updating
8. Press the X in the detail panel → deselects satellite

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Production build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add components/satellites/SatelliteDashboardClient.tsx
git commit -m "feat(satellites): wire up full dashboard — globe, charts, sidebar, detail panel"
```

---

## Done

The satellites dashboard is complete. All tests pass, build succeeds, and the page is live at `/satellites`.
