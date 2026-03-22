# Asteroid Orbital Ring Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an asteroid is selected on the globe, fetch its Keplerian orbital elements from JPL SBDB and render a glowing 3D orbit ring in the globe's THREE.js scene.

**Architecture:** Three independent layers — (1) a server-side API route that proxies JPL SBDB and returns normalized orbital elements, (2) a pure-math library that converts Keplerian elements to 3D ecliptic Cartesian points, (3) a `useEffect` in `EarthGlobe.tsx` that fetches the orbit, builds a THREE.js `Line` object, and inserts it directly into the globe's THREE.js scene via `globeRef.current.scene()`. The orbit ring is removed and rebuilt each time `selectedDes` changes.

**Tech Stack:** JPL SBDB API (free, no API key), THREE.js (already in `node_modules` as peer dep of react-globe.gl), Next.js 16 App Router ISR, TypeScript, Jest + ts-jest.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `lib/nasa/types.ts` | Modify | Add `OrbitalElements` interface |
| `app/api/orbit/route.ts` | Create | Server proxy for JPL SBDB — returns `OrbitalElements` JSON, 24h ISR |
| `lib/nasa/orbitUtils.ts` | Create | Pure math: Keplerian elements → array of 3D ecliptic points |
| `__tests__/nasa/orbitUtils.test.ts` | Create | Unit tests for orbit math |
| `components/globe/EarthGlobe.tsx` | Modify | Extend `GlobeInstance` interface; add `useEffect` that fetches orbit and renders THREE.js ring |

No other files change.

---

## Reference: Key Concepts

### JPL SBDB API

```
GET https://ssd-api.jpl.nasa.gov/sbdb.api?sstr={url-encoded-des}&cov=0&phys-par=0&full-prec=0
```

The designation (`des`) is already on `NeoObject` (e.g. `"2024 YR4"`). URL-encode it for the query string.

**Response shape (relevant fields only):**
```json
{
  "orbit": {
    "elements": [
      { "label": "e",  "value": "0.66592", "units": ""    },
      { "label": "a",  "value": "1.37643", "units": "au"  },
      { "label": "i",  "value": "3.40834", "units": "deg" },
      { "label": "om", "value": "271.072", "units": "deg" },
      { "label": "w",  "value": "190.882", "units": "deg" }
    ]
  }
}
```

Parse by matching `element.label`. All five elements are always present for numbered/designated objects.

### Keplerian to Cartesian

Given: `a` (AU), `e`, `i` (deg), `om` (deg), `w` (deg)

For each true anomaly θ from 0 → 2π:

```
r = a(1 - e²) / (1 + e·cos θ)           # distance from focus
X = r·cos θ,  Y = r·sin θ               # position in orbital plane

# Rotate to ecliptic J2000:
x = (cos Ω cos ω - sin Ω sin ω cos i) X + (-cos Ω sin ω - sin Ω cos ω cos i) Y
y = (sin Ω cos ω + cos Ω sin ω cos i) X + (-sin Ω sin ω + cos Ω cos ω cos i) Y
z = (sin ω sin i) X + (cos ω sin i) Y
```

where Ω = `om`, ω = `w`, i = `i` — all converted to radians.

### THREE.js coordinate mapping

react-globe.gl uses THREE.js with **Y-up** convention. Map ecliptic → THREE.js:

```
THREE.x = ecliptic.x
THREE.y = ecliptic.z    (ecliptic north → globe up)
THREE.z = -ecliptic.y   (flip to maintain right-hand rule)
```

**Scale:** `GLOBE_AU_SCALE = 300` — 1 AU in ecliptic coords → 300 THREE.js units. The globe sphere radius is ~100 units, so a typical NEO orbit (a ≈ 1–2 AU) will render as a ring 3–6× larger than the globe — clearly visible and not occluding the Earth.

### Accessing the THREE.js scene

`react-globe.gl`'s ref exposes a `scene()` method that returns the THREE.js `Scene`. Add it to the existing `GlobeInstance` interface in `EarthGlobe.tsx`:

```tsx
interface GlobeInstance {
  pointOfView: (pov: { lat: number; lng: number; altitude: number }, ms: number) => void;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
  scene: () => import("three").Scene;
}
```

---

## Task 1: Install dependencies, add `OrbitalElements` type, create SBDB API route

**Files:**
- Modify: `lib/nasa/types.ts`
- Create: `app/api/orbit/route.ts`

- [ ] **Step 1: Install `three` and `@types/three`**

```bash
cd C:/Users/SwankyDwarf/OneDrive/Desktop/Claude_Projects/nasa-project
npm install three
npm install --save-dev @types/three
```

Expected: both packages added to `package.json`.

