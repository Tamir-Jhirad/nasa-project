// components/satellites/SatelliteGlobe.tsx
"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { twoline2satrec, propagate, gstime, eciToGeodetic } from "satellite.js";
import type { SatelliteObject, OrbitClass, TleDerived } from "@/lib/celestrak/types";
import { computeOrbitPointsGeo } from "@/lib/celestrak/orbitUtils";

interface Props {
  objects: SatelliteObject[];
  selectedNoradId: number | null;
  selectedTle: TleDerived | null;
  onSelectNoradId: (id: number | null) => void;
  onLivePosition?: (lat: number, lng: number) => void;
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

const GLOBE_ER_SCALE = 100;
const EARTH_RADIUS_KM = 6371;
const MU_KM3_S2 = 398600.4418;

export function SatelliteGlobe({
  objects,
  selectedNoradId,
  selectedTle,
  onSelectNoradId,
  onLivePosition,
  width = 480,
  height = 480,
}: Props) {
  const globeEl = useRef<GlobeInstance | null>(null);
  const orbitMeshRef = useRef<THREE.Line | null>(null);
  const liveDotRef = useRef<THREE.Mesh | null>(null);
  const onLivePositionRef = useRef(onLivePosition);

  useEffect(() => {
    onLivePositionRef.current = onLivePosition;
  }, [onLivePosition]);

  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    g.pointOfView({ lat: 15, lng: 30, altitude: 2.5 }, 0);
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.3;
  }, []);

  // Orbit ring + live position — triggered when selectedTle arrives
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
    if (!selectedTle || !globe) return removeOrbit;

    const { tleLine1, tleLine2, inclinationDeg, eccentricity, periodMin, raanDeg, argOfPericenterDeg } = selectedTle;

    // Derive semi-major axis in Earth radii for orbit ring
    const periodSec = periodMin * 60;
    const a_km = (MU_KM3_S2 * (periodSec / (2 * Math.PI)) ** 2) ** (1 / 3);
    const a_ER = a_km / EARTH_RADIUS_KM;

    const elements = { a: a_ER, e: eccentricity, i: inclinationDeg, om: raanDeg, w: argOfPericenterDeg };
    const pts = computeOrbitPointsGeo(elements, 180);
    const positions = new Float32Array(pts.length * 3);
    pts.forEach(({ x, y, z }, idx) => {
      positions[idx * 3]     = x * GLOBE_ER_SCALE;
      positions[idx * 3 + 1] = z * GLOBE_ER_SCALE;
      positions[idx * 3 + 2] = -y * GLOBE_ER_SCALE;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const selectedSat = objects.find((o) => o.noradId === selectedNoradId);
    const ringColor = selectedSat ? (ORBIT_CLASS_COLOR[selectedSat.orbitClass] ?? "#94a3b8") : "#94a3b8";

    const mat = new THREE.LineBasicMaterial({ color: ringColor, linewidth: 1.5 });
    const orbitLine = new THREE.Line(geo, mat);
    orbitMeshRef.current = orbitLine;
    globe.scene().add(orbitLine);

    // Live dot
    const dotGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: ringColor });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    liveDotRef.current = dot;
    globe.scene().add(dot);

    let satrec: ReturnType<typeof twoline2satrec> | null = null;
    try {
      satrec = twoline2satrec(tleLine1, tleLine2);
    } catch {
      satrec = null;
    }

    function updateLivePosition() {
      if (!satrec || !liveDotRef.current) return;
      const now = new Date();
      const posVel = propagate(satrec, now);
      const gmst = gstime(now);
      if (!posVel || (posVel.position as unknown) === false) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geoPos = eciToGeodetic(posVel.position as any, gmst);
      const latRad = geoPos.latitude;
      const lngRad = geoPos.longitude;
      const altKm = geoPos.height;

      const altER = 1 + altKm / EARTH_RADIUS_KM;
      const cosLat = Math.cos(latRad);
      const x_eci = altER * cosLat * Math.cos(lngRad);
      const y_eci = altER * cosLat * Math.sin(lngRad);
      const z_eci = altER * Math.sin(latRad);

      liveDotRef.current.position.set(
        x_eci * GLOBE_ER_SCALE,
        z_eci * GLOBE_ER_SCALE,
        -y_eci * GLOBE_ER_SCALE
      );
      onLivePositionRef.current?.(latRad * (180 / Math.PI), lngRad * (180 / Math.PI));
    }

    updateLivePosition();
    const interval = setInterval(updateLivePosition, 2000);

    return () => {
      clearInterval(interval);
      removeOrbit();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTle]);

  // Satellite dots — use lat/lng directly from N2YO (no SGP4 propagation needed)
  const points: GlobePoint[] = useMemo(
    () =>
      objects.map((o) => ({
        noradId: o.noradId,
        lat: o.lat,
        lng: o.lng,
        size: o.noradId === selectedNoradId ? 0.6 : 0.2,
        color: ORBIT_CLASS_COLOR[o.orbitClass],
        label: `${o.name} (${o.orbitClass})`,
      })),
    [objects, selectedNoradId]
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
