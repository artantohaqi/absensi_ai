ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Jika backend Render memakai service_role key, service_role otomatis bypass RLS.
-- Tambahkan policy tambahan di sini jika ada akses langsung dari client terautentikasi.