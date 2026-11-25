import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("office_lat, office_lng, max_radius_meter")
      .eq("id", 1)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Pengaturan kantor tidak ditemukan" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}