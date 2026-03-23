"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/",           label: "☄ Asteroids" },
    { href: "/satellites", label: "🛰 Satellites" },
  ];

  return (
    <nav className="flex border-b border-space-600 bg-space-950">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={[
              "px-5 py-2 text-xs font-mono uppercase tracking-widest border-r border-space-700 transition-colors",
              active
                ? "bg-space-800 text-neo-accent border-b-2 border-b-neo-accent"
                : "text-slate-500 hover:text-slate-300 hover:bg-space-900",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
