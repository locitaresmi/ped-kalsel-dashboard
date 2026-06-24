import csv
import datetime
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import djpk


def _periode_berdata(tahun: int) -> int | None:
    for pr in (12, 9, 6, 3):
        try:
            d = djpk.get_apbd("00", pr, tahun)
        except Exception:
            continue
        if d.get("Pendapatan Daerah", (0.0, 0.0))[0] > 0:
            return pr
    return None


def main() -> None:
    only = os.environ.get("APBD_TAHUN")
    now = datetime.date.today().year
    years = [int(only)] if only else list(range(now, 2019, -1))

    rows = []
    for tahun in years:
        periode = _periode_berdata(tahun)
        if periode is None:
            continue
        n0 = len(rows)
        for pemda, (wid, nama) in djpk.PEMDA.items():
            try:
                d = djpk.get_apbd(pemda, periode, tahun)
            except Exception as e:
                print(f"[apbd] {nama} {tahun} gagal: {e}", file=sys.stderr)
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
        print(f"[apbd] {tahun} periode {periode}: {len(rows) - n0} wilayah", file=sys.stderr)

    if not rows:
        print("[apbd] kosong", file=sys.stderr)
        sys.exit(1)

    rows.sort(key=lambda r: (-r["tahun"], r["wilayah_id"]))
    sys.stdout.reconfigure(newline="")
    cols = ["wilayah_id", "wilayah", "tahun", "periode", "pendapatan", "pendapatan_real",
            "pad", "pad_real", "tkd", "tkd_real", "belanja", "belanja_real", "rasio_tkd", "rasio_pad"]
    w = csv.DictWriter(sys.stdout, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)
    th = sorted({r["tahun"] for r in rows})
    print(f"[apbd] {len(rows)} baris, tahun {th[0]}-{th[-1]}, {len(djpk.PEMDA)} wilayah", file=sys.stderr)


if __name__ == "__main__":
    main()
