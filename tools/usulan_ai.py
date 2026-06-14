from __future__ import annotations

import datetime as _dt
import json
import os
import re
import sys
import time

import anthropic

MODEL = os.environ.get("USULAN_AI_MODEL", "claude-haiku-4-5")
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "pipeline", "inputs", "usulan_ai.json")

SUPPORTS_THINKING = not MODEL.startswith("claude-haiku")

MAX_TOKENS_L0 = int(os.environ.get("USULAN_AI_MAX_TOKENS_L0", "4000"))
MAX_TOKENS_L1 = int(os.environ.get("USULAN_AI_MAX_TOKENS_L1", "5000"))
MAX_TOKENS_L2 = int(os.environ.get("USULAN_AI_MAX_TOKENS_L2", "16000"))

MAX_ITEM_L2 = int(os.environ.get("USULAN_AI_MAX_ITEM_L2", "4"))

USE_THINKING_ENV = os.environ.get("USULAN_AI_THINKING", "").strip().lower()

PACE_SECONDS = int(os.environ.get("USULAN_AI_PACE", "8"))

WILAYAH = {
    "6301": "Tanah Laut", "6302": "Kotabaru", "6303": "Banjar",
    "6304": "Barito Kuala", "6305": "Tapin", "6306": "Hulu Sungai Selatan",
    "6307": "Hulu Sungai Tengah", "6308": "Hulu Sungai Utara", "6309": "Tabalong",
    "6310": "Tanah Bumbu", "6311": "Balangan", "6371": "Kota Banjarmasin",
    "6372": "Kota Banjarbaru",
}

KOMODITAS = [
    {"nama": "Padi", "subsektor": "A", "hs": "10"},
    {"nama": "Kelapa Sawit (CPO)", "subsektor": "A", "hs": "15"},
    {"nama": "Karet", "subsektor": "A", "hs": "40"},
    {"nama": "Kelapa", "subsektor": "A", "hs": ""},
    {"nama": "Kopi", "subsektor": "A", "hs": "09"},
    {"nama": "Kakao", "subsektor": "A", "hs": "18"},
    {"nama": "Tebu", "subsektor": "A", "hs": "17"},
    {"nama": "Perikanan Budidaya", "subsektor": "A", "hs": "03"},
    {"nama": "Jagung", "subsektor": "A", "hs": "10"},
    {"nama": "Batu Bara", "subsektor": "B", "hs": "27"},
]

KATEGORI_VALID = {
    "pelaku_usaha_hulu", "offtaker_penyerapan", "nilai_tambah_hilir", "kepastian_pasar",
    "pembiayaan_ljk", "asistensi_teknis", "sarana_prasarana", "dukungan_pemerintah_program",
}
JENIS_VALID = {"resmi", "berita"}

SKETSA_KEYS = ("hulu", "offtaker", "pembiayaan", "asistensi", "program", "gap_utama")

BLOG_PLATFORMS = (
    "blogspot.", "wordpress.com", "medium.com", "blogger.", "tumblr.",
    "wixsite.", "weebly.", ".wix.com", "substack.com", "kompasiana.com",
)

KOMODITAS_GENERIK = (
    "multisektor", "identifikasi", "berbagai", "dan umkm", "ekonomi kreatif",
    "multi sektor", "beberapa komoditas", "lain-lain", "dll",
)

USER_LOCATION = {
    "type": "approximate", "city": "Banjarmasin",
    "region": "Kalimantan Selatan", "country": "ID", "timezone": "Asia/Makassar",
}

SEARCH_MAX = int(os.environ.get("USULAN_AI_SEARCH_MAX", "4"))
FETCH_MAX = int(os.environ.get("USULAN_AI_FETCH_MAX", "3"))
FETCH_TOKENS = int(os.environ.get("USULAN_AI_FETCH_TOKENS", "3500"))
_BLOCKED = ["tokopedia.com", "shopee.co.id", "bukalapak.com", "lazada.co.id",
            "olx.co.id", "pinterest.com"]

def _tools(search_max: int, fetch_max: int, fetch_tokens: int) -> list:
    return [
        {"type": "web_search_20250305", "name": "web_search", "max_uses": search_max,
         "user_location": USER_LOCATION, "blocked_domains": _BLOCKED},
        {"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": fetch_max,
         "max_content_tokens": fetch_tokens, "citations": {"enabled": True}},
    ]

TOOLS = _tools(SEARCH_MAX, FETCH_MAX, FETCH_TOKENS)

TOOLS_MIN = _tools(2, 1, 2500)
DEBUG = bool(os.environ.get("USULAN_AI_DEBUG"))