- [ ] **Step 2: Add `OrbitalElements` to `lib/nasa/types.ts`**

Append after the existing `SentryResponse` interface:

```typescript
/** Keplerian orbital elements from JPL SBDB */
export interface OrbitalElements {
  a: number;   // semi-major axis (AU)
  e: number;   // eccentricity
  i: number;   // inclination (degrees)
  om: number;  // longitude of ascending node (degrees)
  w: number;   // argument of perihelion (degrees)
}
```

- [ ] **Step 3: TypeScript-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Create `app/api/orbit/route.ts`**

```typescript
// app/api/orbit/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { OrbitalElements } from "@/lib/nasa/types";

export const revalidate = 86400; // 24-hour ISR — orbital elements rarely change

const SBDB_BASE = "https://ssd-api.jpl.nasa.gov/sbdb.api";

type SbdbElement = { label: string; value: string };

export async function GET(req: NextRequest) {
  const des = req.nextUrl.searchParams.get("des");
  if (!des) {
    return NextResponse.json({ error: "Missing des parameter" }, { status: 400 });
  }

  const url = `${SBDB_BASE}?sstr=${encodeURIComponent(des)}&cov=0&phys-par=0&full-prec=0`;
  let raw: Response;
  try {
    raw = await fetch(url);
  } catch {
    return NextResponse.json({ error: "SBDB request failed" }, { status: 502 });
  }

  if (!raw.ok) {
    return NextResponse.json({ error: "SBDB returned non-200" }, { status: 502 });
  }

  const data = await raw.json();
  const elements: SbdbElement[] = data?.orbit?.elements ?? [];

  const find = (label: string) => {
    const el = elements.find((e) => e.label === label);
    return el ? parseFloat(el.value) : null;
  };

  const a = find("a");
  const e = find("e");
  const i = find("i");
  const om = find("om");
  const w = find("w");

  if (a == null || e == null || i == null || om == null || w == null) {
    return NextResponse.json({ error: "Incomplete orbital elements from SBDB" }, { status: 502 });
  }

  const result: OrbitalElements = { a, e, i, om, w };
  return NextResponse.json(result);
}
```

- [ ] **Step 5: TypeScript-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: existing 52 tests still pass.

- [ ] **Step 7: Smoke-test the route manually**

Start dev server (`npm run dev`), then in another terminal:

```bash
curl "http://localhost:3000/api/orbit?des=2024%20YR4"
```

Expected: JSON with fields `a`, `e`, `i`, `om`, `w` — all numbers. Example:
```json
{"a":1.376,"e":0.665,"i":3.408,"om":271.072,"w":190.882}
```

If SBDB returns an error for a designation, it likely needs a different format — try `des=2024YR4` (no space) or the packed designation.

- [ ] **Step 8: Commit**

```bash
git add lib/nasa/types.ts app/api/orbit/route.ts package.json package-lock.json
git commit -m "feat: add OrbitalElements type and SBDB orbit proxy API route"
```

---

## Task 2: Orbital mechanics library (TDD)

**Files:**
- Create: `lib/nasa/orbitUtils.ts`
- Create: `__tests__/nasa/orbitUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/nasa/orbitUtils.test.ts`:

```typescript
// __tests__/nasa/orbitUtils.test.ts
import { computeOrbitPoints } from "@/lib/nasa/orbitUtils";
import type { OrbitalElements } from "@/lib/nasa/types";

/** Circular orbit in the ecliptic plane — simplest case */
const CIRCULAR_ECLIPTIC: OrbitalElements = { a: 1, e: 0, i: 0, om: 0, w: 0 };

/** High-eccentricity inclined orbit — exercises all rotation angles */
const INCLINED: OrbitalElements = { a: 1.5, e: 0.5, i: 30, om: 45, w: 90 };

describe("computeOrbitPoints", () => {
  it("returns the requested number of points", () => {
    const pts = computeOrbitPoints(CIRCULAR_ECLIPTIC, 60);
    expect(pts).toHaveLength(61); // 60 segments = 61 points (first repeated at end to close loop)
  });

  it("circular ecliptic orbit lies entirely in z=0 plane", () => {
    const pts = computeOrbitPoints(CIRCULAR_ECLIPTIC, 120);
    pts.forEach((p) => expect(Math.abs(p.z)).toBeLessThan(1e-9));
  });

  it("circular orbit has constant distance from origin equal to semi-major axis", () => {
    const pts = computeOrbitPoints(CIRCULAR_ECLIPTIC, 120);
    pts.forEach((p) => {
      const r = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
      expect(r).toBeCloseTo(1, 5); // a = 1 AU
    });
  });

  it("inclined orbit has non-zero z components", () => {
    const pts = computeOrbitPoints(INCLINED, 120);
    const maxZ = Math.max(...pts.map((p) => Math.abs(p.z)));
    expect(maxZ).toBeGreaterThan(0.1);
  });

  it("orbit closes — first and last point are identical", () => {
    const pts = computeOrbitPoints(INCLINED, 120);
    expect(pts[0].x).toBeCloseTo(pts[pts.length - 1].x, 10);
    expect(pts[0].y).toBeCloseTo(pts[pts.length - 1].y, 10);
    expect(pts[0].z).toBeCloseTo(pts[pts.length - 1].z, 10);
  });

  it("default nPoints is 120", () => {
    expect(computeOrbitPoints(CIRCULAR_ECLIPTIC)).toHaveLength(121);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/nasa/orbitUtils.test.ts -v
```

