-- 1. Tabel data pegawai / pengguna
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabel fitur wajah (representasi angka / embedding dari SFace)
CREATE TABLE IF NOT EXISTS public.face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  model_name text NOT NULL DEFAULT 'sface',
  embedding jsonb NOT NULL, -- atau real[] / vector(128) jika mengaktifkan pgvector
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabel rekap absensi (teks & angka)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_type text NOT NULL CHECK (check_type IN ('IN', 'OUT')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  gps_valid boolean NOT NULL DEFAULT false,
  light_score double precision,
  light_valid boolean NOT NULL DEFAULT false,
  face_score double precision,
  face_valid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'VERIFIED',
  notes text
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_time
  ON public.attendance_logs (employee_id, recorded_at DESC);