GAYA_BAHASA = """

GAYA BAHASA WAJIB (untuk semua teks yang ditampilkan ke pengguna awam):
- DILARANG memakai em dash (—). Pecah jadi dua kalimat terpisah atau pakai tanda kurung biasa.
- DILARANG memakai titik koma (;). Pecah jadi dua kalimat terpisah.
- Kalimat maksimal sekitar 30 kata. Jika lebih panjang, pecah menjadi dua kalimat.
- Hindari istilah bahasa Inggris tanpa terjemahan. Tulis "siklus ekonomi" bukan "loop ekonomi".
  Bila terpaksa memakai istilah teknis seperti offtaker, beri penjelasan dalam kurung,
  misalnya "pembeli atau pengolah hasil panen".
- Bahasa Indonesia lugas, langsung, mudah dipahami orang tanpa latar ekonomi."""

SYSTEM_L0 = """Anda analis ekonomi daerah untuk dashboard Potensi Ekonomi Daerah (PED) \
Kalimantan Selatan.
Tugas: temukan komoditas yang paling signifikan secara ekonomi di SATU kabupaten/kota,
TANPA dibatasi daftar komoditas manapun. Cari secara bebas dan terbuka.

GARIS KERAS (tidak bisa ditawar):
- DILARANG memakai pengetahuan internal sebagai fakta. Tiap klaim WAJIB bersandar pada sumber nyata.
- DILARANG mengarang sumber. Bila tak ada sumber untuk suatu komoditas, JANGAN masukkan.
- Tiap item WAJIB minimal satu sumber: URL persis + tanggal + jenis (resmi|berita).
- BUANG blog pribadi, konten SEO generik, marketplace, sumber tak jelas entitasnya.

SUMBER YANG DICARI (urut prioritas — gunakan web_fetch untuk membaca isi sebelum mengutip):
1. RPJMD, Renja Dinas, APBD kabupaten/kota (komoditas apa yang dapat alokasi anggaran?)
2. Portal pemkab, Bappeda, DPMPTSP setempat (investasi dan prioritas daerah)
3. Website Dinas Pertanian, Perikanan, Perdagangan, Perindustrian setempat
4. BPS publikasi kabupaten (Kabupaten Dalam Angka, profil komoditas, data sektoral)
5. Berita ekonomi lokal yang menyebut nama kabupaten/kota secara eksplisit
6. DJKI (Indikasi Geografis terdaftar dari kab/kota ini)

KRITERIA SIGNIFIKANSI (minimal satu harus terpenuhi berdasarkan sumber):
- Menyerap banyak tenaga kerja lokal (petani/nelayan/peternak)
- Disebut dalam RPJMD/Renstra sebagai komoditas prioritas
- Ada investasi pengolahan/industri yang masuk atau direncanakan
- Menjadi produk ekspor atau produk khas daerah (GI, OVOP, KaTa)
- Nilai ekonominya signifikan dalam konteks lokal

PENTING: Komoditas khas lokal yang mungkin tidak masuk statistik nasional tapi penting
secara lokal (seperti Itik Alabio, Jeruk Siam, Ikan Haruan, Intan, Rotan, Galam, dll.)
SANGAT DISAMBUT bila ada bukti dari sumber. Jangan hanya mengkonfirmasi komoditas
nasional umum — cari kekhasan daerah ini.

OUTPUT: HANYA sebuah array JSON (tanpa prosa/markdown/```), tiap elemen PERSIS:
{"komoditas": str (nama spesifik, bukan kategori/sektor),
 "signifikansi": str (1-2 kalimat lugas: mengapa penting di kab/kota ini, bahasa awam),
 "sumber": [{"url": str, "tanggal": str, "jenis": "resmi"|"berita"}]}
Kembalikan 5-8 item. Urut dari yang paling signifikan. Array kosong [] bila tak ada yang bisa disourced.""" + GAYA_BAHASA

def _prompt_l0(wid: str, nama: str) -> str:
    return (
        f"Kabupaten/Kota: {nama} (kode BPS {wid}), Provinsi Kalimantan Selatan.\n\n"
        f"Temukan 5-8 komoditas paling penting secara ekonomi di {nama}. "
        f"Cari: RPJMD {nama}, portal pemkab/bappeda {nama}, Dinas Pertanian/Perikanan/"
        f"Perdagangan {nama}, berita ekonomi lokal yang menyebut '{nama}', dan BPS "
        f"publikasi kabupaten. Gunakan web_fetch untuk membaca isi halaman sebelum mengutip. "
        f"Sebut '{nama}' dan 'Kalimantan Selatan' dalam setiap kueri pencarian. "
        f"Kembalikan HANYA array JSON sesuai skema."
    )

