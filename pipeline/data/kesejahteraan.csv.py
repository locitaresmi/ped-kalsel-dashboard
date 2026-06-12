import csv
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

TAHUN = range(2021, 2025)
KK_VARS = {"pdrb_kapita": 375, "miskin_pct": 103, "gini": 152, "ipm": 356}

NAS_VARS = {
    "miskin_pct": (192, "jumlah", "maret"),
    "gini": (98, "perkotaan+perdesaan", "maret"),
    "ipm": (494, None, None),
}

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

def _ambil_6300(var: int, tahun: int) -> dict[str, float]:
    resp = bps.data_table("6300", var, tahun)
    th = str(bps.th_id(tahun))
    out: dict[str, float] = {}
    for r in bps.parse_datacontent(resp):
        if r["tahun_id"] != th:
            continue
        wid = NAMA_ID.get(_norm(r["vervar"]))
        if not wid:
            continue
        try:
            out[wid] = float(r["nilai"])
        except (TypeError, ValueError):
            continue
    return out

def _nilai_nasional(var: int, tahun: int, turvar_sub, turtahun_sub) -> float | None:
    resp = bps.data_table("0000", var, tahun)
    th = str(bps.th_id(tahun))
    for r in bps.parse_datacontent(resp):
        if r["tahun_id"] != th or "INDONESIA" not in r["vervar"].upper():
            continue
        if turvar_sub and turvar_sub not in r["turvar"].lower():
            continue
        if turtahun_sub and turtahun_sub not in r["turtahun"].lower():
            continue
        try:
            return float(r["nilai"])
        except (TypeError, ValueError):
            return None
    return None

def main() -> None:
    rows = []
    for th in TAHUN:

        kk = {ind: _ambil_6300(var, th) for ind, var in KK_VARS.items()}
        wids = set().union(*[set(d) for d in kk.values()]) if any(kk.values()) else set()
        for wid in sorted(wids):
            rows.append({
                "tahun": th, "wilayah_id": wid, "wilayah": NAMA_TAMPIL.get(wid, wid),
                "level": "provinsi" if wid == "6300" else "kabkota",
                "pdrb_kapita": kk["pdrb_kapita"].get(wid, ""),
                "miskin_pct": kk["miskin_pct"].get(wid, ""),
                "gini": kk["gini"].get(wid, ""),
                "ipm": kk["ipm"].get(wid, ""),
            })

        nas = {ind: _nilai_nasional(var, th, tv, tt) for ind, (var, tv, tt) in NAS_VARS.items()}
        if any(v is not None for v in nas.values()):
            rows.append({
                "tahun": th, "wilayah_id": "0000", "wilayah": "Indonesia",
                "level": "nasional", "pdrb_kapita": "",
                "miskin_pct": nas.get("miskin_pct") if nas.get("miskin_pct") is not None else "",
                "gini": nas.get("gini") if nas.get("gini") is not None else "",
                "ipm": nas.get("ipm") if nas.get("ipm") is not None else "",
            })
        print(f"[kesejahteraan] {th}: {len(wids)} wilayah + nasional", file=sys.stderr)

    if not rows:
        print("[kesejahteraan] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    print(f"[kesejahteraan] total {len(rows)} baris", file=sys.stderr)

if __name__ == "__main__":
    main()
