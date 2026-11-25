"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { OfficeSettings } from "@/lib/adminTypes";
import { parseJsonSafe } from "@/lib/http";

const OfficeMapPicker = dynamic(() => import("@/components/OfficeMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-sm text-slate-400">
      Memuat peta interaktif...
    </div>
  ),
});

interface OfficeSettingsSectionProps {
  adminPin: string;
  initialSettings: OfficeSettings;
  onNotify: (msg: string) => void;
}

export default function OfficeSettingsSection({
  adminPin,
  initialSettings,
  onNotify,
}: OfficeSettingsSectionProps) {
  const [officeLat, setOfficeLat] = useState<string>(String(initialSettings.office_lat));
  const [officeLng, setOfficeLng] = useState<string>(String(initialSettings.office_lng));
  const [maxRadius, setMaxRadius] = useState<string>(String(initialSettings.max_radius_meter));
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    setOfficeLat(String(initialSettings.office_lat));
    setOfficeLng(String(initialSettings.office_lng));
    setMaxRadius(String(initialSettings.max_radius_meter));
  }, [initialSettings]);

  function handleGetCurrentLocation() {
    if (!navigator.geolocation) return onNotify("❌ Browser tidak mendukung GPS.");
    onNotify("📡 Mengambil koordinat GPS Anda...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeLat(pos.coords.latitude.toFixed(6));
        setOfficeLng(pos.coords.longitude.toFixed(6));
        onNotify("✅ Koordinat GPS diambil. Klik 'Simpan Pengaturan Lokasi' untuk menerapkan.");
      },
      () => onNotify("❌ Gagal mengambil GPS. Pastikan izin lokasi aktif."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onNotify("Menyimpan lokasi kantor...");
    try {
      const res = await fetch("/api/admin", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify({
          office_lat: Number(officeLat),
          office_lng: Number(officeLng),
          max_radius_meter: Number(maxRadius),
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error);
      onNotify(`✅ ${data.message}`);
    } catch (err: unknown) {
      onNotify(`❌ ${err instanceof Error ? err.message : "Gagal menyimpan pengaturan"}`);
    }
    setSaving(false);
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">1. Pengaturan Lokasi & Radius Kantor</h2>
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
        >
          📍 Atau Pakai GPS Saya
        </button>
      </div>

      <OfficeMapPicker
        lat={Number(officeLat)}
        lng={Number(officeLng)}
        radius={Number(maxRadius)}
        adminPin={adminPin}
        onSelectLocation={(newLat, newLng) => {
          setOfficeLat(newLat.toFixed(6));
          setOfficeLng(newLng.toFixed(6));
          onNotify("📍 Titik peta diperbarui. Klik 'Simpan Pengaturan Lokasi' untuk menerapkan.");
        }}
      />

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Latitude Kantor</label>
          <input
            type="text"
            value={officeLat}
            onChange={(e) => setOfficeLat(e.target.value)}
            required
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Longitude Kantor</label>
          <input
            type="text"
            value={officeLng}
            onChange={(e) => setOfficeLng(e.target.value)}
            required
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Radius Maksimal (Meter)</label>
          <input
            type="number"
            min={10}
            max={50000}
            value={maxRadius}
            onChange={(e) => setMaxRadius(e.target.value)}
            required
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm"
          />
        </div>

        <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2">
          <a
            href={`https://www.google.com/maps?q=${officeLat},${officeLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:underline"
          >
            🗺️ Cek titik koordinat ini di Google Maps →
          </a>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 font-bold text-sm"
          >
            {saving ? "Menyimpan..." : "Simpan Pengaturan Lokasi"}
          </button>
        </div>
      </form>
    </section>
  );
}