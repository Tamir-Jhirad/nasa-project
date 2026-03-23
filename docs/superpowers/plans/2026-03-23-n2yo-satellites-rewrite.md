# N2YO Satellites Dashboard Rewrite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken CelesTrak TLE pipeline with N2YO's `/above` API endpoint so the satellites dashboard shows real live data, and delete all TLE-parsing infrastructure that is no longer needed.

**Architecture:** The main route calls N2YO's `/above` endpoint twice (two opposite hemispheres) to get global satellite coverage with real-time lat/lng and altitude. Orbit classification derives from current altitude. When a user selects a satellite, the client fetches its TLE on-demand from a new `tle/[noradId]` route and uses satellite.js SGP4 propagation only for that one satellite's orbit ring and live position dot.

**Tech Stack:** N2YO REST API (`api.n2yo.com`), Next.js App Router (ISR), satellite.js (on-demand SGP4), react-globe.gl, TypeScript, Jest/ts-jest.

---

## Prerequisites — API Key Setup

Before running any code, the N2YO API key must be in place.

- [ ] Register a free account at https://www.n2yo.com/
- [ ] Copy the API key from your profile
- [ ] Add to `.env.local` (create if it doesn't exist):
  ```
  N2YO_API_KEY=your_key_here
  ```
- [ ] Verify `.env.local` is in `.gitignore` (it should already be for this project)

---

## File Map

| Action | File |
|--------|------|
| **DELETE** | `lib/celestrak/gpParser.ts` |
| **DELETE** | `lib/celestrak/fallbackTles.ts` |
| **DELETE** | `scripts/generate-fallback-tles.mjs` |
| **DELETE** | `__tests__/celestrak/gpParser.test.ts` |
| **REWRITE** | `lib/celestrak/types.ts` — update `SatelliteObject` (lat/lng/altitude, optional TLE fields) |
| **REWRITE** | `lib/celestrak/orbitClass.ts` — new single-parameter signature |
| **UPDATE** | `__tests__/celestrak/orbitClass.test.ts` — update for new signature |
| **CREATE** | `lib/n2yo/types.ts` — N2YO API response interfaces |
| **CREATE** | `lib/n2yo/parser.ts` — parse N2YO `/above` JSON → `SatelliteObject[]` |
| **CREATE** | `__tests__/n2yo/parser.test.ts` — parser unit tests |
| **REWRITE** | `app/api/satellites/route.ts` — two hemisphere N2YO calls |
| **CREATE** | `app/api/satellites/tle/[noradId]/route.ts` — on-demand TLE fetch |
| **REWRITE** | `components/satellites/SatelliteGlobe.tsx` — use lat/lng directly; TLE only on selection |
| **UPDATE** | `components/satellites/SatelliteDashboardClient.tsx` — add TLE fetch state |
| **UPDATE** | `components/satellites/SatelliteDetailPanel.tsx` — handle optional TLE-derived fields |
| **UPDATE** | `components/satellites/SatelliteTopBar.tsx` — replace "CelesTrak" text |
| **KEEP** | `lib/celestrak/orbitUtils.ts` — unchanged (still used for orbit ring computation) |
| **KEEP** | `lib/celestrak/constellationDetect.ts` — unchanged |
| **KEEP** | `__tests__/celestrak/orbitUtils.test.ts` — unchanged |
| **KEEP** | `__tests__/celestrak/constellationDetect.test.ts` — unchanged |

---

## Task 1: Delete obsolete CelesTrak TLE files

**Files:**
- Delete: `lib/celestrak/gpParser.ts`
- Delete: `lib/celestrak/fallbackTles.ts`
- Delete: `scripts/generate-fallback-tles.mjs`
- Delete: `__tests__/celestrak/gpParser.test.ts`

- [ ] **Step 1: Delete the four files**

  ```bash
  rm lib/celestrak/gpParser.ts
  rm lib/celestrak/fallbackTles.ts
  rm scripts/generate-fallback-tles.mjs
  rm __tests__/celestrak/gpParser.test.ts
  ```

- [ ] **Step 2: Verify scripts directory is now empty**

  ```bash
  ls scripts/
  ```

  Expected: empty or "No such file or directory" — if empty the directory can also be removed (`rmdir scripts`).

- [ ] **Step 3: Confirm TypeScript still compiles (errors expected — they'll be fixed in Task 2)**

  Run: `npx tsc --noEmit 2>&1 | head -30`
  Expected: errors about missing imports (`gpParser`, `fallbackTles`) — that's fine.

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "chore(satellites): delete CelesTrak TLE parser, fallback dataset, and generator script"
  ```

---

## Task 2: Rewrite shared types and orbit classification

**Files:**
- Rewrite: `lib/celestrak/types.ts`
- Rewrite: `lib/celestrak/orbitClass.ts`
- Update: `__tests__/celestrak/orbitClass.test.ts`

### 2a — Update `SatelliteObject` type

N2YO's `/above` endpoint gives us lat, lng, and altitude directly — no TLE parsing needed for the main list. TLE-derived orbital elements are now optional, populated only when the user selects a satellite and we fetch its TLE on-demand.

- [ ] **Step 1: Write the new `lib/celestrak/types.ts`**

  ```typescript
  // lib/celestrak/types.ts

  export type OrbitClass = "LEO" | "MEO" | "GEO" | "HEO";

  export type Constellation =
    | "Starlink"
    | "OneWeb"
    | "GPS"
    | "Galileo"
    | "GLONASS"
    | "Space Station"
    | "Weather"
    | "Science"
    | "Other";

  /** Active satellite from N2YO /above endpoint. */
  export interface SatelliteObject {
    noradId: number;
    name: string;
    intlDesignator: string;    // e.g. "1998-067A"
    launchDate: string;        // ISO date string from N2YO, e.g. "1998-11-20"
    launchYear: number;        // parsed from launchDate
    orbitClass: OrbitClass;
    altitudeKm: number;        // current altitude above Earth surface (km)
    lat: number;               // current geodetic latitude (degrees)
    lng: number;               // current geodetic longitude (degrees)
    constellation: Constellation;
    // Optional — populated only when TLE is fetched on selection
    tleLine1?: string;
    tleLine2?: string;
    inclinationDeg?: number;
    eccentricity?: number;
    periodMin?: number;
    raanDeg?: number;
    argOfPericenterDeg?: number;
  }

  /** Subset returned by the on-demand TLE route. */
  export interface TleDerived {
    tleLine1: string;
    tleLine2: string;
    inclinationDeg: number;
    eccentricity: number;
    periodMin: number;
    raanDeg: number;
    argOfPericenterDeg: number;
    apogeeKm: number;
    perigeeKm: number;
  }

  export interface SatelliteResponse {
    count: number;
    revalidatedAt: string;
    objects: SatelliteObject[];
  }
  ```

### 2b — Update orbit classification

The N2YO `/above` response provides `satalt` (current altitude in km). We classify from a single altitude value instead of apogee/perigee/eccentricity.

- [ ] **Step 2: Write failing tests first**

  ```typescript
  // __tests__/celestrak/orbitClass.test.ts
  import { classifyOrbit } from "@/lib/celestrak/orbitClass";

  describe("classifyOrbit(altitudeKm)", () => {
    it("classifies ISS (408 km) as LEO", () => {
      expect(classifyOrbit(408)).toBe("LEO");
    });
    it("classifies upper LEO boundary (1999 km) as LEO", () => {
      expect(classifyOrbit(1999)).toBe("LEO");
    });
    it("classifies GPS (20200 km) as MEO", () => {
      expect(classifyOrbit(20200)).toBe("MEO");
    });
    it("classifies GEO (35786 km) as GEO", () => {
      expect(classifyOrbit(35786)).toBe("GEO");
    });
    it("classifies upper GEO edge (36500 km) as GEO", () => {
      expect(classifyOrbit(36500)).toBe("GEO");
    });
    it("classifies altitude above GEO band (40000 km) as HEO", () => {
      expect(classifyOrbit(40000)).toBe("HEO");
    });
    it("classifies LEO/MEO boundary (2000 km) as MEO", () => {
      expect(classifyOrbit(2000)).toBe("MEO");
    });
  });
  ```

- [ ] **Step 3: Run tests — expect FAIL**

  Run: `npx jest __tests__/celestrak/orbitClass.test.ts -t "classifyOrbit" --no-coverage`
  Expected: FAIL (wrong number of arguments to old signature)

- [ ] **Step 4: Rewrite `lib/celestrak/orbitClass.ts`**

  ```typescript
  // lib/celestrak/orbitClass.ts
  import type { OrbitClass } from "./types";

  /**
   * Classifies a satellite's orbit from its current altitude (km above Earth surface).
   * Using a single altitude point is approximate — HEO satellites may appear as MEO
   * when near perigee, but for the dashboard's educational purpose this is acceptable.
   */
  export function classifyOrbit(altitudeKm: number): OrbitClass {
    if (altitudeKm >= 35_000 && altitudeKm <= 36_500) return "GEO";
    if (altitudeKm > 36_500) return "HEO";
    if (altitudeKm < 2_000) return "LEO";
    return "MEO";
  }
  ```

- [ ] **Step 5: Run tests — expect PASS**

  Run: `npx jest __tests__/celestrak/orbitClass.test.ts --no-coverage`
  Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

  ```bash
  git add lib/celestrak/types.ts lib/celestrak/orbitClass.ts __tests__/celestrak/orbitClass.test.ts
  git commit -m "refactor(satellites): update SatelliteObject type and classifyOrbit for N2YO altitude-based data"
  ```

---

## Task 3: Create N2YO parser

**Files:**
- Create: `lib/n2yo/types.ts`
- Create: `lib/n2yo/parser.ts`
- Create: `__tests__/n2yo/parser.test.ts`

### N2YO `/above` response shape

```json
{
  "info": { "category": "All", "satcount": 1234, "transactionscount": 2 },
  "above": [
    {
      "satid": 25544,
      "satname": "ISS (ZARYA)",
      "intDesignator": "1998-067A",
      "launchDate": "1998-11-20",
      "satlat": 51.64,
      "satlng": -50.12,
      "satalt": 408.05
    }
  ]
}
```

- [ ] **Step 1: Create `lib/n2yo/types.ts`**

  ```typescript
  // lib/n2yo/types.ts

  export interface N2YOSatelliteAbove {
    satid: number;
    satname: string;
    intDesignator: string;
    launchDate: string;   // "YYYY-MM-DD"
    satlat: number;
    satlng: number;
    satalt: number;       // km above surface
  }

  export interface N2YOAboveResponse {
    info: {
      category: string;
      satcount: number;
      transactionscount: number;
    };
    above: N2YOSatelliteAbove[];
  }

  export interface N2YOTleResponse {
    info: {
      satid: number;
      satname: string;
      transactionscount: number;
    };
    tle: string;   // "LINE1\r\nLINE2"
  }
  ```

- [ ] **Step 2: Write failing tests first**

  ```typescript
  // __tests__/n2yo/parser.test.ts
  import { parseAboveResponse } from "@/lib/n2yo/parser";
  import type { N2YOAboveResponse } from "@/lib/n2yo/types";

  const MOCK_RESPONSE: N2YOAboveResponse = {
    info: { category: "All", satcount: 2, transactionscount: 1 },
    above: [
      {
        satid: 25544,
        satname: "ISS (ZARYA)",
        intDesignator: "1998-067A",
        launchDate: "1998-11-20",
        satlat: 51.64,
        satlng: -50.12,
        satalt: 408.05,
      },
      {
        satid: 48274,
        satname: "STARLINK-1234",
        intDesignator: "2021-024A",
        launchDate: "2021-03-24",
        satlat: -12.3,
        satlng: 100.0,
        satalt: 550.0,
      },
    ],
  };

  describe("parseAboveResponse", () => {
    const result = parseAboveResponse(MOCK_RESPONSE);

    it("returns one SatelliteObject per above entry", () => {
      expect(result).toHaveLength(2);
    });

    it("maps satid → noradId", () => {
      expect(result[0].noradId).toBe(25544);
    });

    it("maps satname → name", () => {
      expect(result[0].name).toBe("ISS (ZARYA)");
    });

    it("maps intDesignator → intlDesignator", () => {
      expect(result[0].intlDesignator).toBe("1998-067A");
    });

    it("maps launchDate correctly", () => {
      expect(result[0].launchDate).toBe("1998-11-20");
    });

    it("extracts launchYear from launchDate", () => {
      expect(result[0].launchYear).toBe(1998);
    });

    it("maps satlat → lat", () => {
      expect(result[0].lat).toBeCloseTo(51.64);
    });

    it("maps satlng → lng", () => {
      expect(result[0].lng).toBeCloseTo(-50.12);
    });

    it("maps satalt → altitudeKm", () => {
      expect(result[0].altitudeKm).toBeCloseTo(408.05);
    });

    it("classifies ISS as LEO", () => {
      expect(result[0].orbitClass).toBe("LEO");
    });

    it("detects ISS constellation as Space Station", () => {
      expect(result[0].constellation).toBe("Space Station");
    });

    it("detects Starlink constellation", () => {
      expect(result[1].constellation).toBe("Starlink");
    });

    it("returns empty array for empty above list", () => {
      expect(parseAboveResponse({ ...MOCK_RESPONSE, above: [] })).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 3: Run tests — expect FAIL**

  Run: `npx jest __tests__/n2yo/parser.test.ts --no-coverage`
  Expected: FAIL (module not found)

- [ ] **Step 4: Create `lib/n2yo/parser.ts`**

  ```typescript
  // lib/n2yo/parser.ts
  import type { N2YOAboveResponse } from "./types";
  import type { SatelliteObject } from "@/lib/celestrak/types";
  import { classifyOrbit } from "@/lib/celestrak/orbitClass";
  import { detectConstellation } from "@/lib/celestrak/constellationDetect";

  export function parseAboveResponse(data: N2YOAboveResponse): SatelliteObject[] {
    return data.above.map((sat) => {
      const launchYear = sat.launchDate
        ? parseInt(sat.launchDate.substring(0, 4), 10) || 0
        : 0;

      return {
        noradId: sat.satid,
        name: sat.satname,
        intlDesignator: sat.intDesignator,
        launchDate: sat.launchDate,
        launchYear,
        orbitClass: classifyOrbit(sat.satalt),
        altitudeKm: sat.satalt,
        lat: sat.satlat,
        lng: sat.satlng,
        constellation: detectConstellation(sat.satname),
      };
    });
  }
  ```

- [ ] **Step 5: Run tests — expect PASS**

  Run: `npx jest __tests__/n2yo/parser.test.ts --no-coverage`
  Expected: PASS (13 tests)

- [ ] **Step 6: Commit**

  ```bash
  git add lib/n2yo/ __tests__/n2yo/
  git commit -m "feat(satellites): add N2YO API types and /above response parser"
  ```

---

## Task 4: Rewrite main satellites API route

**Files:**
- Rewrite: `app/api/satellites/route.ts`

The new route calls N2YO's `/above` endpoint **twice** — from two opposite longitudes (0° and 180°) with a 90° search radius. Each call covers roughly one hemisphere; together they cover all active satellites globally. Duplicates are removed by NORAD ID.

Rate impact: 2 N2YO transactions per route invocation. With `revalidate = 3600` (1-hour ISR), this is 2 transactions per hour — well within the free tier's 1,000/hour limit.

- [ ] **Step 1: Verify `N2YO_API_KEY` is available in environment**

  ```bash
  echo $N2YO_API_KEY
  ```

  Expected: your API key value. If empty, add it to `.env.local` (see Prerequisites).

- [ ] **Step 2: Rewrite `app/api/satellites/route.ts`**

  ```typescript
  // app/api/satellites/route.ts
  import { NextResponse } from "next/server";
  import { parseAboveResponse } from "@/lib/n2yo/parser";
  import type { N2YOAboveResponse } from "@/lib/n2yo/types";
  import type { SatelliteObject, SatelliteResponse } from "@/lib/celestrak/types";

  export const runtime = "nodejs";
  // ISR: cache the route response for 1 hour — N2YO positions are live but
  // for a dashboard census (total counts, orbit class breakdown) hourly is enough.
  export const revalidate = 3600;

  const N2YO_BASE = "https://api.n2yo.com/rest/v1/satellite";
  const CATEGORY_ALL = 0;
  const RADIUS_DEG = 90; // degrees — covers one full hemisphere per observer
  const TIMEOUT_MS = 15_000;

  // Two observers 180° apart → global coverage after dedup
  const OBSERVERS = [
    { lat: 0, lng: 0 },    // Gulf of Guinea — covers Africa/Europe/Asia hemisphere
    { lat: 0, lng: 180 },  // Pacific — covers Americas/Pacific hemisphere
  ];

  function aboveUrl(lat: number, lng: number, apiKey: string): string {
    // N2YO path: /above/{lat}/{lng}/{alt}/{radius}/{category} — apiKey is a query param
    return `${N2YO_BASE}/above/${lat}/${lng}/0/${RADIUS_DEG}/${CATEGORY_ALL}?apiKey=${apiKey}`;
  }

  async function fetchHemisphere(
    lat: number,
    lng: number,
    apiKey: string
  ): Promise<SatelliteObject[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(aboveUrl(lat, lng, apiKey), {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) {
        console.error(`[satellites] N2YO error — status=${res.status} lat=${lat} lng=${lng}`);
        return [];
      }
      const data: N2YOAboveResponse = await res.json();
      const objects = parseAboveResponse(data);
      console.log(`[satellites] N2YO above(${lat},${lng}) → ${objects.length} satellites`);
      return objects;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        console.error(`[satellites] N2YO fetch timed out after ${TIMEOUT_MS}ms lat=${lat} lng=${lng}`);
      } else {
        console.error(`[satellites] N2YO fetch threw lat=${lat} lng=${lng}`, err);
      }
      return [];
    }
  }

  function dedupeByNorad(objects: SatelliteObject[]): SatelliteObject[] {
    const seen = new Set<number>();
    return objects.filter((o) => {
      if (seen.has(o.noradId)) return false;
      seen.add(o.noradId);
      return true;
    });
  }

  export async function GET() {
    const apiKey = process.env.N2YO_API_KEY;
    if (!apiKey) {
      console.error("[satellites] N2YO_API_KEY is not set");
      return NextResponse.json(
        { error: "N2YO_API_KEY environment variable is not configured" },
        { status: 503 }
      );
    }

    const results = await Promise.allSettled(
      OBSERVERS.map(({ lat, lng }) => fetchHemisphere(lat, lng, apiKey))
    );

    const combined: SatelliteObject[] = [];
    results.forEach((r) => {
      if (r.status === "fulfilled") combined.push(...r.value);
    });

    const objects = dedupeByNorad(combined);

    if (objects.length === 0) {
      console.error("[satellites] both hemisphere fetches returned 0 satellites");
      return NextResponse.json(
        { error: "N2YO API unavailable — try again later" },
        { status: 503 }
      );
    }

    console.log(`[satellites] total unique satellites: ${objects.length}`);
    const body: SatelliteResponse = {
      count: objects.length,
      revalidatedAt: new Date().toISOString(),
      objects,
    };
    return NextResponse.json(body);
  }
  ```

- [ ] **Step 3: Smoke-test the route in dev**

  ```bash
  npm run dev
  ```

  Then in another terminal:
  ```bash
  curl "http://localhost:3000/api/satellites" | head -c 500
  ```

  Expected: JSON with `count`, `revalidatedAt`, and `objects` array with real satellites.

- [ ] **Step 4: TypeScript check**

  Run: `npx tsc --noEmit`
  Expected: errors only in component files (which haven't been updated yet). The route itself should be clean.

- [ ] **Step 5: Commit**

  ```bash
  git add app/api/satellites/route.ts
  git commit -m "feat(satellites): rewrite API route to use N2YO /above endpoint (two-hemisphere global coverage)"
  ```

---

## Task 5: Create on-demand TLE route

**Files:**
- Create: `app/api/satellites/tle/[noradId]/route.ts`

When a user selects a satellite on the globe, the client fetches its TLE to enable orbit ring rendering and SGP4 live position updates. This is a separate route to avoid fetching TLEs for all 1000+ satellites upfront.

N2YO TLE response: `{ "info": {...}, "tle": "LINE1\r\nLINE2" }`

From the TLE lines we derive orbital elements (inclination, eccentricity, period, RAAN, arg of pericenter, apogee, perigee) so the detail panel can display them.

- [ ] **Step 1: Create `app/api/satellites/tle/[noradId]/route.ts`**

  ```typescript
  // app/api/satellites/tle/[noradId]/route.ts
  import { NextResponse } from "next/server";
  import type { TleDerived } from "@/lib/celestrak/types";
  import type { N2YOTleResponse } from "@/lib/n2yo/types";

  export const runtime = "nodejs";
  // Cache TLE for 6 hours — orbital elements change slowly
  export const revalidate = 21600;

  const N2YO_BASE = "https://api.n2yo.com/rest/v1/satellite";
  const TIMEOUT_MS = 10_000;
  const MU_KM3_S2 = 398600.4418;
  const EARTH_RADIUS_KM = 6371;

  /** Parses two TLE lines and returns derived orbital elements. */
  function deriveTleElements(line1: string, line2: string): Omit<TleDerived, "tleLine1" | "tleLine2"> {
    const inclinationDeg = parseFloat(line2.substring(8, 16));
    const raanDeg = parseFloat(line2.substring(17, 25));
    const eccentricity = parseFloat("0." + line2.substring(26, 33));
    const argOfPericenterDeg = parseFloat(line2.substring(34, 42));
    const meanMotion = parseFloat(line2.substring(52, 63)); // rev/day

    const periodMin = 1440 / meanMotion;
    const periodSec = periodMin * 60;
    const a_km = (MU_KM3_S2 * (periodSec / (2 * Math.PI)) ** 2) ** (1 / 3);

    return {
      inclinationDeg,
      eccentricity,
      periodMin,
      raanDeg,
      argOfPericenterDeg,
      apogeeKm: a_km * (1 + eccentricity) - EARTH_RADIUS_KM,
      perigeeKm: a_km * (1 - eccentricity) - EARTH_RADIUS_KM,
    };
  }

  export async function GET(
    _req: Request,
    { params }: { params: Promise<{ noradId: string }> }
  ) {
    const { noradId } = await params;
    const apiKey = process.env.N2YO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "N2YO_API_KEY not configured" }, { status: 503 });
    }

    const url = `${N2YO_BASE}/tle/${noradId}?apiKey=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) {
        return NextResponse.json({ error: `N2YO returned ${res.status}` }, { status: 502 });
      }

      const data: N2YOTleResponse = await res.json();
      // N2YO returns TLE as "LINE1\r\nLINE2" in a single string
      const [line1, line2] = data.tle.replace(/\r/g, "").split("\n").map((l) => l.trim());

      if (!line1 || !line2 || !line1.startsWith("1 ") || !line2.startsWith("2 ")) {
        return NextResponse.json({ error: "Invalid TLE data from N2YO" }, { status: 502 });
      }

      const derived = deriveTleElements(line1, line2);
      const body: TleDerived = { tleLine1: line1, tleLine2: line2, ...derived };
      return NextResponse.json(body);
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      console.error(`[tle] ${isTimeout ? "timeout" : "error"} for NORAD ${noradId}`, err);
      return NextResponse.json({ error: "TLE fetch failed" }, { status: 502 });
    }
  }
  ```

- [ ] **Step 2: Smoke-test the TLE route**

  With dev server running:
  ```bash
  curl "http://localhost:3000/api/satellites/tle/25544"
  ```

  Expected: JSON with `tleLine1`, `tleLine2`, `inclinationDeg` (~51.6), `periodMin` (~92), etc.

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/satellites/tle/
  git commit -m "feat(satellites): add on-demand TLE route for selected satellite orbit ring"
  ```

---

## Task 6: Update `SatelliteDashboardClient`

**Files:**
- Modify: `components/satellites/SatelliteDashboardClient.tsx`

The client uses `useSWR` with a conditional key for TLE fetching — when `selectedNoradId` is null the key is null and SWR skips the fetch. When a satellite is selected, SWR fetches and caches the TLE so revisiting the same satellite is instant (no re-fetch). This data flows down to both `SatelliteGlobe` (for orbit ring) and `SatelliteDetailPanel` (for orbital parameters).

- [ ] **Step 0: Install SWR if not already installed**

  ```bash
  npm list swr
  ```

  If not listed, install it:
  ```bash
  npm install swr
  ```

- [ ] **Step 1: Rewrite `components/satellites/SatelliteDashboardClient.tsx`**

  ```tsx
  // components/satellites/SatelliteDashboardClient.tsx
  "use client";

  import { useState, useMemo } from "react";
  import dynamic from "next/dynamic";
  import useSWR from "swr";
  import type { SatelliteObject, TleDerived } from "@/lib/celestrak/types";
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

  const tleFetcher = (url: string): Promise<TleDerived> =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error(`TLE fetch failed: ${r.status}`);
      return r.json();
    });

  interface Props {
    initialObjects: SatelliteObject[];
  }

  export function SatelliteDashboardClient({ initialObjects }: Props) {
    const [filters, setFilters] = useState<SatelliteFilterState>(DEFAULT_SATELLITE_FILTERS);
    const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null);
    const [liveLatLng, setLiveLatLng] = useState<{ lat: number; lng: number } | null>(null);

    // SWR fetches TLE only when a satellite is selected (null key = skip).
    // Results are cached — clicking the same satellite twice re-uses the cached TLE.
    const { data: selectedTle } = useSWR<TleDerived>(
      selectedNoradId !== null ? `/api/satellites/tle/${selectedNoradId}` : null,
      tleFetcher,
      { revalidateOnFocus: false }
    );

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
      ? initialObjects.find((o) => o.noradId === selectedNoradId) ?? null
      : null;

    return (
      <div className="flex flex-1 overflow-hidden">
        <SatelliteSidebar
          filters={filters}
          onChange={setFilters}
          allObjects={initialObjects}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 bg-space-900 border border-space-700 rounded-xl p-4">
              <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">
                Live Orbital Positions
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Dots are color-coded by orbit class. Select a satellite to see its orbit ring
                and live SGP4-propagated position (updated every 2 s).
              </p>
              <SatelliteGlobe
                objects={filtered}
                selectedNoradId={selectedNoradId}
                selectedTle={selectedTle ?? null}
                onSelectNoradId={(id) => {
                  setSelectedNoradId(id);
                  if (id === null) setLiveLatLng(null);
                }}
                onLivePosition={(lat, lng) => setLiveLatLng({ lat, lng })}
                width={600}
                height={480}
              />
            </section>

            <div className="flex flex-col gap-4">
              <OrbitClassDonut objects={initialObjects} />
              <LaunchTimeline objects={initialObjects} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ConstellationBar objects={initialObjects} />
            </div>
            <div>
              {selected ? (
                <SatelliteDetailPanel
                  satellite={selected}
                  tleDerived={selectedTle}
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

          <p className="text-xs font-mono text-slate-600">
            Showing {filtered.length.toLocaleString()} of {initialObjects.length.toLocaleString()} active satellites
          </p>
        </main>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add components/satellites/SatelliteDashboardClient.tsx
  git commit -m "feat(satellites): add on-demand TLE fetch state in DashboardClient"
  ```

---

## Task 7: Rewrite `SatelliteGlobe`

**Files:**
- Rewrite: `components/satellites/SatelliteGlobe.tsx`

**Key changes:**
- Remove the `initPositions` useMemo that propagated ALL satellites' TLEs at mount — instead use `o.lat` and `o.lng` directly from the N2YO data (orders-of-magnitude faster)
- Accept `selectedTle: TleDerived | null` as a prop instead of reading `sat.tleLine1`/`sat.tleLine2` from the satellite object
- Orbit ring and live dot still use satellite.js SGP4, but only for the one selected satellite

- [ ] **Step 1: Rewrite `components/satellites/SatelliteGlobe.tsx`**

  ```tsx
  // components/satellites/SatelliteGlobe.tsx
  "use client";

  import { useRef, useEffect, useCallback, useMemo } from "react";
  import Globe from "react-globe.gl";
  import * as THREE from "three";
  import { twoline2satrec, propagate, gstime, eciToGeodetic } from "satellite.js";
  import type { SatelliteObject, OrbitClass, TleDerived } from "@/lib/celestrak/types";
  import { computeOrbitPointsGeo } from "@/lib/celestrak/orbitUtils";

  interface Props {
    objects: SatelliteObject[];
    selectedNoradId: number | null;
    selectedTle: TleDerived | null;
    onSelectNoradId: (id: number | null) => void;
    onLivePosition?: (lat: number, lng: number) => void;
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

  const GLOBE_ER_SCALE = 100;
  const EARTH_RADIUS_KM = 6371;
  const MU_KM3_S2 = 398600.4418;

  export function SatelliteGlobe({
    objects,
    selectedNoradId,
    selectedTle,
    onSelectNoradId,
    onLivePosition,
    width = 480,
    height = 480,
  }: Props) {
    const globeEl = useRef<GlobeInstance | null>(null);
    const orbitMeshRef = useRef<THREE.Line | null>(null);
    const liveDotRef = useRef<THREE.Mesh | null>(null);
    const onLivePositionRef = useRef(onLivePosition);

    useEffect(() => {
      onLivePositionRef.current = onLivePosition;
    }, [onLivePosition]);

    useEffect(() => {
      const g = globeEl.current;
      if (!g) return;
      g.pointOfView({ lat: 15, lng: 30, altitude: 2.5 }, 0);
      g.controls().autoRotate = true;
      g.controls().autoRotateSpeed = 0.3;
    }, []);

    // Orbit ring + live position — triggered by selectedTle (arrives after TLE fetch completes)
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
      if (!selectedTle || !globe) return removeOrbit;

      const { tleLine1, tleLine2, inclinationDeg, eccentricity, periodMin, raanDeg, argOfPericenterDeg } = selectedTle;

      // Derive semi-major axis in Earth radii for orbit ring
      const periodSec = periodMin * 60;
      const a_km = (MU_KM3_S2 * (periodSec / (2 * Math.PI)) ** 2) ** (1 / 3);
      const a_ER = a_km / EARTH_RADIUS_KM;

      const elements = { a: a_ER, e: eccentricity, i: inclinationDeg, om: raanDeg, w: argOfPericenterDeg };
      const pts = computeOrbitPointsGeo(elements, 180);
      const positions = new Float32Array(pts.length * 3);
      pts.forEach(({ x, y, z }, idx) => {
        positions[idx * 3]     = x * GLOBE_ER_SCALE;
        positions[idx * 3 + 1] = z * GLOBE_ER_SCALE;
        positions[idx * 3 + 2] = -y * GLOBE_ER_SCALE;
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const selectedSat = objects.find((o) => o.noradId === selectedNoradId);
      const ringColor = selectedSat ? (ORBIT_CLASS_COLOR[selectedSat.orbitClass] ?? "#94a3b8") : "#94a3b8";

      const mat = new THREE.LineBasicMaterial({ color: ringColor, linewidth: 1.5 });
      const orbitLine = new THREE.Line(geo, mat);
      orbitMeshRef.current = orbitLine;
      globe.scene().add(orbitLine);

      // Live dot
      const dotGeo = new THREE.SphereGeometry(1.5, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: ringColor });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      liveDotRef.current = dot;
      globe.scene().add(dot);

      let satrec: ReturnType<typeof twoline2satrec> | null = null;
      try {
        satrec = twoline2satrec(tleLine1, tleLine2);
      } catch {
        satrec = null;
      }

      function updateLivePosition() {
        if (!satrec || !liveDotRef.current) return;
        const now = new Date();
        const posVel = propagate(satrec, now);
        const gmst = gstime(now);
        if (!posVel || (posVel.position as unknown) === false) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geoPos = eciToGeodetic(posVel.position as any, gmst);
        const latRad = geoPos.latitude;
        const lngRad = geoPos.longitude;
        const altKm = geoPos.height;

        const altER = 1 + altKm / EARTH_RADIUS_KM;
        const cosLat = Math.cos(latRad);
        const x_eci = altER * cosLat * Math.cos(lngRad);
        const y_eci = altER * cosLat * Math.sin(lngRad);
        const z_eci = altER * Math.sin(latRad);

        liveDotRef.current.position.set(
          x_eci * GLOBE_ER_SCALE,
          z_eci * GLOBE_ER_SCALE,
          -y_eci * GLOBE_ER_SCALE
        );
        onLivePositionRef.current?.(latRad * (180 / Math.PI), lngRad * (180 / Math.PI));
      }

      updateLivePosition();
      const interval = setInterval(updateLivePosition, 2000);

      return () => {
        clearInterval(interval);
        removeOrbit();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTle]);

    // Satellite dots — use lat/lng directly from N2YO (no SGP4 propagation needed)
    const points: GlobePoint[] = useMemo(
      () =>
        objects.map((o) => ({
          noradId: o.noradId,
          lat: o.lat,
          lng: o.lng,
          size: o.noradId === selectedNoradId ? 0.6 : 0.2,
          color: ORBIT_CLASS_COLOR[o.orbitClass],
          label: `${o.name} (${o.orbitClass})`,
        })),
      [objects, selectedNoradId]
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

- [ ] **Step 2: Commit**

  ```bash
  git add components/satellites/SatelliteGlobe.tsx
  git commit -m "refactor(SatelliteGlobe): use N2YO lat/lng directly for dots; TLE only for selected satellite orbit ring"
  ```

---

## Task 8: Update `SatelliteDetailPanel`

**Files:**
- Modify: `components/satellites/SatelliteDetailPanel.tsx`

The panel now accepts an optional `tleDerived` prop. When TLE hasn't loaded yet (user just selected) it shows a loading indicator for the orbital parameters. When TLE is loaded it shows the full details.

- [ ] **Step 1: Rewrite `components/satellites/SatelliteDetailPanel.tsx`**

  ```tsx
  // components/satellites/SatelliteDetailPanel.tsx
  "use client";

  import { X } from "lucide-react";
  import type { SatelliteObject, TleDerived } from "@/lib/celestrak/types";

  interface Props {
    satellite: SatelliteObject;
    tleDerived: TleDerived | null;
    onClose: () => void;
    liveLatLng: { lat: number; lng: number } | null;
  }

  const ORBIT_CLASS_COLORS = {
    LEO: "text-neo-accent",
    MEO: "text-neo-watchlist",
    GEO: "text-neo-safe",
    HEO: "text-purple-400",
  };

  export function SatelliteDetailPanel({ satellite: sat, tleDerived, onClose, liveLatLng }: Props) {
    const position = liveLatLng
      ? {
          lat: `${Math.abs(liveLatLng.lat).toFixed(2)}° ${liveLatLng.lat >= 0 ? "N" : "S"}`,
          lng: `${Math.abs(liveLatLng.lng).toFixed(2)}° ${liveLatLng.lng >= 0 ? "E" : "W"}`,
        }
      : null;

    // Speed estimate from TLE-derived semi-major axis, if available
    const speedKmS = tleDerived
      ? (() => {
          const MU = 398600.4418;
          const T = tleDerived.periodMin * 60;
          const a_km = (MU * (T / (2 * Math.PI)) ** 2) ** (1 / 3);
          return Math.sqrt(MU / a_km);
        })()
      : null;

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
          <Row label="Launched" value={sat.launchDate || sat.launchYear.toString() || "—"} />
          <Row label="Altitude" value={`${sat.altitudeKm.toFixed(0)} km`} />

          {/* TLE-derived fields — show loading state until available */}
          {tleDerived ? (
            <>
              <Row
                label="Perigee / Apogee"
                value={`${tleDerived.perigeeKm.toFixed(0)}–${tleDerived.apogeeKm.toFixed(0)} km`}
              />
              <Row label="Inclination" value={`${tleDerived.inclinationDeg.toFixed(2)}°`} />
              <Row label="Period" value={`${tleDerived.periodMin.toFixed(1)} min`} />
              {speedKmS !== null && (
                <Row label="Speed" value={`${speedKmS.toFixed(2)} km/s`} />
              )}
            </>
          ) : (
            <div className="text-slate-600 text-xs py-1">Loading orbital data…</div>
          )}
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

- [ ] **Step 2: Commit**

  ```bash
  git add components/satellites/SatelliteDetailPanel.tsx
  git commit -m "feat(SatelliteDetailPanel): show N2YO base data immediately, TLE-derived orbital params after async fetch"
  ```

---

## Task 9: Update `SatelliteTopBar` and `SatelliteDashboardClientWrapper`

**Files:**
- Modify: `components/satellites/SatelliteTopBar.tsx`
- Modify: `components/satellites/SatelliteDashboardClientWrapper.tsx` (if it imports old types)

- [ ] **Step 1: Update the data source text in `SatelliteTopBar`**

  The TopBar currently shows "Countries" (derived from `countryCode` which N2YO `/above` doesn't provide). Replace with "Orbit Classes" — always available from altitude classification.

  ```tsx
  // components/satellites/SatelliteTopBar.tsx
  import { Satellite, Layers, TrendingUp, Zap } from "lucide-react";
  import { StatCard } from "@/components/cards/StatCard";
  import type { SatelliteObject } from "@/lib/celestrak/types";

  interface Props {
    objects: SatelliteObject[];
    revalidatedAt: string;
  }

  export function SatelliteTopBar({ objects, revalidatedAt }: Props) {
    const leoCount = objects.filter((o) => o.orbitClass === "LEO").length;
    const geoCount = objects.filter((o) => o.orbitClass === "GEO").length;
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
              N2YO live data · Updates every hour
            </p>
          </div>
          <span className="hidden sm:block text-xs font-mono text-slate-500">
            Updated: {new Date(revalidatedAt).toUTCString()}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 py-3 sm:py-4">
          <StatCard label="Active Satellites" value={objects.length} sub="Currently tracked globally" icon={Satellite} />
          <StatCard
            label="LEO Satellites"
            value={leoCount}
            sub={`${objects.length ? Math.round((leoCount / objects.length) * 100) : 0}% of total — below 2,000 km`}
            icon={Layers}
            iconColor="text-neo-watchlist"
          />
          <StatCard
            label="GEO Satellites"
            value={geoCount}
            sub={`${objects.length ? Math.round((geoCount / objects.length) * 100) : 0}% of total — ~35,786 km`}
            icon={TrendingUp}
            iconColor="text-neo-safe"
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

- [ ] **Step 2: Check `SatelliteDashboardClientWrapper.tsx` for any outdated imports**

  Read the file and verify it only wraps `SatelliteDashboardClient` — no direct type imports that need updating.

  Run: `cat components/satellites/SatelliteDashboardClientWrapper.tsx`

  If it imports from `@/lib/celestrak/types`, verify those imports still exist in the updated types file. If it references `countryCode`, `apogeeKm`, `perigeeKm`, `tleLine1`, or `tleLine2` as required fields, update accordingly.

- [ ] **Step 3: Commit**

  ```bash
  git add components/satellites/SatelliteTopBar.tsx
  git commit -m "chore(SatelliteTopBar): update data source text to N2YO; replace Countries stat with GEO count"
  ```

---

## Task 10: Verify charts handle new data shape

**Files:**
- Check: `components/satellites/OrbitClassDonut.tsx`
- Check: `components/satellites/LaunchTimeline.tsx`
- Check: `components/satellites/ConstellationBar.tsx`

These charts operate on `SatelliteObject[]`. They access `orbitClass`, `constellation`, `launchYear` — all of which are still present in the new type. But `LaunchTimeline` may use `launchYear` derived from `intlDesignator` (old) — now derived from `launchDate`.

- [ ] **Step 1: Read and verify `OrbitClassDonut.tsx`**

  Run: `cat components/satellites/OrbitClassDonut.tsx`
  Check: only uses `o.orbitClass` — no changes needed.

- [ ] **Step 2: Read and verify `LaunchTimeline.tsx`**

  Run: `cat components/satellites/LaunchTimeline.tsx`
  Check: only uses `o.launchYear` — still present, still correct.

- [ ] **Step 3: Read and verify `ConstellationBar.tsx`**

  Run: `cat components/satellites/ConstellationBar.tsx`
  Check: only uses `o.constellation` — no changes needed.

- [ ] **Step 4: Fix any issues found**, then commit if changes were needed.

---

## Task 11: Full verification

- [ ] **Step 1: TypeScript check — must be clean**

  Run: `npx tsc --noEmit`
  Expected: 0 errors.

  If errors exist, fix them before continuing. Common causes:
  - Components still referencing removed fields (`perigeeKm`, `apogeeKm`, `periodMin`, `countryCode`, `tleLine1`, `tleLine2` on the main object)
  - Wrong import paths

- [ ] **Step 2: Run all tests**

  Run: `npm test`
  Expected: All passing. Deleted test files should no longer appear. The `orbitClass` tests should pass with new single-argument signature.

- [ ] **Step 3: Start dev server and verify dashboard**

  ```bash
  npm run dev
  ```

  Navigate to `http://localhost:3000/satellites`.

  Check:
  - [ ] TopBar shows non-zero "Active Satellites" count
  - [ ] Globe has satellite dots visible
  - [ ] Orbit class donut renders (no empty state)
  - [ ] Constellation bar renders
  - [ ] Click a satellite dot → detail panel appears with "Loading orbital data…"
  - [ ] After ~1 second → orbital data fills in (inclination, period, etc.)
  - [ ] Orbit ring appears on the globe
  - [ ] Live position dot moves every 2 seconds

- [ ] **Step 4: Final commit**

  ```bash
  git add -A
  git commit -m "feat(satellites): complete N2YO rewrite — live API data, on-demand TLE orbit rings, cleanup of CelesTrak infrastructure"
  ```