Expected: FAIL — "Cannot find module '@/lib/nasa/orbitUtils'"

- [ ] **Step 3: Create `lib/nasa/orbitUtils.ts`**

```typescript
// lib/nasa/orbitUtils.ts
import type { OrbitalElements } from "@/lib/nasa/types";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Computes `nPoints + 1` positions along a Keplerian orbit in heliocentric
 * ecliptic J2000 coordinates (AU). The last point equals the first so that
 * THREE.js LineLoop / BufferGeometry renders a closed ring.
 *
 * Rotation convention: R_z(Ω) · R_x(i) · R_z(ω) applied to orbital-plane coords.
 */
export function computeOrbitPoints(
  elements: OrbitalElements,
  nPoints = 120
): Array<{ x: number; y: number; z: number }> {
  const { a, e, i, om, w } = elements;

  const iRad  = i  * DEG_TO_RAD;
  const omRad = om * DEG_TO_RAD;
  const wRad  = w  * DEG_TO_RAD;

  const cosOm = Math.cos(omRad), sinOm = Math.sin(omRad);
  const cosI  = Math.cos(iRad),  sinI  = Math.sin(iRad);
  const cosW  = Math.cos(wRad),  sinW  = Math.sin(wRad);

  // Rotation matrix columns (p-vector and q-vector in ecliptic frame)
  //   x_ecl = Px*X + Qx*Y
  //   y_ecl = Py*X + Qy*Y
  //   z_ecl = Pz*X + Qz*Y
  const Px =  cosOm * cosW - sinOm * sinW * cosI;
  const Py =  sinOm * cosW + cosOm * sinW * cosI;
  const Pz =  sinW * sinI;

  const Qx = -cosOm * sinW - sinOm * cosW * cosI;
  const Qy = -sinOm * sinW + cosOm * cosW * cosI;
  const Qz =  cosW * sinI;

  const points: Array<{ x: number; y: number; z: number }> = [];
  const semiLatus = a * (1 - e * e);

  for (let k = 0; k <= nPoints; k++) {
    const theta = (2 * Math.PI * k) / nPoints;
    const r = semiLatus / (1 + e * Math.cos(theta));

    const X = r * Math.cos(theta); // position in orbital plane
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

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npx jest __tests__/nasa/orbitUtils.test.ts -v
```

Expected: 6 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: all 58 tests pass (52 existing + 6 new).

- [ ] **Step 6: Commit**

```bash
git add lib/nasa/orbitUtils.ts __tests__/nasa/orbitUtils.test.ts
git commit -m "feat: add Keplerian orbit math library with tests"
```

---

## Task 3: Orbit ring in EarthGlobe

**Files:**
- Modify: `components/globe/EarthGlobe.tsx`

Read `components/globe/EarthGlobe.tsx` before editing. The file is 78 lines.

Key things to understand before editing:
- `globeEl` ref is typed as `GlobeInstance | null` — must extend `GlobeInstance` to add `scene()`
- The file has a single `useEffect` (auto-rotate) and two `useCallback` hooks
- `objects` prop is already available — needed to look up the selected asteroid's `riskCategory`

- [ ] **Step 1: Add THREE.js import and extend `GlobeInstance`**

At the top of `EarthGlobe.tsx`, add after the existing imports:

```tsx
import * as THREE from "three";
import { computeOrbitPoints } from "@/lib/nasa/orbitUtils";
import type { OrbitalElements } from "@/lib/nasa/types";
```

Extend the existing `GlobeInstance` interface (replace the current one):

```tsx
interface GlobeInstance {
  pointOfView: (pov: { lat: number; lng: number; altitude: number }, ms: number) => void;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
  scene: () => THREE.Scene;
}
```

- [ ] **Step 2: Add orbit ring constants and color map**

Add just above the `EarthGlobe` function:

