# Asteroid Selection Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scrollable asteroid list next to the Earth globe so users can select/deselect asteroids by clicking rows instead of trying to click moving arcs.

**Architecture:** A new `AsteroidList` component handles the list UI and receives `objects`, `selectedDes`, and `onSelectDes` as props. `EarthGlobeWrapper` is updated to render `AsteroidList` above the existing detail card, replacing the old safe/watchlist/critical legend. All selection state stays in `EarthGlobeWrapper` — no state is added to the new component.

**Tech Stack:** React 19, TypeScript, Tailwind v3 (pinned — do NOT upgrade). Custom color tokens: `bg-neo-critical`, `bg-neo-watchlist`, `bg-neo-safe`, `bg-space-700`, `bg-space-800`.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `components/globe/AsteroidList.tsx` | **Create** | Renders the scrollable list; no state of its own |
| `components/globe/EarthGlobeWrapper.tsx` | **Modify** | Imports `AsteroidList`; replaces legend; updates hint text |

No other files change.

---

## Reference: key types and existing code

**`NeoObject` fields used in this feature** (from `lib/nasa/types.ts`):
```typescript
des: string;           // unique ID — also used as React key and for onSelectDes
fullname: string;      // display name, e.g. "(2024 YR4)"
distAu: number;        // miss distance in AU — shown in list as toFixed(5)
riskCategory: RiskCategory;  // "Critical" | "Watchlist" | "Safe"
```

**`EarthGlobeWrapper` current right-panel logic** (`components/globe/EarthGlobeWrapper.tsx:58-103`):
- When `selected !== null`: renders a detail card (name, RiskBadge, 5 data rows, X button)
- When `selected === null`: renders placeholder text + Safe/Watchlist/Critical legend

After this change:
- `<AsteroidList>` always renders at the top of the right panel
- Detail card (or placeholder) always renders below it
- Legend is removed entirely

---

## Task 1: Create `AsteroidList` component

**Files:**
- Create: `components/globe/AsteroidList.tsx`

This is a purely presentational component — no state, no side effects. It receives the full sorted list from the parent and renders a scrollable list of rows. Jest does not have jsdom configured in this project, so we verify visually in Task 2 instead of writing component tests.

- [ ] **Step 1: Create the file**

```tsx
// components/globe/AsteroidList.tsx
"use client";

import type { NeoObject, RiskCategory } from "@/lib/nasa/types";

interface Props {
  objects: NeoObject[];
  selectedDes: string | null;
  onSelectDes: (des: string | null) => void;
}

const DOT_CLASS: Record<RiskCategory, string> = {
  Critical: "bg-neo-critical",
  Watchlist: "bg-neo-watchlist",
  Safe:      "bg-neo-safe",
};

const BORDER_CLASS: Record<RiskCategory, string> = {
  Critical: "border-l-red-500",
  Watchlist: "border-l-amber-400",
  Safe:      "border-l-green-500",
};

export function AsteroidList({ objects, selectedDes, onSelectDes }: Props) {
  if (objects.length === 0) {
    return (
      <div className="px-3 py-4 text-xs font-mono text-slate-500">
        No asteroids to display
      </div>
    );
  }

  return (
    <div className="max-h-[280px] overflow-y-auto">
      {objects.map((o) => {
        const isSelected = o.des === selectedDes;
        return (
          <button
            key={o.des}
            onClick={() => onSelectDes(isSelected ? null : o.des)}
            className={[
              "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-l-2",
              isSelected
                ? `bg-space-700 ${BORDER_CLASS[o.riskCategory]}`
                : "border-l-transparent hover:bg-space-800/60",
            ].join(" ")}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[o.riskCategory]}`} />
            <span className="flex-1 truncate font-mono text-xs text-slate-300">
              {o.fullname || o.des}
            </span>
            <span className="font-mono text-xs text-slate-500 whitespace-nowrap shrink-0">
              {o.distAu.toFixed(5)} AU
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript-check the new file**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see "Cannot find name 'bg-neo-critical'" — that's fine, Tailwind classes aren't checked by tsc.

- [ ] **Step 3: Commit**

```bash
git add components/globe/AsteroidList.tsx
git commit -m "feat: add AsteroidList component for asteroid selection"
```

---

## Task 2: Integrate `AsteroidList` into `EarthGlobeWrapper`

**Files:**
- Modify: `components/globe/EarthGlobeWrapper.tsx`

Read the current file at `components/globe/EarthGlobeWrapper.tsx` before making changes so you have the full context.

Changes needed:
1. Import `AsteroidList`
2. Replace the `{selected ? … : <legend>}` block with `<AsteroidList>` + `{selected ? … : <placeholder>}`
3. Update the hint caption below the globe

- [ ] **Step 1: Add the import**

At the top of `EarthGlobeWrapper.tsx`, add this import after the existing local imports:

```tsx
import { AsteroidList } from "./AsteroidList";
```

- [ ] **Step 2: Replace the right-panel content**

Find the right-panel `<div>` that starts at line 58:

```tsx
      {/* Detail panel — shown when an asteroid is selected */}
      <div className="flex-1 min-w-[220px]">
        {selected ? (
          ...detail card...
        ) : (
          ...legend...
        )}
      </div>
```

Replace it with:

```tsx
      {/* Right panel — asteroid list + detail card */}
      <div className="flex-1 min-w-[220px] flex flex-col gap-3">
        <AsteroidList
          objects={limited}
          selectedDes={selectedDes}
          onSelectDes={setSelectedDes}
        />
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
              <Row label="Speed" value={selected.velocityKmS != null ? `${selected.velocityKmS.toFixed(1)} km/s` : "N/A"} />
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
          <p className="text-xs font-mono text-slate-500 px-1">
            Select an asteroid above to see details.
          </p>
        )}
      </div>
```

- [ ] **Step 3: Update the hint caption**

Find the caption below the globe (currently line 53):

```tsx
        <p className="text-center text-xs text-slate-600 mt-1 font-mono">
          Showing top {limited.length} objects · Click an arc to select
        </p>
```

Change to:

```tsx
        <p className="text-center text-xs text-slate-600 mt-1 font-mono">
          Showing top {limited.length} objects · Select from the list or click an arc
        </p>
```

- [ ] **Step 4: TypeScript-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run existing tests to verify nothing is broken**

```bash
npm test
```

Expected: all tests pass (the existing globe and NASA unit tests). The test count should stay the same — we did not add any new tests.

- [ ] **Step 6: Start dev server and verify visually**

```bash
npm run dev
```

Open http://localhost:3000. Check:

1. The right panel shows the scrollable asteroid list (Critical rows first, then Watchlist, then Safe)
2. Nothing is selected by default — all arcs at full opacity, placeholder text "Select an asteroid above to see details." shown below the list
3. Click a row in the list → that row gets highlighted (colored left border + darker background), the globe arc for that asteroid brightens and all others dim, detail card appears below the list
4. Click the same row again → deselects (row returns to normal, all arcs return to full opacity, placeholder returns)
5. Click an arc directly on the globe → the corresponding row in the list gets highlighted, detail card fills in
6. Click the X button in the detail card → deselects
7. The caption below the globe reads "Showing top N objects · Select from the list or click an arc"
8. If the sidebar filters remove all objects, the list shows "No asteroids to display"

- [ ] **Step 7: Commit**

```bash
git add components/globe/EarthGlobeWrapper.tsx
git commit -m "feat: integrate AsteroidList into globe panel, remove legend"
```
