"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { SatelliteObject, OrbitClass } from "@/lib/celestrak/types";

const COLORS: Record<OrbitClass, string> = {
  LEO: "#38bdf8",
  GEO: "#22c55e",
  MEO: "#f59e0b",
  HEO: "#a78bfa",
};

interface Props { objects: SatelliteObject[] }

export function OrbitClassDonut({ objects }: Props) {
  const counts: Record<OrbitClass, number> = { LEO: 0, GEO: 0, MEO: 0, HEO: 0 };
  for (const o of objects) counts[o.orbitClass]++;

  const data = (["LEO", "GEO", "MEO", "HEO"] as OrbitClass[])
    .filter((k) => counts[k] > 0)
    .map((k) => ({ name: k, value: counts[k] }));

  const total = objects.length;
  const dominant = data[0];

  return (
    <div className="bg-space-900 border border-space-700 rounded-xl p-4">
      <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
        Orbit Class Distribution
      </h2>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" strokeWidth={0}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name as OrbitClass]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11, fontFamily: "monospace" }}
                formatter={(v: any) => {
                  if (!v) return ["", ""];
                  return [`${v} (${total ? Math.round((v / total) * 100) : 0}%)`, ""];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {dominant && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-mono font-bold text-white">
                {total ? Math.round((dominant.value / total) * 100) : 0}%
              </span>
              <span className="text-xs font-mono text-slate-500">{dominant.name}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-sm" style={{ background: COLORS[entry.name as OrbitClass] }} />
              <span className="text-slate-400 w-8">{entry.name}</span>
              <span className="text-slate-300">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
