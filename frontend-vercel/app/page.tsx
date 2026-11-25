"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { calculateDistanceMeters } from "@/lib/geo";
import { captureResizedBlob } from "@/lib/camera";
import { parseJsonSafe } from "@/lib/http";

const OfficeMapViewer = dynamic(() => import("@/components/OfficeMapViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-56 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-400">
      Memuat peta lokasi kantor...
    </div>
  ),
});

interface ChallengeData {
  challenge_id: string;
  expected_pose: "KIRI" | "KANAN";
  expires_at: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface OfficeInfo {
  office_lat: number;
  office_lng: number;
  max_radius_meter: number;
}

interface AbsenResult {
  nama: string;
  jabatan: string;
  tipe: string;
  kemiripan: string;
  jarak: string;
  status_lokasi: "DALAM_RADIUS" | "LUAR_RADIUS";
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<"ABSEN" | "DAFTAR">("ABSEN");
  const [tipeAbsen, setTipeAbsen] = useState<"MASUK" | "PULANG">("MASUK");
  const [status, setStatus] = useState<string>("Siap. Hadapkan wajah ke kamera untuk memulai.");
  const [loading, setLoading] = useState<boolean>(false);

  // State Pendaftaran Publik
  const [nama, setNama] = useState<string>("");
  const [jabatan, setJabatan] = useState<string>("");

  // State Absensi & Lokasi
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [photoFront, setPhotoFront] = useState<Blob | null>(null);
  const [brightness, setBrightness] = useState<number>(120);
  const [alasan, setAlasan] = useState<string>("");
  const [officeInfo, setOfficeInfo] = useState<OfficeInfo | null>(null);
  const [previewDistance, setPreviewDistance] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<AbsenResult | null>(null);
  const [needsRegisterHint, setNeedsRegisterHint] = useState<boolean>(false);

  // 1. Ambil info lokasi kantor & hitung perkiraan jarak
  useEffect(() => {
    async function checkDistancePreview() {
      try {
        const res = await fetch("/api/office-info");
        const cfg = (await parseJsonSafe(res)) as OfficeInfo;
        if (!res.ok) return;
        setOfficeInfo(cfg);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserCoords(coords);
            const dist = calculateDistanceMeters(
              coords.lat,
              coords.lng,
              cfg.office_lat,
              cfg.office_lng
            );
            setPreviewDistance(Math.round(dist));
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } catch {
        // Validasi jarak tetap berjalan di server saat submit
      }
    }
    checkDistancePreview();
  }, []);

  // 2. Nyalakan kamera depan & pantau kecerahan
  useEffect(() => {
    let stream: MediaStream | undefined;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setStatus("Gagal mengakses kamera. Pastikan izin kamera aktif & pakai HTTPS.");
      }
    }
    startCamera();

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;

      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 160, 120);
      const pixels = ctx.getImageData(0, 0, 160, 120).data;

