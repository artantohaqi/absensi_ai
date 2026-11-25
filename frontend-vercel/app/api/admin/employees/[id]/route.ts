import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthorized } from "@/lib/adminAuth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Akses ditolak: PIN Admin tidak valid." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdmin();
    const formData = await request.formData();

    const nama = formData.get("nama");
    const jabatanRaw = formData.get("jabatan");
    const isActiveRaw = formData.get("is_active");
    const photo = formData.get("photo");

    if (typeof nama !== "string" || !nama.trim()) {
      return NextResponse.json({ error: "Nama karyawan wajib diisi." }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      nama: nama.trim(),
      jabatan: typeof jabatanRaw === "string" && jabatanRaw.trim() ? jabatanRaw.trim() : null,
      is_active: isActiveRaw === "true",
    };

    // Opsional: jika Admin mencentang perbarui foto wajah, ekstrak ulang vektor di Server AI
    if (photo instanceof Blob && photo.size > 0) {
      const aiForm = new FormData();
      aiForm.append("photo", photo, "update-face.jpg");

      const aiRes = await fetch(`${process.env.AI_SERVER_URL}/register-face`, {
        method: "POST",
        headers: { "x-api-key": process.env.AI_API_KEY ?? "" },
        body: aiForm,
      });

      const aiData = await aiRes.json();
      if (!aiRes.ok) {
        return NextResponse.json(
          { error: aiData.detail || "Gagal memproses foto wajah baru" },
          { status: aiRes.status }
        );
      }
      updatePayload.face_embedding = JSON.stringify(aiData.embedding);
    }

    const { data, error } = await supabaseAdmin
      .from("employees")
      .update(updatePayload)
      .eq("id", id)
      .select("id, nama, jabatan, is_active, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Gagal memperbarui data karyawan" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Data ${data.nama} berhasil diperbarui.`,
      employee: data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Akses ditolak: PIN Admin tidak valid." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const force = request.nextUrl.searchParams.get("force") === "true";
    const supabaseAdmin = getSupabaseAdmin();

    // Cek apakah karyawan sudah memiliki riwayat absensi (mencegah pelanggaran Foreign Key)
    const { count, error: countErr } = await supabaseAdmin
      .from("attendances")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", id);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    if ((count ?? 0) > 0 && !force) {
      return NextResponse.json(
        {
          error: `Karyawan ini memiliki ${count} riwayat absensi.`,
          has_history: true,
          history_count: count,
        },
        { status: 409 }
      );
    }

    if (force) {
      const { error: delAttErr } = await supabaseAdmin
        .from("attendances")
        .delete()
        .eq("employee_id", id);
      if (delAttErr) {
        return NextResponse.json({ error: delAttErr.message }, { status: 500 });
      }
    }

    const { error: delEmpErr } = await supabaseAdmin.from("employees").delete().eq("id", id);
    if (delEmpErr) {
      return NextResponse.json({ error: delEmpErr.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Karyawan berhasil dihapus." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}