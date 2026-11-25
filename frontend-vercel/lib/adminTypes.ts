export interface OfficeSettings {
  office_lat: number;
  office_lng: number;
  max_radius_meter: number;
  updated_at?: string;
}

export interface EmployeeRow {
  id: string;
  nama: string;
  jabatan: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AttendanceRow {
  id: string;
  tipe: string;
  jarak_meter: number;
  status_lokasi: "DALAM_RADIUS" | "LUAR_RADIUS";
  alasan: string | null;
  similarity_score: number;
  ip_address: string | null;
  created_at: string;
  employees:
    | { nama: string; jabatan: string | null }
    | { nama: string; jabatan: string | null }[]
    | null;
}