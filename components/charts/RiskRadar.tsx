// components/charts/RiskRadar.tsx
"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import type { NeoObject, RiskCategory } from "@/lib/nasa/types";

interface Props {
  objects: NeoObject[];
}

const COLORS: Record<RiskCategory, string> = {
  Safe:      "#22c55e",
  Watchlist: "#f59e0b",
  Critical:  "#ef4444",
};

export function RiskRadar({ objects }: Props) {
  const byCategory = (cat: RiskCategory) =>
    objects
      .filter(o => o.riskCategory === cat)
      .map(o => ({
        x: o.distAu,
        y: o.velocityKmS,
        z: o.diameterKm * 1000, // diameter in meters for bubble size
        name: o.fullname || o.des,
      }));

  const categories: RiskCategory[] = ["Safe", "Watchlist", "Critical"];

  return (
    <div className="bg-space-800 border border-space-600 rounded-lg p-4">
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-4">
        Speed vs. Distance
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Each dot is one asteroid. Closer to the left = nearer to Earth.
        Higher up = faster. Bigger dot = larger asteroid.
        Red dots are the ones to watch.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="x"
            name="Miss Distance (AU)"
            type="number"
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }}
            label={{ value: "Miss Distance (AU)", position: "insideBottom", offset: -4, fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
          />
          <YAxis
            dataKey="y"
            name="Velocity (km/s)"
            type="number"
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }}
            label={{ value: "Velocity (km/s)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
          />
          <ZAxis dataKey="z" range={[20, 400]} name="Diameter (m)" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}
            formatter={(val, name) => {
              const n = String(name ?? "");
              const v = typeof val === "number" ? val.toFixed(n.includes("AU") ? 5 : 1) : String(val ?? "");
              return [v, n];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 8 }} />
          {categories.map(cat => (
            <Scatter
              key={cat}
              name={cat}
              data={byCategory(cat)}
              fill={COLORS[cat]}
              fillOpacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
