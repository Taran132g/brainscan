"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FAKE_USERS, TIER_INFO, FakeUser } from "@/lib/fake-users";

// react-globe.gl uses WebGL — must be client-only.
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

type Props = {
  height?: number;
  width?: number;
  users?: FakeUser[];
  onUserClick?: (user: FakeUser) => void;
  highlightId?: string;
  autoRotate?: boolean;
  interactive?: boolean;
};

export function FounderGlobe({
  height = 500,
  width,
  users = FAKE_USERS,
  onUserClick,
  highlightId,
  autoRotate = true,
  interactive = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: width ?? 600, h: height });
  // Globe ref typing is awkward through next/dynamic — keep it untyped here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);

  // Responsive width
  useEffect(() => {
    if (width) return;
    const update = () => {
      if (containerRef.current) {
        setSize({ w: containerRef.current.clientWidth, h: height });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [width, height]);

  // Auto-rotate
  useEffect(() => {
    if (!autoRotate || !globeRef.current) return;
    const g = globeRef.current as { controls?: () => { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean } };
    if (g.controls) {
      const c = g.controls();
      c.autoRotate = true;
      c.autoRotateSpeed = 0.5;
      c.enableZoom = interactive;
    }
  }, [autoRotate, interactive, size.w]);

  const pointsData = users.map((u) => ({
    lat: u.lat,
    lng: u.lng,
    color: TIER_INFO[u.tier].color,
    altitude: 0.01 + u.rank * 0.005,
    radius: u.id === highlightId ? 0.9 : 0.4,
    user: u,
  }));

  return (
    <div ref={containerRef} style={{ width: "100%", height }}>
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#10b981"
        atmosphereAltitude={0.18}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude="altitude"
        pointRadius="radius"
        pointLabel={(d: object) => {
          const u = (d as { user: FakeUser }).user;
          return `
            <div style="background:#0f1524;color:#f0f2f8;padding:10px 14px;border-radius:8px;border:1px solid ${TIER_INFO[u.tier].color};font-size:12px;line-height:1.5;max-width:240px;font-family:-apple-system,sans-serif">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:4px">
                <strong style="font-size:13px">${u.name}</strong>
                <span style="color:${TIER_INFO[u.tier].color};font-weight:600">${u.tier} · ${u.rank}/10</span>
              </div>
              <div style="color:#8892a4;font-size:11px;margin-bottom:6px">${u.city}, ${u.country}</div>
              <div style="color:#f0f2f8;font-size:11px">${u.building}</div>
            </div>
          `;
        }}
        onPointClick={(d: object) => {
          const u = (d as { user: FakeUser }).user;
          onUserClick?.(u);
        }}
      />
    </div>
  );
}
