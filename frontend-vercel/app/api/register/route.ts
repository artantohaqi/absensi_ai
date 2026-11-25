import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

interface MatchedFace {
  id: string;
  nama: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const formData = await request.formData();

    const namaRaw = formData.get("nama");
    const jabatanRaw = formData.get("jabatan");
    const photo = formData.get("photo");

    if (typeof namaRaw !== "string" || namaRaw.trim().length < 2 || !(photo instanceof Blob)) {
      return NextResponse.json(
        { error: "Nama (minimal 2 huruf) dan foto wajah wajib diisi." },
        { status: 400 }
      );
    }

    const nama = namaRaw.trim().slice(0, 60);
    const jabatan =
      typeof jabatanRaw === "string" && jabatanRaw.trim()
        ? jabatanRaw.trim().slice(0, 50)
        : "Karyawan";

    // 1. Kirim foto ke Server AI Render untuk ekstraksi 128 vektor
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
        { error: aiData.detail || "Gagal memproses wajah di server AI." },
        { status: aiRes.status }
      );
    }

    const embeddingStr = JSON.stringify(aiData.embedding);

    // 2. PENGAMAN 1 WAJAH = 1 KARYAWAN (Cek duplikat sebelum INSERT)
    const { data: existingMatches, error: matchErr } = await supabaseAdmin.rpc(
      "match_employee_face",
      {
        query_embedding: embeddingStr,
        match_threshold: 0.4,
      }
    );

    if (matchErr) {
      return NextResponse.json(
        { error: "Gagal memeriksa duplikasi wajah: " + matchErr.message },
        { status: 500 }
      );
    }

    const duplicates = existingMatches as MatchedFace[] | null;
    if (duplicates && duplicates.length > 0) {
      const existing = duplicates[0];
      const { data: empInfo } = await supabaseAdmin
        .from("employees")
        .select("nama, jabatan")
        .eq("id", existing.id)
        .single();

      const labelExisting = empInfo?.jabatan
        ? `${empInfo.nama} (${empInfo.jabatan})`
        : existing.nama;

      return NextResponse.json(
        {
          error: `Wajah ini sudah terdaftar atas nama ${labelExisting}. Satu wajah hanya bisa digunakan untuk 1 karyawan.`,
        },
        { status: 409 }
      );
    }

    // 3. Simpan karyawan baru ke Supabase
    const { data, error } = await supabaseAdmin
      .from("employees")
      .insert({
        nama,
        jabatan,
        face_embedding: embeddingStr,
      })
      .select("id, nama, jabatan")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Gagal menyimpan data karyawan." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `${data.nama} (${data.jabatan}) berhasil didaftarkan! Sekarang silakan coba tab Absen.`,
      employee: data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Server error: " + message }, { status: 500 });
  }
}