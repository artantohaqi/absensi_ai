import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateDistanceMeters } from "@/lib/geo";

interface MatchedEmployee {
  id: string;
  nama: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const formData = await request.formData();

    const challengeId = formData.get("challenge_id");
    const tipeRaw = formData.get("tipe");
    const alasanRaw = formData.get("alasan");
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));
    const photoFront = formData.get("photo_front");
    const photoChallenge = formData.get("photo_challenge");

    const tipe: "MASUK" | "PULANG" = tipeRaw === "PULANG" ? "PULANG" : "MASUK";
    const alasan = typeof alasanRaw === "string" ? alasanRaw.trim() : "";

    if (
      typeof challengeId !== "string" ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      !(photoFront instanceof Blob) ||
      !(photoChallenge instanceof Blob)
    ) {
      return NextResponse.json({ error: "Data absensi tidak lengkap" }, { status: 400 });
    }

    // 1. CEK JARAK GPS & SYARAT ALASAN DI SISI SERVER
    const { data: settings, error: setErr } = await supabaseAdmin
      .from("system_settings")
      .select("office_lat, office_lng, max_radius_meter")
      .eq("id", 1)
      .single();

    if (setErr || !settings) {
      return NextResponse.json(
        { error: "Pengaturan koordinat kantor belum tersedia." },
        { status: 500 }
      );
    }

    const jarakMeter = calculateDistanceMeters(
      lat,
      lng,
      settings.office_lat,
      settings.office_lng
    );

    const isOutsideRadius = jarakMeter > settings.max_radius_meter;
    const statusLokasi: "DALAM_RADIUS" | "LUAR_RADIUS" = isOutsideRadius
      ? "LUAR_RADIUS"
      : "DALAM_RADIUS";

    if (isOutsideRadius && alasan.length < 5) {
      return NextResponse.json(
        {
          error: `Anda berada di luar radius kantor (${Math.round(jarakMeter)}m > ${settings.max_radius_meter}m). Wajib mengisi alasan minimal 5 karakter!`,
          require_reason: true,
        },
        { status: 400 }
      );
    }

    // 2. VALIDASI TIKET TANTANGAN (NONCE) & LANGSUNG HANGUSKAN
    const { data: challenge, error: chalErr } = await supabaseAdmin
      .from("attendance_challenges")
      .update({ is_used: true })
      .eq("id", challengeId)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .select("expected_pose")
      .single();

    if (chalErr || !challenge) {
      return NextResponse.json(
        { error: "Sesi tantangan tidak valid atau kedaluwarsa (>30 detik). Ulangi absen." },
        { status: 400 }
      );
    }

    // 3. KIRIM 2 FOTO MENTAH KE SERVER AI RENDER
    const aiForm = new FormData();
    aiForm.append("photo_front", photoFront, "front.jpg");
    aiForm.append("photo_challenge", photoChallenge, "challenge.jpg");
    aiForm.append("expected_pose", challenge.expected_pose);

    const aiRes = await fetch(`${process.env.AI_SERVER_URL}/verify-liveness`, {
      method: "POST",
      headers: { "x-api-key": process.env.AI_API_KEY ?? "" },
      body: aiForm,
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) {
      return NextResponse.json(
        { error: aiData.detail || "Verifikasi wajah/liveness gagal" },
        { status: aiRes.status }
      );
    }

    // 4. COCOKKAN VEKTOR 128D KE SUPABASE (pgvector)
    const { data: matches, error: matchErr } = await supabaseAdmin.rpc("match_employee_face", {
      query_embedding: JSON.stringify(aiData.embedding),
      match_threshold: 0.4,
    });

    const matchedList = matches as MatchedEmployee[] | null;
    if (matchErr || !matchedList || matchedList.length === 0) {
      return NextResponse.json(
        { error: "Wajah tidak dikenali. Silakan daftarkan wajah Anda dulu di tab Daftar Wajah." },
        { status: 404 }
      );
    }

    const karyawan = matchedList[0];

    // Ambil jabatan karyawan agar tampil lengkap di halaman sukses
    const { data: empDetail } = await supabaseAdmin
      .from("employees")
      .select("nama, jabatan")
      .eq("id", karyawan.id)
      .single();

    const namaKaryawan = empDetail?.nama || karyawan.nama;
    const jabatanKaryawan = empDetail?.jabatan || "Karyawan";

    // 5. SIMPAN ABSENSI
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const { error: insertErr } = await supabaseAdmin.from("attendances").insert({
      employee_id: karyawan.id,
      tipe,
      latitude: lat,
      longitude: lng,
      jarak_meter: Number(jarakMeter.toFixed(2)),
      status_lokasi: statusLokasi,
      alasan: isOutsideRadius ? alasan : alasan || null,
      similarity_score: Number(karyawan.similarity.toFixed(4)),
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (insertErr) {
      return NextResponse.json(
        { error: "Gagal menyimpan absensi: " + insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Absen ${tipe} berhasil!`,
      detail: {
        nama: namaKaryawan,
        jabatan: jabatanKaryawan,
        tipe,
        kemiripan: `${(karyawan.similarity * 100).toFixed(1)}%`,
        jarak: `${Math.round(jarakMeter)} meter`,
        status_lokasi: statusLokasi,
        pose_lulus: aiData.pose_verified,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Terjadi kesalahan server: " + message }, { status: 500 });
  }
}