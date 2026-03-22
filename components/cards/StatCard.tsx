// components/cards/StatCard.tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({ label, value, sub, icon: Icon, iconColor = "text-neo-accent" }: Props) {
  return (
    <div className="bg-space-800 border border-space-600 rounded-lg p-4 flex items-start gap-3">
      <div className={cn("mt-0.5", iconColor)}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-mono font-bold text-slate-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
