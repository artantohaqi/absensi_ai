"use client";

import Link from "next/link";

interface AdminLoginGateProps {
  pin: string;
  loading: boolean;
  message: string;
  onPinChange: (value: string) => void;
  onSubmit: () => void;
}

export default function AdminLoginGate({
  pin,
  loading,
  message,
  onPinChange,
  onSubmit,
}: AdminLoginGateProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-bold text-center">Panel Admin Absensi</h1>
        <p className="text-xs text-slate-400 text-center">
          Masukkan PIN Admin untuk mengelola lokasi kantor, data karyawan, dan laporan.
        </p>
        <input
          type="password"
          placeholder="Masukkan PIN Admin"
          value={pin}
          onChange={(e) => onPinChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-center tracking-widest"
        />
        <button
          disabled={loading || !pin}
          onClick={onSubmit}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 font-bold"
        >
          {loading ? "Memverifikasi..." : "Masuk Dashboard"}
        </button>
        {message && <p className="text-sm text-center text-red-400">{message}</p>}
        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-slate-400 hover:text-white underline">
            ← Kembali ke Halaman Absensi
          </Link>
        </div>
      </div>
    </main>
  );
}