def validasi_l0(item: dict, wid: str) -> dict | None:
    if not isinstance(item, dict):
        return None
    komoditas = str(item.get("komoditas", "")).strip()
    if not _komoditas_valid(komoditas):
        return None
    sumber = _bersih_sumber(item.get("sumber"))
    if not sumber:
        return None
    signifikansi = _bersih_teks(item.get("signifikansi"))
    if not signifikansi:
        return None
    return {"wilayah_id": wid, "komoditas": komoditas, "signifikansi": signifikansi, "sumber": sumber}

SYSTEM_L1 = """Anda analis pasar untuk dashboard Potensi Ekonomi Daerah (PED) Kalimantan Selatan.
Tugas: menilai apakah SATU komoditas punya (a) pasar yang tumbuh, (b) keunggulan komparatif
Indonesia/Kalsel, dan (c) momentum. Hasil MELENGKAPI data resmi Tier A (dihitung kode dari BPS).

GARIS KERAS (tidak bisa ditawar):
- Anda MENGOLAH sumber yang Anda temukan via web_search/web_fetch, BUKAN menjadi sumber fakta.
  DILARANG memakai pengetahuan internal sebagai fakta. Tiap klaim WAJIB bersandar pada sumber nyata.
- DILARANG memasok/mengarang angka produksi atau ekspor untuk skor Tier A (itu domain kode resmi).
  Angka boleh DIKUTIP dari sumber sebagai bukti (sebut sumbernya), tapi TIDAK PERNAH untuk skor.
- DILARANG mengarang sumber. Bila tak menemukan sumber nyata untuk satu dimensi, isi apa adanya
  ("belum ditemukan sumber") — jangan menebak.
- Tiap analisis WAJIB bersandar pada minimal satu sumber: URL persis + tanggal + jenis (resmi|berita).

TIGA DIMENSI yang dicari (cari LEBAR lintas domain; JANGAN dikurung ke .go.id saja):
- pasar: arah permintaan/harga global & nasional. Sumber: World Bank Commodity Prices,
  FAOSTAT, ITC Trade Map / UN Comtrade (apakah Indonesia masih impor = permintaan belum
  terpenuhi?), Kemendag/BPS ekspor nasional per kode HS.
- kompetisi: posisi kompetitif Indonesia (RCA/pangsa ekspor dunia), kesesuaian lahan/agroklimat
  Kalsel (Kementan/BBSDLP), Indikasi Geografis terdaftar (DJKI) bila ada.
- momentum: realisasi/komitmen investasi (BKPM/NSWI) di sektor terkait di Kalsel, tren harga
  produsen 2-3 tahun (PIHPS/BPS), sinyal ekspansi industri/hilirisasi.

Gunakan web_fetch untuk MEMBACA halaman & menilai entitas penerbit. BUANG blog pribadi,
konten SEO/daur ulang, marketplace, sumber tak jelas entitasnya.

GAYA TULISAN: ringkas, faktual, tiap dimensi maksimal 2 kalimat. verdik_pasar = 1 kalimat
sintesis ketiga dimensi (apakah pasarnya menjanjikan & kenapa), bahasa lugas non-jargon.

OUTPUT: HANYA sebuah objek JSON (tanpa prosa/markdown/```), bentuk PERSIS:
{"komoditas": str,
 "analisis": {"pasar": str, "kompetisi": str, "momentum": str},
 "verdik_pasar": str,
 "sumber": [{"url": str, "tanggal": str, "jenis": "resmi"|"berita"}]}""" + GAYA_BAHASA

def _prompt_l1(kom: dict) -> str:
    hs = f" (kode HS {kom['hs']})" if kom.get("hs") else ""
    return (
        f"Komoditas: {kom['nama']}{hs}, fokus Provinsi Kalimantan Selatan, Indonesia.\n"
        f"Cari & verifikasi tiga dimensi (pasar, kompetisi, momentum) sesuai instruksi sistem. "
        f"Sebut 'Kalimantan Selatan' / 'Indonesia' dalam kueri yang relevan. Gunakan web_fetch "
        f"untuk membaca sumber sebelum mengutip. Kembalikan HANYA satu objek JSON sesuai skema."
    )

