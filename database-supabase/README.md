# Sistem Absensi Face Recognition (Vercel + Render + Supabase)

Aplikasi absensi berbasis web dengan validasi cahaya kamera, validasi GPS, dan pencocokan wajah menggunakan **OpenCV (YuNet & SFace)** pada backend sendiri, serta penyimpanan rekap berbasis teks dan angka di **Supabase**.

## Arsitektur Sistem

1. **Frontend (Vercel)**
   - Menangani antarmuka kamera dan pengguna.
   - Melakukan pengecekan kondisi cahaya kamera dan validasi lokasi GPS di sisi klien/frontend agar ringan dan hemat resource server gratis.
2. **Backend / API Validasi Wajah (Render)**
   - Menjalankan model deteksi & pengenalan wajah **OpenCV (YuNet & SFace)** di server sendiri (data wajah tidak dikirim ke pihak ketiga).
   - Membandingkan wajah dengan data tersimpan lalu mencatat hasil ke Supabase.
3. **Database (Supabase)**
   - Menyimpan data master pengguna, fitur wajah numerik, serta log rekap absensi berbasis teks dan angka.

> **Catatan Lisensi:** Komponen model OpenCV (YuNet & SFace) menggunakan lisensi **Apache License 2.0**, sehingga aman digunakan termasuk untuk kebutuhan bisnis/komersial sesuai ketentuan lisensi (sertakan pemberitahuan lisensi/atribusi yang relevan saat mendistribusikan kode).

---

## Struktur Folder Repository

```text
.
├── frontend/               # Aplikasi frontend (di-deploy ke Vercel)
├── backend/                # API face recognition OpenCV YuNet & SFace (di-deploy ke Render)
├── database-supabase/      # Skrip SQL & panduan setup database Supabase
│   ├── 01_schema_tables.sql
│   ├── 02_rls_policies.sql
│   └── 03_seed_sample.sql
└── README.md
```

---

## Langkah Setup dari Awal sampai Supabase

### 1. Setup Database di Supabase
1. Login ke [Supabase](https://supabase.com) dan buat **New Project**.
2. Buka menu **SQL Editor** di dashboard Supabase.
3. Jalankan isi file `database-supabase/01_schema_tables.sql` terlebih dahulu, lalu klik **Run**.
4. Jalankan isi file `database-supabase/02_rls_policies.sql`, lalu klik **Run**.
5. *(Opsional)* Jalankan `database-supabase/03_seed_sample.sql` untuk data uji coba.
6. Masuk ke **Project Settings → API** dan catat:
   - **Project URL** (`SUPABASE_URL`)
   - **Service Role Key** (`SUPABASE_SERVICE_KEY` — simpan rahasia, hanya untuk backend Render)

### 2. Setup & Deploy Backend ke Render
1. Push kode backend ke GitHub.
2. Buat **Web Service** baru di [Render](https://render.com) dan hubungkan ke repository Anda.
3. Atur **Build Command** dan **Start Command** sesuai stack backend Anda (misalnya Python/FastAPI/Flask dengan `opencv-contrib-python` dan file model YuNet & SFace).
4. Tambahkan **Environment Variables** di Render:
   - `SUPABASE_URL` = *(URL dari Supabase)*
   - `SUPABASE_SERVICE_KEY` = *(Service Role Key dari Supabase)*
   - Variabel lain (misalnya radius GPS atau batas *threshold* kemiripan wajah).
5. Deploy dan pastikan endpoint API backend berjalan normal.

### 3. Setup & Deploy Frontend ke Vercel
1. Import repository ke [Vercel](https://vercel.com) dan arahkan *Root Directory* ke folder frontend (jika monorepo).
2. Tambahkan **Environment Variable** di Vercel:
   - `NEXT_PUBLIC_API_URL` / `VITE_API_URL` = *(URL endpoint backend di Render)*
3. Klik **Deploy** dan uji alur kamera → cek cahaya → GPS → validasi wajah → masuk ke tabel `attendance_logs` di Supabase.

---

## Keamanan & Catatan Teknis
- Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di kode frontend.
- Pastikan waktu server (`UTC` / `Asia/Jakarta`) konsisten antara frontend, backend, dan kolom `timestamptz` di Supabase.