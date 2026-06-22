from __future__ import annotations

import csv
import json
import os
import re
import sys
import time

import anthropic

MODEL = os.environ.get("TIER_B_MODEL", "claude-haiku-4-5")
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "pipeline", "inputs", "tier_b.csv")
PACE_SECONDS = int(os.environ.get("TIER_B_PACE", "5"))

WILAYAH = {
    "6300": "Kalimantan Selatan",
    "6301": "Tanah Laut", "6302": "Kotabaru", "6303": "Banjar",
    "6304": "Barito Kuala", "6305": "Tapin", "6306": "Hulu Sungai Selatan",
    "6307": "Hulu Sungai Tengah", "6308": "Hulu Sungai Utara", "6309": "Tabalong",
    "6310": "Tanah Bumbu", "6311": "Balangan", "6371": "Kota Banjarmasin",
    "6372": "Kota Banjarbaru",
}

KATEGORI_VALID = {
    "Perkebunan", "Perkebunan/Kehutanan", "Peternakan", "Pertanian",
    "Kerajinan/Ekraf", "Perikanan", "Pertambangan", "Pangan Olahan", "Lainnya",
}

FIELDNAMES = ["wilayah_id", "wilayah", "komoditas", "kategori", "status", "sumber", "url"]

USER_LOCATION = {
    "type": "approximate", "city": "Banjarmasin",
    "region": "Kalimantan Selatan", "country": "ID", "timezone": "Asia/Makassar",
}

TOOLS = [
    {"type": "web_search_20250305", "name": "web_search", "max_uses": 6,
     "user_location": USER_LOCATION},
    {"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": 5,
     "max_content_tokens": 4000, "citations": {"enabled": True}},
]

SYSTEM = """Anda peneliti kekayaan intelektual untuk dashboard Potensi Ekonomi Daerah Kalimantan Selatan.

Tugas: temukan SEMUA produk Indikasi Geografis (IG) dari Provinsi Kalimantan Selatan yang sudah terdaftar ATAU sedang dalam proses pendaftaran di DJKI.

GARIS KERAS:
- DILARANG mengarang data. Tiap item WAJIB bersumber dari halaman yang Anda baca via web_fetch.
- DILARANG memakai pengetahuan internal sebagai fakta.
- DILARANG memakai em dash (tanda pisah panjang). Gunakan koma atau tanda kurung biasa.
- Gunakan web_fetch untuk MEMBACA isi halaman sebelum mengutip.

SUMBER YANG DICARI (urut prioritas):
1. https://www.dgip.go.id/menu-utama/indikasi-geografis/listing (daftar resmi IG terdaftar DJKI)
2. https://kalsel.kemenkum.go.id (Kanwil Kemenkum Kalsel, cari berita pendaftaran IG)
3. Situs resmi pemerintah kabupaten/kota Kalsel yang menyebut produk IG
4. Berita resmi tentang pendaftaran atau sertifikasi IG dari Kalsel

ISIAN TIAP PRODUK:
- komoditas: nama spesifik produk (contoh: "Kayu Manis Loksado", "Itik Alabio")
- wilayah: nama kabupaten/kota, atau "Kalimantan Selatan" jika lingkup provinsi
- kategori: salah satu dari "Perkebunan", "Perkebunan/Kehutanan", "Peternakan", "Pertanian", "Kerajinan/Ekraf", "Perikanan", "Pangan Olahan", "Lainnya"
- status: "Terdaftar (Indikasi Geografis)" jika sudah resmi, atau "Dalam proses (IG, [fase])" jika masih proses. Gunakan koma, BUKAN tanda pisah panjang.
- sumber: nama lembaga sumber (contoh: "DJKI", "Kanwil Kemenkum Kalsel")
- url: URL halaman yang Anda baca dan jadikan sumber

OUTPUT: HANYA array JSON (tanpa prosa, tanpa markdown, tanpa tanda backtick), tiap elemen PERSIS:
{"komoditas": str, "wilayah": str, "kategori": str, "status": str, "sumber": str, "url": str}

Array kosong [] bila tidak menemukan satupun dengan sumber valid."""

PROMPT = """Cari semua produk Indikasi Geografis dari Kalimantan Selatan.

Langkah:
1. Fetch https://www.dgip.go.id/menu-utama/indikasi-geografis/listing dan cari yang berlokasi di Kalimantan Selatan.
2. Search "indikasi geografis Kalimantan Selatan terdaftar" dan "pendaftaran IG Kalsel".
3. Fetch https://kalsel.kemenkum.go.id dan cari berita terkait IG.
4. Untuk tiap produk yang ditemukan, fetch halaman sumbernya untuk verifikasi.

Kembalikan HANYA array JSON sesuai skema."""


