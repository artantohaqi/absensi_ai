import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const expectedPose: "KIRI" | "KANAN" = Math.random() < 0.5 ? "KIRI" : "KANAN";
    const expiresAt = new Date(Date.now() + 30 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("attendance_challenges")
      .insert({ expected_pose: expectedPose, expires_at: expiresAt })
      .select("id, expected_pose, expires_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Gagal membuat tantangan di database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      challenge_id: data.id,
      expected_pose: data.expected_pose,
      expires_at: data.expires_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}