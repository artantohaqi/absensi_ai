PANDUAN INSTALASI & DEPLOY

1. SETUP DATABASE (SUPABASE)
Buat proyek baru di Supabase.
Masuk ke menu SQL Editor → buat query baru.
Jalankan isi file database-supabase/01_schema_tables.sql terlebih dahulu. Skrip ini akan membuat 3 tabel utama:
employees: data profil pegawai.

face_embeddings: representasi angka wajah dari SFace (jsonb, atau bisa disesuaikan ke vector(128) jika mengaktifkan ekstensi pgvector).
attendance_logs: rekap absen IN/OUT lengkap dengan koordinat GPS, jarak, skor cahaya, skor kemiripan wajah, dan catatan tugas luar.
Setelah berhasil, jalankan isi file database-supabase/02_rls_policies.sql untuk mengaktifkan Row Level Security (RLS) pada seluruh tabel agar tidak bisa diakses sembarangan dari publik.
Catat Project URL dan service_role key dari Settings → API (jaga kerahasiaan service_role key, hanya boleh dipakai di sisi server).

2. DEPLOY MESIN AI (RENDER)
Buat Web Service baru di Render dan arahkan Root Directory ke folder backend-render.
Gunakan runtime Docker (mengikuti Dockerfile yang sudah tersedia untuk mengunduh model OpenCV Zoo saat build).
Tambahkan Environment Variables sesuai .env.example di folder backend-render (seperti AI_API_KEY atau kredensial Supabase jika backend mengakses DB langsung).
Setelah deploy sukses, catat URL layanan Render Anda (misal: https://nama-service.onrender.com).

3. DEPLOY WEB APP (VERCEL)
Import repositori ini di Vercel dan atur Root Directory ke frontend-vercel.
Isi seluruh Environment Variables sesuai .env.example di folder frontend-vercel (URL Render, API Key internal, URL & service_role key Supabase, dll.).
Disarankan menyamakan Function Region ke Singapore (sin1) agar satu wilayah dengan Render & Supabase.
Klik Deploy dan buka link web melalui HTTPS (wajib HTTPS agar izin kamera dan GPS browser aktif).

CATATAN KEAMANAN & BATASAN SISTEM
- Zero-Storage Foto ≠ Tanpa Data Biometrik: Walaupun foto wajah tidak pernah disimpan ke disk, deretan angka embedding wajah tetap tergolong data biometrik sensitif. Pastikan akses database terkunci (RLS aktif) dan selalu minta persetujuan karyawan saat pendaftaran wajah.
- Server Gratis Render Tidur Setelah 15 Menit: Pada paket gratis, layanan Render akan sleep jika tidak ada trafik selama 15 menit. Solusinya bisa menggunakan cron ping rutin ke endpoint /health.
- Batasan Browser & Fake GPS: Aplikasi berbasis web browser tidak memiliki akses sistem operasi untuk memblokir aplikasi Mock Location / Fake GPS secara otomatis. Untuk skenario dinas luar atau pengiriman barang, proteksi tambahan dapat dilakukan dengan membungkus web ini ke dalam APK Android (WebView + native GPS check + penguncian API).
