import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function isAuthorized(request: NextRequest): boolean {
  const expectedPin = process.env.ADMIN_PIN;
  const sentPin = request.headers.get("x-admin-pin");
  return Boolean(expectedPin && sentPin && sentPin === expectedPin);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "PIN Admin salah atau tidak valid." }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Jalankan 3 query secara paralel agar cepat
    const [settingsRes, employeesRes, attendancesRes] = await Promise.all([
      supabaseAdmin
        .from("system_settings")
        .select("office_lat, office_lng, max_radius_meter, updated_at")
        .eq("id", 1)
        .single(),
      supabaseAdmin
        .from("employees")
        .select("id, nama, jabatan, is_active, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("attendances")
        .select(
          "id, tipe, jarak_meter, status_lokasi, alasan, similarity_score, ip_address, created_at, employees(nama, jabatan)"
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (settingsRes.error) throw new Error(settingsRes.error.message);
    if (employeesRes.error) throw new Error(employeesRes.error.message);
    if (attendancesRes.error) throw new Error(attendancesRes.error.message);

    return NextResponse.json({
      settings: settingsRes.data,
      employees: employeesRes.data,
      attendances: attendancesRes.data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat data admin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "PIN Admin salah atau tidak valid." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const officeLat = Number(body.office_lat);
    const officeLng = Number(body.office_lng);
    const maxRadius = Number(body.max_radius_meter);

    if (
      Number.isNaN(officeLat) ||
      officeLat < -90 ||
      officeLat > 90 ||
      Number.isNaN(officeLng) ||
      officeLng < -180 ||
      officeLng > 180 ||
      Number.isNaN(maxRadius) ||
      maxRadius < 10 ||
      maxRadius > 50000
    ) {
      return NextResponse.json(
        { error: "Koordinat tidak valid atau radius harus antara 10–50.000 meter." },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .update({
        office_lat: officeLat,
        office_lng: officeLng,
        max_radius_meter: Math.round(maxRadius),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select("office_lat, office_lng, max_radius_meter, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Lokasi dan radius kantor berhasil diperbarui!",
      settings: data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan pengaturan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}