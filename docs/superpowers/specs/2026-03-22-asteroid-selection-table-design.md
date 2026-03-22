# Asteroid Selection Table — Design Spec

## Goal

Replace the difficult "click a moving arc" interaction on the Earth globe with a scrollable asteroid list panel. Users click a row in the list to select an asteroid; the globe highlights that arc and a detail card shows below the list.

## Problem Being Solved

Clicking animated arcs on a WebGL globe is frustrating — arcs move continuously and are small click targets. A sidebar list gives users a stable, predictable way to select asteroids.

## Layout

The globe and right panel sit **side-by-side** (existing `flex-col lg:flex-row` layout in `EarthGlobeWrapper` is unchanged). The right panel currently switches between a legend and a detail card; it will instead always show:

```
[  Globe (left, shrink-0)  ][  Right panel (flex-1)       ]
                             ┌─────────────────────────────┐
                             │  AsteroidList (scrollable)  │
                             │  row · row · row ...        │
                             │  (max-h-[280px], scroll)    │
                             ├─────────────────────────────┤
                             │  Detail Card                │
                             │  (or placeholder text)      │
                             └─────────────────────────────┘
```

## Default State

On first load, **no asteroid is selected** (`selectedDes === null`):
- All globe arcs render at full opacity (existing behavior — no change needed)
- The detail card shows the placeholder text
- No row is highlighted in the list

Note: arc dimming and thicker stroke for the selected arc are already implemented in `EarthGlobe.tsx` using the `selectedDes` prop — no changes required there.

## `AsteroidList` Component

**File:** `components/globe/AsteroidList.tsx`

### Props

```typescript
interface AsteroidListProps {
  objects: NeoObject[];
  selectedDes: string | null;
  onSelectDes: (des: string | null) => void;
}
```

### Sort order
Display the objects in the order received — `limitGlobeObjects` already sorts Critical → Watchlist → Safe before passing to this component.

### Row contents (left to right)
- Risk color dot: use Tailwind classes `bg-neo-critical` / `bg-neo-watchlist` / `bg-neo-safe` (matches existing globe colors)
- Name: `fullname` with CSS `truncate` class (overflow ellipsis), fallback to `des`; use `des` as the React `key` for each row
- Miss distance: `distAu` formatted with `toFixed(5)`, e.g. `0.00123 AU`

### Selection behavior
- Click an unselected row → call `onSelectDes(des)` (selects it)
- Click the already-selected row → call `onSelectDes(null)` (deselects)
- Selected row styling: `bg-space-700` background + left border in the asteroid's risk color

### Scroll
The list container uses `max-h-[280px] overflow-y-auto` so it scrolls independently. This leaves room for the detail card below so the combined right-panel height stays close to the globe's 480 px.

### Scroll-to-selected
When an arc on the globe is clicked (setting `selectedDes` externally), the list does **not** need to auto-scroll to the selected row. This is out of scope.

### Empty state
When `objects` is empty (all asteroids filtered out by the sidebar), render: `"No asteroids to display"` in place of the list.

### Legend
Remove the existing Safe/Watchlist/Critical color legend (currently in the empty-state branch of the detail panel). The colored dots on each row serve this purpose, making the legend redundant.

## Detail Card

Stays inside `EarthGlobeWrapper.tsx` — same fields as today, just repositioned below `<AsteroidList>`.

**When `selectedDes !== null`:**
- Asteroid name (heading)
- `<RiskBadge>` component
- Five data rows (unchanged from current implementation):
  - Miss distance: `X × Moon` (lunar distances)
  - Speed: `X.X km/s` (with `!= null` guard → "N/A")
  - Diameter: `~X m`
  - Risk score: `X.XX`
  - Close approach: `Mon D, YYYY`
- X button to deselect (unchanged)

**When `selectedDes === null`:**
- Placeholder: "Select an asteroid above to see details."

## Hint Text

Update the sub-caption below the globe (currently "Showing top N objects · Click an arc to select") to:
`"Showing top N objects · Select from the list or click an arc"`

## Files Changed

| File | Change |
|------|--------|
| `components/globe/AsteroidList.tsx` | New component |
| `components/globe/EarthGlobeWrapper.tsx` | Render `<AsteroidList>` + detail card in right panel; remove old legend; update hint text |
| `components/globe/EarthGlobe.tsx` | No change — stroke/opacity logic already handles `selectedDes` |

## Out of Scope

- Multi-select (select multiple asteroids simultaneously)
- Sorting or filtering the list (separate feature)
- Pagination (50 rows fits in the scrollable list)
- Any changes to charts, sidebar, or other dashboard sections
