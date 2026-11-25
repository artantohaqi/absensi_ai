"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface OfficeMapViewerProps {
  lat: number;
  lng: number;
  radius: number;
}

export default function OfficeMapViewer({ lat, lng, radius }: OfficeMapViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([lat, lng], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: "",
      html: `<div style="width:24px;height:24px;background:#10b981;border:3px solid #ffffff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,0.45);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    L.marker([lat, lng], { draggable: false, icon: pinIcon })
      .addTo(map)
      .bindPopup(`<strong>Lokasi Kantor</strong><br/>Radius absensi: ${radius}m`)
      .openPopup();

    L.circle([lat, lng], {
      radius,
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 0.2,
      weight: 2,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, radius]);

  return (
    <div className="space-y-1.5">
      <div className="rounded-xl overflow-hidden border border-slate-700 isolate">
        <div ref={containerRef} className="w-full h-56 bg-slate-950" />
      </div>
      <p className="text-[11px] text-slate-400 text-center">
        Mode lihat saja (read-only). Lingkaran hijau adalah radius kantor ({radius}m).
      </p>
    </div>
  );
}