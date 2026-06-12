import csv
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

def pilih_tahun() -> int:
    for th in (2025, 2024, 2023):
        ref = bps.ekspor_chapter("27", th)
        if ref and ref["n_bulan"] >= 12:
            return th
    return 2024

def main() -> None:
    th = pilih_tahun()
    print(f"[ekspor] tahun penuh = {th}", file=sys.stderr)
    rows = []
    for i in range(1, 100):
        hs = f"{i:02d}"
        c = bps.ekspor_chapter(hs, th)
        if c and c["nilai_nasional"] > 0:
            rows.append(c)
        if i % 20 == 0:
            print(f"[ekspor] {i}/99 chapter diproses, {len(rows)} ada ekspor",
                  file=sys.stderr)

    if not rows:
        print("[ekspor] TIDAK ada data ekspor tertarik", file=sys.stderr)
        sys.exit(1)

    rows.sort(key=lambda r: r["nilai_nasional"], reverse=True)
    for i, r in enumerate(rows, 1):
        r["peringkat_nasional"] = i
        r["top10_nasional"] = i <= 10

    kalsel = sorted([r for r in rows if r["nilai_kalsel"] > 0],
                    key=lambda r: r["nilai_kalsel"], reverse=True)
    for i, r in enumerate(kalsel, 1):
        r["peringkat_kalsel"] = i
        r["top10_kalsel"] = i <= 10

    out = []
    for r in rows:
        out.append({
            "kodehs": r["kodehs"],
            "label": r["label"],
            "tahun": th,
            "nilai_nasional_usd": round(r["nilai_nasional"], 0),
            "nilai_kalsel_usd": round(r["nilai_kalsel"], 0),
            "peringkat_nasional": r["peringkat_nasional"],
            "peringkat_kalsel": r.get("peringkat_kalsel", ""),

            "top10_nasional": str(r["top10_nasional"]).lower(),
            "top10_kalsel": str(r.get("top10_kalsel", False)).lower(),
        })

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(out[0].keys()))
    w.writeheader()
    w.writerows(out)
    print(f"[ekspor] {len(out)} chapter ber-ekspor ({len(kalsel)} via pelabuhan Kalsel)",
          file=sys.stderr)

if __name__ == "__main__":
    main()
