# Cross-Platform Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NEO-Guardian fully usable on iOS, Android, and desktop browsers via responsive layout, a mobile sidebar drawer, and PWA installability.

**Architecture:** The existing Next.js 16 App Router structure is preserved. The desktop sidebar stays inline in the flex layout unchanged. On mobile, a `MobileDrawer` component renders the Sidebar into a React portal attached to `document.body` — this is the only correct approach given that the `DashboardClient` flex container has `overflow-hidden`, which would clip any `fixed`/`absolute` child on iOS Safari. Charts already use `ResponsiveContainer` so no chart changes are needed.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v3 (pinned, no upgrades), React 19 portals, Lucide React — no new npm packages required.

---

## File Map

| File | Action | Change |
|------|--------|--------|
| `public/manifest.json` | **Create** | PWA manifest for iOS/Android homescreen install |
| `public/apple-touch-icon.png` | **Note** | Must be created externally (180×180 PNG from favicon) |
| `app/layout.tsx` | **Modify** | Add manifest, apple-touch-icon, viewport metadata |
| `components/layout/MobileDrawer.tsx` | **Create** | Portal-based mobile drawer (escapes overflow-hidden parent) |
| `components/layout/DashboardClient.tsx` | **Modify** | Add `sidebarOpen` state, mobile filter button, MobileDrawer |
| `components/layout/Sidebar.tsx` | **Modify** | Add optional `onClose` prop + close button for mobile |
| `components/layout/TopBar.tsx` | **Modify** | Hide subtitle/timestamp on xs, responsive padding |
| `components/table/NeoTable.tsx` | **Modify** | Sticky first column with group-hover colour match |

---

## Task 1: PWA Manifest & iOS Meta Tags

**Files:**
- Create: `public/manifest.json`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "NEO-Guardian",
  "short_name": "NEO-Guardian",
  "description": "Real-time Asteroid Proximity & Risk Dashboard",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#030712",
  "theme_color": "#38bdf8",
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "any",
      "type": "image/x-icon"
    }
  ]
}
```

> **Android install note:** Chrome requires at least one PNG icon of 192×192 or larger to show the "Add to Home Screen" install prompt. The `favicon.ico` fallback above satisfies the manifest spec but will NOT trigger Chrome's install prompt. If Android PWA installability is a goal, create `public/icons/icon-192.png` and `public/icons/icon-512.png` (any solid-colour square PNG), add them to the `icons` array with `"type": "image/png"`, and update `"src"` accordingly.

- [ ] **Step 2: Create apple-touch-icon (manual step)**

Copy or convert the existing `public/favicon.ico` to a 180×180 PNG and save it as `public/apple-touch-icon.png`. Without this file, iOS Safari uses a screenshot as the homescreen icon instead of the app icon.

> If no image editor is available, skip for now — PWA install will degrade gracefully (screenshot icon on iOS). This does NOT break functionality.

- [ ] **Step 3: Update `app/layout.tsx`**

Next.js 16 separates viewport config from metadata. Replace the existing `layout.tsx` content:

```tsx
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
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
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json app/layout.tsx
git commit -m "feat: add PWA manifest and iOS meta tags"
```

---

## Task 2: Responsive TopBar

**Files:**
- Modify: `components/layout/TopBar.tsx`

Changes: hide subtitle and timestamp on `xs` to prevent overflow; reduce padding on mobile.

- [ ] **Step 1: Update `components/layout/TopBar.tsx` title bar section**

```tsx
// BEFORE — lines 22-37
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
```

```tsx
// AFTER
<div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-space-700">
  <div className="flex items-center gap-3 min-w-0">
    <Shield className="text-neo-accent shrink-0" size={24} />
    <span className="font-mono font-bold text-lg tracking-widest text-neo-accent uppercase shrink-0">
      NEO-Guardian
    </span>
    <span className="hidden sm:inline text-xs text-slate-500 font-mono truncate">
      Real-time Asteroid Proximity &amp; Risk Dashboard
    </span>
  </div>
  <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500 shrink-0">
    <Clock size={12} />
    <span>Updated: {new Date(revalidatedAt).toUTCString()}</span>
  </div>
</div>
```

- [ ] **Step 2: Update stat card container padding**

```tsx
// BEFORE (line 40)
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4">

