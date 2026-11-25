import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthorized } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Akses ditolak: PIN Admin tidak valid." }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const formData = await request.formData();

    const nama = formData.get("nama");
    const jabatanRaw = formData.get("jabatan");
    const photo = formData.get("photo");

    if (typeof nama !== "string" || !nama.trim() || !(photo instanceof Blob)) {
      return NextResponse.json({ error: "Nama dan foto wajah wajib diisi." }, { status: 400 });
    }

    const jabatan =
      typeof jabatanRaw === "string" && jabatanRaw.trim() ? jabatanRaw.trim() : "Karyawan";

    const aiForm = new FormData();
    aiForm.append("photo", photo, "register.jpg");

    const aiRes = await fetch(`${process.env.AI_SERVER_URL}/register-face`, {
      method: "POST",
      headers: { "x-api-key": process.env.AI_API_KEY ?? "" },
      body: aiForm,
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) {
      return NextResponse.json(
        { error: aiData.detail || "Gagal memproses wajah di server AI" },
        { status: aiRes.status }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("employees")
      .insert({
        nama: nama.trim(),
        jabatan,
        face_embedding: JSON.stringify(aiData.embedding),
      })
      .select("id, nama, jabatan, is_active, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Gagal menyimpan karyawan" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Karyawan ${data.nama} berhasil ditambahkan.`,
      employee: data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}