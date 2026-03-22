// components/satellites/SatelliteGlobe.tsx
"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
} from "satellite.js";
import type { SatelliteObject, OrbitClass } from "@/lib/celestrak/types";
import { computeOrbitPointsGeo } from "@/lib/celestrak/orbitUtils";

interface Props {
  objects: SatelliteObject[];
  selectedNoradId: number | null;
  onSelectNoradId: (id: number | null) => void;
  onLivePosition?: (lat: number, lng: number) => void; // fired every 2 s — drives detail panel
  width?: number;
  height?: number;
}

interface GlobeInstance {
  pointOfView: (pov: { lat: number; lng: number; altitude: number }, ms: number) => void;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
  scene: () => THREE.Scene;
}

interface GlobePoint {
  noradId: number;
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
}

const ORBIT_CLASS_COLOR: Record<OrbitClass, string> = {
  LEO: "#38bdf8",
  MEO: "#f59e0b",
  GEO: "#22c55e",
  HEO: "#a78bfa",
};

// react-globe.gl renders its Earth sphere at radius 100 THREE.js units
const GLOBE_ER_SCALE = 100; // 1 Earth radius = 100 THREE.js units
const EARTH_RADIUS_KM = 6371;
const MU_KM3_S2 = 398600.4418;

function deriveOrbitalElements(sat: SatelliteObject) {
  const T = sat.periodMin * 60; // seconds
  const a_km = (MU_KM3_S2 * (T / (2 * Math.PI)) ** 2) ** (1 / 3);
  const a_ER = a_km / EARTH_RADIUS_KM;
  return {
    a: a_ER,
    e: sat.eccentricity,
    i: sat.inclinationDeg,
    om: sat.raanDeg,
    w: sat.argOfPericenterDeg,
  };
}

export function SatelliteGlobe({
  objects,
  selectedNoradId,
  onSelectNoradId,
  onLivePosition,
  width = 480,
  height = 480,
}: Props) {
  const globeEl = useRef<GlobeInstance | null>(null);
  const orbitMeshRef = useRef<THREE.Line | null>(null);
  const liveDotRef = useRef<THREE.Mesh | null>(null);

  // Initial camera position
  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    g.pointOfView({ lat: 15, lng: 30, altitude: 2.5 }, 0);
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.3;
  }, []);

  // Orbit ring + live position animation
  useEffect(() => {
    const globe = globeEl.current;

    function removeOrbit() {
      if (orbitMeshRef.current && globe) {
        globe.scene().remove(orbitMeshRef.current);
        orbitMeshRef.current.geometry.dispose();
        const mat = orbitMeshRef.current.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
        orbitMeshRef.current = null;
      }
      if (liveDotRef.current && globe) {
        globe.scene().remove(liveDotRef.current);
        (liveDotRef.current.geometry as THREE.BufferGeometry).dispose();
        (liveDotRef.current.material as THREE.Material).dispose();
        liveDotRef.current = null;
      }
    }

    removeOrbit();

    const sat = selectedNoradId
      ? objects.find((o) => o.noradId === selectedNoradId) ?? null
      : null;

    if (!sat || !globe) return removeOrbit;

    // Draw static orbit ring
    const elements = deriveOrbitalElements(sat);
    const pts = computeOrbitPointsGeo(elements, 180);
    const positions = new Float32Array(pts.length * 3);
    pts.forEach(({ x, y, z }, idx) => {
      // THREE.js axis swap: x→x, y→z, z→-y (Y-up ECI to Y-up globe frame)
      positions[idx * 3]     = x * GLOBE_ER_SCALE;
      positions[idx * 3 + 1] = z * GLOBE_ER_SCALE;
      positions[idx * 3 + 2] = -y * GLOBE_ER_SCALE;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const ringColor = ORBIT_CLASS_COLOR[sat.orbitClass] ?? "#94a3b8";
    const mat = new THREE.LineBasicMaterial({ color: ringColor, linewidth: 1.5 });
    const orbitLine = new THREE.Line(geo, mat);
    orbitMeshRef.current = orbitLine;
    globe.scene().add(orbitLine);

    // Live position dot
    const dotGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: ringColor });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    liveDotRef.current = dot;
    globe.scene().add(dot);

    // TLE propagation — satrec created once per selection
    let satrec: ReturnType<typeof twoline2satrec> | null = null;
    try {
      satrec = twoline2satrec(sat.tleLine1, sat.tleLine2);
    } catch {
      satrec = null;
    }

    function updateLivePosition() {
      if (!satrec || !liveDotRef.current) return;
      const now = new Date();
      const posVel = propagate(satrec, now);
      const gmst = gstime(now);
      // satellite.js returns false for position on propagation failure; cast via unknown to satisfy TS
      if (!posVel || (posVel.position as unknown) === false) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geoPos = eciToGeodetic(posVel.position as any, gmst);
      const latRad = geoPos.latitude;
      const lngRad = geoPos.longitude;
      const altKm = geoPos.height;

      // Convert geodetic to THREE.js Cartesian (same axis convention as orbit ring)
      const altER = 1 + altKm / EARTH_RADIUS_KM; // altitude in Earth radii from center
      const cosLat = Math.cos(latRad);
      const x_eci = altER * cosLat * Math.cos(lngRad);
      const y_eci = altER * cosLat * Math.sin(lngRad);
      const z_eci = altER * Math.sin(latRad);

      liveDotRef.current.position.set(
        x_eci * GLOBE_ER_SCALE,
        z_eci * GLOBE_ER_SCALE,
        -y_eci * GLOBE_ER_SCALE
      );

      // Notify parent so detail panel shows same position (single source of truth)
      onLivePosition?.(latRad * (180 / Math.PI), lngRad * (180 / Math.PI));
    }

    updateLivePosition();
    const interval = setInterval(updateLivePosition, 2000);

    return () => {
      clearInterval(interval);
      removeOrbit();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoradId]);

  // Compute page-load positions once — propagate every satellite to now at mount
  const initPositions = useMemo(() => {
    const now = new Date();
    const gmst = gstime(now);
    const map = new Map<number, { lat: number; lng: number }>();
    for (const o of objects) {
      try {
        const rec = twoline2satrec(o.tleLine1, o.tleLine2);
        const posVel = propagate(rec, now);
        if (!posVel || (posVel.position as unknown) === false) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geoPos = eciToGeodetic(posVel.position as any, gmst);
        map.set(o.noradId, {
          lat: (geoPos.latitude * 180) / Math.PI,
          lng: (geoPos.longitude * 180) / Math.PI,
        });
      } catch {
        // skip satellites with bad TLEs
      }
    }
    return map;
  }, [objects]); // recompute only when objects change (not on selection)

  // Satellite dots — color by orbit class
  const points: GlobePoint[] = useMemo(
    () =>
      objects.map((o) => {
        const pos = initPositions.get(o.noradId);
        return {
          noradId: o.noradId,
          lat: pos?.lat ?? 0,
          lng: pos?.lng ?? 0,
          size: o.noradId === selectedNoradId ? 0.6 : 0.2,
          color: ORBIT_CLASS_COLOR[o.orbitClass],
          label: `${o.name} (${o.orbitClass})`,
        };
      }),
    [objects, selectedNoradId, initPositions]
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as GlobePoint;
      onSelectNoradId(p.noradId === selectedNoradId ? null : p.noradId);
    },
    [selectedNoradId, onSelectNoradId]
  );

  return (
    <Globe
      ref={globeEl}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.12}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={0.01}
      pointRadius="size"
      pointColor="color"
      pointLabel="label"
      onPointClick={handlePointClick}
    />
  );
}
