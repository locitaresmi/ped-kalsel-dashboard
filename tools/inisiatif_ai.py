from __future__ import annotations

import csv
import json
import os
import re
import sys

import anthropic

MODEL = os.environ.get("INISIATIF_MODEL", "claude-haiku-4-5")
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "pipeline", "inputs", "inisiatif.csv")

FIELDNAMES = ["komoditas", "subsektor_kode", "inisiatif", "deskripsi", "sumber", "url"]

SUBSEKTOR = {
    "A": {
        "padi", "beras", "jagung", "kedelai", "karet", "kelapa sawit", "cpo", "kelapa",
        "kopi", "kakao", "cokelat", "tebu", "gula", "perikanan", "ikan", "udang",
        "peternakan", "ayam", "sapi", "kambing", "itik", "telur", "hortikultura",
        "sayuran", "buah", "singkong", "ubi", "rotan", "galam", "kayu",
    },
    "B": {"batu bara", "batubara", "nikel", "bauksit", "emas", "intan", "pasir"},
    "C": {"industri", "pengolahan", "manufaktur", "pabrik"},
}

USER_LOCATION = {
    "type": "approximate", "city": "Banjarmasin",
    "region": "Kalimantan Selatan", "country": "ID", "timezone": "Asia/Makassar",
}

TOOLS = [
    {"type": "web_search_20250305", "name": "web_search", "max_uses": 8,
     "user_location": USER_LOCATION},
    {"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": 5,
     "max_content_tokens": 4000, "citations": {"enabled": True}},
]

SYSTEM = """Anda analis kebijakan ekonomi daerah untuk dashboard Potensi Ekonomi Daerah Kalimantan Selatan.

Tugas: temukan semua inisiatif atau program pemerintah (pusat maupun daerah) yang secara eksplisit mendukung komoditas ekonomi di Provinsi Kalimantan Selatan. Yang dicari adalah program yang nyata dan berjalan, bukan rencana tanpa realisasi.

GARIS KERAS:
- DILARANG mengarang data. Tiap item WAJIB bersumber dari halaman yang Anda baca via web_fetch.
- DILARANG memakai pengetahuan internal sebagai fakta.
- DILARANG memakai em dash (tanda pisah panjang). Gunakan koma atau tanda kurung biasa.
- Gunakan web_fetch untuk MEMBACA isi halaman sebelum mengutip.

SUMBER YANG DICARI (urut prioritas):
1. RPJMD Kalimantan Selatan 2025-2029 (Bappeda Prov. Kalsel)
2. Portal resmi Pemprov Kalsel, Dinas Pertanian, Dinas Perikanan, Dinas Perkebunan, Disperin
3. Situs Kemenkeu/SIKP untuk data KUR per sektor di Kalsel
4. Portal Kementan, KKP, BKPM/NSWI untuk program di Kalsel
5. Berita resmi tentang program pemerintah terkait komoditas Kalsel

PROGRAM YANG RELEVAN (contoh, bukan pembatas):
- MBG (Makan Bergizi Gratis) dan komoditas pendukungnya di Kalsel
- Klaster Banua Enam (lumbung pangan)
- Hilirisasi komoditas (karet, sawit, batu bara, ikan)
- KDMP (Kawasan Diversifikasi Masyarakat Perkebunan)
- KaTa (Kawasan Tanaman Pangan)
- KUR sektoral (kredit usaha rakyat untuk komoditas tertentu)
- OVOP (One Village One Product) di Kalsel
- Program klaster Saijaan Bersujud
- Program pengembangan komoditas unggulan daerah lainnya

ISIAN TIAP ITEM:
- komoditas: nama spesifik komoditas yang didukung (contoh: "Padi", "Karet", "Batu Bara")
- subsektor_kode: "A" untuk pertanian/perikanan/peternakan/kehutanan, "B" untuk pertambangan, "C" untuk industri pengolahan
- inisiatif: nama singkat program (contoh: "MBG + Banua Enam (lumbung pangan)", "Hilirisasi RPJMD 2025-2029")
- deskripsi: 1-2 kalimat lugas menjelaskan isi program dan relevansinya ke komoditas. Tanpa em dash, tanpa titik koma.
- sumber: nama lembaga sumber (contoh: "Bappeda Prov. Kalsel", "Kementan")
- url: URL halaman yang Anda baca dan jadikan sumber

OUTPUT: HANYA array JSON (tanpa prosa, tanpa markdown, tanpa tanda backtick), tiap elemen PERSIS:
{"komoditas": str, "subsektor_kode": "A"|"B"|"C", "inisiatif": str, "deskripsi": str, "sumber": str, "url": str}

Satu program bisa menghasilkan beberapa item bila mendukung beberapa komoditas berbeda.
Array kosong [] bila tidak menemukan satupun dengan sumber valid."""

