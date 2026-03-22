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
            {data.map((d, i) => (
              <Cell key={d.label} fill={`hsl(${200 + i * 20}, 70%, ${45 + i * 5}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