SYSTEM_L2 = """Anda analis ekosistem ekonomi daerah untuk dashboard Potensi Ekonomi Daerah (PED)
Kalimantan Selatan. Untuk SATU kabupaten/kota, petakan bentuk ekosistem closed-loop PED tiap
komoditas yang PUNYA BASIS PRODUKSI NYATA di kab/kota itu (diverifikasi dari sumber), dan
tentukan satu gap utama. Hasil MELENGKAPI data resmi Tier A (dihitung kode dari BPS).

GARIS KERAS (tidak bisa ditawar):
- Anda MENGOLAH sumber via web_search/web_fetch, BUKAN menjadi sumber fakta. DILARANG memakai
  pengetahuan internal sebagai fakta. Tiap klaim WAJIB bersandar pada sumber nyata.
- DILARANG memasok/mengarang angka produksi/ekspor untuk skor Tier A. Angka boleh DIKUTIP dari
  sumber sebagai bukti (sebut sumbernya), tapi TIDAK PERNAH dipakai untuk skor.
- DILARANG mengarang item/sumber. Bila tak ada sumber nyata untuk satu komoditas, JANGAN buat item.
- Tiap item WAJIB minimal satu sumber: URL persis + tanggal + jenis (resmi|berita).

KOMODITAS WAJIB SPESIFIK & PUNYA BASIS LOKAL di kab/kota ini (bukti dari sumber):
- BENAR: "Karet", "Ikan Patin", "Itik Alabio", "Cabai Rawit", "Kelapa Sawit", "Batu Bara".
- SALAH: sektor/kategori/gabungan/meta. Bila hanya sinyal sektoral tanpa komoditas spesifik
  ATAU tanpa basis produksi lokal di kab/kota ini, JANGAN buat item.

TIER (dinilai dari ENTITAS di balik situs, BUKAN dari TLD/domain):
- Tier B (indikasi resmi): entitas resmi mana pun — K/L, Pemprov/Pemkab/Bappeda/DPMPTSP, DJKI,
  RPJMD, program pemerintah, asosiasi/unit resmi (.go.id MAUPUN .org/.com resmi, termasuk portal
  nasional yang memuat info daerah). web_fetch dulu untuk menilai entitas sebelum memberi Tier B.
- Tier C (sinyal berita/non-statistik): media berita, rilis, liputan inisiatif warga/swasta.
- BUANG: blog pribadi, konten SEO/daur ulang, marketplace, sumber tak jelas entitasnya.

DIMENSI ekosistem yang dicari (cari LEBAR; jangan dikurung ke .go.id):
- offtaker: industri pengolahan/distributor/eksportir penyerap hasil (DPMPTSP/BKPMD, profil
  investasi, berita industri masuk ke kab/kota).
- pembiayaan: realisasi KUR per sektor (Kemenkeu/SIKP), produk perbankan, akses kredit petani/pembudidaya.
- infrastruktur/sarana: cold storage, pabrik pengolahan, pengemasan, logistik (berita, RPJMD, dinas teknis).
- asistensi: pendampingan GAP/GHP/SNI, sertifikasi, pelatihan (Kementan/Kemenperin/dinas).
- program: RPJMD prioritas, MBG, KDMP, DPP, KaTa, EKI, klaster Banua Enam.

FORMAT WAJIB untuk sinyal Tier C: rangkai Temuan -> Implikasi ekonomi -> Alasan jadi usulan.
Implikasi = efek langsung yang TERSIRAT (bukan prediksi), bahasa berpagar ("mengindikasikan",
"berpotensi"); kandidat berita seremonial tanpa implikasi ekonomi jelas WAJIB dibuang.

STRUKTUR tiap item:
- verdik_ekosistem: 1-2 kalimat ringkas NON-JARGON (orang awam paham). DILARANG kata teknis
  "LQ", "hilirisasi", "offtaker", "RCA". Langsung: layak/tidak + apa yang KURANG. WAJIB
  mengintegrasikan sinyal pasar (dari KONTEKS PASAR yang diberikan) dengan kesiapan lokal.
- sketsa: {hulu, offtaker, pembiayaan, asistensi, program, gap_utama}. Tiap unsur 1 kalimat
  bersandar sumber. Kosongkan ("") unsur yang tak ada buktinya. gap_utama WAJIB ada (satu hal
  paling penting yang harus ditutup agar siklus ekonomi komoditas ini lengkap).
- evidence: array {dimensi, teks (1 kalimat + bukti dari sumber), sumber:[{url,tanggal,jenis}]}.
- sumber: gabungan sumber utama item {url, tanggal, jenis}.
- kategori: metadata backend (boleh >1) dari daftar TEPAT: pelaku_usaha_hulu, offtaker_penyerapan,
  nilai_tambah_hilir, kepastian_pasar, pembiayaan_ljk, asistensi_teknis, sarana_prasarana,
  dukungan_pemerintah_program.

OUTPUT: HANYA sebuah array JSON (tanpa prosa/markdown/```), tiap elemen PERSIS:
{"komoditas": str, "wilayah_id": str, "tier": "B"|"C", "verdik_ekosistem": str,
 "sketsa": {"hulu": str, "offtaker": str, "pembiayaan": str, "asistensi": str, "program": str, "gap_utama": str},
 "evidence": [{"dimensi": str, "teks": str, "sumber": [{"url": str, "tanggal": str, "jenis": "resmi"|"berita"}]}],
 "sumber": [{"url": str, "tanggal": str, "jenis": "resmi"|"berita"}],
 "kategori": [label...]}
Bila tak ada kandidat valid, kembalikan array kosong [].""" + GAYA_BAHASA

