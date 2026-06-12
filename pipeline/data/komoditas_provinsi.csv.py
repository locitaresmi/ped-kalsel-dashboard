import csv
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

PROV_KALSEL = "KALIMANTAN SELATAN"

def _ranking(prov_nilai: dict[str, float]) -> tuple[int | None, int, float]:
    bersih = {p: v for p, v in prov_nilai.items()
              if "INDONESIA" not in p.upper() and v > 0}
    urut = sorted(bersih.items(), key=lambda x: -x[1])
    rank = next((i + 1 for i, (p, _) in enumerate(urut) if PROV_KALSEL in p.upper()), None)
    nilai = next((v for p, v in urut if PROV_KALSEL in p.upper()), 0.0)
    return rank, len(urut), nilai

def _provinsi_x_jenis(var: int, tahun: int) -> dict[str, dict[str, float]]:
    resp = bps.data_table("0000", var, tahun)
    th = str(bps.th_id(tahun))
    out: dict[str, dict[str, float]] = defaultdict(dict)
    for r in bps.parse_datacontent(resp):
        if r["tahun_id"] != th:
            continue
        try:
            out[r["turvar"].strip()][r["vervar"].strip()] = float(r["nilai"])
        except (TypeError, ValueError):
            continue
    return out

def _provinsi_jumlah(var: int, tahun: int, turvar_sub: str | None = None) -> dict[str, float]:
    resp = bps.data_table("0000", var, tahun)
    th = str(bps.th_id(tahun))
    out: dict[str, float] = defaultdict(float)
    for r in bps.parse_datacontent(resp):
        if r["tahun_id"] != th:
            continue
        if turvar_sub and turvar_sub.lower() not in r["turvar"].lower():
            continue
        try:
            out[r["vervar"].strip()] += float(r["nilai"])
        except (TypeError, ValueError):
            continue
    return out

PERKEBUNAN = {
    "Kelapa Sawit": ("Kelapa Sawit (CPO)", "A", "15", "ribu ton"),
    "Karet": ("Karet", "A", "40", "ribu ton"),
    "Kelapa": ("Kelapa", "A", "", "ribu ton"),
    "Kopi": ("Kopi", "A", "09", "ribu ton"),
    "Kakao": ("Kakao", "A", "18", "ribu ton"),
    "Tebu": ("Tebu", "A", "17", "ribu ton"),
}

def main() -> None:
    rows = []

    for th in (2024, 2023, 2022):
        try:
            perk = _provinsi_x_jenis(2566, th)
        except Exception:
            perk = {}
        if perk:
            break
    for jenis_bps, (nama, sub, hs, sat) in PERKEBUNAN.items():

        cocok = next((k for k in perk if k.strip().lower() == jenis_bps.lower()), None)
        if not cocok:
            continue
        rank, n, nilai = _ranking(perk[cocok])
        if rank is None:
            continue
        rows.append({"komoditas": nama, "subsektor_kode": sub, "hs_chapter": hs,
                     "satuan": sat, "tahun": th, "produksi_kalsel": round(nilai, 1),
                     "peringkat_nasional": rank, "n_provinsi": n})

    for th in (2024, 2023, 2022):
        try:
            ikan = _provinsi_jumlah(1509, th)
        except Exception:
            ikan = {}
        if ikan:
            break
    if ikan:
        rank, n, nilai = _ranking(ikan)
        if rank is not None:
            rows.append({"komoditas": "Perikanan Budidaya", "subsektor_kode": "A",
                         "hs_chapter": "03", "satuan": "ton", "tahun": th,
                         "produksi_kalsel": round(nilai, 1),
                         "peringkat_nasional": rank, "n_provinsi": n})

    for th in (2024, 2023, 2022):
        try:
            jag = _provinsi_jumlah(2204, th, turvar_sub="produksi")
        except Exception:
            jag = {}
        if jag:
            break
    if jag:
        rank, n, nilai = _ranking(jag)
        if rank is not None:
            rows.append({"komoditas": "Jagung", "subsektor_kode": "A", "hs_chapter": "10",
                         "satuan": "ton", "tahun": th, "produksi_kalsel": round(nilai, 1),
                         "peringkat_nasional": rank, "n_provinsi": n})

    rows.append({"komoditas": "Batu Bara", "subsektor_kode": "B", "hs_chapter": "27",
                 "satuan": "", "tahun": "", "produksi_kalsel": "",
                 "peringkat_nasional": "", "n_provinsi": ""})

    if not rows:
        print("[komoditas_prov] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    print(f"[komoditas_prov] {len(rows)} komoditas provinsi", file=sys.stderr)

if __name__ == "__main__":
    main()
