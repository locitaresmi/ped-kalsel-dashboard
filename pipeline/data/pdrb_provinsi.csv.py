import csv
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

TAHUN = range(2021, 2025)

def _per_provinsi(var: int, tahun: int) -> dict[str, float]:
    resp = bps.data_table("0000", var, tahun)
    th = str(bps.th_id(tahun))
    out: dict[str, float] = {}
    for r in bps.parse_datacontent(resp):
        if r["tahun_id"] != th:
            continue
        try:
            out[bps._clean_label(r["vervar"]).strip()] = float(r["nilai"])
        except (TypeError, ValueError):
            continue
    return out

def main() -> None:
    rows = []
    for th in TAHUN:
        try:
            share = _per_provinsi(289, th)
            growth = _per_provinsi(291, th)
        except Exception as e:
            print(f"[pdrb_prov] {th} gagal: {e}", file=sys.stderr)
            continue
        prov = set(share) | set(growth)
        for p in sorted(prov):
            up = p.upper()
            rows.append({
                "tahun": th, "provinsi": p.title(),
                "share_pdrb_pct": round(share[p], 3) if p in share else "",
                "growth_pct": round(growth[p], 2) if p in growth else "",
                "kalimantan": "true" if "KALIMANTAN" in up else "false",
                "nasional": "true" if "INDONESIA" in up else "false",
            })
        print(f"[pdrb_prov] {th}: {len(prov)} provinsi", file=sys.stderr)

    if not rows:
        print("[pdrb_prov] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    print(f"[pdrb_prov] total {len(rows)} baris", file=sys.stderr)

if __name__ == "__main__":
    main()
