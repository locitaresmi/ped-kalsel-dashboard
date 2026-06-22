import csv
import datetime
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

KABKOTA = {
    "6301": "Tanah Laut", "6302": "Kotabaru", "6303": "Banjar",
    "6304": "Barito Kuala", "6305": "Tapin", "6306": "Hulu Sungai Selatan",
    "6307": "Hulu Sungai Tengah", "6308": "Hulu Sungai Utara", "6309": "Tabalong",
    "6310": "Tanah Bumbu", "6311": "Balangan", "6371": "Banjarmasin", "6372": "Banjarbaru",
}
NAMA_TAMPIL = dict(KABKOTA, **{"6371": "Kota Banjarmasin", "6372": "Kota Banjarbaru"})
PROBE = tuple(range(datetime.date.today().year, 2016, -1))

POLA_A = [
    ("53", "Tanaman Pangan", "crop", "ton",
     (("produksi", "tanaman pangan"), ("kecamatan", "periode", "menurut")),
     (("luas panen", "tanaman pangan"), ("kecamatan", "lahan", "menurut"))),
    ("55", "Hortikultura - Sayuran", "crop", "ton",
     (("produksi", "sayuran"), ("kecamatan", "biofarmaka")),
     (("luas panen", "sayuran"), ("kecamatan", "biofarmaka"))),
    ("55", "Hortikultura - Buah", "produksi", "ton",
     (("produksi", "buah"), ("kecamatan",)), None),
    ("54", "Perkebunan", "crop", "ton",
     (("produksi", "perkebunan"), ("rakyat",)),
     (("luas", "perkebunan"), ("rakyat", "produksi"))),
    ("24", "Peternakan - Ternak", "populasi", "ekor",
     (("populasi", "ternak"), ("unggas", "kecamatan")), None),
    ("24", "Peternakan - Unggas", "populasi", "ekor",
     (("populasi", "unggas"), ("kecamatan",)), None),
    ("56", "Perikanan Budidaya", "produksi", "ton",
     (("produksi", "perikanan budidaya"), ("rumah tangga",)), None),
]

POLA_B = [
    ("24", r"^(jumlah|populasi)\s+", "populasi", "ekor", "Peternakan"),
    ("53", r"^produksi\s+", "produksi", "ton", "Tanaman Pangan"),
    ("54", r"^produksi\s+", "produksi", "ton", "Perkebunan"),
    ("56", r"^produksi\s+", "produksi", "ton", "Perikanan Budidaya"),
]

KATEGORI = {
    "tanaman pangan", "palawija", "sayuran", "sayur-sayuran", "buah-buahan", "buah buahan",
    "biofarmaka", "tanaman hias", "perkebunan", "tanaman perkebunan", "ternak", "hewan ternak",
    "unggas", "hewan unggas", "ternak besar", "ternak kecil", "perikanan", "perikanan budidaya",
    "perikanan tangkap", "rumah tangga", "lahan", "lahan sawah", "irigasi", "ternak unggas",
}
TURVAR_BUANG = {"jumlah", "total", "lainnya", "lain-lain", "tidak ada"}
UNGGAS_KW = ("ayam", "itik", "entok", "puyuh", "burung", "bebek", "angsa", "unggas")

def _norm(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s or "").upper().strip()
    s = re.sub(r"^\d[\d\s.\-]*", "", s)
    s = re.sub(r"^(KABUPATEN|KOTA)\s+", "", s)
    return re.sub(r"\s+", "", s)

_VAR_CACHE: dict[tuple[str, str], list[dict]] = {}

def _vars(domain: str, subject: str) -> list[dict]:
    k = (domain, subject)
    if k not in _VAR_CACHE:
        _VAR_CACHE[k] = bps.list_var(domain, subject=subject)
    return _VAR_CACHE[k]

def _baris_total(resp: dict, kab_norm: str) -> str | None:
    vervar = bps._label_map(resp.get("vervar"))
    for vid, lbl in vervar:
        if _norm(lbl) == kab_norm:
            return vid
    for vid, lbl in vervar:
        n = _norm(lbl)
        if n in ("JUMLAH", "TOTAL", "KALIMANTANSELATAN"):
            return vid
    return vervar[-1][0] if vervar else None

def _pilih_dari(cands: list[dict], domain: str, kab_short: str):
    best = None
    for c in cands:
        for y in PROBE:
            try:
                resp = bps.data_table(domain, c["var_id"], y)
            except Exception:
                continue
            if not bps.parse_datacontent(resp):
                continue
            if best is None or y > best["tahun"]:
                best = {"var_id": c["var_id"], "title": c["title"], "tahun": y}
            break
    return best

def _cari(domain, subject, judul_ada, judul_tdk):
    ada = [k.lower() for k in judul_ada]
    tdk = [k.lower() for k in judul_tdk]
    out = []
    for v in _vars(domain, subject):
        t = (v.get("title") or "").lower()
        if all(k in t for k in ada) and not any(k in t for k in tdk):
            out.append({"var_id": v.get("var_id"), "title": v.get("title")})
    return out

