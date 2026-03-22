// components/globe/EarthGlobe.tsx
"use client";

import { useRef, useEffect } from "react";
import Globe from "react-globe.gl";
import type { NeoObject } from "@/lib/nasa/types";
import { toGlobeArcs, toGlobePoints, type GlobeArc } from "./globeUtils";

interface Props {
  objects: NeoObject[];
  selectedDes: string | null;
  onSelectDes: (des: string | null) => void;
  /** px — parent should pass a fixed value for SSR/hydration safety */
  width?: number;
  height?: number;
}

export function EarthGlobe({ objects, selectedDes, onSelectDes, width = 480, height = 480 }: Props) {
  const globeEl = useRef<any>(null);

  // Start with a gentle tilt and auto-rotate
  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    g.pointOfView({ lat: 15, lng: 30, altitude: 2 }, 0);
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.4;
  }, []);

  const arcs = toGlobeArcs(objects, selectedDes);
  const points = toGlobePoints(objects);

  function handleArcClick(arc: GlobeArc) {
    // Toggle: clicking the already-selected arc deselects it
    onSelectDes(arc.des === selectedDes ? null : arc.des);
  }

  return (
    <Globe
      ref={globeEl}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.12}
      // Approach arcs
      arcsData={arcs}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcAltitude="altitude"
      arcColor="color"
      arcLabel="label"
      arcDashLength={0.4}
      arcDashGap={0.2}
      arcDashAnimateTime={2500}
      arcStroke={(arc: GlobeArc) => (arc.des === selectedDes ? 1.2 : 0.5)}
      onArcClick={handleArcClick}
      // Alert points (Watchlist / Critical only)
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={0.01}
      pointRadius="size"
      pointColor="color"
      pointLabel="label"
    />
  );
}