def _konteks_pasar(layer1: list[dict]) -> str:
    baris = []
    for it in layer1:
        v = (it.get("verdik_pasar") or "").strip()
        if not v:
            continue
        if len(v) > 200:
            v = v[:200].rsplit(" ", 1)[0] + "…"
        baris.append(f"- {it['komoditas']}: {v}")
    if not baris:
        return "(belum ada konteks pasar Layer 1)"
    return "\n".join(baris)

def _prompt_l2(wid: str, nama: str, konteks_pasar: str, kandidat_l0: list[dict] | None = None) -> str:
    if kandidat_l0:
        kandidat_str = (
            f"\n\nKANDIDAT dari Layer 0 — komoditas yang sudah terverifikasi ada basis lokal "
            f"di {nama} (berdasarkan sumber yang ditemukan pada tahap sebelumnya):\n"
            + "\n".join(f"- {k['komoditas']}: {k['signifikansi']}" for k in kandidat_l0)
            + f"\n\nPRIORITASKAN kandidat di atas. Boleh tambahkan komoditas lain bila "
            f"menemukan bukti yang sangat kuat, tapi tidak perlu mencari dari nol."
        )
    else:
        kandidat_str = ""

    return (
        f"Kabupaten/Kota: {nama} (wilayah_id {wid}), Provinsi Kalimantan Selatan.\n\n"
        f"KONTEKS PASAR (ringkasan verdik Layer 1 per komoditas Kalsel — pakai untuk "
        f"mengintegrasikan ke verdik ekosistem; JANGAN dikutip mentah sebagai sumber):\n"
        f"{konteks_pasar}"
        f"{kandidat_str}\n\n"
        f"Pilih {MAX_ITEM_L2} komoditas PALING KUAT yang punya basis produksi/budidaya nyata di "
        f"{nama} (cukup ada indikasi ber-sumber bahwa komoditas itu memang diproduksi/dibudidayakan "
        f"di sana — TIDAK perlu angka pasti). Untuk tiap komoditas, cari sinyal ekosistem (offtaker, "
        f"pembiayaan/KUR, infrastruktur pengolahan, asistensi, program) dan buat SATU item. Lebih "
        f"baik 2-3 item ber-sumber kuat daripada array kosong; kosongkan HANYA bila benar-benar tak "
        f"ada satupun komoditas yang bisa di-sumber-kan. Sebut '{nama}' dalam kueri. Gunakan web_fetch "
        f"untuk memverifikasi entitas sebelum memberi tier. Set wilayah_id = \"{wid}\" pada tiap item. "
        f"Kembalikan HANYA array JSON sesuai skema."
    )

def panggil(client: anthropic.Anthropic, system: str, prompt: str, max_tokens: int, tools=None):
    messages = [{"role": "user", "content": prompt}]
    kwargs = dict(model=MODEL, max_tokens=max_tokens, system=system,
                  tools=tools or TOOLS, messages=messages)

    if SUPPORTS_THINKING and USE_THINKING_ENV in ("1", "true", "yes", "on"):
        kwargs["thinking"] = {"type": "adaptive"}
    resp = None
    for _ in range(12):
        resp = client.messages.create(**kwargs)
        if resp.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": resp.content})
            continue
        break
    return resp

def _resp_meta(resp) -> str:
    if resp is None:
        return "resp=None"
    sr = getattr(resp, "stop_reason", "?")
    blok = [getattr(b, "type", "?") for b in (resp.content or [])]
    u = getattr(resp, "usage", None)
    out = getattr(u, "output_tokens", "?") if u else "?"
    return f"stop={sr} out_tok={out} blok={blok}"

