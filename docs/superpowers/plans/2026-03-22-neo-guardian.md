# NEO-Guardian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark "Mission Control" dashboard that tracks Near-Earth Objects using NASA's SSD APIs, with a custom Impact Hazard Score data-science layer, deployed on Vercel via ISR.

**Architecture:** A Next.js App Router app with two API Route proxies (one for the CAD close-approach API, one for the Sentry risk API) that normalize the raw NASA data (parsing custom date formats, estimating diameters from H magnitude). The main dashboard page fetches from those proxies at build time and revalidates every 12 hours (ISR). All chart rendering uses Recharts on the client side.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS **v3** (pinned — v4 breaks `tailwind.config.ts` and `@tailwind` directives), Recharts, Lucide React, TypeScript, Vercel (ISR)

---

## Key API Facts (Discovered from Live Endpoints)

- **CAD API** returns `data` as array-of-arrays aligned to `fields` header. Date field `cd` is `"2026-Jan-01 15:44"` (NASA custom, not Julian). `jd` is Julian Date but `cd` is already human-ish — we parse `cd`. `diameter` is `null` for ~99% of records; estimate from `h` (absolute magnitude) instead.
- **Sentry API** returns `data` as array-of-objects. `diameter` is always present. No miss distance (it's impact-risk focused, not close-approach).
- CAD requests require `date-min`, `date-max`, and `dist-max` params. Sentry accepts no `limit` param (returns all ~2100 records, we filter on backend).

---

## File Structure

```
app/
├── layout.tsx                    # Root layout: dark bg, Geist fonts, metadata
├── page.tsx                      # Main dashboard page — ISR (revalidate: 43200)
├── globals.css                   # Tailwind base + CSS vars for mission-control palette
└── api/
    ├── close-approaches/
    │   └── route.ts              # Proxy: CAD API → NeoObject[]
    └── sentry/
        └── route.ts              # Proxy: Sentry API → SentryObject[]

lib/
├── utils.ts                      # cn() helper (clsx + tailwind-merge)
└── nasa/
    ├── types.ts                  # NeoObject, SentryObject, RiskCategory, RiskScore
    ├── cadParser.ts              # Parse CAD array-of-arrays response → NeoObject[]
    ├── dateUtils.ts              # Parse "2026-Jan-01 15:44" → ISO 8601 string
    ├── diameterEstimate.ts       # Estimate diameter (km) from H magnitude
    └── riskScore.ts              # Impact Hazard Score + Safe/Watchlist/Critical

components/
├── layout/
│   ├── TopBar.tsx                # Mission-control header + 3 stat cards (always shows unfiltered totals)
│   ├── Sidebar.tsx               # Filter panel (min size, risk category)
│   └── DashboardClient.tsx       # "use client" orchestrator — owns filter state, renders charts + table
├── cards/
│   ├── StatCard.tsx              # Single stat card (label + value + icon)
│   └── RiskBadge.tsx             # Colored badge: Safe / Watchlist / Critical
├── charts/
│   ├── ApproachTimeline.tsx      # Recharts LineChart — approaches over time
│   ├── SizeDistribution.tsx      # Recharts BarChart — objects by size bucket
│   └── RiskRadar.tsx             # Recharts ScatterChart — velocity vs miss distance
├── table/
│   └── NeoTable.tsx              # Sortable table of NEOs + risk badge + score
└── methodology/
    └── MethodologySection.tsx    # Data-science explainer with formula

__tests__/
└── nasa/
    ├── dateUtils.test.ts
    ├── diameterEstimate.test.ts
    ├── riskScore.test.ts
    └── cadParser.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via `npx create-next-app`)
- Modify: `tailwind.config.ts` — add custom mission-control colors
- Modify: `app/globals.css` — dark base + CSS custom properties
- Create: `tsconfig.json` path alias `@/*`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd "C:\Users\SwankyDwarf\OneDrive\Desktop\Claude_Projects\nasa-project"
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --no-eslint
```

Expected: project files created, `package.json` present.

- [ ] **Step 1b: Pin Tailwind to v3**

`create-next-app` may scaffold Tailwind v4, which uses a different config format. Pin to v3 to match this plan:

```bash
npm install -D tailwindcss@^3 postcss autoprefixer
```

Verify `package.json` shows `"tailwindcss": "^3.x.x"` under devDependencies.

- [ ] **Step 2: Install dependencies**

```bash
npm install recharts lucide-react
npm install -D @types/node
```

- [ ] **Step 3: Update `tailwind.config.ts` with mission-control palette**

Replace the default content with:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mission control palette
        space: {
          950: "#030712",
          900: "#0a0f1e",
          800: "#0f172a",
          700: "#1e293b",
          600: "#334155",
        },
        neo: {
          safe: "#22c55e",        // green-500
          watchlist: "#f59e0b",   // amber-500
          critical: "#ef4444",    // red-500
          accent: "#38bdf8",      // sky-400
        },
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "monospace"],
        sans: ["var(--font-geist-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Update `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #030712;
  --foreground: #e2e8f0;
}

body {
  background-color: var(--background);
  color: var(--foreground);
}

/* Custom scrollbar for mission-control feel */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0f172a; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #38bdf8; }
```

- [ ] **Step 5: Create test config**

```bash
npm install -D jest @types/jest ts-jest jest-environment-node
```

Create `jest.config.ts`:

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};

export default config;
```

Add to `package.json` scripts: `"test": "jest"`

- [ ] **Step 6: Create `__tests__/nasa/` directory and placeholder**

```bash
mkdir -p __tests__/nasa
```

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with mission-control Tailwind config"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/nasa/types.ts`

- [ ] **Step 1: Write types**

```typescript
// lib/nasa/types.ts

export type RiskCategory = "Safe" | "Watchlist" | "Critical";

/** Normalized close-approach object from NASA CAD API */
export interface NeoObject {
  des: string;              // e.g. "2025 YL4"
  fullname: string;         // trimmed, e.g. "(2025 YL4)"
  closeApproachDate: string; // ISO 8601, e.g. "2026-01-01T15:44:00Z"
  distAu: number;           // miss distance in AU
  distKm: number;           // miss distance in km
  velocityKmS: number;      // relative velocity km/s
  diameterKm: number;       // estimated (from H mag)
  hMag: number;             // absolute magnitude H
  riskScore: number;        // 0–100 normalized score
  riskCategory: RiskCategory;
}

/** Object from NASA Sentry API (impact-risk objects) */
export interface SentryObject {
  des: string;
  fullname: string;
  diameterKm: number;
  velocityKmS: number;
  impactProbability: number;   // e.g. 0.002743
  palmeroScale: number;        // ps_max as number
  impactYearRange: string;     // e.g. "2056-2113"
  nImpacts: number;
}

/** Response from /api/close-approaches */
export interface CloseApproachesResponse {
  count: number;
  revalidatedAt: string;    // ISO timestamp of server fetch
  objects: NeoObject[];
}

/** Response from /api/sentry */
export interface SentryResponse {
  count: number;
  revalidatedAt: string;
  objects: SentryObject[];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/nasa/types.ts
git commit -m "feat: add TypeScript types for NASA API responses"
```

---

## Task 3: Date Utility (TDD)

**Files:**
- Create: `lib/nasa/dateUtils.ts`
- Create: `__tests__/nasa/dateUtils.test.ts`

NASA CAD returns dates as `"2026-Jan-01 15:44"` — a non-standard format. We parse it to ISO 8601.

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/nasa/dateUtils.test.ts
import { parseCadDate } from "@/lib/nasa/dateUtils";

describe("parseCadDate", () => {
  it("converts NASA cd format to ISO 8601", () => {
    expect(parseCadDate("2026-Jan-01 15:44")).toBe("2026-01-01T15:44:00.000Z");
  });

  it("handles all month abbreviations", () => {
    expect(parseCadDate("2025-Dec-31 00:00")).toBe("2025-12-31T00:00:00.000Z");
    expect(parseCadDate("2026-Mar-15 09:30")).toBe("2026-03-15T09:30:00.000Z");
    expect(parseCadDate("2026-Sep-07 22:10")).toBe("2026-09-07T22:10:00.000Z");
  });

  it("returns null for invalid input", () => {
    expect(parseCadDate("")).toBeNull();
    expect(parseCadDate("garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/nasa/dateUtils.test.ts --no-coverage
```

Expected: FAIL with "Cannot find module '@/lib/nasa/dateUtils'"

- [ ] **Step 3: Implement dateUtils**

```typescript
// lib/nasa/dateUtils.ts

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04",
  May: "05", Jun: "06", Jul: "07", Aug: "08",
  Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/**
 * Parses NASA CAD close-approach date format: "2026-Jan-01 15:44"
 * Returns ISO 8601 string or null if invalid.
 */
export function parseCadDate(cd: string): string | null {
  if (!cd) return null;
  const match = cd.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})\s(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, monAbbr, day, hour, min] = match;
  const month = MONTH_MAP[monAbbr];
  if (!month) return null;
  return new Date(`${year}-${month}-${day}T${hour}:${min}:00Z`).toISOString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/nasa/dateUtils.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/nasa/dateUtils.ts __tests__/nasa/dateUtils.test.ts
git commit -m "feat: add NASA cd date parser with tests"
```

---

## Task 4: Diameter Estimation (TDD)

**Files:**
- Create: `lib/nasa/diameterEstimate.ts`
- Create: `__tests__/nasa/diameterEstimate.test.ts`

Since ~99% of CAD records have `diameter = null`, we estimate from absolute magnitude H using the standard formula: `D = (1329 / sqrt(p)) × 10^(-H/5)` km with assumed geometric albedo `p = 0.14`.

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/nasa/diameterEstimate.test.ts
import { estimateDiameterKm } from "@/lib/nasa/diameterEstimate";

describe("estimateDiameterKm", () => {
  it("returns provided diameter string as a number (ignores H)", () => {
    expect(estimateDiameterKm("0.5", 18)).toBeCloseTo(0.5, 4);
    expect(estimateDiameterKm("0.066", 22)).toBeCloseTo(0.066, 4);
  });

  it("estimates diameter from H magnitude when diameter is null", () => {
    // H=17.75 → ~1 km asteroid (standard result)
    const d = estimateDiameterKm(null, 17.75);
    expect(d).toBeGreaterThan(0.8);
    expect(d).toBeLessThan(1.2);
  });

  it("returns a smaller diameter for fainter (higher H) objects", () => {
    const small = estimateDiameterKm(null, 25);
    const large = estimateDiameterKm(null, 18);
    expect(small).toBeLessThan(large);
  });

  it("handles H = 0", () => {
    const d = estimateDiameterKm(null, 0);
    expect(d).toBeGreaterThan(100); // very bright = very large
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/nasa/diameterEstimate.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// lib/nasa/diameterEstimate.ts

const ALBEDO = 0.14; // geometric albedo for typical S-type asteroid

/**
 * Returns diameter in km.
 * Uses provided diameter string if non-null, otherwise estimates from H magnitude.
 * Formula: D = (1329 / sqrt(p)) × 10^(-H/5)
 */
export function estimateDiameterKm(
  diameterStr: string | null | undefined,
  hMag: number
): number {
  if (diameterStr != null && diameterStr !== "") {
    const parsed = parseFloat(diameterStr);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return (1329 / Math.sqrt(ALBEDO)) * Math.pow(10, -hMag / 5);
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest __tests__/nasa/diameterEstimate.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/nasa/diameterEstimate.ts __tests__/nasa/diameterEstimate.test.ts
git commit -m "feat: add asteroid diameter estimator from H magnitude with tests"
```

---

## Task 5: Risk Score (TDD)

**Files:**
- Create: `lib/nasa/riskScore.ts`
- Create: `__tests__/nasa/riskScore.test.ts`

**Score formula:**
```
mass_kg     = (4/3) × π × (diameter_m / 2)³ × density_kg_m3
dist_m      = dist_au × AU_IN_METERS
velocity_ms = velocity_km_s × 1000
rawScore    = (mass_kg × velocity_ms) / dist_m²
logScore    = log10(rawScore + 1)
```
Category thresholds (tuned to real data distribution):
- `logScore >= 3.0` → Critical
- `logScore >= 1.5` → Watchlist
- `logScore < 1.5` → Safe

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/nasa/riskScore.test.ts
import { computeRiskScore, categorizeRisk } from "@/lib/nasa/riskScore";

describe("computeRiskScore", () => {
  it("returns a positive number", () => {
    const score = computeRiskScore({
      diameterKm: 0.14,
      velocityKmS: 20,
      distAu: 0.02,
    });
    expect(score).toBeGreaterThan(0);
  });

  it("increases with larger diameter", () => {
    const small = computeRiskScore({ diameterKm: 0.1, velocityKmS: 10, distAu: 0.05 });
    const large = computeRiskScore({ diameterKm: 1.0, velocityKmS: 10, distAu: 0.05 });
    expect(large).toBeGreaterThan(small);
  });

  it("increases with higher velocity", () => {
    const slow = computeRiskScore({ diameterKm: 0.5, velocityKmS: 5, distAu: 0.05 });
    const fast = computeRiskScore({ diameterKm: 0.5, velocityKmS: 30, distAu: 0.05 });
    expect(fast).toBeGreaterThan(slow);
  });

  it("decreases with larger miss distance", () => {
    const near = computeRiskScore({ diameterKm: 0.5, velocityKmS: 10, distAu: 0.01 });
    const far  = computeRiskScore({ diameterKm: 0.5, velocityKmS: 10, distAu: 0.05 });
    expect(near).toBeGreaterThan(far);
  });
});

describe("categorizeRisk", () => {
  it("returns Safe for low scores", () => {
    expect(categorizeRisk(0.5)).toBe("Safe");
    expect(categorizeRisk(1.4)).toBe("Safe");
  });

  it("returns Watchlist for mid scores", () => {
    expect(categorizeRisk(1.5)).toBe("Watchlist");
    expect(categorizeRisk(2.9)).toBe("Watchlist");
  });

  it("returns Critical for high scores", () => {
    expect(categorizeRisk(3.0)).toBe("Critical");
    expect(categorizeRisk(5.0)).toBe("Critical");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/nasa/riskScore.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// lib/nasa/riskScore.ts
import type { RiskCategory } from "./types";

const AU_IN_METERS = 1.496e11;      // meters per AU
const DENSITY_KG_M3 = 2000;         // typical S-type asteroid density

interface ScoreInput {
  diameterKm: number;
  velocityKmS: number;
  distAu: number;
}

/**
 * Computes log10(Impact Hazard Score + 1).
 * Formula: log10( (mass_kg × velocity_m/s) / dist_m² + 1 )
 */
export function computeRiskScore({ diameterKm, velocityKmS, distAu }: ScoreInput): number {
  const radiusM = (diameterKm * 1000) / 2;
  const massKg = (4 / 3) * Math.PI * Math.pow(radiusM, 3) * DENSITY_KG_M3;
  const velocityMs = velocityKmS * 1000;
  const distM = distAu * AU_IN_METERS;
  const rawScore = (massKg * velocityMs) / Math.pow(distM, 2);
  return Math.log10(rawScore + 1);
}

/** Maps a log-scale risk score to a human-readable risk category. */
export function categorizeRisk(logScore: number): RiskCategory {
  if (logScore >= 3.0) return "Critical";
  if (logScore >= 1.5) return "Watchlist";
  return "Safe";
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest __tests__/nasa/riskScore.test.ts --no-coverage
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/nasa/riskScore.ts __tests__/nasa/riskScore.test.ts
git commit -m "feat: add Impact Hazard Score computation with categorization and tests"
```

---

## Task 6: CAD API Parser (TDD)

**Files:**
- Create: `lib/nasa/cadParser.ts`
- Create: `__tests__/nasa/cadParser.test.ts`

The CAD API returns `{ fields: string[], data: string[][] }`. We zip fields onto each row and normalize.

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/nasa/cadParser.test.ts
import { parseCadResponse } from "@/lib/nasa/cadParser";

const mockCadResponse = {
  signature: { version: "1.5", source: "NASA/JPL" },
  count: 2,
  fields: ["des", "orbit_id", "jd", "cd", "dist", "dist_min", "dist_max", "v_rel", "v_inf", "t_sigma_f", "h", "diameter", "diameter_sigma", "fullname"],
  data: [
    ["2025 YL4", "1", "2461042.0", "2026-Jan-01 15:44", "0.04", "0.039", "0.041", "15.5", "15.4", "00:10", "22.5", null, null, "       (2025 YL4)"],
    ["2015 FS33", "20", "2460777.0", "2025-Apr-12 01:14", "0.0375", "0.0375", "0.0375", "20.7", "20.7", "< 00:01", "22.56", "0.066", "0.013", "       (2015 FS33)"],
  ],
};

describe("parseCadResponse", () => {
  it("returns an array of NeoObjects", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result).toHaveLength(2);
  });

  it("trims fullname whitespace", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].fullname).toBe("(2025 YL4)");
  });

  it("parses closeApproachDate to ISO 8601", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].closeApproachDate).toBe("2026-01-01T15:44:00.000Z");
  });

  it("converts distAu and computes distKm", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].distAu).toBeCloseTo(0.04, 4);
    expect(result[0].distKm).toBeCloseTo(0.04 * 1.496e8, -2);
  });

  it("uses provided diameter when available", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[1].diameterKm).toBeCloseTo(0.066, 3);
  });

  it("estimates diameter from H when diameter is null", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].diameterKm).toBeGreaterThan(0);
  });

  it("computes a riskScore and riskCategory", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].riskScore).toBeGreaterThan(0);
    expect(["Safe", "Watchlist", "Critical"]).toContain(result[0].riskCategory);
  });

  it("filters out rows with unparseable dates", () => {
    const bad = {
      ...mockCadResponse,
      data: [["X", "1", "0", "garbage date", "0.04", "0.04", "0.04", "10", "10", "00:00", "22", null, null, "X"]],
    };
    const result = parseCadResponse(bad);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/nasa/cadParser.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement `cadParser.ts`**

```typescript
// lib/nasa/cadParser.ts
import type { NeoObject } from "./types";
import { parseCadDate } from "./dateUtils";
import { estimateDiameterKm } from "./diameterEstimate";
import { computeRiskScore, categorizeRisk } from "./riskScore";

const AU_TO_KM = 1.496e8;

interface RawCadResponse {
  fields: string[];
  data: (string | null)[][];
}

export function parseCadResponse(raw: RawCadResponse): NeoObject[] {
  const { fields, data } = raw;
  const idx = Object.fromEntries(fields.map((f, i) => [f, i]));

  const results: NeoObject[] = [];

  for (const row of data) {
    const get = (field: string) => row[idx[field]] ?? null;

    const cdStr = get("cd") as string | null;
    const closeApproachDate = cdStr ? parseCadDate(cdStr) : null;
    if (!closeApproachDate) continue; // skip unparseable rows

    const distAu = parseFloat(get("dist") as string);
    const velocityKmS = parseFloat(get("v_rel") as string);
    const hMag = parseFloat(get("h") as string);
    const diameterKm = estimateDiameterKm(get("diameter") as string | null, hMag);

    const riskScore = computeRiskScore({ diameterKm, velocityKmS, distAu });
    const riskCategory = categorizeRisk(riskScore);

    results.push({
      des: get("des") as string,
      fullname: ((get("fullname") as string) ?? "").trim(),
      closeApproachDate,
      distAu,
      distKm: distAu * AU_TO_KM,
      velocityKmS,
      diameterKm,
      hMag,
      riskScore,
      riskCategory,
    });
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest __tests__/nasa/cadParser.test.ts --no-coverage
```

Expected: PASS (8 tests)

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all 19+ tests pass

- [ ] **Step 6: Commit**

```bash
git add lib/nasa/cadParser.ts __tests__/nasa/cadParser.test.ts
git commit -m "feat: add CAD API parser with normalization, date parsing, and scoring"
```

---

## Task 7: API Route — Close Approaches

**Files:**
- Create: `app/api/close-approaches/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/close-approaches/route.ts
import { NextResponse } from "next/server";
import { parseCadResponse } from "@/lib/nasa/cadParser";
import type { CloseApproachesResponse } from "@/lib/nasa/types";

const CAD_BASE = "https://ssd-api.jpl.nasa.gov/cad.api";
const TIMEOUT_MS = 15_000;

export const revalidate = 43200; // 12 hours

export async function GET() {
  // Query the next 6 months of close approaches within 0.05 AU
  const today = new Date();
  const sixMonths = new Date(today);
  sixMonths.setMonth(sixMonths.getMonth() + 6);

  const params = new URLSearchParams({
    "date-min": today.toISOString().split("T")[0],
    "date-max": sixMonths.toISOString().split("T")[0],
    "dist-max": "0.05",
    "diameter": "true",
    "fullname": "true",
    "sort": "date",
  });

  const url = `${CAD_BASE}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json(
        { error: `NASA API error: ${res.status}` },
        { status: 502 }
      );
    }

    const raw = await res.json();
    const objects = parseCadResponse(raw);

    const body: CloseApproachesResponse = {
      count: objects.length,
      revalidatedAt: new Date().toISOString(),
      objects,
    };

    return NextResponse.json(body);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "NASA API timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Then in a second terminal:

```bash
curl http://localhost:3000/api/close-approaches | head -c 500
```

Expected: JSON with `count`, `revalidatedAt`, `objects` array.

- [ ] **Step 3: Commit**

```bash
git add app/api/close-approaches/route.ts
git commit -m "feat: add /api/close-approaches proxy route with ISR and timeout"
```

---

## Task 8: API Route — Sentry

**Files:**
- Create: `app/api/sentry/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/sentry/route.ts
import { NextResponse } from "next/server";
import type { SentryResponse, SentryObject } from "@/lib/nasa/types";

const SENTRY_URL = "https://ssd-api.jpl.nasa.gov/sentry.api";
const TIMEOUT_MS = 15_000;

export const revalidate = 43200; // 12 hours

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(SENTRY_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({ error: `NASA Sentry API error: ${res.status}` }, { status: 502 });
    }

    const raw = await res.json();

    // Sort by impact probability descending and take top 50
    const sorted = [...raw.data].sort(
      (a: any, b: any) => parseFloat(b.ip) - parseFloat(a.ip)
    );

    const objects: SentryObject[] = sorted.slice(0, 50).map((item: any) => ({
      des: item.des,
      fullname: (item.fullname ?? item.des ?? "").trim(),
      diameterKm: parseFloat(item.diameter),
      velocityKmS: parseFloat(item.v_inf),
      impactProbability: parseFloat(item.ip),
      palmeroScale: parseFloat(item.ps_max),
      impactYearRange: item.range,
      nImpacts: item.n_imp,
    }));

    const body: SentryResponse = {
      count: objects.length,
      revalidatedAt: new Date().toISOString(),
      objects,
    };

    return NextResponse.json(body);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Sentry API timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual smoke test**

```bash
curl http://localhost:3000/api/sentry | head -c 500
```

Expected: JSON with top 50 Sentry objects by impact probability.

- [ ] **Step 3: Commit**

```bash
git add app/api/sentry/route.ts
git commit -m "feat: add /api/sentry proxy route returning top 50 impact-risk objects"
```

---

## Task 9: Root Layout (Dark Mission Control Shell)

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install Geist fonts package**

```bash
npm install geist
```

- [ ] **Step 2: Update the root layout**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEO-Guardian | Asteroid Proximity & Risk Dashboard",
  description:
    "Real-time Near-Earth Object tracking with custom Impact Hazard Scoring. Data powered by NASA's Small-Body Database.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-space-950 text-slate-200 font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx package.json package-lock.json
git commit -m "feat: add dark Mission Control root layout with Geist fonts"
```

---

## Task 10: Reusable UI Primitives

**Files:**
- Create: `components/cards/RiskBadge.tsx`
- Create: `components/cards/StatCard.tsx`

- [ ] **Step 1: Create `RiskBadge`**

```tsx
// components/cards/RiskBadge.tsx
import type { RiskCategory } from "@/lib/nasa/types";
import { cn } from "@/lib/utils";

interface Props {
  category: RiskCategory;
  className?: string;
}

const STYLES: Record<RiskCategory, string> = {
  Safe:      "bg-neo-safe/10 text-neo-safe border border-neo-safe/30",
  Watchlist: "bg-neo-watchlist/10 text-neo-watchlist border border-neo-watchlist/30",
  Critical:  "bg-neo-critical/10 text-neo-critical border border-neo-critical/30",
};

export function RiskBadge({ category, className }: Props) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider", STYLES[category], className)}>
      {category}
    </span>
  );
}
```

- [ ] **Step 2: Create `lib/utils.ts`** (for `cn` helper)

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 3: Create `StatCard`**

```tsx
// components/cards/StatCard.tsx
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({ label, value, sub, icon: Icon, iconColor = "text-neo-accent" }: Props) {
  return (
    <div className="bg-space-800 border border-space-600 rounded-lg p-4 flex items-start gap-3">
      <div className={`mt-0.5 ${iconColor}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-mono font-bold text-slate-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/cards/ lib/utils.ts package.json package-lock.json
git commit -m "feat: add RiskBadge and StatCard primitive components"
```

---

## Task 11: TopBar and Sidebar

> **Design note:** `TopBar` intentionally receives the full unfiltered `objects` array so its stat cards always reflect total tracked counts. The charts and table below receive the filtered subset. This is by design — the header communicates global mission status, not filtered state.

**Files:**
- Create: `components/layout/TopBar.tsx`
- Create: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `TopBar`**

```tsx
// components/layout/TopBar.tsx
import { Shield, Zap, Clock } from "lucide-react";
import { StatCard } from "@/components/cards/StatCard";
import type { NeoObject } from "@/lib/nasa/types";

interface Props {
  objects: NeoObject[];
  revalidatedAt: string;
}

export function TopBar({ objects, revalidatedAt }: Props) {
  const criticalCount = objects.filter(o => o.riskCategory === "Critical").length;
  const nearest = objects.reduce((min, o) => o.distAu < min.distAu ? o : min, objects[0]);
  const fastest = objects.reduce((max, o) => o.velocityKmS > max.velocityKmS ? o : max, objects[0]);

  return (
    <header className="border-b border-space-600 bg-space-900">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-space-700">
        <div className="flex items-center gap-3">
          <Shield className="text-neo-accent" size={24} />
          <span className="font-mono font-bold text-lg tracking-widest text-neo-accent uppercase">
            NEO-Guardian
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Real-time Asteroid Proximity &amp; Risk Dashboard
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <Clock size={12} />
          <span>Updated: {new Date(revalidatedAt).toUTCString()}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4">
        <StatCard
          label="Objects Tracked"
          value={objects.length}
          sub="Next 6 months, ≤ 0.05 AU"
          icon={Shield}
        />
        <StatCard
          label="Critical Risk"
          value={criticalCount}
          sub={`${objects.filter(o => o.riskCategory === "Watchlist").length} on watchlist`}
          icon={Zap}
          iconColor="text-neo-critical"
        />
        <StatCard
          label="Nearest Approach"
          value={nearest ? `${nearest.distAu.toFixed(4)} AU` : "N/A"}
          sub={nearest?.fullname}
          icon={Clock}
          iconColor="text-neo-watchlist"
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create `Sidebar`**

```tsx
// components/layout/Sidebar.tsx
"use client";

import { useState } from "react";
import type { RiskCategory } from "@/lib/nasa/types";
import { Filter } from "lucide-react";

// Note: date-range filter is descoped for this plan. Filters cover min-size and risk category only.
export interface FilterState {
  minDiameterM: number;       // meters
  riskCategories: RiskCategory[];
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

const CATEGORIES: RiskCategory[] = ["Safe", "Watchlist", "Critical"];
const SIZE_OPTIONS = [
  { label: "All sizes", value: 0 },
  { label: "> 10 m",   value: 10 },
  { label: "> 50 m",   value: 50 },
  { label: "> 100 m",  value: 100 },
  { label: "> 500 m",  value: 500 },
  { label: "> 1 km",   value: 1000 },
];

export function Sidebar({ filters, onChange }: Props) {
  function toggleCategory(cat: RiskCategory) {
    const has = filters.riskCategories.includes(cat);
    onChange({
      ...filters,
      riskCategories: has
        ? filters.riskCategories.filter(c => c !== cat)
        : [...filters.riskCategories, cat],
    });
  }

  return (
    <aside className="w-56 shrink-0 border-r border-space-600 bg-space-900 p-4 space-y-6">
      <div className="flex items-center gap-2 text-neo-accent font-mono text-xs uppercase tracking-widest">
        <Filter size={14} />
        <span>Filters</span>
      </div>

      {/* Size filter */}
      <div>
        <p className="text-xs font-mono text-slate-400 mb-2">Min Diameter</p>
        <select
          value={filters.minDiameterM}
          onChange={e => onChange({ ...filters, minDiameterM: Number(e.target.value) })}
          className="w-full bg-space-800 border border-space-600 rounded px-2 py-1.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neo-accent"
        >
          {SIZE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Risk category filter */}
      <div>
        <p className="text-xs font-mono text-slate-400 mb-2">Risk Category</p>
        <div className="space-y-2">
          {CATEGORIES.map(cat => (
            <label key={cat} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.riskCategories.includes(cat)}
                onChange={() => toggleCategory(cat)}
                className="accent-sky-400"
              />
              <span className="text-sm font-mono text-slate-300">{cat}</span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/
git commit -m "feat: add TopBar stats header and Sidebar filter panel"
```

---

## Task 12: NEO Data Table

**Files:**
- Create: `components/table/NeoTable.tsx`

- [ ] **Step 1: Create `NeoTable`**

```tsx
// components/table/NeoTable.tsx
"use client";

import { useState } from "react";
import type { NeoObject } from "@/lib/nasa/types";
import { RiskBadge } from "@/components/cards/RiskBadge";
import { ChevronUp, ChevronDown } from "lucide-react";

interface Props {
  objects: NeoObject[];
}

type SortKey = "closeApproachDate" | "distAu" | "velocityKmS" | "diameterKm" | "riskScore";

export function NeoTable({ objects }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...objects].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const Th = ({ label, sk }: { label: string; sk: SortKey }) => (
    <th
      onClick={() => handleSort(sk)}
      className="px-3 py-2 text-left text-xs font-mono text-slate-400 uppercase tracking-wider cursor-pointer hover:text-neo-accent select-none whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sk ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </span>
    </th>
  );

  return (
    <div className="overflow-auto rounded-lg border border-space-600">
      <table className="w-full text-sm">
        <thead className="bg-space-800 border-b border-space-600">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-mono text-slate-400">Object</th>
            <Th label="Close Approach" sk="closeApproachDate" />
            <Th label="Miss Dist (AU)" sk="distAu" />
            <Th label="Velocity (km/s)" sk="velocityKmS" />
            <Th label="Diameter (m)" sk="diameterKm" />
            <Th label="Risk Score" sk="riskScore" />
            <th className="px-3 py-2 text-left text-xs font-mono text-slate-400">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-space-700">
          {sorted.map(obj => (
            <tr key={`${obj.des}-${obj.closeApproachDate}`} className="hover:bg-space-800/60 transition-colors">
              <td className="px-3 py-2 font-mono text-neo-accent text-xs">{obj.fullname || obj.des}</td>
              <td className="px-3 py-2 font-mono text-xs text-slate-300">
                {new Date(obj.closeApproachDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{obj.distAu.toFixed(5)}</td>
              <td className="px-3 py-2 font-mono text-xs">{obj.velocityKmS.toFixed(1)}</td>
              <td className="px-3 py-2 font-mono text-xs">{(obj.diameterKm * 1000).toFixed(0)} m</td>
              <td className="px-3 py-2 font-mono text-xs">{obj.riskScore.toFixed(2)}</td>
              <td className="px-3 py-2"><RiskBadge category={obj.riskCategory} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="py-12 text-center text-slate-500 font-mono text-sm">
          No objects match current filters
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/table/NeoTable.tsx
git commit -m "feat: add sortable NEO data table with risk badges"
```

---

## Task 13: Recharts — Approach Timeline

**Files:**
- Create: `components/charts/ApproachTimeline.tsx`

- [ ] **Step 1: Create the chart**

```tsx
// components/charts/ApproachTimeline.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { NeoObject } from "@/lib/nasa/types";

interface Props {
  objects: NeoObject[];
}

export function ApproachTimeline({ objects }: Props) {
  // Group by week, count objects
  const weekly = objects.reduce<Record<string, number>>((acc, o) => {
    const d = new Date(o.closeApproachDate);
    // Round down to Monday of that week
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    const key = monday.toISOString().split("T")[0];
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(weekly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    }));

  return (
    <div className="bg-space-800 border border-space-600 rounded-lg p-4">
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-4">
        Close Approaches per Week
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 12, fontFamily: "monospace" }}
            labelStyle={{ color: "#38bdf8" }}
          />
          <Line type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/ApproachTimeline.tsx
git commit -m "feat: add Recharts close-approach timeline chart"
```

---

## Task 14: Recharts — Size Distribution

**Files:**
- Create: `components/charts/SizeDistribution.tsx`

- [ ] **Step 1: Create the chart**

```tsx
// components/charts/SizeDistribution.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import type { NeoObject } from "@/lib/nasa/types";

interface Props {
  objects: NeoObject[];
}

const BUCKETS = [
  { label: "< 10 m",    min: 0,     max: 0.01 },
  { label: "10–50 m",   min: 0.01,  max: 0.05 },
  { label: "50–100 m",  min: 0.05,  max: 0.1 },
  { label: "100–500 m", min: 0.1,   max: 0.5 },
  { label: "0.5–1 km",  min: 0.5,   max: 1 },
  { label: "> 1 km",    min: 1,     max: Infinity },
];

export function SizeDistribution({ objects }: Props) {
  const data = BUCKETS.map(b => ({
    label: b.label,
    count: objects.filter(o => o.diameterKm >= b.min && o.diameterKm < b.max).length,
  }));

  return (
    <div className="bg-space-800 border border-space-600 rounded-lg p-4">
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-4">
        Object Size Distribution
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8", fontFamily: "monospace" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 12, fontFamily: "monospace" }}
          />
          <Bar dataKey="count" name="Objects" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={`hsl(${200 + i * 20}, 70%, ${45 + i * 5}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/SizeDistribution.tsx
git commit -m "feat: add Recharts object size distribution bar chart"
```

---

## Task 15: Recharts — Risk Radar (Scatter Plot)

**Files:**
- Create: `components/charts/RiskRadar.tsx`

- [ ] **Step 1: Create the chart**

```tsx
// components/charts/RiskRadar.tsx
"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import type { NeoObject, RiskCategory } from "@/lib/nasa/types";

interface Props {
  objects: NeoObject[];
}

const COLORS: Record<RiskCategory, string> = {
  Safe:      "#22c55e",
  Watchlist: "#f59e0b",
  Critical:  "#ef4444",
};

export function RiskRadar({ objects }: Props) {
  const byCategory = (cat: RiskCategory) =>
    objects
      .filter(o => o.riskCategory === cat)
      .map(o => ({
        x: o.distAu,
        y: o.velocityKmS,
        z: o.diameterKm * 1000, // diameter in meters for bubble size
        name: o.fullname || o.des,
      }));

  const categories: RiskCategory[] = ["Safe", "Watchlist", "Critical"];

  return (
    <div className="bg-space-800 border border-space-600 rounded-lg p-4">
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-4">
        Risk Radar — Velocity vs. Miss Distance
      </h3>
      <p className="text-xs text-slate-500 font-mono mb-3">
        Bubble size = estimated diameter · Closer + Faster + Larger = higher risk
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="x"
            name="Miss Distance (AU)"
            type="number"
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }}
            label={{ value: "Miss Distance (AU)", position: "insideBottom", offset: -4, fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
          />
          <YAxis
            dataKey="y"
            name="Velocity (km/s)"
            type="number"
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }}
            label={{ value: "Velocity (km/s)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
          />
          <ZAxis dataKey="z" range={[20, 400]} name="Diameter (m)" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}
            formatter={(val: number, name: string) => [val.toFixed(name.includes("AU") ? 5 : 1), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 8 }} />
          {categories.map(cat => (
            <Scatter
              key={cat}
              name={cat}
              data={byCategory(cat)}
              fill={COLORS[cat]}
              fillOpacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/RiskRadar.tsx
git commit -m "feat: add Recharts velocity vs. miss-distance scatter plot (Risk Radar)"
```

---

## Task 16: Methodology Section

**Files:**
- Create: `components/methodology/MethodologySection.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/methodology/MethodologySection.tsx
import { FlaskConical, BookOpen } from "lucide-react";

export function MethodologySection() {
  return (
    <section className="bg-space-800 border border-space-600 rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2 text-neo-accent">
        <FlaskConical size={18} />
        <h2 className="font-mono font-bold text-sm uppercase tracking-widest">
          Data Science Methodology
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        {/* Score formula */}
        <div className="space-y-2">
          <h3 className="font-mono text-slate-300 font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-slate-400" />
            Impact Hazard Score
          </h3>
          <div className="bg-space-900 rounded p-3 font-mono text-xs text-neo-accent border border-space-700">
            <p>Score = log₁₀( (Mass × Velocity) / Distance² + 1 )</p>
          </div>
          <ul className="text-slate-400 space-y-1 text-xs font-mono">
            <li><span className="text-slate-300">Mass</span> — derived from estimated diameter (spherical body, ρ = 2,000 kg/m³)</li>
            <li><span className="text-slate-300">Velocity</span> — relative velocity at close approach (m/s)</li>
            <li><span className="text-slate-300">Distance</span> — nominal miss distance (m)</li>
            <li><span className="text-slate-300">log₁₀</span> — log scale prevents extreme values from dominating</li>
          </ul>
        </div>

        {/* Diameter estimation */}
        <div className="space-y-2">
          <h3 className="font-mono text-slate-300 font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-slate-400" />
            Diameter Estimation
          </h3>
          <div className="bg-space-900 rounded p-3 font-mono text-xs text-neo-accent border border-space-700">
            <p>D = (1329 / √p) × 10^(−H/5)  [km]</p>
          </div>
          <ul className="text-slate-400 space-y-1 text-xs font-mono">
            <li><span className="text-slate-300">H</span> — absolute magnitude from NASA catalog</li>
            <li><span className="text-slate-300">p = 0.14</span> — assumed geometric albedo (S-type asteroid)</li>
            <li>NASA provides diameter for &lt; 1% of tracked objects; this formula covers the rest</li>
          </ul>
        </div>

        {/* Categories */}
        <div className="space-y-2 md:col-span-2">
          <h3 className="font-mono text-slate-300 font-semibold">Risk Categories</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-neo-safe/5 border border-neo-safe/20 rounded p-3">
              <p className="text-neo-safe font-mono font-bold text-xs mb-1">SAFE</p>
              <p className="text-slate-400 text-xs font-mono">Score &lt; 1.5 — Low kinetic energy or large miss distance</p>
            </div>
            <div className="bg-neo-watchlist/5 border border-neo-watchlist/20 rounded p-3">
              <p className="text-neo-watchlist font-mono font-bold text-xs mb-1">WATCHLIST</p>
              <p className="text-slate-400 text-xs font-mono">Score 1.5–3.0 — Notable combination of size, speed, and proximity</p>
            </div>
            <div className="bg-neo-critical/5 border border-neo-critical/20 rounded p-3">
              <p className="text-neo-critical font-mono font-bold text-xs mb-1">CRITICAL</p>
              <p className="text-slate-400 text-xs font-mono">Score ≥ 3.0 — High kinetic impact potential, close approach</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 font-mono border-t border-space-700 pt-3">
        ⚠ This scoring system is a portfolio demonstration of data-science thinking, not an official NASA risk assessment.
        For authoritative impact risk, see NASA's{" "}
        <a href="https://cneos.jpl.nasa.gov/sentry/" className="text-neo-accent underline" target="_blank" rel="noreferrer">Sentry system</a>.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/methodology/MethodologySection.tsx
git commit -m "feat: add data science methodology explainer section"
```

---

## Task 17: Main Dashboard Page

**Files:**
- Modify: `app/page.tsx`

This is the ISR page — it fetches from our own API routes at build time and revalidates every 12 hours. Recharts components are client-only, so we wrap them with dynamic imports.

- [ ] **Step 1: Write the page**

```tsx
// app/page.tsx
import dynamic from "next/dynamic";
import { TopBar } from "@/components/layout/TopBar";
import type { CloseApproachesResponse } from "@/lib/nasa/types";

// DashboardClient manages all client-side state (filters). Charts live inside it.
// It is loaded with ssr:false because Recharts requires a browser environment.
const DashboardClient = dynamic(
  () => import("@/components/layout/DashboardClient").then(m => m.DashboardClient),
  { ssr: false }
);

// ISR: revalidate every 12 hours
export const revalidate = 43200;

async function getData(): Promise<CloseApproachesResponse> {
  // IMPORTANT: Do NOT use VERCEL_URL here — it is deployment-scoped and changes every deploy,
  // which would cause ISR fetches to hit a stale deployment's API.
  // Instead, import the route handler directly to avoid the HTTP round-trip entirely.
  // This is the recommended App Router pattern for server→server calls within the same project.
  const { GET } = await import("@/app/api/close-approaches/route");
  const response = await GET();
  if (!response.ok) throw new Error("Failed to fetch close approaches");
  return response.json();
}

export default async function HomePage() {
  const data = await getData();

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar objects={data.objects} revalidatedAt={data.revalidatedAt} />
      <DashboardClient initialObjects={data.objects} />
    </div>
  );
}
```

- [ ] **Step 2: Create `DashboardClient` component** (handles client-side filter state)

```tsx
// components/layout/DashboardClient.tsx
"use client";

import { useState, useMemo } from "react";
import type { NeoObject } from "@/lib/nasa/types";
import { Sidebar, type FilterState } from "@/components/layout/Sidebar";
import { NeoTable } from "@/components/table/NeoTable";
import { ApproachTimeline } from "@/components/charts/ApproachTimeline";
import { SizeDistribution } from "@/components/charts/SizeDistribution";
import { RiskRadar } from "@/components/charts/RiskRadar";
import { MethodologySection } from "@/components/methodology/MethodologySection";

interface Props {
  initialObjects: NeoObject[];
}

const DEFAULT_FILTERS: FilterState = {
  minDiameterM: 0,
  riskCategories: ["Safe", "Watchlist", "Critical"],
};

export function DashboardClient({ initialObjects }: Props) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return initialObjects.filter(o => {
      const diamM = o.diameterKm * 1000;
      if (diamM < filters.minDiameterM) return false;
      if (!filters.riskCategories.includes(o.riskCategory)) return false;
      return true;
    });
  }, [initialObjects, filters]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar filters={filters} onChange={setFilters} />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ApproachTimeline objects={filtered} />
          </div>
          <SizeDistribution objects={filtered} />
        </div>

        <RiskRadar objects={filtered} />

        {/* Data table */}
        <div>
          <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
            All Tracked Objects ({filtered.length})
          </h2>
          <NeoTable objects={filtered} />
        </div>

        <MethodologySection />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx components/layout/DashboardClient.tsx
git commit -m "feat: add ISR main dashboard page with client-side filter state"
```

---

## Task 18: Final Polish & Verification

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 2: Start dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:
- Dark mission-control background renders
- TopBar shows object count, critical count, nearest approach
- Sidebar filters work (changing size filters updates all charts + table)
- All 3 charts render without errors
- Risk badges show in table
- Methodology section is present at the bottom

- [ ] **Step 3: Verify API routes directly**

```bash
curl http://localhost:3000/api/close-approaches | python -m json.tool | head -30
curl http://localhost:3000/api/sentry | python -m json.tool | head -20
```

- [ ] **Step 4: Build for production**

```bash
npm run build
```

Expected: successful build with no TypeScript errors

- [ ] **Step 5: Create `.env.example` and `.gitignore`**

Create `.env.example`:

```bash
# No NASA API key required — public API
# Vercel will auto-set VERCEL_URL at deploy time
```

Verify `.gitignore` includes `.env*.local` and `.next/`.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete NEO-Guardian dashboard — asteroid risk scoring, Recharts visualizations, ISR"
```

---

## Deployment Notes

After completing implementation:

1. Push to GitHub
2. Import project on Vercel
3. No environment variables needed — NASA's SSD APIs are public
4. The dashboard page imports the Close Approaches route handler directly (no HTTP round-trip, no `VERCEL_URL` needed)

The `revalidate = 43200` on both API routes and the page ensures NASA is called at most once every 12 hours per region.
