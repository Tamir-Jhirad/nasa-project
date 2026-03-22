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
    const cmp = sortKey === "closeApproachDate"
      ? new Date(va as string).getTime() - new Date(vb as string).getTime()
      : typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const Th = ({ label, sk }: { label: string; sk: SortKey }) => (
    <th
      onClick={() => handleSort(sk)}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && handleSort(sk)}
      tabIndex={0}
      aria-sort={sortKey === sk ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className="px-3 py-2 text-left text-xs font-mono text-slate-400 uppercase tracking-wider cursor-pointer hover:text-neo-accent select-none whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sk ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </span>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-space-600">
      <table className="w-full text-sm">
        <thead className="bg-space-800 border-b border-space-600">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-mono text-slate-400 sticky left-0 bg-space-800 z-10">Object</th>
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
            <tr key={`${obj.des}-${obj.closeApproachDate}`} className="group hover:bg-space-800/60 transition-colors">
              <td className="px-3 py-2 font-mono text-neo-accent text-xs sticky left-0 bg-space-950 group-hover:bg-space-800 transition-colors z-10 whitespace-nowrap">
                {obj.fullname || obj.des}
              </td>
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
