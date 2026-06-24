import csv
import datetime
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import djpk

def main() -> None:
    now = datetime.date.today().year
    lp = os.environ.get("APBD_PERIODE")
    if lp:
        tahun, periode = (int(x) for x in lp.split("-"))
    else:
        found = djpk.latest_periode([now, now - 1])
        if not found:
            print("[apbd] tak menemukan periode berdata", file=sys.stderr)
            sys.exit(1)
        tahun, periode = found
    print(f"[apbd] periode {tahun}-{periode}", file=sys.stderr)

    rows = []
    for pemda, (wid, nama) in djpk.PEMDA.items():
        try:
            d = djpk.get_apbd(pemda, periode, tahun)
        except Exception as e:
            print(f"[apbd] {nama} gagal: {e}", file=sys.stderr)
            continue
        pend = d.get("Pendapatan Daerah", (0.0, 0.0))
        pad = d.get("PAD", (0.0, 0.0))
        tkd = d.get("TKDD", (0.0, 0.0))
        belanja = d.get("Belanja Daerah", (0.0, 0.0))
        if pend[0] <= 0:
            continue
        rows.append({
            "wilayah_id": wid, "wilayah": nama, "tahun": tahun, "periode": periode,
            "pendapatan": round(pend[0]), "pendapatan_real": round(pend[1]),
            "pad": round(pad[0]), "pad_real": round(pad[1]),
            "tkd": round(tkd[0]), "tkd_real": round(tkd[1]),
            "belanja": round(belanja[0]), "belanja_real": round(belanja[1]),
            "rasio_tkd": round(tkd[0] / pend[0], 4),
            "rasio_pad": round(pad[0] / pend[0], 4),
        })

    if not rows:
        print("[apbd] kosong", file=sys.stderr)
        sys.exit(1)

    rows.sort(key=lambda r: r["wilayah_id"])
    sys.stdout.reconfigure(newline="")
    cols = ["wilayah_id", "wilayah", "tahun", "periode", "pendapatan", "pendapatan_real",
            "pad", "pad_real", "tkd", "tkd_real", "belanja", "belanja_real", "rasio_tkd", "rasio_pad"]
    w = csv.DictWriter(sys.stdout, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)
    kal = next((r for r in rows if r["wilayah_id"] == "6300"), None)
    if kal:
        print(f"[apbd] {len(rows)} wilayah; Kalsel ketergantungan TKD {kal['rasio_tkd']*100:.1f}% "
              f"PAD {kal['rasio_pad']*100:.1f}%", file=sys.stderr)


if __name__ == "__main__":
    main()