PROMPT = """Cari semua inisiatif dan program pemerintah yang mendukung komoditas ekonomi di Kalimantan Selatan.

Langkah:
1. Search "RPJMD Kalimantan Selatan 2025-2029 komoditas unggulan" dan fetch hasilnya.
2. Search "program MBG Kalimantan Selatan komoditas" dan fetch hasilnya.
3. Search "hilirisasi komoditas Kalimantan Selatan 2025" dan fetch hasilnya.
4. Fetch https://bappeda.kalselprov.go.id untuk cari program pembangunan ekonomi terkini.
5. Search "KUR komoditas Kalimantan Selatan" dan "KDMP Kalsel" untuk program pembiayaan.

Kembalikan HANYA array JSON sesuai skema. Satu program boleh menghasilkan beberapa item untuk komoditas berbeda."""


def _tebak_subsektor(komoditas: str, raw_kode: str) -> str:
    if raw_kode in ("A", "B", "C"):
        return raw_kode
    kl = komoditas.lower()
    for kode, kata_kunci in SUBSEKTOR.items():
        if any(k in kl for k in kata_kunci):
            return kode
    return "A"


def _panggil(client: anthropic.Anthropic) -> str:
    messages = [{"role": "user", "content": PROMPT}]
    resp = None
    for _ in range(12):
        resp = client.messages.create(
            model=MODEL, max_tokens=5000, system=SYSTEM,
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


def _bersih(s: str) -> str:
    s = re.sub(r"\s*—\s*", ", ", s)
    s = re.sub(r"\s*;\s*", ". ", s)
    return re.sub(r"\s{2,}", " ", s).strip()


def _validasi(item: dict) -> dict | None:
    if not isinstance(item, dict):
        return None
    komoditas = _bersih(str(item.get("komoditas", "")).strip())
    subsektor_raw = str(item.get("subsektor_kode", "")).strip().upper()
    inisiatif = _bersih(str(item.get("inisiatif", "")).strip())
    deskripsi = _bersih(str(item.get("deskripsi", "")).strip())
    sumber = _bersih(str(item.get("sumber", "")).strip())
    url = str(item.get("url", "")).strip()

    if not komoditas or not inisiatif or not deskripsi or not url.startswith("http"):
        return None

    subsektor_kode = _tebak_subsektor(komoditas, subsektor_raw)

    return {
        "komoditas": komoditas,
        "subsektor_kode": subsektor_kode,
        "inisiatif": inisiatif,
        "deskripsi": deskripsi,
        "sumber": sumber,
        "url": url,
    }


def _baca_lama() -> list[dict]:
    if not os.path.exists(OUTPUT):
        return []
    with open(OUTPUT, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _kunci(r: dict) -> str:
    return f"{r['komoditas'].lower()}|||{r['inisiatif'].lower()}"


def _merge(lama: list[dict], baru: list[dict]) -> tuple[list[dict], int, int]:
    idx = {_kunci(r): i for i, r in enumerate(lama)}
    hasil = [dict(r) for r in lama]
    ditambah = diupdate = 0

    for item in baru:
        key = _kunci(item)
        if key in idx:
            old = hasil[idx[key]]
            berubah = False
            if old["deskripsi"] != item["deskripsi"] and item["deskripsi"]:
                hasil[idx[key]]["deskripsi"] = item["deskripsi"]
                berubah = True
            if item["url"].startswith("http") and old["url"] != item["url"]:
                hasil[idx[key]]["url"] = item["url"]
                berubah = True
            if item["sumber"] and old["sumber"] != item["sumber"]:
                hasil[idx[key]]["sumber"] = item["sumber"]
                berubah = True
            if berubah:
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

    print("[inisiatif_ai] mencari inisiatif program pemerintah untuk Kalsel ...", file=sys.stderr)
    teks = _panggil(client)
    raw = _ekstrak(teks)
    print(f"[inisiatif_ai] {len(raw)} item diekstrak dari respons AI", file=sys.stderr)

    baru = [v for item in raw if (v := _validasi(item)) is not None]
    print(f"[inisiatif_ai] {len(baru)} item valid", file=sys.stderr)

    if not baru:
        print("[inisiatif_ai] tidak ada item valid, file lama dipertahankan", file=sys.stderr)
        sys.exit(0)

    lama = _baca_lama()
    hasil, ditambah, diupdate = _merge(lama, baru)
    print(
        f"[inisiatif_ai] merge: +{ditambah} baru, {diupdate} diupdate, "
        f"{len(lama) - diupdate} tidak berubah",
        file=sys.stderr,
    )

    with open(OUTPUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(hasil)
    print(f"[inisiatif_ai] {len(hasil)} baris ditulis ke {OUTPUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
