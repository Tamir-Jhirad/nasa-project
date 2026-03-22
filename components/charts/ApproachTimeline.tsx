// components/charts/ApproachTimeline.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { NeoObject } from "@/lib/nasa/types";

interface Props {
  objects: NeoObject[];
}

export function ApproachTimeline({ objects }: Props) {
  // Group by week, count objects
  const weekly = objects.reduce<Record<string, number>>((acc, o) => {
    // Strip time to avoid UTC-vs-local timezone bucketing errors at day boundaries
    const d = new Date(o.closeApproachDate.split("T")[0]);
    // Round down to Monday of that week
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    const key = monday.toISOString().split("T")[0];
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(weekly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    }));

  return (
    <div className="bg-space-800 border border-space-600 rounded-lg p-4">
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">
        Close Approaches per Week
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        How many asteroids fly past each week over the next 6 months.
        Peaks indicate busy periods — not increased danger.
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 12, fontFamily: "monospace" }}
            labelStyle={{ color: "#38bdf8" }}
          />
          <Line type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
