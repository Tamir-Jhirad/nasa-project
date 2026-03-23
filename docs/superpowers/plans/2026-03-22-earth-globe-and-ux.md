# Earth Globe + User-Friendly UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive 3D Earth globe showing asteroid approach paths, then overhaul the UI so a non-technical visitor immediately understands what the app does and why it matters.

**Architecture:** A `react-globe.gl` component (client-only, loaded via `next/dynamic` with `ssr: false`) displays Earth with color-coded arcs representing each asteroid's close approach at its actual miss-distance scale. A new `HeroIntro` banner above the dashboard explains the app in plain language. Chart labels and cards are rewritten for general audiences.

**Tech Stack:** `react-globe.gl` (Three.js-based globe), `next/dynamic` (SSR bypass), Tailwind v3, lucide-react, existing Recharts charts.

---

## Scope

Two independent sub-features:
1. **3D Earth Globe** — visual centrepiece, new `components/globe/` directory
2. **UX / Plain Language** — no new dependencies, rewrites existing layout components

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `components/globe/globeUtils.ts` | Converts `NeoObject[]` → arc/point data for globe |
| `components/globe/EarthGlobe.tsx` | Renders `react-globe.gl` with asteroid arcs |
| `components/globe/EarthGlobeWrapper.tsx` | `next/dynamic` wrapper (SSR safe) |
| `components/layout/HeroIntro.tsx` | Plain-language banner explaining the app |

### Modified files
| Path | Change |
|------|--------|
| `components/layout/DashboardClient.tsx` | Add `HeroIntro` + `EarthGlobeWrapper` above charts |
| `components/layout/TopBar.tsx` | Add subtitle / tagline for clarity |
| `components/charts/ApproachTimeline.tsx` | Better chart title + plain-language description |
| `components/charts/RiskRadar.tsx` | Better chart title + tooltip descriptions |
| `components/charts/SizeDistribution.tsx` | Better chart title |

### Test files
| Path | Tests |
|------|-------|
| `__tests__/globe/globeUtils.test.ts` | Unit tests for arc/point data transformation |

---

## Task 1: Install react-globe.gl

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the library**

```bash
npm install react-globe.gl
```

- [ ] **Step 2: Verify install**

```bash
npx tsc --noEmit
```

Expected: No new errors introduced.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-globe.gl dependency"
```

---

## Task 2: Globe data utils (TDD)

**Files:**
- Create: `components/globe/globeUtils.ts`
- Test: `__tests__/globe/globeUtils.test.ts`

The globe needs each `NeoObject` mapped to an arc (approach path) and a point (closest approach marker). Since NASA CAD data does not include 3D direction vectors, we derive a *consistent* position from the asteroid's designation string using a simple integer hash. This gives each asteroid a fixed, repeatable lat/lng — clearly approximate, clearly visual.

**Globe display limit:** To prevent visual overload, only the top 50 objects by risk score are shown on the globe. A `limitGlobeObjects` function handles this — Critical first, then Watchlist, then Safe, all sorted by `riskScore` descending within each tier.

**Select/deselect:** Each arc is clickable. Clicking an arc selects that asteroid; all other arcs dim to 20% opacity. Clicking the same arc (or a clear button) deselects. The globe data utils expose a `selectedColor` / `dimmedColor` helper used by `EarthGlobe` to compute per-arc colors based on selection state.

- [ ] **Step 1: Create the test file**

```typescript
// __tests__/globe/globeUtils.test.ts
import { toGlobeArcs, toGlobePoints, limitGlobeObjects } from "@/components/globe/globeUtils";
import type { NeoObject } from "@/lib/nasa/types";

const makeNeo = (overrides: Partial<NeoObject> = {}): NeoObject => ({
  des: "2025 AA1",
  fullname: "(2025 AA1)",
  closeApproachDate: "2026-04-01T00:00:00Z",
  distAu: 0.02,
  distKm: 2992000,
  velocityKmS: 12,
  diameterKm: 0.05,
  hMag: 22,
  riskScore: 1.2,
  riskCategory: "Safe",
  ...overrides,
});

