"use client";

import { AttendanceRow } from "@/lib/adminTypes";
import { formatWaktuWIB } from "@/lib/http";

interface AttendanceTableSectionProps {
  attendances: AttendanceRow[];
}

export default function AttendanceTableSection({ attendances }: AttendanceTableSectionProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-bold">3. Riwayat Absensi Terbaru ({attendances.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-2 pr-4">Waktu (WIB)</th>
              <th className="py-2 pr-4">Karyawan</th>
              <th className="py-2 pr-4">Tipe</th>
              <th className="py-2 pr-4">Lokasi & Jarak</th>
              <th className="py-2 pr-4">Alasan</th>
              <th className="py-2 pr-4">Skor AI</th>
              <th className="py-2">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {attendances.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-center text-slate-500">
                  Belum ada data absensi masuk.
                </td>
              </tr>
            ) : (
              attendances.map((row) => {
                const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
                const isOutside = row.status_lokasi === "LUAR_RADIUS";
                return (
                  <tr key={row.id}>
                    <td className="py-3 pr-4 whitespace-nowrap text-slate-300">
                      {formatWaktuWIB(row.created_at)}
                    </td>
                    <td className="py-3 pr-4 font-semibold">
                      {emp?.nama || "Tidak diketahui"}
                    </td>
                    <td className="py-3 pr-4">{row.tipe}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          isOutside
                            ? "bg-amber-900/70 text-amber-300"
                            : "bg-emerald-900/60 text-emerald-300"
                        }`}
                      >
                        {isOutside ? "LUAR RADIUS" : "DI KANTOR"} ({Math.round(row.jarak_meter)}m)
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300 max-w-xs">
                      {row.alasan || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {(row.similarity_score * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 text-xs text-slate-400 font-mono">
                      {row.ip_address || "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}