def _teks_final(resp) -> str:
    teks = "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", "") == "text")
    teks = teks.strip()
    if "```" in teks:
        m = re.search(r"```(?:json)?\s*(.*?)```", teks, re.S)
        if m:
            teks = m.group(1).strip()
    return teks

def _salvage_objects(teks: str) -> list:
    out, depth, start, in_str, esc = [], 0, None, False, False
    for i, ch in enumerate(teks):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start is not None:
                    try:
                        obj = json.loads(teks[start:i + 1])
                        if isinstance(obj, dict):
                            out.append(obj)
                    except json.JSONDecodeError:
                        pass
                    start = None
    return out

def ekstrak_obj(resp) -> dict | None:
    teks = _teks_final(resp)
    i, j = teks.find("{"), teks.rfind("}")
    if i != -1 and j != -1 and j > i:
        try:
            data = json.loads(teks[i:j + 1])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    objs = _salvage_objects(teks)
    return objs[0] if objs else None

def ekstrak_array(resp) -> list:
    teks = _teks_final(resp)
    i, j = teks.find("["), teks.rfind("]")
    if i != -1 and j != -1 and j > i:
        try:
            data = json.loads(teks[i:j + 1])
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass
    return _salvage_objects(teks)

def _bersih_teks(t) -> str:
    if not t:
        return ""
    t = str(t)
    t = re.sub(r"\s*—\s*", ". ", t)
    t = re.sub(r"\s*;\s*", ". ", t)
    t = re.sub(r"\bloop ekonomi\b", "siklus ekonomi", t, flags=re.IGNORECASE)
    t = re.sub(r"\bclosed[- ]loop\b", "rantai ekonomi lengkap", t, flags=re.IGNORECASE)
    t = re.sub(r"\boff[- ]?taker\b", "pembeli hasil panen", t, flags=re.IGNORECASE)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r"\.\s*\.", ".", t)
    return t.strip()

def _bersih_sumber(raw) -> list:
    out = []
    for s in raw or []:
        if not isinstance(s, dict):
            continue
        url = str(s.get("url", "")).strip()
        tanggal = str(s.get("tanggal", "")).strip()
        jenis = str(s.get("jenis", "")).strip().lower()
        if not (url.startswith("http") and tanggal and jenis in JENIS_VALID):
            continue
        if any(p in url.lower() for p in BLOG_PLATFORMS):
            continue
        out.append({"url": url, "tanggal": tanggal, "jenis": jenis})
    return out

def _komoditas_valid(komoditas: str) -> bool:
    if not komoditas:
        return False
    kl = komoditas.lower()
    if any(g in kl for g in KOMODITAS_GENERIK):
        return False

    if re.search(r"\([^)]*,[^)]*,", komoditas):
        return False
    return True

def validasi_l1(item: dict, kom: dict) -> dict | None:
    if not isinstance(item, dict):
        return None
    sumber = _bersih_sumber(item.get("sumber"))
    if not sumber:
        return None
    a = item.get("analisis") or {}
    analisis = {
        "pasar": _bersih_teks(a.get("pasar")),
        "kompetisi": _bersih_teks(a.get("kompetisi")),
        "momentum": _bersih_teks(a.get("momentum")),
    }
    if not any(analisis.values()):
        return None
    return {
        "komoditas": kom["nama"],
        "subsektor": kom["subsektor"],
        "analisis": analisis,
        "verdik_pasar": _bersih_teks(item.get("verdik_pasar")),
        "sumber": sumber,
    }

def validasi_l2(item: dict, wid: str) -> dict | None:
    if not isinstance(item, dict):
        return None
    tier = str(item.get("tier", "")).upper()
    if tier not in {"B", "C"}:
        return None
    komoditas = str(item.get("komoditas", "")).strip()
    if not _komoditas_valid(komoditas):
        return None

    evidence = []
    sumber_evidence = []
    for ev in item.get("evidence") or []:
        if not isinstance(ev, dict):
            continue
        teks = _bersih_teks(ev.get("teks"))
        if not teks:
            continue
        es = _bersih_sumber(ev.get("sumber"))
        sumber_evidence.extend(es)
        evidence.append({
            "dimensi": _bersih_teks(ev.get("dimensi")) or "lainnya",
            "teks": teks, "sumber": es,
        })

    sumber = _bersih_sumber(item.get("sumber")) + sumber_evidence
    seen, sumber_unik = set(), []
    for s in sumber:
        if s["url"] in seen:
            continue
        seen.add(s["url"])
        sumber_unik.append(s)
    if not sumber_unik:
        return None

    sk_raw = item.get("sketsa") or {}
    sketsa = {k: _bersih_teks(sk_raw.get(k)) for k in SKETSA_KEYS}
    verdik = _bersih_teks(item.get("verdik_ekosistem"))

    if not (verdik or any(sketsa.values()) or evidence):
        return None

    kategori = [k for k in (item.get("kategori") or []) if k in KATEGORI_VALID]
    return {
        "komoditas": komoditas, "wilayah_id": wid, "tier": tier,
        "verdik_ekosistem": verdik, "sketsa": sketsa,
        "evidence": evidence, "sumber": sumber_unik, "kategori": kategori,
    }

