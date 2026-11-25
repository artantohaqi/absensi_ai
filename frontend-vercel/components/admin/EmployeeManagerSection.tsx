"use client";

import { useState } from "react";
import { EmployeeRow } from "@/lib/adminTypes";
import { formatWaktuWIB, parseJsonSafe } from "@/lib/http";
import EmployeeFormModal from "./EmployeeFormModal";

interface EmployeeManagerSectionProps {
  adminPin: string;
  employees: EmployeeRow[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export default function EmployeeManagerSection({
  adminPin,
  employees,
  onRefresh,
  onNotify,
}: EmployeeManagerSectionProps) {
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAddModal() {
    setEditingEmployee(null);
    setModalOpen(true);
  }

  function openEditModal(emp: EmployeeRow) {
    setEditingEmployee(emp);
    setModalOpen(true);
  }

  async function handleDelete(emp: EmployeeRow) {
    if (!window.confirm(`Yakin ingin menghapus karyawan "${emp.nama}"?`)) return;

    setDeletingId(emp.id);
    try {
      let res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "DELETE",
        headers: { "x-admin-pin": adminPin },
      });
      let data = await parseJsonSafe(res);

      // Jika sudah ada riwayat absensi, beri konfirmasi kedua (mencegah hapus tidak sengaja)
      if (res.status === 409 && data.has_history) {
        const confirmForce = window.confirm(
          `${emp.nama} sudah memiliki ${data.history_count} riwayat absensi.\n\n` +
            `• Klik CANCEL jika ingin mempertahankan riwayat (Anda bisa pilih Edit → Nonaktifkan).\n` +
            `• Klik OK untuk HAPUS PERMANEN karyawan beserta seluruh riwayat absensinya.`
        );
        if (!confirmForce) {
          setDeletingId(null);
          return;
        }

        res = await fetch(`/api/admin/employees/${emp.id}?force=true`, {
          method: "DELETE",
          headers: { "x-admin-pin": adminPin },
        });
        data = await parseJsonSafe(res);
      }

      if (!res.ok) throw new Error(data.error || "Gagal menghapus karyawan");
      onNotify(`✅ ${data.message}`);
      await onRefresh();
    } catch (err: unknown) {
      onNotify(`❌ ${err instanceof Error ? err.message : "Gagal menghapus karyawan"}`);
    }
    setDeletingId(null);
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">2. Karyawan Terdaftar ({employees.length})</h2>
        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold"
        >
          + Tambah Karyawan
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-2 pr-4">Nama</th>
              <th className="py-2 pr-4">Jabatan</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Terdaftar Pada (WIB)</th>
              <th className="py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-500">
                  Belum ada karyawan terdaftar. Klik &quot;+ Tambah Karyawan&quot; untuk mendaftarkan.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="py-3 pr-4 font-semibold">{emp.nama}</td>
                  <td className="py-3 pr-4 text-slate-300">{emp.jabatan || "-"}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        emp.is_active
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-red-900/60 text-red-300"
                      }`}
                    >
                      {emp.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-400">{formatWaktuWIB(emp.created_at)}</td>
                  <td className="py-3 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(emp)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-blue-300"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === emp.id}
                      onClick={() => handleDelete(emp)}
                      className="px-2.5 py-1 rounded bg-red-950 hover:bg-red-900 disabled:opacity-50 text-xs font-semibold text-red-300"
                    >
                      {deletingId === emp.id ? "..." : "Hapus"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <EmployeeFormModal
          adminPin={adminPin}
          employee={editingEmployee}
          onClose={() => setModalOpen(false)}
          onSuccess={async (msg) => {
            setModalOpen(false);
            onNotify(msg);
            await onRefresh();
          }}
        />
      )}
    </section>
  );
}