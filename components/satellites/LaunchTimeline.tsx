"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SatelliteObject } from "@/lib/celestrak/types";

interface Props { objects: SatelliteObject[] }

export function LaunchTimeline({ objects }: Props) {
  const byYear: Record<number, number> = {};
  for (const o of objects) {
    if (o.launchYear > 0) byYear[o.launchYear] = (byYear[o.launchYear] ?? 0) + 1;
  }
  const data = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, count]) => ({ year: Number(year), count }));

  return (
    <div className="bg-space-900 border border-space-700 rounded-xl p-4">
      <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
        Launches Per Year
      </h2>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} barCategoryGap={1}>
          <XAxis
            dataKey="year"
            tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v % 5 === 0 ? String(v) : "")}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11, fontFamily: "monospace" }}
            labelFormatter={(v) => `Year: ${v}`}
            formatter={(v: any) => {
              if (!v) return ["", ""];
              return [v, "launches"];
            }}
          />
          <Bar dataKey="count" radius={[1, 1, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.year}
                fill={entry.year >= 2019 ? "#0ea5e9" : "#1e3a5f"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs font-mono text-slate-600 mt-1">
        <span className="inline-block w-2 h-2 bg-sky-500 mr-1 rounded-sm" />
        Blue = Starlink era (2019+)
      </p>
    </div>
  );
}
