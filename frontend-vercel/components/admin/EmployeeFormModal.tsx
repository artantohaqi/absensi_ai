"use client";

import { useEffect, useRef, useState } from "react";
import { EmployeeRow } from "@/lib/adminTypes";
import { captureResizedBlob } from "@/lib/camera";
import { parseJsonSafe } from "@/lib/http";

interface EmployeeFormModalProps {
  adminPin: string;
  employee: EmployeeRow | null; // null = mode Tambah, ada isi = mode Edit
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function EmployeeFormModal({
  adminPin,
  employee,
  onClose,
  onSuccess,
}: EmployeeFormModalProps) {
  const isEdit = employee !== null;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [nama, setNama] = useState<string>(employee?.nama ?? "");
  const [jabatan, setJabatan] = useState<string>(employee?.jabatan ?? "");
  const [isActive, setIsActive] = useState<boolean>(employee?.is_active ?? true);
  const [useCamera, setUseCamera] = useState<boolean>(!isEdit); // Wajib nyala saat Tambah
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!useCamera) return;
    let stream: MediaStream | undefined;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError("Gagal mengakses kamera. Pastikan izin kamera aktif.");
      }
    }
    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [useCamera]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nama.trim()) return setError("Nama karyawan wajib diisi.");

    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("nama", nama.trim());
      fd.append("jabatan", jabatan.trim());

      if (isEdit) {
        fd.append("is_active", String(isActive));
      }

      if (useCamera) {
        const blob = await captureResizedBlob(videoRef.current);
        fd.append("photo", blob, "face.jpg");
      }

      const url = isEdit ? `/api/admin/employees/${employee.id}` : "/api/admin/employees";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "x-admin-pin": adminPin },
        body: fd,
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan karyawan");

      onSuccess(`✅ ${data.message}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">
            {isEdit ? `Edit Karyawan: ${employee.nama}` : "Tambah Karyawan Baru"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nama Lengkap *</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
              placeholder="Contoh: Budi Santoso"
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Jabatan</label>
            <input
              type="text"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder="Contoh: Kasir / Barista"
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            />
          </div>

          {isEdit && (
            <div className="flex flex-wrap gap-4 pt-1 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Status Aktif (Boleh Absen)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-amber-300">
                <input
                  type="checkbox"
                  checked={useCamera}
                  onChange={(e) => setUseCamera(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Perbarui Foto Wajah</span>
              </label>
            </div>
          )}

          {useCamera && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">
                Arahkan wajah karyawan <strong>menghadap lurus ke depan</strong> dengan cahaya cukup:
              </p>
              <div className="rounded-xl overflow-hidden bg-black border border-slate-700">
                <video ref={videoRef} autoPlay playsInline muted className="w-full" />
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/70 border border-red-700 text-xs text-red-200">
              ❌ {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-sm font-bold"
            >
              {saving
                ? "Memproses..."
                : isEdit
                ? "Simpan Perubahan"
                : "Jepret & Daftarkan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}