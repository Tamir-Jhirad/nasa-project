// components/globe/EarthGlobe.tsx
"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import type { NeoObject, OrbitalElements } from "@/lib/nasa/types";
import { toGlobeArcs, toGlobePoints, type GlobeArc } from "./globeUtils";
import { computeOrbitPoints } from "@/lib/nasa/orbitUtils";

interface Props {
  objects: NeoObject[];
  selectedDes: string | null;
  onSelectDes: (des: string | null) => void;
  /** px — parent should pass a fixed value for SSR/hydration safety */
  width?: number;
  height?: number;
}

interface GlobeInstance {
  pointOfView: (pov: { lat: number; lng: number; altitude: number }, ms: number) => void;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
  scene: () => THREE.Scene;
}

const GLOBE_AU_SCALE = 300; // 1 AU → 300 globe units (globe radius ≈ 100)
const ORBIT_COLOR: Record<string, string> = {
  Critical: "#ef4444",
  Watchlist: "#f59e0b",
  Safe: "#22c55e",
};

export function EarthGlobe({ objects, selectedDes, onSelectDes, width = 480, height = 480 }: Props) {
  const globeEl = useRef<GlobeInstance | null>(null);
  const orbitMeshRef = useRef<THREE.Line | null>(null);

  const orbitColor = useMemo(() => {
    if (!selectedDes) return "#94a3b8";
    const obj = objects.find((o) => o.des === selectedDes);
    return obj ? (ORBIT_COLOR[obj.riskCategory] ?? "#94a3b8") : "#94a3b8";
  }, [selectedDes, objects]);

  // Start with a gentle tilt and auto-rotate
  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    g.pointOfView({ lat: 15, lng: 30, altitude: 2 }, 0);
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.4;
  }, []);

  useEffect(() => {
    const globe = globeEl.current;

    function removeOrbit() {
      if (orbitMeshRef.current && globe) {
        globe.scene().remove(orbitMeshRef.current);
        orbitMeshRef.current.geometry.dispose();
        (orbitMeshRef.current.material as THREE.Material).dispose();
        orbitMeshRef.current = null;
      }
    }

    removeOrbit();
    if (!selectedDes || !globe) return removeOrbit;

    let cancelled = false;

    fetch(`/api/orbit?des=${encodeURIComponent(selectedDes)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((elements: OrbitalElements) => {
        if (cancelled) return;
        if (elements.e >= 1) return;

        const pts = computeOrbitPoints(elements, 120);
        const positions = new Float32Array(pts.length * 3);
        pts.forEach(({ x, y, z }, idx) => {
          positions[idx * 3]     = x * GLOBE_AU_SCALE;
          positions[idx * 3 + 1] = z * GLOBE_AU_SCALE;
          positions[idx * 3 + 2] = -y * GLOBE_AU_SCALE;
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color: orbitColor, linewidth: 1.5 });
        const orbitLine = new THREE.Line(geometry, material);

        if (!cancelled && globeEl.current) {
          orbitMeshRef.current = orbitLine;
          globeEl.current.scene().add(orbitLine);
        } else {
          geometry.dispose();
          material.dispose();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      removeOrbit();
    };
  // orbitColor intentionally omitted — we only re-fetch when selection changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDes]);

  const arcs = toGlobeArcs(objects, selectedDes);
  const points = toGlobePoints(objects);

  const handleArcClick = useCallback((arc: GlobeArc) => {
    // Toggle: clicking the already-selected arc deselects it
    onSelectDes(arc.des === selectedDes ? null : arc.des);
  }, [selectedDes, onSelectDes]);

  const getArcStroke = useCallback((arc: GlobeArc) => (arc.des === selectedDes ? 1.2 : 0.5), [selectedDes]);

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
      arcStroke={getArcStroke}
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
