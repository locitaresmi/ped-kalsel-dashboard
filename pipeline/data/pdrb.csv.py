import csv
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

TAHUN = range(2020, 2026)
VAR_PROV = ("6300", 322)
VAR_NAS = ("0000", 65)

def main() -> None:
    rows = []
    for th in TAHUN:
        try:
            prov = bps.ambil_pdrb_sektor(*VAR_PROV, th)
            nas = bps.ambil_pdrb_sektor(*VAR_NAS, th)
        except Exception as e:
            print(f"[pdrb] lewati {th}: {e}", file=sys.stderr)
            continue
        if not prov or not nas:
            print(f"[pdrb] data {th} kosong, dilewati", file=sys.stderr)
            continue
        tot_prov = sum(prov.values())
        tot_nas = sum(nas.values())
        for kode, nilai in prov.items():
            nilai_nas = nas.get(kode)
            if not nilai_nas or not tot_prov or not tot_nas:
                continue
            share_prov = nilai / tot_prov
            share_nas = nilai_nas / tot_nas
            lq = share_prov / share_nas if share_nas else None
            rows.append({
                "tahun": th,
                "sektor_kode": kode,
                "sektor": bps.SEKTOR_NAMA.get(kode, kode),
                "pdrb_prov": round(nilai, 2),
                "pdrb_nas": round(nilai_nas, 2),
                "share_prov": round(share_prov, 6),
                "share_nas": round(share_nas, 6),
                "lq": round(lq, 4) if lq is not None else "",
            })

    if not rows:
        print("[pdrb] TIDAK ada data tertarik dari BPS", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    print(f"[pdrb] {len(rows)} baris ({len(set(r['tahun'] for r in rows))} tahun)",
          file=sys.stderr)

if __name__ == "__main__":
    main()
