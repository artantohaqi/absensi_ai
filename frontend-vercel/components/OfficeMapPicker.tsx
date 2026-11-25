"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface SearchResult {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

interface OfficeMapPickerProps {
  lat: number;
  lng: number;
  radius: number;
  adminPin: string;
  onSelectLocation: (lat: number, lng: number) => void;
}

export default function OfficeMapPicker({
  lat,
  lng,
  radius,
  adminPin,
  onSelectLocation,
}: OfficeMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onSelectRef = useRef(onSelectLocation);
  onSelectRef.current = onSelectLocation;

  const [query, setQuery] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string>("");

  const safeLat = Number.isFinite(lat) ? lat : -6.8048;
  const safeLng = Number.isFinite(lng) ? lng : 110.8405;
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 100;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([safeLat, safeLng], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: "",
      html: `<div style="width:26px;height:26px;background:#10b981;border:3px solid #ffffff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,0.45);"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    });

    const marker = L.marker([safeLat, safeLng], {
      draggable: true,
      icon: pinIcon,
    }).addTo(map);

    const circle = L.circle([safeLat, safeLng], {
      radius: safeRadius,
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 0.2,
      weight: 2,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onSelectRef.current(e.latlng.lat, e.latlng.lng);
    });

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      onSelectRef.current(pos.lat, pos.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;

    markerRef.current.setLatLng([safeLat, safeLng]);
    circleRef.current.setLatLng([safeLat, safeLng]);
    circleRef.current.setRadius(safeRadius);
    mapRef.current.panTo([safeLat, safeLng]);
  }, [safeLat, safeLng, safeRadius]);

  async function handleSearch() {
    if (query.trim().length < 3) {
      setSearchError("Ketik minimal 3 huruf (mis. nama jalan, gedung, atau kecamatan).");
      return;
    }

    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, {
        headers: { "x-admin-pin": adminPin },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pencarian gagal");

      if (!data.results || data.results.length === 0) {
        setSearchError("Lokasi tidak ditemukan. Coba ketik nama jalan atau kota yang lebih umum.");
      } else {
        setResults(data.results);
      }
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : "Gagal mencari lokasi");
    }
    setSearching(false);
  }

  function handlePickResult(item: SearchResult) {
    onSelectLocation(item.lat, item.lng);
    mapRef.current?.setView([item.lat, item.lng], 17);
    setResults([]);
    setQuery(item.name);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="Cari nama tempat, jalan, atau kota (mis. Alun-alun Kudus)..."
          className="flex-1 p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500"
        />
        <button
          type="button"
          disabled={searching}
          onClick={handleSearch}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-sm font-bold whitespace-nowrap"
        >
          {searching ? "Mencari..." : "🔍 Cari"}
        </button>
      </div>

      {searchError && <p className="text-xs text-amber-400">{searchError}</p>}

      {results.length > 0 && (
        <ul className="bg-slate-950 border border-slate-700 rounded-lg divide-y divide-slate-800 max-h-48 overflow-y-auto">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handlePickResult(item)}
                className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
              >
                📍 {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl overflow-hidden border border-slate-700 isolate">
        <div ref={mapContainerRef} className="w-full h-80 bg-slate-950" />
      </div>

      <p className="text-xs text-slate-400">
        💡 Cari alamat di atas, lalu <strong>klik langsung di peta</strong> atau{" "}
        <strong>geser pin hijau</strong> untuk menentukan titik kantor secara presisi. Lingkaran
        hijau menunjukkan area radius absensi ({safeRadius}m).
      </p>
    </div>
  );
}