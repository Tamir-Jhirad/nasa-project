"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SatelliteObject, Constellation } from "@/lib/celestrak/types";

const COLORS: Partial<Record<Constellation, string>> = {
  Starlink: "#0ea5e9",
  OneWeb: "#a78bfa",
  GPS: "#22c55e",
  Galileo: "#f59e0b",
  GLONASS: "#ef4444",
  "Space Station": "#ec4899",
  Weather: "#06b6d4",
  Science: "#8b5cf6",
  Other: "#475569",
};

interface Props { objects: SatelliteObject[] }

export function ConstellationBar({ objects }: Props) {
  const counts: Partial<Record<Constellation, number>> = {};
  for (const o of objects) counts[o.constellation] = (counts[o.constellation] ?? 0) + 1;

  const data = Object.entries(counts)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return (
    <div className="bg-space-900 border border-space-700 rounded-xl p-4">
      <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
        Top Constellations
      </h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11, fontFamily: "monospace" }}
            formatter={(v: any) => {
              if (!v) return ["", ""];
              return [v.toLocaleString(), "satellites"];
            }}
          />
          <Bar dataKey="count" radius={[0, 2, 2, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name as Constellation] ?? "#475569"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
