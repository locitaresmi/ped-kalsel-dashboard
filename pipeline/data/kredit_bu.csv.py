import csv
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import ojk
import bps

TABLE, METRIC = "BU_KreditdanPembiayaanEntitas", 340
SEKTOR_NAMA = dict(bps.SEKTOR_NAMA, RT="Rumah Tangga (konsumsi)")

def _is_npl(kualitas: str | None) -> bool:
    q = (kualitas or "").lower()
    return "kurang lancar" in q or "diragukan" in q or "macet" in q

def main() -> None:
    bulan = os.environ.get("OJK_BULAN") or ojk.latest_month(
        TABLE, METRIC, ojk.bulan_kandidat(8))
    if not bulan:
        print("[kredit_bu] tak menemukan bulan dengan data", file=sys.stderr)
        sys.exit(1)

    rows, total = ojk.get_grid(TABLE, METRIC, field="Bulan", values=[bulan], take=70000)
    print(f"[kredit_bu] bulan {bulan}: {len(rows)}/{total} baris ditarik", file=sys.stderr)
    if not rows:
        print("[kredit_bu] kosong", file=sys.stderr)
        sys.exit(1)

    agg: dict[tuple[str, str], float] = defaultdict(float)
    npl_agg: dict[tuple[str, str], float] = defaultdict(float)
    tak_dikenal: dict[str, float] = defaultdict(float)
    for r in rows:
        prov = ojk.bersih_provinsi(r.get("DATI1"))
        if not prov:
            continue
        kode = ojk.kode_sektor(r.get("SektorEkonomi"))
        nilai = r.get("Nilai") or 0
        if kode is None:
            tak_dikenal[r.get("SektorEkonomi") or "?"] += nilai
            continue
        agg[(prov, kode)] += float(nilai)
        if _is_npl(r.get("KualitasKredit")):
            npl_agg[(prov, kode)] += float(nilai)

    if tak_dikenal:
        tot_tak = sum(tak_dikenal.values())
        print(f"[kredit_bu] {len(tak_dikenal)} label sektor tak terpetakan "
              f"(Rp {tot_tak/1e9:,.0f} M, mis. {next(iter(tak_dikenal))[:40]})", file=sys.stderr)

    out = []
    for (prov, kode), nilai in agg.items():
        out.append({"provinsi": prov, "sektor_kode": kode,
                    "sektor": SEKTOR_NAMA.get(kode, kode),
                    "nilai": round(nilai), "npl": round(npl_agg.get((prov, kode), 0)),
                    "bulan": bulan})
    out.sort(key=lambda d: (d["provinsi"], d["sektor_kode"]))

    kalsel = sum(d["nilai"] for d in out if d["provinsi"] == ojk.KALSEL)
    print(f"[kredit_bu] {len(out)} baris, {len({d['provinsi'] for d in out})} provinsi; "
          f"total kredit Kalsel Rp {kalsel/1e12:,.2f} T", file=sys.stderr)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=["provinsi", "sektor_kode", "sektor", "nilai", "npl", "bulan"])
    w.writeheader()
    w.writerows(out)

if __name__ == "__main__":
    main()