// AFTER
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 sm:px-6 py-3 sm:py-4">
```

- [ ] **Step 3: Verify at 375px in dev server**

```bash
npm run dev
```

Resize browser to 375px. Verify title stays on one line, no horizontal overflow.

- [ ] **Step 4: Commit**

```bash
git add components/layout/TopBar.tsx
git commit -m "feat: responsive TopBar — hide subtitle and timestamp on mobile"
```

---

## Task 3: Create MobileDrawer Portal Component

This is the core fix. The `DashboardClient` flex container has `overflow-hidden`, which clips `position: fixed` descendants on iOS Safari (a known Safari bug). The solution is to render the mobile drawer as a React portal directly into `document.body`, outside any `overflow-hidden` ancestor.

The drawer will cover the TopBar on mobile — this is intentional and standard UX (e.g., Gmail, iOS Settings). The X button closes it.

**Files:**
- Create: `components/layout/MobileDrawer.tsx`

- [ ] **Step 1: Create `components/layout/MobileDrawer.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Renders children into a portal attached to document.body.
 * This is necessary because the DashboardClient flex container has
 * overflow-hidden, which clips fixed/absolute descendants on iOS Safari.
 * Portaling to body escapes all ancestor overflow constraints.
 */
export function MobileDrawer({ open, onClose, children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when drawer is open so background content cannot scroll
  // behind the backdrop. Restore on close or unmount.
  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open, mounted]);

  // Do not render on the server (portals are client-only)
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={[
          "fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={[
          "fixed top-0 left-0 h-full z-50 md:hidden",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/layout/MobileDrawer.tsx
git commit -m "feat: add MobileDrawer portal component for iOS-safe overlay"
```

---

## Task 4: Add Close Button to Sidebar

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Update `components/layout/Sidebar.tsx`**

Full replacement:

```tsx
"use client";

import type { RiskCategory } from "@/lib/nasa/types";
import { Filter, X } from "lucide-react";

export interface FilterState {
  minDiameterM: number;
  riskCategories: RiskCategory[];
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClose?: () => void; // only passed when rendered inside MobileDrawer
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

export function Sidebar({ filters, onChange, onClose }: Props) {
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
    <aside className="w-56 shrink-0 border-r border-space-600 bg-space-900 p-4 space-y-6 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-neo-accent font-mono text-xs uppercase tracking-widest">
          <Filter size={14} />
          <span>Filters</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close filters"
            className="p-1 rounded hover:bg-space-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        )}
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
                className="accent-sky-400 w-4 h-4"
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

Key changes vs original:
- `h-full` added to `<aside>` so the drawer fills full height
- `onClose?: () => void` prop with X button (shown when provided)
- Checkbox `w-4 h-4` for larger touch targets
- X button has no `md:hidden` — it only renders when `onClose` is passed (only from MobileDrawer)

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: Sidebar close button and h-full for mobile drawer"
```

---

## Task 5: Wire Up MobileDrawer in DashboardClient

**Files:**
- Modify: `components/layout/DashboardClient.tsx`

- [ ] **Step 1: Update `components/layout/DashboardClient.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import type { NeoObject } from "@/lib/nasa/types";
import { Sidebar, type FilterState } from "@/components/layout/Sidebar";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { NeoTable } from "@/components/table/NeoTable";
import { ApproachTimeline } from "@/components/charts/ApproachTimeline";
import { SizeDistribution } from "@/components/charts/SizeDistribution";
import { RiskRadar } from "@/components/charts/RiskRadar";
import { MethodologySection } from "@/components/methodology/MethodologySection";
import { Filter } from "lucide-react";

interface Props {
  initialObjects: NeoObject[];
}

const DEFAULT_FILTERS: FilterState = {
  minDiameterM: 0,
  riskCategories: ["Safe", "Watchlist", "Critical"],
};

export function DashboardClient({ initialObjects }: Props) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {/* Mobile drawer — portaled to document.body to escape overflow-hidden */}
      <MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <Sidebar
          filters={filters}
          onChange={setFilters}
          onClose={() => setSidebarOpen(false)}
        />
      </MobileDrawer>

      {/* Desktop sidebar — inline in flex layout, hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Mobile filter button — hidden on desktop */}
        <div className="flex items-center md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-space-600 bg-space-800 text-neo-accent font-mono text-xs uppercase tracking-widest hover:bg-space-700 transition-colors"
          >
            <Filter size={14} />
            Filters
          </button>
          <span className="ml-3 text-xs font-mono text-slate-500">
            {filtered.length} objects
          </span>
        </div>

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

Key decisions:
- `overflow-hidden` stays on the outer div (required for desktop scroll behavior — not changed)
- The `MobileDrawer` portal renders into `document.body`, bypassing the `overflow-hidden` container entirely
- The desktop sidebar (`hidden md:block`) is a separate DOM node from the portal — no conflict
- The mobile "Filters" button is at the top of `<main>` where it's immediately visible

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Manual test in dev server**

```bash
npm run dev
```

Test at 375px width:
- Sidebar is NOT visible on load
- "Filters" button is visible at the top of the content area
- Clicking "Filters" opens the drawer (full-height panel from the left)
- Backdrop click closes the drawer
- X button (top-right of drawer) closes the drawer
- On desktop (≥ 768px): sidebar is inline, "Filters" button is hidden, no MobileDrawer renders

- [ ] **Step 4: Commit**

```bash
git add components/layout/DashboardClient.tsx
git commit -m "feat: mobile sidebar drawer via MobileDrawer portal"
```

---

## Task 6: NeoTable Sticky First Column

**Files:**
- Modify: `components/table/NeoTable.tsx`

The Object column is made sticky for mobile horizontal scroll. The `<tr>` gets `group` so the sticky cell can match the row hover colour using `group-hover:`.

- [ ] **Step 1: Update `components/table/NeoTable.tsx`**

Change the outer container:
```tsx
// BEFORE
<div className="overflow-auto rounded-lg border border-space-600">

// AFTER
<div className="overflow-x-auto rounded-lg border border-space-600">
```

Change the Object column header:
```tsx
// BEFORE
<th className="px-3 py-2 text-left text-xs font-mono text-slate-400">Object</th>

// AFTER
<th className="px-3 py-2 text-left text-xs font-mono text-slate-400 sticky left-0 bg-space-800 z-10">Object</th>
```

Change each data row `<tr>`:
```tsx
// BEFORE
<tr key={...} className="hover:bg-space-800/60 transition-colors">

// AFTER
<tr key={...} className="group hover:bg-space-800/60 transition-colors">
```

Change the Object column data cell:
```tsx
// BEFORE
<td className="px-3 py-2 font-mono text-neo-accent text-xs">{obj.fullname || obj.des}</td>

// AFTER
<td className="px-3 py-2 font-mono text-neo-accent text-xs sticky left-0 bg-space-950 group-hover:bg-space-800/60 transition-colors z-10 whitespace-nowrap">
  {obj.fullname || obj.des}
</td>
```

Note: `bg-space-950` (the page background) is used as the default sticky cell background so it matches the transparent row background. `group-hover:bg-space-800/60` matches the row hover. The `transition-colors` keeps it smooth.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Test sticky column in dev server**

```bash
npm run dev
```

At 375px, scroll the table horizontally. Verify:
- Object column stays pinned on the left
- On row hover: sticky cell colour matches the rest of the row

- [ ] **Step 4: Commit**

```bash
git add components/table/NeoTable.tsx
git commit -m "fix: sticky first column on NeoTable with group-hover colour sync"
```

---

## Task 7: Production Build Verification

- [ ] **Step 1: Full production build**

```bash
npm run build
```

Expected: exits with 0. ISR revalidation log messages are normal.

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Serve and smoke-test on real device (or emulator)**

```bash
npm run start
```

On a real iPhone or Android (or Chrome DevTools device emulation):
- 375px (iPhone SE): filter drawer, no overflow, table scrolls
- 768px (iPad): sidebar inline visible, drawer hidden
- 1280px (desktop): full layout unchanged

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: cross-platform responsive — smoke test cleanup"
```

---

## Summary of Changes

| File | What Changed |
|------|-------------|
| `public/manifest.json` | New — PWA manifest |
| `app/layout.tsx` | `manifest`, `appleWebApp`, `Viewport` export |
| `components/layout/MobileDrawer.tsx` | New — React portal drawer, escapes `overflow-hidden` ancestor; locks body scroll when open |
| `components/layout/TopBar.tsx` | Subtitle + timestamp hidden on `xs`, reduced padding |
| `components/layout/Sidebar.tsx` | `onClose?` prop, X button, `h-full`, larger checkbox targets |
| `components/layout/DashboardClient.tsx` | `sidebarOpen` state, `MobileDrawer` + desktop inline sidebar split, mobile filter button |
| `components/table/NeoTable.tsx` | `group` on rows, sticky Object column with `group-hover:` colour sync |

**Zero new npm packages.** All Recharts charts already use `ResponsiveContainer` and require no changes.
