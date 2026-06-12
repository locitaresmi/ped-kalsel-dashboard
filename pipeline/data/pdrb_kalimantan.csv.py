import csv
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

PROVINSI = {
    "6100": "Kalimantan Barat", "6200": "Kalimantan Tengah",
    "6300": "Kalimantan Selatan", "6400": "Kalimantan Timur",
    "6500": "Kalimantan Utara",
}
PROBE = (2024, 2023, 2022)

def main() -> None:
    rows = []
    for dom, nama in PROVINSI.items():
        best = bps.pilih_var_pdrb(dom)
        if not best:
            print(f"[pdrb_kalimantan] {nama}: var PDRB tak ditemukan", file=sys.stderr)
            continue
        var, title = best["var_id"], best["title"]

        sek_now, th_now = {}, None
        for y in PROBE:
            sek = bps.ambil_pdrb_sektor(dom, var, y, harga="ADHK", title=title)
            if len(sek) >= 15:
                sek_now, th_now = sek, y
                break
        if not sek_now:
            print(f"[pdrb_kalimantan] {nama}: tak ada tahun valid", file=sys.stderr)
            continue
        sek_prev = bps.ambil_pdrb_sektor(dom, var, th_now - 1, harga="ADHK", title=title)
        total_now = sum(sek_now.values())
        total_prev = sum(sek_prev.values()) if sek_prev else 0
        growth = round((total_now / total_prev - 1) * 100, 2) if total_prev else ""

        for kode, nilai in sorted(sek_now.items()):
            rows.append({
                "provinsi": nama, "domain": dom, "tahun": th_now,
                "sektor_kode": kode, "sektor": bps.SEKTOR_NAMA.get(kode, kode),
                "adhk": round(nilai, 1),
                "share_pct": round(nilai / total_now * 100, 2) if total_now else "",
                "growth_total_pct": growth,
            })
        print(f"[pdrb_kalimantan] {nama} (var {var}, {th_now}): {len(sek_now)} sektor, "
              f"growth {growth}%", file=sys.stderr)

    if not rows:
        print("[pdrb_kalimantan] TIDAK ada data", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    print(f"[pdrb_kalimantan] total {len(rows)} baris ({len(PROVINSI)} provinsi)", file=sys.stderr)

if __name__ == "__main__":
    main()