      let total = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        total += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      }
      setBrightness(Math.round(total / (pixels.length / 4)));
    }, 1000);

    return () => {
      clearInterval(interval);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function getGPS(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          resolve(coords);
        },
        () => reject(new Error("Izin lokasi GPS ditolak atau tidak tersedia.")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  const isOutsidePreview =
    officeInfo !== null &&
    previewDistance !== null &&
    previewDistance > officeInfo.max_radius_meter;

  // ALUR DAFTAR WAJAH (1 Wajah = 1 Karyawan)
  async function handleRegister() {
    if (nama.trim().length < 2) {
      return setStatus("⚠️ Isi nama Anda terlebih dahulu (minimal 2 huruf).");
    }
    setLoading(true);
    setLastResult(null);
    setNeedsRegisterHint(false);
    setStatus("Memverifikasi wajah & mengecek duplikasi di server AI...");
    try {
      const blob = await captureResizedBlob(videoRef.current);
      const fd = new FormData();
      fd.append("nama", nama.trim());
      fd.append("jabatan", jabatan.trim());
      fd.append("photo", blob, "register.jpg");

      const res = await fetch("/api/register", { method: "POST", body: fd });
      const data = await parseJsonSafe(res);
      if (res.ok) {
        setStatus(`✅ ${data.message}`);
        setNama("");
        setJabatan("");
        setMode("ABSEN");
      } else {
        setStatus(`❌ ${data.error}`);
      }
    } catch (e: unknown) {
      setStatus(`❌ ${e instanceof Error ? e.message : "Terjadi kesalahan"}`);
    }
    setLoading(false);
  }

  // LANGKAH 1 ABSEN
  async function startAbsenStep1() {
    if (isOutsidePreview && alasan.trim().length < 5) {
      return setStatus("⚠️ Anda terdeteksi di luar radius kantor. Isi alasan dulu minimal 5 karakter.");
    }

    setLoading(true);
    setLastResult(null);
    setNeedsRegisterHint(false);
    setStatus("Meminta tantangan acak dari server...");
    try {
      const frontBlob = await captureResizedBlob(videoRef.current);
      const res = await fetch("/api/challenge", { method: "POST" });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat tantangan");

      setPhotoFront(frontBlob);
      setChallenge(data as ChallengeData);
      setStatus(
        `📸 Foto 1 tersimpan! Sekarang TENGOK ${data.expected_pose}, lalu klik tombol konfirmasi (< 30 detik).`
      );
    } catch (e: unknown) {
      setStatus(`❌ ${e instanceof Error ? e.message : "Terjadi kesalahan"}`);
    }
    setLoading(false);
  }

  // LANGKAH 2 ABSEN
  async function submitAbsenStep2() {
    if (!challenge || !photoFront) return;
    setLoading(true);
    setStatus("Mengambil GPS & memverifikasi wajah di server...");
    try {
      const challengeBlob = await captureResizedBlob(videoRef.current);
      const gps = userCoords ?? (await getGPS());

      const fd = new FormData();
      fd.append("challenge_id", challenge.challenge_id);
      fd.append("tipe", tipeAbsen);
      fd.append("alasan", alasan.trim());
      fd.append("lat", String(gps.lat));
      fd.append("lng", String(gps.lng));
      fd.append("photo_front", photoFront, "front.jpg");
      fd.append("photo_challenge", challengeBlob, "challenge.jpg");

      const res = await fetch("/api/absen", { method: "POST", body: fd });
      const data = await parseJsonSafe(res);

      if (res.ok) {
        const detail = data.detail as AbsenResult;
        setLastResult(detail);
        setNeedsRegisterHint(false);
        setStatus(`✅ ${data.message} Selamat bekerja, ${detail.nama}!`);
        setAlasan("");
      } else {
        const errMsg = String(data.error || "Gagal memverifikasi absensi.");
        const isUnrecognized = /tidak dikenali|belum terdaftar|tidak ditemukan/i.test(errMsg);
        setNeedsRegisterHint(isUnrecognized);
        setStatus(
          isUnrecognized
            ? `❌ ${errMsg} Belum pernah daftar? Daftarkan wajahmu dulu di tab Daftar Wajah.`
            : `❌ ${errMsg}`
        );
      }
    } catch (e: unknown) {
      setStatus(`❌ ${e instanceof Error ? e.message : "Terjadi kesalahan"}`);
    } finally {
      setChallenge(null);
      setPhotoFront(null);
      setLoading(false);
    }
  }

  const isLightBad = brightness < 45 || brightness > 225;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-5 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">Absensi AI Zero-Storage</h1>
          <p className="text-xs text-slate-400">
            Demo interaktif: foto langsung dibuang dari RAM setelah diverifikasi AI.
          </p>
        </div>

        {/* Tab Navigasi 1 Halaman */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("ABSEN");
              setChallenge(null);
              setNeedsRegisterHint(false);
            }}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              mode === "ABSEN" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            Absen Sekarang
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("DAFTAR");
              setChallenge(null);
              setLastResult(null);
              setNeedsRegisterHint(false);
            }}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              mode === "DAFTAR" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            Daftar Wajah
          </button>
        </div>

        {/* Info tipis untuk pengguna pertama kali */}
        {mode === "ABSEN" && (
          <button
            type="button"
            onClick={() => {
              setMode("DAFTAR");
              setChallenge(null);
              setLastResult(null);
              setNeedsRegisterHint(false);
            }}
            className="w-full text-left px-3 py-2 rounded-lg bg-blue-950/50 hover:bg-blue-950/80 border border-blue-800/70 text-xs text-blue-200 transition-colors"
          >
            Baru pertama coba?{" "}
            <span className="font-semibold text-blue-300 underline">
              Daftarkan wajahmu dulu di tab Daftar Wajah →
            </span>
          </button>
        )}

        {/* Layar Kamera (Efek Cermin untuk UX) */}
        <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800">
          <video ref={videoRef} autoPlay playsInline muted className="w-full -scale-x-100" />
          <canvas ref={canvasRef} className="hidden" />
          <div
            className={`text-xs px-3 py-1 text-center font-medium ${
              isLightBad ? "bg-red-600" : "bg-slate-900/80"
            }`}
          >
            Skor Cahaya: {brightness} {isLightBad ? "(Cahaya tidak ideal!)" : "(Cahaya Baik)"}
          </div>
        </div>

        {/* Info Lokasi Kantor + Tombol Peta Read-Only */}
        {officeInfo && (
          <div className="space-y-2">
            <div
              className={`flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg border ${
                isOutsidePreview
                  ? "bg-amber-950/60 border-amber-600 text-amber-200"
                  : "bg-slate-900 border-slate-800 text-slate-300"
              }`}
            >
              <span>
                {previewDistance !== null ? (
                  <>
                    📍 Jarak ke kantor: <strong>{previewDistance}m</strong> (Batas{" "}
                    {officeInfo.max_radius_meter}m)
                  </>
                ) : (
                  <>📍 Radius kantor: {officeInfo.max_radius_meter}m</>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowMap((prev) => !prev)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold whitespace-nowrap"
              >
                {showMap ? "Tutup Peta" : "🗺️ Lihat Peta"}
              </button>
            </div>

            {showMap && (
              <OfficeMapViewer
                lat={officeInfo.office_lat}
                lng={officeInfo.office_lng}
                radius={officeInfo.max_radius_meter}
              />
            )}
          </div>
        )}

        {/* MODE DAFTAR vs MODE ABSEN */}
        {mode === "DAFTAR" ? (
          <div className="space-y-2.5">
            <input
              type="text"
              placeholder="Nama Lengkap *"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm"
            />
            <input
              type="text"
              placeholder="Jabatan (mis. Barista, Staff IT, Pengunjung Demo)"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm"
            />
            <button
              disabled={loading || isLightBad}
              onClick={handleRegister}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 font-bold text-sm"
            >
              {loading ? "Memproses..." : "Daftarkan Wajah (Hadap Lurus ke Depan)"}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              🔒 Pengaman aktif: 1 wajah hanya bisa didaftarkan untuk 1 karyawan.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pilih MASUK / PULANG */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                type="button"
                onClick={() => setTipeAbsen("MASUK")}
                className={`py-2 rounded-lg border font-semibold ${
                  tipeAbsen === "MASUK"
                    ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                Absen MASUK
              </button>
              <button
                type="button"
                onClick={() => setTipeAbsen("PULANG")}
                className={`py-2 rounded-lg border font-semibold ${
                  tipeAbsen === "PULANG"
                    ? "bg-blue-950 border-blue-500 text-blue-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                Absen PULANG
              </button>
            </div>

            {/* Kotak Alasan */}
            <textarea
              rows={2}
              placeholder={
                isOutsidePreview
                  ? "WAJIB: Anda di luar radius kantor. Tulis alasan (min. 5 huruf)"
                  : "Catatan / Alasan (wajib diisi jika berada di luar radius kantor)"
              }
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              className={`w-full p-3 rounded-lg bg-slate-900 border text-sm ${
                isOutsidePreview && alasan.trim().length < 5 ? "border-amber-500" : "border-slate-700"
              }`}
            />

            {/* Tombol Absen 2 Tahap */}
            {!challenge ? (
              <button
                disabled={loading || isLightBad}
                onClick={startAbsenStep1}
                className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 font-bold text-sm"
              >
                {loading ? "Memproses..." : `1. Mulai Absen ${tipeAbsen} (Hadap Depan)`}
              </button>
            ) : (
              <button
                disabled={loading || isLightBad}
                onClick={submitAbsenStep2}
                className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm animate-pulse"
              >
                {loading ? "Memverifikasi..." : `2. Ambil Foto Tengok ${challenge.expected_pose}`}
              </button>
            )}
          </div>
        )}

        {/* Kartu Hasil Sukses (Menampilkan Nama + Jabatan) */}
        {lastResult && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-600 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Terverifikasi AI • Absen {lastResult.tipe}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 font-semibold">
                {lastResult.kemiripan}
              </span>
            </div>
            <p className="text-lg font-bold text-white">{lastResult.nama}</p>
            <p className="text-sm text-emerald-200">{lastResult.jabatan}</p>
            <p className="text-xs text-slate-300 pt-1">
              Status:{" "}
              <strong>
                {lastResult.status_lokasi === "LUAR_RADIUS"
                  ? `Luar Radius (${lastResult.jarak})`
                  : `Di Dalam Kantor (${lastResult.jarak})`}
              </strong>
            </p>
          </div>
        )}

        {/* Kotak Status */}
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-sm leading-relaxed space-y-2">
          <p>{status}</p>
          {needsRegisterHint && mode === "ABSEN" && (
            <button
              type="button"
              onClick={() => {
                setMode("DAFTAR");
                setChallenge(null);
                setLastResult(null);
                setNeedsRegisterHint(false);
              }}
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
            >
              Ke Tab Daftar Wajah →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}