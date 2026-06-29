import csv
import io

SANITY = {
    "pdrb": ("pdrb_prov", 0.5),
    "pdrb_provinsi": ("share_pdrb_pct", 0.5),
    "kredit_bu": ("nilai", 0.5),
    "apbd": ("pendapatan", 0.5),
}


def _parse(text):
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return [], []
    return rows[0], [r for r in rows[1:] if r]


def _kolom_sum(header, baris, col):
    if col not in header:
        return None
    i = header.index(col)
    total = 0.0
    ada = False
    for r in baris:
        if i < len(r):
            try:
                total += float(r[i])
                ada = True
            except (ValueError, TypeError):
                pass
    return total if ada else None


def validate(stem, teks_baru, teks_lama):
    header_baru, baris_baru = _parse(teks_baru)
    if not header_baru or not baris_baru:
        return ("kosong", "keluaran tanpa baris data", 0)
    n = len(baris_baru)

    if teks_lama:
        header_lama, baris_lama = _parse(teks_lama)
        if header_lama and header_baru != header_lama:
            hilang = [c for c in header_lama if c not in header_baru]
            tambah = [c for c in header_baru if c not in header_lama]
            sebab = "struktur kolom berubah"
            if hilang:
                sebab += f", kolom hilang {hilang}"
            if tambah:
                sebab += f", kolom baru {tambah}"
            return ("skema_berubah", sebab, n)
        if baris_lama:
            m = len(baris_lama)
            if n < m * 0.5 or n > m * 2:
                return ("jumlah_baris_aneh", f"jumlah baris {m} menjadi {n}", n)
            col_tol = SANITY.get(stem)
            if col_tol:
                col, tol = col_tol
                s_baru = _kolom_sum(header_baru, baris_baru, col)
                s_lama = _kolom_sum(header_lama, baris_lama, col)
                if s_lama and s_baru is not None and s_lama != 0:
                    delta = abs(s_baru - s_lama) / abs(s_lama)
                    if delta > tol:
                        return ("nilai_mencurigakan", f"total {col} berubah {delta:.0%}", n)
    return ("ok", None, n)