def _norm(s: str) -> str:
    s = re.sub(r"^(kabupaten|kota)\s+", "", s.strip(), flags=re.I)
    return re.sub(r"\s+", " ", s).upper().strip()


def _resolve_wid(nama: str) -> tuple[str, str] | None:
    n = _norm(nama)
    for wid, wnam in WILAYAH.items():
        if n == _norm(wnam):
            return wid, wnam
    for wid, wnam in WILAYAH.items():
        wn = _norm(wnam)
        if wn in n or n in wn:
            return wid, wnam
    return None


def _panggil(client: anthropic.Anthropic) -> str:
    messages = [{"role": "user", "content": PROMPT}]
    resp = None
    for _ in range(12):
        resp = client.messages.create(
            model=MODEL, max_tokens=4000, system=SYSTEM,
            tools=TOOLS, messages=messages,
        )
        if resp.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": resp.content})
            continue
        break
    if resp is None:
        return "[]"
    return "".join(
        getattr(b, "text", "") for b in resp.content if getattr(b, "type", "") == "text"
    ).strip()


def _ekstrak(teks: str) -> list[dict]:
    if "```" in teks:
        m = re.search(r"```(?:json)?\s*(.*?)```", teks, re.S)
        if m:
            teks = m.group(1).strip()
    i, j = teks.find("["), teks.rfind("]")
    if i != -1 and j != -1 and j > i:
        try:
            d = json.loads(teks[i : j + 1])
            if isinstance(d, list):
                return d
        except json.JSONDecodeError:
            pass
    return []


def _validasi(item: dict) -> dict | None:
    if not isinstance(item, dict):
        return None
    komoditas = str(item.get("komoditas", "")).strip()
    wilayah_raw = str(item.get("wilayah", "")).strip()
    kategori = str(item.get("kategori", "")).strip()
    status = str(item.get("status", "")).strip()
    sumber = str(item.get("sumber", "")).strip()
    url = str(item.get("url", "")).strip()

    if not komoditas or not wilayah_raw or not status or not url.startswith("http"):
        return None

    resolved = _resolve_wid(wilayah_raw)
    if resolved is None:
        print(f"[tier_b_ai] wilayah tak dikenal: {wilayah_raw!r}", file=sys.stderr)
        return None
    wid, wnam = resolved

    if kategori not in KATEGORI_VALID:
        kategori = "Lainnya"

    return {
        "wilayah_id": wid, "wilayah": wnam, "komoditas": komoditas,
        "kategori": kategori, "status": status, "sumber": sumber, "url": url,
    }


def _baca_lama() -> list[dict]:
    if not os.path.exists(OUTPUT):
        return []
    with open(OUTPUT, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _merge(lama: list[dict], baru: list[dict]) -> tuple[list[dict], int, int]:
    idx = {r["komoditas"].lower(): i for i, r in enumerate(lama)}
    hasil = [dict(r) for r in lama]
    ditambah = diupdate = 0

    for item in baru:
        key = item["komoditas"].lower()
        if key in idx:
            old = hasil[idx[key]]
            if old["status"] != item["status"]:
                hasil[idx[key]]["status"] = item["status"]
                if item["url"].startswith("http"):
                    hasil[idx[key]]["url"] = item["url"]
                if item["sumber"]:
                    hasil[idx[key]]["sumber"] = item["sumber"]
                diupdate += 1
        else:
            hasil.append(item)
            idx[key] = len(hasil) - 1
            ditambah += 1

    return hasil, ditambah, diupdate


def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY tidak diset.", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(max_retries=5)

    print("[tier_b_ai] mencari produk IG Kalsel ...", file=sys.stderr)
    teks = _panggil(client)
    raw = _ekstrak(teks)
    print(f"[tier_b_ai] {len(raw)} item diekstrak dari respons AI", file=sys.stderr)

    baru = [v for item in raw if (v := _validasi(item)) is not None]
    print(f"[tier_b_ai] {len(baru)} item valid", file=sys.stderr)

    if not baru:
        print("[tier_b_ai] tidak ada item valid, file lama dipertahankan", file=sys.stderr)
        sys.exit(0)

    lama = _baca_lama()
    hasil, ditambah, diupdate = _merge(lama, baru)
    print(
        f"[tier_b_ai] merge: +{ditambah} baru, {diupdate} status diupdate, "
        f"{len(lama) - diupdate} tidak berubah",
        file=sys.stderr,
    )

    with open(OUTPUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(hasil)
    print(f"[tier_b_ai] {len(hasil)} baris ditulis ke {OUTPUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
