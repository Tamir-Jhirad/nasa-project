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
  Critical: "border-l-neo-critical",
  Watchlist: "border-l-neo-watchlist",
  Safe:      "border-l-neo-safe",
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