```tsx
/** 1 AU in AU → this many THREE.js globe units. Globe sphere radius ≈ 100. */
const GLOBE_AU_SCALE = 300;

const ORBIT_COLOR: Record<string, string> = {
  Critical: "#ef4444",
  Watchlist: "#f59e0b",
  Safe: "#22c55e",
};
```

- [ ] **Step 3: Add orbit mesh ref, color memo, and fetch useEffect**

Inside the `EarthGlobe` function, after the existing refs, add:

```tsx
const orbitMeshRef = useRef<THREE.Line | null>(null);
```

Add a `useMemo` to derive orbit color from the selected asteroid (import `useMemo` if not already imported — check the existing import line):

```tsx
// Derive orbit ring color from the selected asteroid's risk category.
// Kept separate from the fetch effect so that objects changes don't re-trigger fetches.
const orbitColor = useMemo(() => {
  if (!selectedDes) return "#94a3b8";
  const obj = objects.find((o) => o.des === selectedDes);
  return obj ? (ORBIT_COLOR[obj.riskCategory] ?? "#94a3b8") : "#94a3b8";
}, [selectedDes, objects]);
```

Add a new `useEffect` after the existing auto-rotate `useEffect`. Note: the dependency array is `[selectedDes]` only — `orbitColor` is read at render time inside the `.then()` callback and will always be current:

```tsx
// Fetch orbital elements and render/clear orbit ring when selection changes
useEffect(() => {
  const globe = globeEl.current;
  if (!globe) return;

  // Remove previous ring
  if (orbitMeshRef.current) {
    globe.scene().remove(orbitMeshRef.current);
    orbitMeshRef.current.geometry.dispose();
    (orbitMeshRef.current.material as THREE.LineBasicMaterial).dispose();
    orbitMeshRef.current = null;
  }

  if (!selectedDes) return;

  let cancelled = false;

  fetch(`/api/orbit?des=${encodeURIComponent(selectedDes)}`)
    .then((r): Promise<OrbitalElements | null> => r.ok ? r.json() : Promise.resolve(null))
    .then((elements) => {
      if (cancelled || !elements || !globeEl.current) return;

      const pts = computeOrbitPoints(elements, 120);

      // Map ecliptic J2000 → THREE.js Y-up coordinate system
      const threePoints = pts.map(
        (p) => new THREE.Vector3(
          p.x * GLOBE_AU_SCALE,
          p.z * GLOBE_AU_SCALE,   // ecliptic Z (north) → THREE.js Y (up)
          -p.y * GLOBE_AU_SCALE,  // flip Y for right-hand rule
        )
      );

      const geometry = new THREE.BufferGeometry().setFromPoints(threePoints);
      const material = new THREE.LineBasicMaterial({
        color: orbitColor,
        opacity: 0.75,
        transparent: true,
      });

      const orbitLine = new THREE.Line(geometry, material);
      orbitMeshRef.current = orbitLine;
      globeEl.current.scene().add(orbitLine);
    })
    .catch(() => {
      // Silent fail — orbit ring is cosmetic, don't break the globe
    });

  return () => {
    cancelled = true;
    // Dispose on unmount or before next effect run
    const g = globeEl.current;
    if (g && orbitMeshRef.current) {
      g.scene().remove(orbitMeshRef.current);
      orbitMeshRef.current.geometry.dispose();
      (orbitMeshRef.current.material as THREE.LineBasicMaterial).dispose();
      orbitMeshRef.current = null;
    }
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedDes]); // orbitColor intentionally omitted — read at .then() time, stable per selectedDes
```

- [ ] **Step 4: TypeScript-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see `"Property 'scene' does not exist on type 'GlobeInstance'"`, double-check that the `GlobeInstance` interface was updated in Step 1.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: all 58 tests pass (orbit fetch is client-side, not tested by Jest).

- [ ] **Step 6: Visual verification**

Start dev server:

```bash
npm run dev
```

Open http://localhost:3000. Verify:

1. Select an asteroid from the list — within ~1 second a glowing ring appears around the globe, colored by risk category (red = Critical, amber = Watchlist, green = Safe)
2. The ring is clearly an ellipse (not a perfect circle) for most asteroids — this shows eccentricity working
3. The ring is tilted at an angle relative to the globe's equator — this shows inclination working
4. Deselect the asteroid — the ring disappears immediately
5. Select a different asteroid — the old ring disappears and a new ring for the new asteroid appears
6. If an asteroid's designation is not found in SBDB (rare), no ring appears but the globe still works normally
7. The auto-rotate and arc animations continue to work while the orbit ring is visible

- [ ] **Step 7: Commit**

```bash
git add components/globe/EarthGlobe.tsx
git commit -m "feat: render 3D orbit ring in globe scene when asteroid is selected"
```
