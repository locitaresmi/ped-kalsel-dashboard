import csv
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import ojk

TABLE, METRIC = "BU_DanaPihakKetiga", 341

def main() -> None:
    bulan = os.environ.get("OJK_BULAN") or ojk.latest_month(TABLE, METRIC, ojk.bulan_kandidat(8))
    if not bulan:
        print("[dpk_bu] tak menemukan bulan dengan data", file=sys.stderr)
        sys.exit(1)
    rows, total = ojk.get_grid(TABLE, METRIC, field="Bulan", values=[bulan], take=30000)
    print(f"[dpk_bu] bulan {bulan}: {len(rows)}/{total} baris", file=sys.stderr)
    if not rows:
        sys.exit(1)

    agg: dict[str, float] = defaultdict(float)
    for r in rows:
        prov = ojk.bersih_provinsi(r.get("DATI1"))
        if prov:
            agg[prov] += float(r.get("Nilai") or 0)

    out = [{"provinsi": p, "dpk": round(v), "bulan": bulan} for p, v in sorted(agg.items())]
    kalsel = next((d["dpk"] for d in out if d["provinsi"] == ojk.KALSEL), 0)
    print(f"[dpk_bu] {len(out)} provinsi; DPK Kalsel Rp {kalsel/1e12:,.2f} T", file=sys.stderr)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=["provinsi", "dpk", "bulan"])
    w.writeheader()
    w.writerows(out)

if __name__ == "__main__":
    main()
