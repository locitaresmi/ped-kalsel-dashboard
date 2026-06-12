import csv
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

TAHUN = range(2020, 2025)

NAMA_KE_ID = {
    "TANAH LAUT": "6301", "KOTABARU": "6302", "BANJAR": "6303",
    "BARITO KUALA": "6304", "TAPIN": "6305", "HULU SUNGAI SELATAN": "6306",
    "HULU SUNGAI TENGAH": "6307", "HULU SUNGAI UTARA": "6308", "TABALONG": "6309",
    "TANAH BUMBU": "6310", "BALANGAN": "6311", "BANJARMASIN": "6371",
    "BANJARBARU": "6372",
}
NAMA_TAMPIL = {
    "6301": "Tanah Laut", "6302": "Kotabaru", "6303": "Banjar",
    "6304": "Barito Kuala", "6305": "Tapin", "6306": "Hulu Sungai Selatan",
    "6307": "Hulu Sungai Tengah", "6308": "Hulu Sungai Utara", "6309": "Tabalong",
    "6310": "Tanah Bumbu", "6311": "Balangan", "6371": "Kota Banjarmasin",
    "6372": "Kota Banjarbaru",
}

def normalisasi(label: str) -> str:
    s = re.sub(r"\s+", " ", (label or "").upper()).strip()
    s = re.sub(r"^KOTA\s+", "", s)
    return s

def main() -> None:
    rows = []
    for th in TAHUN:
        try:
            data = bps.ambil_padi(th)
        except Exception as e:
            print(f"[produksi] padi {th} gagal: {e}", file=sys.stderr)
            continue
        for label, nilai in data.items():
            wid = NAMA_KE_ID.get(normalisasi(label))
            if not wid:
                continue
            produksi = nilai.get("produksi")
            luas = nilai.get("luas")
            if produksi is None:
                continue
            rows.append({
                "tahun": th,
                "wilayah_id": wid,
                "wilayah": NAMA_TAMPIL[wid],
                "komoditas": "Padi",
                "subsektor_kode": "A",
                "luas_panen_ha": round(luas, 1) if luas is not None else "",
                "produksi_ton": round(produksi, 1),
            })

    if not rows:
        print("[produksi] TIDAK ada data tertarik dari BPS", file=sys.stderr)
        sys.exit(1)

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    n_th = len({r["tahun"] for r in rows})
    print(f"[produksi] {len(rows)} baris padi ({n_th} tahun, "
          f"{len({r['wilayah_id'] for r in rows})} kab/kota)", file=sys.stderr)

if __name__ == "__main__":
    main()
