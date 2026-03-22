// components/layout/HeroIntro.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Eye, ShieldCheck } from "lucide-react";

export function HeroIntro() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-space-950 via-space-900 to-space-950 border border-space-700 rounded-xl p-5 sm:p-6">
      {/* Headline */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-white leading-snug">
            Asteroids passing close to Earth — right now
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-xl">
            Every day, small rocks fly past our planet. Most are harmless. A few are
            worth watching. This tracker pulls live data from NASA and scores each
            object by how much energy it would deliver if it hit.
          </p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-1"
          aria-expanded={expanded}
        >
          {expanded ? (
            <><ChevronUp size={14} /> Less info</>
          ) : (
            <><ChevronDown size={14} /> How does it work?</>
          )}
        </button>
      </div>

      {/* Risk key — always visible */}
      <div className="mt-4 flex flex-wrap gap-3">
        <RiskPill
          icon={<ShieldCheck size={13} className="text-neo-safe" />}
          label="Safe"
          desc="No concern — just passing by"
          color="text-neo-safe"
          bg="bg-neo-safe/10 border-neo-safe/30"
        />
        <RiskPill
          icon={<Eye size={13} className="text-neo-watchlist" />}
          label="Watchlist"
          desc="Notable — worth monitoring"
          color="text-neo-watchlist"
          bg="bg-neo-watchlist/10 border-neo-watchlist/30"
        />
        <RiskPill
          icon={<AlertTriangle size={13} className="text-neo-critical" />}
          label="Critical"
          desc="High kinetic energy relative to miss distance"
          color="text-neo-critical"
          bg="bg-neo-critical/10 border-neo-critical/30"
        />
      </div>

      {/* Expandable explainer */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-space-700 grid sm:grid-cols-3 gap-4 text-xs text-slate-400">
          <div>
            <p className="text-slate-300 font-medium mb-1">What is an NEO?</p>
            <p>
              A Near-Earth Object (NEO) is any asteroid or comet whose orbit brings
              it within 0.05 AU of Earth&apos;s orbit — about 7.5 million km, or 20× the
              distance to the Moon.
            </p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">How is risk calculated?</p>
            <p>
              We combine mass, speed, and miss distance into a single score using
              the formula: <span className="font-mono">log₁₀(mass × speed / distance² + 1)</span>.
              A score of 3 or above is flagged Critical.
            </p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">Is this official?</p>
            <p>
              Data is from NASA&apos;s JPL Close Approach Database, updated every 12 hours.
              The risk score is a portfolio demo — not an official NASA hazard assessment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface PillProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  bg: string;
}

function RiskPill({ icon, label, desc, color, bg }: PillProps) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${bg}`}>
      {icon}
      <span className={`font-semibold ${color}`}>{label}</span>
      <span className="text-slate-500 hidden sm:inline">— {desc}</span>
    </div>
  );
}
