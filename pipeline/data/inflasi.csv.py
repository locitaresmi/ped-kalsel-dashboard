import csv
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

SUBJECT_INFLASI = 3
TAHUN = (2023, 2024, 2025)

BULAN_ID = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12,
}

def _per_kota_bulan(domain: str, var: int, tahun: int) -> dict[tuple[str, int], float]:
    resp = bps.data_table(domain, var, tahun)
    th = str(bps.th_id(tahun))
    out: dict[tuple[str, int], float] = {}
    for r in bps.parse_datacontent(resp):
        if r["tahun_id"] != th:
            continue
        bln = BULAN_ID.get(bps._clean_label(r["turtahun"]).lower())
        if not bln:
            continue
        kota = bps._clean_label(r["vervar"]).strip()
        try:
            out[(kota, bln)] = float(r["nilai"])
        except (TypeError, ValueError):
            continue
    return out

def main() -> None:
    ihk_var = bps.pilih_var("6300", subject=SUBJECT_INFLASI,
                            judul_ada=("indeks harga konsumen",), judul_tdk=("kelompok",),
                            probe=TAHUN[::-1], vervar_ada=("banjarmasin", "tanjung"))
    inf_var = bps.pilih_var("6300", subject=SUBJECT_INFLASI,
                            judul_ada=("inflasi", "m-to-m"), judul_tdk=(),
                            probe=TAHUN[::-1], vervar_ada=("banjarmasin", "tanjung"))
    if not ihk_var:
        print("[inflasi] var IHK tak ditemukan", file=sys.stderr)
        sys.exit(1)
    print(f"[inflasi] IHK var {ihk_var['var_id']} | inflasi var "
          f"{inf_var['var_id'] if inf_var else '-'}", file=sys.stderr)

    rows_map: dict[tuple[str, int, int], dict] = {}
    for th in TAHUN:
        try:
            ihk = _per_kota_bulan("6300", ihk_var["var_id"], th)
        except Exception as e:
            print(f"[inflasi] IHK {th} gagal: {e}", file=sys.stderr)
            ihk = {}
        inf = {}
        if inf_var:
            try:
                inf = _per_kota_bulan("6300", inf_var["var_id"], th)
            except Exception as e:
                print(f"[inflasi] inflasi {th} gagal: {e}", file=sys.stderr)
        for (kota, bln), nilai in ihk.items():
            rows_map.setdefault((kota, th, bln), {})["ihk"] = round(nilai, 2)
        for (kota, bln), nilai in inf.items():
            rows_map.setdefault((kota, th, bln), {})["inflasi_mtm"] = round(nilai, 2)

    rows = []
    for (kota, th, bln), v in sorted(rows_map.items()):
        rows.append({
            "kota": kota, "tahun": th, "bulan": bln,
            "tanggal": f"{th}-{bln:02d}-01",
            "ihk": v.get("ihk", ""), "inflasi_mtm": v.get("inflasi_mtm", ""),
        })

    if not rows:
        print("[inflasi] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    n_kota = len({r["kota"] for r in rows})
    print(f"[inflasi] {len(rows)} baris ({n_kota} kota IHK, {TAHUN[0]}-{TAHUN[-1]})", file=sys.stderr)

if __name__ == "__main__":
    main()
