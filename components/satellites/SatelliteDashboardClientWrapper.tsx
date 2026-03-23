// components/satellites/SatelliteDashboardClientWrapper.tsx
"use client";

import dynamic from "next/dynamic";
import type { SatelliteObject } from "@/lib/celestrak/types";

const SatelliteDashboardClient = dynamic(
  () =>
    import("@/components/satellites/SatelliteDashboardClient").then(
      (m) => m.SatelliteDashboardClient
    ),
  { ssr: false }
);

interface Props {
  initialObjects: SatelliteObject[];
}

export function SatelliteDashboardClientWrapper({ initialObjects }: Props) {
  return <SatelliteDashboardClient initialObjects={initialObjects} />;
}
