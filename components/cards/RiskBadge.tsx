// components/cards/RiskBadge.tsx
import type { RiskCategory } from "@/lib/nasa/types";
import { cn } from "@/lib/utils";

interface Props {
  category: RiskCategory;
  className?: string;
}

const STYLES: Record<RiskCategory, string> = {
  Safe:      "bg-neo-safe/10 text-neo-safe border border-neo-safe/30",
  Watchlist: "bg-neo-watchlist/10 text-neo-watchlist border border-neo-watchlist/30",
  Critical:  "bg-neo-critical/10 text-neo-critical border border-neo-critical/30",
};

export function RiskBadge({ category, className }: Props) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider", STYLES[category], className)}>
      {category}
    </span>
  );
}
