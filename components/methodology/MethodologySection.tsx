// components/methodology/MethodologySection.tsx
import { FlaskConical, BookOpen } from "lucide-react";

export function MethodologySection() {
  return (
    <section className="bg-space-800 border border-space-600 rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2 text-neo-accent">
        <FlaskConical size={18} />
        <h2 className="font-mono font-bold text-sm uppercase tracking-widest">
          Data Science Methodology
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        {/* Score formula */}
        <div className="space-y-2">
          <h3 className="font-mono text-slate-300 font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-slate-400" />
            Impact Hazard Score
          </h3>
          <div className="bg-space-900 rounded p-3 font-mono text-xs text-neo-accent border border-space-700">
            <p>Score = log₁₀( (Mass × Velocity) / Distance² + 1 )</p>
          </div>
          <ul className="text-slate-400 space-y-1 text-xs font-mono">
            <li><span className="text-slate-300">Mass</span> — derived from estimated diameter (spherical body, ρ = 2,000 kg/m³)</li>
            <li><span className="text-slate-300">Velocity</span> — relative velocity at close approach (m/s)</li>
            <li><span className="text-slate-300">Distance</span> — nominal miss distance (m)</li>
            <li><span className="text-slate-300">log₁₀</span> — log scale prevents extreme values from dominating</li>
          </ul>
        </div>

        {/* Diameter estimation */}
        <div className="space-y-2">
          <h3 className="font-mono text-slate-300 font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-slate-400" />
            Diameter Estimation
          </h3>
          <div className="bg-space-900 rounded p-3 font-mono text-xs text-neo-accent border border-space-700">
            <p>D = (1329 / √p) × 10^(−H/5)  [km]</p>
          </div>
          <ul className="text-slate-400 space-y-1 text-xs font-mono">
            <li><span className="text-slate-300">H</span> — absolute magnitude from NASA catalog</li>
            <li><span className="text-slate-300">p = 0.14</span> — assumed geometric albedo (S-type asteroid)</li>
            <li>NASA provides diameter for &lt; 1% of tracked objects; this formula covers the rest</li>
          </ul>
        </div>

        {/* Categories */}
        <div className="space-y-2 md:col-span-2">
          <h3 className="font-mono text-slate-300 font-semibold">Risk Categories</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-neo-safe/5 border border-neo-safe/20 rounded p-3">
              <p className="text-neo-safe font-mono font-bold text-xs mb-1">SAFE</p>
              <p className="text-slate-400 text-xs font-mono">Score &lt; 1.5 — Low kinetic energy or large miss distance</p>
            </div>
            <div className="bg-neo-watchlist/5 border border-neo-watchlist/20 rounded p-3">
              <p className="text-neo-watchlist font-mono font-bold text-xs mb-1">WATCHLIST</p>
              <p className="text-slate-400 text-xs font-mono">Score 1.5–3.0 — Notable combination of size, speed, and proximity</p>
            </div>
            <div className="bg-neo-critical/5 border border-neo-critical/20 rounded p-3">
              <p className="text-neo-critical font-mono font-bold text-xs mb-1">CRITICAL</p>
              <p className="text-slate-400 text-xs font-mono">Score ≥ 3.0 — High kinetic impact potential, close approach</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 font-mono border-t border-space-700 pt-3">
        ⚠ This scoring system is a portfolio demonstration of data-science thinking, not an official NASA risk assessment.
        For authoritative impact risk, see NASA's{" "}
        <a href="https://cneos.jpl.nasa.gov/sentry/" className="text-neo-accent underline" target="_blank" rel="noreferrer">Sentry system</a>.
      </p>
    </section>
  );
}
