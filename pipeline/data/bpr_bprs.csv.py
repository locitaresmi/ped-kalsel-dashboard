import csv
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import ojk

JENIS = [
    ("BPR", {"kredit": ("BPR_KreditPembiayaanEntitas", 9),
             "dpk": ("BPR_DanaPihakKetiga", 10),
             "kantor": ("BPR_InfoKantorCabangdanPerwakilan", 2)}),
    ("BPRS", {"kredit": ("BPRS_KreditPembiayaanEntitas", 22),
              "dpk": ("BPRS_DanaPihakKetiga", 23),
              "kantor": ("BPRS_InfoKantorCabangdanPerwakilan", 15)}),
]

def _per_prov(rows: list[dict], field: str) -> dict[str, float]:
    agg: dict[str, float] = defaultdict(float)
    for r in rows:
        prov = ojk.bersih_provinsi(r.get("DATI1"))
        if prov:
            agg[prov] += float(r.get(field) or 0)
    return agg

def main() -> None:
    out_rows = []
    for jenis, tab in JENIS:
        kt, km = tab["kredit"]
        bln = os.environ.get("OJK_BULAN") or ojk.latest_month(kt, km, ojk.bulan_kandidat(8))
        if not bln:
            print(f"[bpr_bprs] {jenis}: tak ada bulan berdata", file=sys.stderr)
            continue

        kredit_rows = ojk.get_grid_paged(kt, km, field="Bulan", values=[bln], page=50000)
        kredit = _per_prov(kredit_rows, "TotalKredit")
        umkm = _per_prov(kredit_rows, "TotalKecilMenengah")

        dt, dm = tab["dpk"]
        dpk_rows, _ = ojk.get_grid(dt, dm, field="Bulan", values=[bln], take=20000)
        dpk = _per_prov(dpk_rows, "TotalDana")

        nt, nm = tab["kantor"]
        kantor_rows, _ = ojk.get_grid(nt, nm, field="Bulan", values=[bln], take=20000)
        kantor = _per_prov(kantor_rows, "JumlahKantor")

        provs = set(kredit) | set(dpk) | set(kantor)
        for p in sorted(provs):
            out_rows.append({
                "jenis": jenis, "provinsi": p,
                "kredit": round(kredit.get(p, 0)), "kredit_umkm": round(umkm.get(p, 0)),
                "dpk": round(dpk.get(p, 0)), "kantor": int(kantor.get(p, 0)), "bulan": bln,
            })
        kk = kredit.get(ojk.KALSEL, 0)
        print(f"[bpr_bprs] {jenis} {bln}: {len(provs)} prov; kredit Kalsel Rp {kk/1e12:,.2f} T",
              file=sys.stderr)

    if not out_rows:
        print("[bpr_bprs] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=["jenis", "provinsi", "kredit", "kredit_umkm", "dpk", "kantor", "bulan"])
    w.writeheader()
    w.writerows(out_rows)

if __name__ == "__main__":
    main()
