"use client";
// components/layout/Sidebar.tsx

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