def _dump(label: str, resp) -> None:
    if not DEBUG or resp is None:
        return
    try:
        p = os.path.join(os.path.dirname(__file__), f"_debug_{label}.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write(f"# META: {_resp_meta(resp)}\n# TEKS FINAL:\n")
            f.write(_teks_final(resp) or "(KOSONG — tak ada blok teks di pesan final)")
    except OSError:
        pass

def _jalankan(client, system, prompt, max_tokens, label):
    try:
        return panggil(client, system, prompt, max_tokens)
    except anthropic.BadRequestError as e:
        if "prompt is too long" in str(e).lower():
            print(f"[usulan_ai]   konteks overflow — ulang {label} dgn tool minimal", file=sys.stderr)
            try:
                return panggil(client, system, prompt, max_tokens, tools=TOOLS_MIN)
            except Exception as e2:
                print(f"[usulan_ai] {label} gagal (overflow): {e2}", file=sys.stderr)
                return None
        print(f"[usulan_ai] {label} gagal (400): {e}", file=sys.stderr)
        return None
    except anthropic.RateLimitError:
        print(f"[usulan_ai]   429 — tunggu 60s lalu ulang {label}", file=sys.stderr)
        time.sleep(60)
        try:
            return panggil(client, system, prompt, max_tokens)
        except Exception as e:
            print(f"[usulan_ai] {label} gagal setelah ulang: {e}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"[usulan_ai] {label} gagal: {e}", file=sys.stderr)
        return None

def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY tidak diset di environment.", file=sys.stderr)
        sys.exit(1)
    only = os.environ.get("USULAN_AI_LAYER", "").strip()

    kom_filter = [s.strip().lower() for s in os.environ.get("USULAN_AI_KOM", "").split(",") if s.strip()]
    wil_filter = [s.strip() for s in os.environ.get("USULAN_AI_WIL", "").split(",") if s.strip()]

    client = anthropic.Anthropic(max_retries=8)

    lama = {}
    if os.path.exists(OUTPUT):
        try:
            with open(OUTPUT, encoding="utf-8") as f:
                lama = json.load(f)
        except (OSError, json.JSONDecodeError):
            lama = {}
    lama_l0 = lama.get("layer0") or []
    lama_l1 = lama.get("layer1") or []
    lama_l2 = lama.get("layer2") or []

    layer0: list[dict] = []
    if only in ("", "0"):
        wilayah_l0 = [(w, n) for w, n in WILAYAH.items() if not wil_filter or w in wil_filter]
        run_wid_l0 = {w for w, _ in wilayah_l0}
        layer0 = [it for it in lama_l0 if str(it.get("wilayah_id")) not in run_wid_l0]
        for idx, (wid, nama) in enumerate(wilayah_l0):
            print(f"[usulan_ai] L0 {wid} {nama} ...", file=sys.stderr)
            resp = _jalankan(client, SYSTEM_L0, _prompt_l0(wid, nama), MAX_TOKENS_L0, f"L0 {wid}")
            if resp is None:
                continue
            _dump(f"l0_{wid}", resp)
            arr = ekstrak_array(resp)
            valid = [v for it in arr if (v := validasi_l0(it, wid)) is not None]
            layer0.extend(valid)
            extra = "" if valid else f" [{_resp_meta(resp)}]"
            print(f"[usulan_ai]   parsed {len(arr)}, {len(valid)} kandidat valid{extra}", file=sys.stderr)
            if idx < len(wilayah_l0) - 1 and PACE_SECONDS > 0:
                time.sleep(PACE_SECONDS)
    elif only in ("1", "2"):
        layer0 = list(lama_l0)

    # Index L0 per wilayah for quick lookup in L2
    l0_per_wil: dict[str, list[dict]] = {}
    for it in layer0:
        l0_per_wil.setdefault(str(it.get("wilayah_id")), []).append(it)

    layer1 = list(lama_l1) if only == "2" else []
    if only in ("", "1"):
        komoditas_run = [k for k in KOMODITAS
                         if not kom_filter or any(f in k["nama"].lower() for f in kom_filter)]

        run_nama = {k["nama"] for k in komoditas_run}
        layer1 = [it for it in lama_l1 if it.get("komoditas") not in run_nama]
        for idx, kom in enumerate(komoditas_run):
            print(f"[usulan_ai] L1 {kom['nama']} ...", file=sys.stderr)
            resp = _jalankan(client, SYSTEM_L1, _prompt_l1(kom), MAX_TOKENS_L1, f"L1 {kom['nama']}")
            if resp is None:
                continue
            _dump(f"l1_{kom['nama']}", resp)
            v = validasi_l1(ekstrak_obj(resp) or {}, kom)
            if v:
                layer1.append(v)
                print(f"[usulan_ai]   ok ({len(v['sumber'])} sumber)", file=sys.stderr)
            else:
                print(f"[usulan_ai]   tak ada analisis valid [{_resp_meta(resp)}]", file=sys.stderr)
            if idx < len(komoditas_run) - 1 and PACE_SECONDS > 0:
                time.sleep(PACE_SECONDS)

    layer2 = list(lama_l2) if only == "1" else []
    if only in ("", "2"):
        konteks = _konteks_pasar(layer1)
        wilayah_items = [(w, n) for w, n in WILAYAH.items() if not wil_filter or w in wil_filter]

        run_wid = {w for w, _ in wilayah_items}
        layer2 = [it for it in lama_l2 if str(it.get("wilayah_id")) not in run_wid]
        for idx, (wid, nama) in enumerate(wilayah_items):
            print(f"[usulan_ai] L2 {wid} {nama} ...", file=sys.stderr)
            kandidat_l0 = l0_per_wil.get(wid)
            resp = _jalankan(client, SYSTEM_L2, _prompt_l2(wid, nama, konteks, kandidat_l0),
                             MAX_TOKENS_L2, f"L2 {wid}")
            if resp is None:
                continue
            _dump(f"l2_{wid}", resp)
            arr = ekstrak_array(resp)
            valid = 0
            for it in arr:
                v = validasi_l2(it, wid)
                if v and valid < MAX_ITEM_L2:
                    layer2.append(v)
                    valid += 1

            extra = "" if (arr and valid) else f" [{_resp_meta(resp)}]"
            print(f"[usulan_ai]   parsed {len(arr)}, {valid} item ekosistem valid{extra}", file=sys.stderr)
            if idx < len(wilayah_items) - 1 and PACE_SECONDS > 0:
                time.sleep(PACE_SECONDS)

    if only in ("", "0") and not layer0 and lama_l0:
        print("[usulan_ai] PERINGATAN: Layer 0 hasil 0 — PERTAHANKAN data lama.", file=sys.stderr)
        layer0 = lama_l0
    if only in ("", "1") and not layer1 and lama_l1:
        print("[usulan_ai] PERINGATAN: Layer 1 hasil 0 — PERTAHANKAN data lama (cek diagnosa di atas).",
              file=sys.stderr)
        layer1 = lama_l1
    if only in ("", "2") and not layer2 and lama_l2:
        print("[usulan_ai] PERINGATAN: Layer 2 hasil 0 — PERTAHANKAN data lama (cek diagnosa di atas).",
              file=sys.stderr)
        layer2 = lama_l2

    urut_kom = {k["nama"]: i for i, k in enumerate(KOMODITAS)}
    layer0.sort(key=lambda it: (str(it.get("wilayah_id")), it.get("komoditas") or ""))
    layer1.sort(key=lambda it: urut_kom.get(it.get("komoditas"), 999))
    layer2.sort(key=lambda it: (str(it.get("wilayah_id")), it.get("komoditas") or ""))

    output = {
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "model": MODEL,
        "catatan": ("Usulan berbantuan AI tiga lapis (L0 penemuan lokal + L1 pasar + L2 ekosistem). "
                    "Provenans pada tiap item; angka & skor Tier A tidak terpengaruh."),
        "layer0": layer0,
        "layer1": layer1,
        "layer2": layer2,
    }
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

    if os.path.exists(OUTPUT):
        try:
            with open(OUTPUT, encoding="utf-8") as f:
                _prev = f.read()
            with open(OUTPUT + ".bak", "w", encoding="utf-8") as f:
                f.write(_prev)
        except OSError:
            pass
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=1)
    print(f"[usulan_ai] L0={len(output['layer0'])} kandidat, L1={len(output['layer1'])} komoditas, "
          f"L2={len(output['layer2'])} item -> {OUTPUT}", file=sys.stderr)

if __name__ == "__main__":
    main()
