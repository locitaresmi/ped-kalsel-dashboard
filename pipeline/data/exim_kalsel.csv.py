import csv
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

SUBJECT_EXIM = 8
TAHUN = (2021, 2022, 2023, 2024, 2025)

BULAN_ID = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12,
}

def _per_bulan(var: int, tahun: int) -> dict[int, float]:
    resp = bps.data_table("6300", var, tahun)
    th = str(bps.th_id(tahun))
    out: dict[int, float] = {}
    for r in bps.parse_datacontent(resp):
        if r["tahun_id"] != th:
            continue
        bln = BULAN_ID.get(bps._clean_label(r["turtahun"]).lower())
        if not bln:
            continue
        try:
            out[bln] = float(r["nilai"])
        except (TypeError, ValueError):
            continue
    return out

def main() -> None:
    eks = bps.pilih_var("6300", subject=SUBJECT_EXIM,
                        judul_ada=("nilai ekspor",), probe=TAHUN[::-1])
    imp = bps.pilih_var("6300", subject=SUBJECT_EXIM,
                        judul_ada=("nilai impor",), probe=TAHUN[::-1])
    ner = bps.pilih_var("6300", subject=SUBJECT_EXIM,
                        judul_ada=("neraca",), probe=TAHUN[::-1])
    if not eks:
        print("[exim] var Nilai Ekspor tak ditemukan", file=sys.stderr)
        sys.exit(1)
    print(f"[exim] ekspor var {eks['var_id']} | impor {imp['var_id'] if imp else '-'} | "
          f"neraca {ner['var_id'] if ner else '-'}", file=sys.stderr)

    rows_map: dict[tuple[int, int], dict] = {}
    for th in TAHUN:
        seri = [("ekspor", eks), ("impor", imp), ("neraca", ner)]
        for nama, v in seri:
            if not v:
                continue
            try:
                data = _per_bulan(v["var_id"], th)
            except Exception as e:
                print(f"[exim] {nama} {th} gagal: {e}", file=sys.stderr)
                continue
            for bln, nilai in data.items():
                rows_map.setdefault((th, bln), {})[nama] = round(nilai, 2)

    rows = []
    for (th, bln), v in sorted(rows_map.items()):
        rows.append({
            "tahun": th, "bulan": bln, "tanggal": f"{th}-{bln:02d}-01",
            "ekspor": v.get("ekspor", ""), "impor": v.get("impor", ""),
            "neraca": v.get("neraca", ""),
        })

    if not rows:
        print("[exim] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=["tahun", "bulan", "tanggal",
                                               "ekspor", "impor", "neraca"])
    w.writeheader()
    w.writerows(rows)
    print(f"[exim] {len(rows)} baris bulanan ({TAHUN[0]}-{TAHUN[-1]}), satuan Juta US$",
          file=sys.stderr)

if __name__ == "__main__":
    main()