describe("toGlobeArcs", () => {
  it("returns one arc per object", () => {
    const neos = [makeNeo(), makeNeo({ des: "2025 BB2" })];
    expect(toGlobeArcs(neos, null)).toHaveLength(2);
  });

  it("arc color reflects risk category when nothing selected", () => {
    const safe = toGlobeArcs([makeNeo({ riskCategory: "Safe" })], null)[0];
    const critical = toGlobeArcs([makeNeo({ riskCategory: "Critical" })], null)[0];
    expect(safe.color).not.toEqual(critical.color);
  });

  it("non-selected arcs are dimmed when a selection is active", () => {
    const neos = [makeNeo({ des: "A" }), makeNeo({ des: "B" })];
    const arcs = toGlobeArcs(neos, "A");
    // arc for "A" should be full opacity, arc for "B" should be dimmed
    expect(arcs[0].color).not.toEqual(arcs[1].color);
    expect(arcs[1].color).toContain("0.2"); // dimmed to 20% opacity
  });

  it("arc altitude is proportional to miss distance", () => {
    const near = toGlobeArcs([makeNeo({ distAu: 0.005 })], null)[0];
    const far = toGlobeArcs([makeNeo({ distAu: 0.04 })], null)[0];
    expect(far.altitude).toBeGreaterThan(near.altitude);
  });
});

describe("toGlobePoints", () => {
  it("returns one point per Critical or Watchlist object", () => {
    const neos = [
      makeNeo({ riskCategory: "Critical" }),
      makeNeo({ des: "X", riskCategory: "Watchlist" }),
      makeNeo({ des: "Y", riskCategory: "Safe" }),
    ];
    expect(toGlobePoints(neos)).toHaveLength(2);
  });
});