def _total_by_turvar(domain, var, tahun, kab_norm) -> dict[str, float]:
    resp = bps.data_table(domain, var, tahun)
    th = str(bps.th_id(tahun))
    tv = _baris_total(resp, kab_norm)
    out = {}
    for r in bps.parse_datacontent(resp):
        if r["vervar_id"] != tv or r["tahun_id"] != th:
            continue
        kom = bps._clean_label(r["turvar"]).strip()
        if kom.lower() in TURVAR_BUANG:
            continue
        try:
            v = float(r["nilai"])
        except (TypeError, ValueError):
            continue
        if v > 0:
            out[kom] = v
    return out

def _total_nilai(domain, var, tahun, kab_norm) -> float | None:
    resp = bps.data_table(domain, var, tahun)
    th = str(bps.th_id(tahun))
    tv = _baris_total(resp, kab_norm)
    for r in bps.parse_datacontent(resp):
        if r["vervar_id"] == tv and r["tahun_id"] == th:
            try:
                return float(r["nilai"])
            except (TypeError, ValueError):
                return None
    return None

def _komoditas_dari_judul(title: str, prefix_re: str) -> str | None:
    t = bps._clean_label(title)
    t = re.sub(prefix_re, "", t, flags=re.I)
    t = re.split(r"\s+(menurut|di\s+kab|di\s+kota|pada|tahun)\b", t, flags=re.I)[0]
    t = re.sub(r"\(.*?\)", "", t)
    t = re.sub(r"\b(tanaman|hewan|perkebunan rakyat|ras)\b", "", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip(" -")
    if not t or t.lower() in KATEGORI or len(t.split()) > 4:
        return None
    return t.title()

def main() -> None:
    only = os.environ.get("PRODUKSI_KK_DOMAINS", "").strip()
    domains = only.split(",") if only else list(KABKOTA)

    rows = []
    for dom in domains:
        kab_short = KABKOTA[dom]
        kab_norm = _norm(kab_short)
        ada: set[tuple[str, str]] = set()
        n0 = len(rows)

        for subj, nama, mode, satuan, jp, jl in POLA_A:
            pv = _pilih_dari(_cari(dom, subj, *jp), dom, kab_short)
            if not pv:
                continue
            try:
                prod = _total_by_turvar(dom, pv["var_id"], pv["tahun"], kab_norm)
            except Exception:
                prod = {}
            if not prod:
                continue
            luas = {}
            if mode == "crop" and jl:
                lv = _pilih_dari(_cari(dom, subj, *jl), dom, kab_short)
                if lv:
                    for ty in (pv["tahun"], lv["tahun"]):
                        try:
                            luas = _total_by_turvar(dom, lv["var_id"], ty, kab_norm)
                        except Exception:
                            luas = {}
                        if luas:
                            break
            for kom, nilai in sorted(prod.items()):
                rows.append(_row(dom, nama, kom, pv["tahun"], mode, satuan,
                                 nilai, luas.get(kom), "A"))
                ada.add((nama, kom.lower()))

        for subj, prefix_re, mode, satuan, sub_default in POLA_B:
            for v in _vars(dom, subj):
                title = v.get("title") or ""
                if not re.match(prefix_re, title.strip(), flags=re.I):
                    continue
                kom = _komoditas_dari_judul(title, prefix_re)
                if not kom:
                    continue
                nama = sub_default
                if subj == "24":
                    nama = ("Peternakan - Unggas" if any(k in kom.lower() for k in UNGGAS_KW)
                            else "Peternakan - Ternak")
                if (nama, kom.lower()) in ada:
                    continue
                pick = _pilih_dari([{"var_id": v.get("var_id"), "title": title}], dom, kab_short)
                if not pick:
                    continue
                nilai = _total_nilai(dom, pick["var_id"], pick["tahun"], kab_norm)
                if nilai is None or nilai <= 0:
                    continue
                rows.append(_row(dom, nama, kom, pick["tahun"], mode, satuan, nilai, None, "B"))
                ada.add((nama, kom.lower()))

        print(f"[produksi_kk] {dom} {NAMA_TAMPIL[dom]}: {len(rows) - n0} baris", file=sys.stderr)

    if not rows:
        print("[produksi_kk] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    cols = ["wilayah_id", "wilayah", "subsektor", "komoditas", "tahun", "metrik_utama",
            "luas_ha", "produksi", "satuan_produksi", "produktivitas", "populasi", "pola"]
    w = csv.DictWriter(sys.stdout, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)
    print(f"[produksi_kk] total {len(rows)} baris, "
          f"{len({r['wilayah_id'] for r in rows})} kab/kota", file=sys.stderr)

def _row(dom, subsektor, kom, tahun, mode, satuan, nilai, luas_ha, pola) -> dict:
    base = {"wilayah_id": dom, "wilayah": NAMA_TAMPIL[dom], "subsektor": subsektor,
            "komoditas": kom, "tahun": tahun, "luas_ha": "", "produksi": "",
            "satuan_produksi": "", "produktivitas": "", "populasi": "", "pola": pola}
    if mode == "populasi":
        base["metrik_utama"] = "populasi"
        base["populasi"] = round(nilai)
    else:
        base["metrik_utama"] = "produksi"
        base["produksi"] = round(nilai, 1)
        base["satuan_produksi"] = satuan
        if mode == "crop" and luas_ha and luas_ha > 0:
            base["luas_ha"] = round(luas_ha, 1)
            base["produktivitas"] = round(nilai / luas_ha, 2)
    return base

if __name__ == "__main__":
    main()
