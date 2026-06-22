import csv
import datetime
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

SUBJECT_TK = 6
TAHUN = range(2023, datetime.date.today().year + 1)
PERIODE_PRIORITAS = ("agustus", "februari", "november")

NAMA_TAMPIL = {
    "6300": "Kalimantan Selatan", "6301": "Tanah Laut", "6302": "Kotabaru",
    "6303": "Banjar", "6304": "Barito Kuala", "6305": "Tapin",
    "6306": "Hulu Sungai Selatan", "6307": "Hulu Sungai Tengah",
    "6308": "Hulu Sungai Utara", "6309": "Tabalong", "6310": "Tanah Bumbu",
    "6311": "Balangan", "6371": "Kota Banjarmasin", "6372": "Kota Banjarbaru",
}

def _norm(label: str) -> str:
    s = re.sub(r"<[^>]+>", "", label or "").upper().strip()
    s = re.sub(r"^KOTA\s+", "", s)
    return re.sub(r"\s+", "", s)

NAMA_ID = {_norm(v): k for k, v in NAMA_TAMPIL.items()}
NAMA_ID[_norm("KALIMANTAN SELATAN")] = "6300"

def _per_wilayah(var: int, tahun: int) -> dict[str, float]:
    resp = bps.data_table("6300", var, tahun)
    th = str(bps.th_id(tahun))

    tmp: dict[str, dict[str, float]] = {}
    for r in bps.parse_datacontent(resp):
        if r["tahun_id"] != th:
            continue
        wid = NAMA_ID.get(_norm(r["vervar"]))
        if not wid:
            continue
        per = bps._clean_label(r["turtahun"]).lower()
        try:
            tmp.setdefault(wid, {})[per] = float(r["nilai"])
        except (TypeError, ValueError):
            continue
    out: dict[str, float] = {}
    for wid, permap in tmp.items():
        for p in PERIODE_PRIORITAS:
            if p in permap:
                out[wid] = permap[p]
                break
        else:
            if permap:
                out[wid] = next(iter(permap.values()))
    return out

def _periode_terpakai(var: int, tahun: int) -> str:
    resp = bps.data_table("6300", var, tahun)
    pers = {bps._clean_label(l).lower() for _, l in bps._label_map(resp.get("turtahun"))}
    for p in PERIODE_PRIORITAS:
        if p in pers:
            return p.capitalize()
    return next(iter(pers), "").capitalize() if pers else ""

def main() -> None:
    tpt_var = bps.pilih_var("6300", subject=SUBJECT_TK,
                            judul_ada=("tingkat pengangguran terbuka",),
                            probe=TAHUN[::-1], vervar_ada=("tanah laut", "banjar"))
    tpak_var = bps.pilih_var("6300", subject=SUBJECT_TK,
                             judul_ada=("tingkat partisipasi angkatan kerja",),
                             probe=TAHUN[::-1], vervar_ada=("tanah laut", "banjar"))
    if not tpt_var or not tpak_var:
        print(f"[ketenagakerjaan] var tak lengkap: TPT={tpt_var} TPAK={tpak_var}", file=sys.stderr)
        sys.exit(1)
    print(f"[ketenagakerjaan] TPT var {tpt_var['var_id']} | TPAK var {tpak_var['var_id']}",
          file=sys.stderr)

    rows = []
    for th in TAHUN:
        try:
            tpt = _per_wilayah(tpt_var["var_id"], th)
            tpak = _per_wilayah(tpak_var["var_id"], th)
        except Exception as e:
            print(f"[ketenagakerjaan] {th} gagal: {e}", file=sys.stderr)
            continue
        if not tpt and not tpak:
            continue
        periode = _periode_terpakai(tpt_var["var_id"], th) or _periode_terpakai(tpak_var["var_id"], th)
        wids = set(tpt) | set(tpak)
        for wid in sorted(wids):
            rows.append({
                "tahun": th, "periode": periode, "wilayah_id": wid,
                "wilayah": NAMA_TAMPIL.get(wid, wid),
                "level": "provinsi" if wid == "6300" else "kabkota",
                "tpt": round(tpt[wid], 2) if wid in tpt else "",
                "tpak": round(tpak[wid], 2) if wid in tpak else "",
            })
        print(f"[ketenagakerjaan] {th} ({periode}): {len(wids)} wilayah", file=sys.stderr)

    if not rows:
        print("[ketenagakerjaan] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    print(f"[ketenagakerjaan] total {len(rows)} baris", file=sys.stderr)

if __name__ == "__main__":
    main()
