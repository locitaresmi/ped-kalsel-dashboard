import csv
import datetime
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

TAHUN = range(2020, datetime.date.today().year + 1)
NASIONAL = ("0000", 65)

WILAYAH = {
    "6301": "Tanah Laut", "6302": "Kotabaru", "6303": "Banjar",
    "6304": "Barito Kuala", "6305": "Tapin", "6306": "Hulu Sungai Selatan",
    "6307": "Hulu Sungai Tengah", "6308": "Hulu Sungai Utara", "6309": "Tabalong",
    "6310": "Tanah Bumbu", "6311": "Balangan", "6371": "Kota Banjarmasin",
    "6372": "Kota Banjarbaru",
}

def main() -> None:

    nas: dict[int, dict[str, float]] = {}
    for th in TAHUN:
        try:
            nas[th] = bps.ambil_pdrb_sektor(*NASIONAL, th)
        except Exception as e:
            print(f"[wilayah] nasional {th} gagal: {e}", file=sys.stderr)

    rows = []
    for wid, wnama in WILAYAH.items():
        try:
            var = bps.pilih_var_pdrb(wid)
        except Exception as e:
            print(f"[wilayah] {wid} {wnama}: discovery gagal: {e}", file=sys.stderr)
            continue
        if not var:
            print(f"[wilayah] {wid} {wnama}: tak ada tabel PDRB 17-sektor, dilewati",
                  file=sys.stderr)
            continue
        print(f"[wilayah] {wid} {wnama}: var {var['var_id']} ({var['n_sektor']} sektor)",
              file=sys.stderr)
        for th in TAHUN:
            nas_th = nas.get(th)
            if not nas_th:
                continue
            try:
                wil = bps.ambil_pdrb_sektor(wid, var["var_id"], th, title=var["title"])
            except Exception as e:
                print(f"[wilayah] {wid} {th} gagal: {e}", file=sys.stderr)
                continue
            if not wil:
                continue
            tot_wil = sum(wil.values())
            tot_nas = sum(nas_th.values())
            for kode, nilai in wil.items():
                nilai_nas = nas_th.get(kode)
                if not nilai_nas or not tot_wil or not tot_nas:
                    continue
                share_wil = nilai / tot_wil
                share_nas = nilai_nas / tot_nas
                lq = share_wil / share_nas if share_nas else None
                rows.append({
                    "tahun": th,
                    "wilayah_id": wid,
                    "wilayah": wnama,
                    "sektor_kode": kode,
                    "sektor": bps.SEKTOR_NAMA.get(kode, kode),
                    "pdrb_wil": round(nilai, 2),
                    "share_wil": round(share_wil, 6),
                    "share_nas": round(share_nas, 6),
                    "lq": round(lq, 4) if lq is not None else "",
                })

    if not rows:
        print("[wilayah] TIDAK ada data tertarik dari BPS", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    n_wil = len({r["wilayah_id"] for r in rows})
    print(f"[wilayah] {len(rows)} baris, {n_wil} kab/kota", file=sys.stderr)

if __name__ == "__main__":
    main()
