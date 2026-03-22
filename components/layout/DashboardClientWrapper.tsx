"use client";

import dynamic from "next/dynamic";
import type { NeoObject } from "@/lib/nasa/types";

// DashboardClient uses Recharts which requires a browser environment, so we
// load it with ssr:false. This wrapper is a Client Component so that dynamic()
// with ssr:false is allowed (it is not permitted in Server Components).
const DashboardClient = dynamic(
  () => import("@/components/layout/DashboardClient").then((m) => m.DashboardClient),
  { ssr: false }
);

interface Props {
  initialObjects: NeoObject[];
}

export function DashboardClientWrapper({ initialObjects }: Props) {
  return <DashboardClient initialObjects={initialObjects} />;
}
