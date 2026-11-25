import { NextRequest, NextResponse } from "next/server";

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export async function GET(request: NextRequest) {
  // Kunci agar hanya Admin yang sudah memasukkan PIN yang bisa memakai endpoint ini
  const expectedPin = process.env.ADMIN_PIN;
  const sentPin = request.headers.get("x-admin-pin");
  if (!expectedPin || sentPin !== expectedPin) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json(
      { error: "Masukkan minimal 3 karakter untuk mencari lokasi." },
      { status: 400 }
    );
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", q);
    url.searchParams.set("countrycodes", "id"); // Fokuskan hasil ke Indonesia
    url.searchParams.set("limit", "5");

    const res = await fetch(url.toString(), {
      headers: {
        // Wajib menyertakan User-Agent sesuai aturan OpenStreetMap Nominatim
        "User-Agent": "AbsensiAIZeroTrust/1.0 (admin-map-picker)",
        "Accept-Language": "id",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Layanan peta sedang sibuk, silakan coba beberapa detik lagi." },
        { status: 502 }
      );
    }

    const raw = (await res.json()) as NominatimItem[];
    const results = raw.map((item) => ({
      id: item.place_id,
      name: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mencari lokasi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}