describe("limitGlobeObjects", () => {
  it("returns at most max objects", () => {
    const neos = Array.from({ length: 80 }, (_, i) =>
      makeNeo({ des: `${i}`, riskScore: i * 0.05 })
    );
    expect(limitGlobeObjects(neos, 50)).toHaveLength(50);
  });

  it("prioritises Critical > Watchlist > Safe", () => {
    const safe = makeNeo({ des: "S", riskCategory: "Safe", riskScore: 0.5 });
    const watchlist = makeNeo({ des: "W", riskCategory: "Watchlist", riskScore: 2.0 });
    const critical = makeNeo({ des: "C", riskCategory: "Critical", riskScore: 3.5 });
    // With max=2, should keep critical and watchlist, drop safe
    const result = limitGlobeObjects([safe, watchlist, critical], 2);
    expect(result.map(o => o.des)).toEqual(expect.arrayContaining(["C", "W"]));
    expect(result.map(o => o.des)).not.toContain("S");
  });

  it("returns all objects when count is below max", () => {
    const neos = [makeNeo(), makeNeo({ des: "B" })];
    expect(limitGlobeObjects(neos, 50)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/globe/globeUtils.test.ts --no-coverage
```

Expected: `Cannot find module '@/components/globe/globeUtils'`

- [ ] **Step 3: Create the implementation**

```typescript
// components/globe/globeUtils.ts
import type { NeoObject, RiskCategory } from "@/lib/nasa/types";

export interface GlobeArc {
  des: string;       // used by EarthGlobe to identify which arc was clicked
  startLat: number;
  startLng: number;
  endLat: number;    // Earth centre (0, 0)
  endLng: number;
  altitude: number;  // relative arc height above globe
  color: string;
  label: string;
}

export interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
}

const RISK_COLOR: Record<RiskCategory, string> = {
  Safe: "rgba(74,222,128,0.75)",       // neo-safe
  Watchlist: "rgba(251,191,36,0.85)",  // neo-watchlist
  Critical: "rgba(248,113,113,0.95)",  // neo-critical
};

const DIMMED_COLOR = "rgba(148,163,184,0.2)"; // slate-400 at 20% — fades non-selected arcs

/** Integer hash of a string — deterministic, platform-independent */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/** Derives a consistent lat/lng from an asteroid's designation */
function designationToLatLng(des: string): { lat: number; lng: number } {
  const h = hashString(des);
  const lat = ((h % 140) - 70);          // -70° … +70° (avoids polar extremes)
  const lng = (((h >> 7) % 360) - 180);  // -180° … +180°
  return { lat, lng };
}

/**
 * Maps miss distance in AU to a globe arc altitude (0.1 – 0.7).
 * Closer approaches produce lower arcs; farther ones arc higher.
 * Clamped to 0.7 so objects right at the 0.05 AU limit don't overflow.
 */
function distToAltitude(distAu: number): number {
  const MAX_DIST_AU = 0.05;
  return Math.min(0.7, 0.1 + (distAu / MAX_DIST_AU) * 0.6);
}

/**
 * Returns the top N objects by risk score, prioritising Critical > Watchlist > Safe.
 * Used to cap the number of arcs on the globe and prevent visual overload.
 */
export function limitGlobeObjects(objects: NeoObject[], max: number = 50): NeoObject[] {
  const TIER: Record<RiskCategory, number> = { Critical: 0, Watchlist: 1, Safe: 2 };
  return [...objects]
    .sort((a, b) => {
      const tierDiff = TIER[a.riskCategory] - TIER[b.riskCategory];
      if (tierDiff !== 0) return tierDiff;
      return b.riskScore - a.riskScore; // within same tier, higher score first
    })
    .slice(0, max);
}

/**
 * Converts NeoObject[] to arc data for react-globe.gl.
 * @param selectedDes — designation of the currently selected asteroid, or null for none.
 *   When a selection is active, non-selected arcs are dimmed to 20% opacity.
 */
export function toGlobeArcs(objects: NeoObject[], selectedDes: string | null): GlobeArc[] {
  const hasSelection = selectedDes !== null;
  return objects.map((o) => {
    const { lat, lng } = designationToLatLng(o.des);
    const isSelected = o.des === selectedDes;
    return {
      des: o.des,
      startLat: lat,
      startLng: lng,
      endLat: 0,
      endLng: 0,
      altitude: distToAltitude(o.distAu),
      color: hasSelection && !isSelected ? DIMMED_COLOR : RISK_COLOR[o.riskCategory],
      label: `${o.fullname || o.des} — ${(o.distAu * 1000).toFixed(1)}k km`,
    };
  });
}

/** Returns glowing surface points for Watchlist and Critical objects only */
export function toGlobePoints(objects: NeoObject[]): GlobePoint[] {
  return objects
    .filter((o) => o.riskCategory !== "Safe")
    .map((o) => {
      const { lat, lng } = designationToLatLng(o.des);
      const sizePx = o.riskCategory === "Critical" ? 0.6 : 0.35;
      return {
        lat,
        lng,
        size: sizePx,
        color: RISK_COLOR[o.riskCategory],
        label: o.fullname || o.des,
      };
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/globe/globeUtils.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/globe/globeUtils.ts __tests__/globe/globeUtils.test.ts
git commit -m "feat: globe data utils — NeoObject[] to arc/point data"
```

---

## Task 3: EarthGlobe React component

**Files:**
- Create: `components/globe/EarthGlobe.tsx`

`react-globe.gl` exposes a `<Globe>` React component. Because it uses WebGL / Three.js it **cannot** run in SSR. We keep this file pure client code and load it through a wrapper in the next task.

- [ ] **Step 1: Create the component**

```typescript
// components/globe/EarthGlobe.tsx
"use client";

import { useRef, useEffect } from "react";
import Globe from "react-globe.gl";
import type { NeoObject } from "@/lib/nasa/types";
import { toGlobeArcs, toGlobePoints, type GlobeArc } from "./globeUtils";

interface Props {
  objects: NeoObject[];
  selectedDes: string | null;
  onSelectDes: (des: string | null) => void;
  /** px — parent should pass a fixed value for SSR/hydration safety */
  width?: number;
  height?: number;
}

export function EarthGlobe({ objects, selectedDes, onSelectDes, width = 480, height = 480 }: Props) {
  const globeEl = useRef<any>(null);

  // Start with a gentle tilt and auto-rotate
  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    g.pointOfView({ lat: 15, lng: 30, altitude: 2 }, 0);
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.4;
  }, []);

  const arcs = toGlobeArcs(objects, selectedDes);
  const points = toGlobePoints(objects);

  function handleArcClick(arc: GlobeArc) {
    // Toggle: clicking the already-selected arc deselects it
    onSelectDes(arc.des === selectedDes ? null : arc.des);
  }

  return (
    <Globe
      ref={globeEl}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.12}
      // Approach arcs
      arcsData={arcs}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcAltitude="altitude"
      arcColor="color"
      arcLabel="label"
      arcDashLength={0.4}
      arcDashGap={0.2}
      arcDashAnimateTime={2500}
      arcStroke={(arc: GlobeArc) => (arc.des === selectedDes ? 1.2 : 0.5)}
      onArcClick={handleArcClick}
      // Alert points (Watchlist / Critical only)
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={0.01}
      pointRadius="size"
      pointColor="color"
      pointLabel="label"
    />
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

If `react-globe.gl` lacks types, add a shim:

```typescript
// types/react-globe.gl.d.ts  (only if tsc complains about missing module)
declare module "react-globe.gl" {
  import React from "react";
  const Globe: React.ForwardRefExoticComponent<any>;
  export default Globe;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/globe/EarthGlobe.tsx
git commit -m "feat: EarthGlobe component with asteroid approach arcs"
```

---

## Task 4: EarthGlobeWrapper (SSR-safe) + integrate into dashboard

**Files:**
- Create: `components/globe/EarthGlobeWrapper.tsx`
- Modify: `components/layout/DashboardClient.tsx`

- [ ] **Step 1: Create the SSR-safe wrapper**

The wrapper owns `selectedDes` state and renders both the globe and a detail panel for the selected asteroid.

```typescript
// components/globe/EarthGlobeWrapper.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { NeoObject } from "@/lib/nasa/types";
import { RiskBadge } from "@/components/cards/RiskBadge";
import { limitGlobeObjects } from "./globeUtils";

const EarthGlobe = dynamic(
  () => import("./EarthGlobe").then((m) => m.EarthGlobe),
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
  objects: NeoObject[];
}

export function EarthGlobeWrapper({ objects }: Props) {
  const [selectedDes, setSelectedDes] = useState<string | null>(null);

  // Cap at 50 objects, prioritising highest-risk first
  const limited = limitGlobeObjects(objects, 50);
  const selected = selectedDes ? limited.find(o => o.des === selectedDes) ?? null : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="shrink-0">
        <EarthGlobe
          objects={limited}
          selectedDes={selectedDes}
          onSelectDes={setSelectedDes}
          width={480}
          height={480}
        />
        <p className="text-center text-xs text-slate-600 mt-1 font-mono">
          Showing top {limited.length} objects · Click an arc to select
        </p>
      </div>

      {/* Detail panel — shown when an asteroid is selected */}
      <div className="flex-1 min-w-[220px]">
        {selected ? (
          <div className="bg-space-800 border border-space-600 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-mono text-white leading-snug">
                {selected.fullname || selected.des}
              </p>
              <button
                onClick={() => setSelectedDes(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                aria-label="Deselect asteroid"
              >
                <X size={14} />
              </button>
            </div>
            <RiskBadge category={selected.riskCategory} />
            <dl className="space-y-1.5 text-xs font-mono">
              <Row label="Miss distance" value={`${(selected.distAu * 384400).toFixed(0)} × Moon`} />
              <Row label="Speed" value={`${selected.velocityKmS.toFixed(1)} km/s`} />
              <Row label="Diameter" value={`~${(selected.diameterKm * 1000).toFixed(0)} m`} />
              <Row label="Risk score" value={selected.riskScore.toFixed(2)} />
              <Row
                label="Close approach"
                value={new Date(selected.closeApproachDate).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              />
            </dl>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-xs text-slate-500 font-mono pt-2">
            <p className="text-slate-400">Click any arc on the globe to see details.</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neo-safe inline-block shrink-0" />
              Safe
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neo-watchlist inline-block shrink-0" />
              Watchlist
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neo-critical inline-block shrink-0" />
              Critical
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-300 text-right">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Add globe section to DashboardClient**

Open `components/layout/DashboardClient.tsx`. Find the `<main>` content section (the `space-y-6` div that currently starts with the mobile filter button). Add the globe section after the filter button row and before the charts grid:

```typescript
// Add this import at the top of DashboardClient.tsx
import { EarthGlobeWrapper } from "@/components/globe/EarthGlobeWrapper";
```

Then add this block inside `<main>` before `{/* Charts row */}`:

```tsx
{/* Globe section */}
<section className="bg-space-900 border border-space-700 rounded-xl p-4 sm:p-6">
  <h2 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-1">
    Approach Trajectories
  </h2>
  <p className="text-xs text-slate-500 mb-4">
    Animated arcs show each asteroid's path relative to Earth. Arc height = miss distance.{" "}
    <span className="text-slate-600 italic">
      Arc positions are approximate — NASA does not publish the exact direction each
      asteroid approaches from, so positions are derived from the asteroid's name.
    </span>
  </p>
  <EarthGlobeWrapper objects={filtered} />
</section>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Run dev server and visually check**

```bash
npm run dev
```

Open `http://localhost:3000`. The globe should appear with animated arcs. Check:
- Globe loads (not blank)
- Arcs animate
- No console errors about SSR / document

- [ ] **Step 5: Commit**

```bash
git add components/globe/EarthGlobeWrapper.tsx components/layout/DashboardClient.tsx
git commit -m "feat: integrate 3D Earth globe with asteroid approach arcs into dashboard"
```

---

## Task 5: HeroIntro — explain the app in plain language

**Files:**
- Create: `components/layout/HeroIntro.tsx`
- Modify: `components/layout/DashboardClient.tsx`

The current app drops users straight into stats with no context. New users should immediately understand: *what are we tracking, why does it matter, what do the colours mean.*

- [ ] **Step 1: Create HeroIntro component**

```tsx
// components/layout/HeroIntro.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Eye, ShieldCheck } from "lucide-react";

export function HeroIntro() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-space-950 via-space-900 to-space-950 border border-space-700 rounded-xl p-5 sm:p-6">
      {/* Headline */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-white leading-snug">
            Asteroids passing close to Earth — right now
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-xl">
            Every day, small rocks fly past our planet. Most are harmless. A few are
            worth watching. This tracker pulls live data from NASA and scores each
            object by how much energy it would deliver if it hit.
          </p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-1"
          aria-expanded={expanded}
        >
          {expanded ? (
            <><ChevronUp size={14} /> Less info</>
          ) : (
            <><ChevronDown size={14} /> How does it work?</>
          )}
        </button>
      </div>

      {/* Risk key — always visible */}
      <div className="mt-4 flex flex-wrap gap-3">
        <RiskPill
          icon={<ShieldCheck size={13} className="text-neo-safe" />}
          label="Safe"
          desc="No concern — just passing by"
          color="text-neo-safe"
          bg="bg-neo-safe/10 border-neo-safe/30"
        />
        <RiskPill
          icon={<Eye size={13} className="text-neo-watchlist" />}
          label="Watchlist"
          desc="Notable — worth monitoring"
          color="text-neo-watchlist"
          bg="bg-neo-watchlist/10 border-neo-watchlist/30"
        />
        <RiskPill
          icon={<AlertTriangle size={13} className="text-neo-critical" />}
          label="Critical"
          desc="High kinetic energy relative to miss distance"
          color="text-neo-critical"
          bg="bg-neo-critical/10 border-neo-critical/30"
        />
      </div>

      {/* Expandable explainer */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-space-700 grid sm:grid-cols-3 gap-4 text-xs text-slate-400">
          <div>
            <p className="text-slate-300 font-medium mb-1">What is an NEO?</p>
            <p>
              A Near-Earth Object (NEO) is any asteroid or comet whose orbit brings
              it within 0.05 AU of Earth's orbit — about 7.5 million km, or 20× the
              distance to the Moon.
            </p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">How is risk calculated?</p>
            <p>
              We combine mass, speed, and miss distance into a single score using
              the formula: <span className="font-mono">log₁₀(mass × speed / distance² + 1)</span>.
              A score of 3 or above is flagged Critical.
            </p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">Is this official?</p>
            <p>
              Data is from NASA's JPL Close Approach Database, updated every 12 hours.
              The risk score is a portfolio demo — not an official NASA hazard assessment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface PillProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  bg: string;
}

function RiskPill({ icon, label, desc, color, bg }: PillProps) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${bg}`}>
      {icon}
      <span className={`font-semibold ${color}`}>{label}</span>
      <span className="text-slate-500 hidden sm:inline">— {desc}</span>
    </div>
  );
}
```

- [ ] **Step 2: Add HeroIntro to DashboardClient**

Add import at top of `DashboardClient.tsx`:
```typescript
import { HeroIntro } from "@/components/layout/HeroIntro";
```

Add `<HeroIntro />` as the **first child** inside `<main>` (before the mobile filter button row):

```tsx
<main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
  <HeroIntro />

  {/* Mobile filter button — existing code */}
  ...
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Check in browser**

```bash
npm run dev
```

Expected: Hero banner appears at top. "How does it work?" expands on click. Risk pills show on all screen sizes.

- [ ] **Step 5: Commit**

```bash
git add components/layout/HeroIntro.tsx components/layout/DashboardClient.tsx
git commit -m "feat: HeroIntro section — plain-language intro for general audiences"
```

---

## Task 6: TopBar — clearer tagline

**Files:**
- Modify: `components/layout/TopBar.tsx`

Read the file first. The current TopBar shows "NEO-Guardian" and stat cards but no descriptive subtitle. We'll add a concise subtitle so users on first visit understand what they're looking at.

- [ ] **Step 1: Read the current file**

Read `components/layout/TopBar.tsx` to understand its exact JSX structure before editing.

- [ ] **Step 2: Add subtitle below the title**

Locate the element showing "NEO-Guardian" (or similar app name). Add a subtitle just beneath it:

```tsx
<p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
  Live NASA data · Near-Earth asteroid tracker · Updates every 12 hours
</p>
```

- [ ] **Step 3: Improve StatCard labels (make them plain)**

The three stat cards currently show labels like "Objects Tracked", "Critical Risk", "Nearest Approach". Update them to be more human:

- "Objects Tracked" → keep as-is (already clear)
- "Critical Risk" → "High-Risk Objects"
- "Nearest Approach" → keep the existing `sub={nearest?.fullname}` asteroid name AND add the Moon-distance conversion

The current code passes `sub={nearest?.fullname}`. Update it to show both name and distance:
```tsx
sub={nearest ? `${nearest.fullname || nearest.des} · ${(nearest.distAu * 389).toFixed(0)}× Moon` : undefined}
```
(`nearest` is the variable already computed in `TopBar.tsx` as the closest NeoObject by `distAu`)

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/layout/TopBar.tsx
git commit -m "feat: TopBar subtitle + Moon-distance stat for non-technical users"
```

---

## Task 7: Chart label improvements

**Files:**
- Modify: `components/charts/ApproachTimeline.tsx`
- Modify: `components/charts/RiskRadar.tsx`
- Modify: `components/charts/SizeDistribution.tsx`

Read each file before editing. Add a one-line description below each chart title so users know what they're looking at.

- [ ] **Step 1: Read all three chart files**

Read `components/charts/ApproachTimeline.tsx`, `components/charts/RiskRadar.tsx`, and `components/charts/SizeDistribution.tsx`.

- [ ] **Step 2: ApproachTimeline — add description**

Below the chart title heading, add:

```tsx
<p className="text-xs text-slate-500 mb-3">
  How many asteroids fly past each week over the next 6 months.
  Peaks indicate busy periods — not increased danger.
</p>
```

- [ ] **Step 3: RiskRadar — rename title + replace existing description**

`RiskRadar.tsx` already has a one-line description `<p>`. **Replace** it (do not add a second paragraph).

Change the chart title to: `Speed vs. Distance`

Replace the existing `<p className="text-xs ...">` with:

```tsx
<p className="text-xs text-slate-500 mb-3">
  Each dot is one asteroid. Closer to the left = nearer to Earth.
  Higher up = faster. Bigger dot = larger asteroid.
  Red dots are the ones to watch.
</p>
```

- [ ] **Step 4: SizeDistribution — add description**

```tsx
<p className="text-xs text-slate-500 mb-3">
  Most near-Earth asteroids are small (&lt;50 m) — roughly the size of a house.
  Objects above 1 km would have global consequences.
</p>
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/charts/ApproachTimeline.tsx components/charts/RiskRadar.tsx components/charts/SizeDistribution.tsx
git commit -m "feat: plain-language descriptions on all three charts"
```

---

## Task 8: Full build check

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass, including new globe utils tests.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: Build succeeds. The globe is client-only so no SSR issues should occur. If `react-globe.gl` emits a "window is not defined" error at build time, it means the dynamic import boundary is missing — check `EarthGlobeWrapper.tsx` uses `ssr: false`.

- [ ] **Step 3: Serve and final visual check**

```bash
npm run start
```

Visit `http://localhost:3000`. Confirm:
- [ ] HeroIntro banner visible, "How does it work?" expands
- [ ] Risk pills show on mobile and desktop
- [ ] Globe loads with animated arcs
- [ ] Hovering an arc shows the asteroid name
- [ ] Globe rotates automatically
- [ ] Dragging the globe rotates it manually
- [ ] Charts have plain descriptions
- [ ] TopBar has subtitle + Moon-distance stat
- [ ] No console errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: 3D Earth globe + user-friendly UI overhaul complete"
```

---

## Notes

### Why the positions are approximate
NASA's CAD API returns miss distance, velocity, and date — but not the 3D approach direction (right ascension/declination). Actual trajectory vectors require querying NASA Horizons for each object individually, which would be a separate API and much higher complexity. For a visual demo, deterministic positions derived from the asteroid designation are clear and consistent.

### Globe performance
`react-globe.gl` bundles Three.js (~600KB gzipped). It is loaded lazily via `next/dynamic` with `ssr: false`, so it does not affect initial page load. The globe renders in a single `<canvas>` element and handles hundreds of arcs without frame-rate issues.

### User-facing language strategy
Technical users can still read AU, km/s, H magnitude, and risk scores in the table. The new HeroIntro, chart descriptions, and TopBar stat speak to non-technical users without removing the technical content — it layers explanation on top, not in place of.
