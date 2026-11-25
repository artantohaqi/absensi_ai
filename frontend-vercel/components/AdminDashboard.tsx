"use client";

import { useState } from "react";
import Link from "next/link";
import { AttendanceRow, EmployeeRow, OfficeSettings } from "@/lib/adminTypes";
import { parseJsonSafe } from "@/lib/http";
import AdminLoginGate from "./admin/AdminLoginGate";
import OfficeSettingsSection from "./admin/OfficeSettingsSection";
import EmployeeManagerSection from "./admin/EmployeeManagerSection";
import AttendanceTableSection from "./admin/AttendanceTableSection";

export default function AdminDashboard() {
  const [pin, setPin] = useState<string>("");
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const [settings, setSettings] = useState<OfficeSettings>({
    office_lat: -6.8048,
    office_lng: 110.8405,
    max_radius_meter: 100,
  });
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);

  async function loadAdminData(currentPin = pin) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        headers: { "x-admin-pin": currentPin },
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal masuk");

      setSettings(data.settings as OfficeSettings);
      setEmployees(data.employees || []);
      setAttendances(data.attendances || []);
      setIsUnlocked(true);
    } catch (e: unknown) {
      setMessage(`❌ ${e instanceof Error ? e.message : "Terjadi kesalahan"}`);
    }
    setLoading(false);
  }

  if (!isUnlocked) {
    return (
      <AdminLoginGate
        pin={pin}
        loading={loading}
        message={message}
        onPinChange={setPin}
        onSubmit={() => {
          setMessage("");
          loadAdminData(pin);
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Admin Absensi</h1>
            <p className="text-sm text-slate-400">
              Atur koordinat kantor, kelola karyawan, dan audit riwayat absensi.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadAdminData(pin)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold"
            >
              ↻ Refresh Data
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold"
            >
              Halaman Absen
            </Link>
          </div>
        </div>

        {message && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm">
            {message}
          </div>
        )}

        <OfficeSettingsSection
          adminPin={pin}
          initialSettings={settings}
          onNotify={setMessage}
        />

        <EmployeeManagerSection
          adminPin={pin}
          employees={employees}
          onRefresh={() => loadAdminData(pin)}
          onNotify={setMessage}
        />

        <AttendanceTableSection attendances={attendances} />
      </div>
    </main>
  );
}