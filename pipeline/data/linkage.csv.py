import csv
import html
import os
import re
import sys
from html.parser import HTMLParser

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import bps

TABLE_ID = 1198

SEKTOR17 = {
    "I-01": "A", "I-02": "A", "I-03": "A", "I-04": "A", "I-05": "A", "I-06": "A", "I-07": "A",
    "I-08": "B", "I-09": "B", "I-10": "B", "I-11": "B",
    "I-12": "C", "I-13": "C", "I-14": "C", "I-15": "C", "I-16": "C", "I-17": "C", "I-18": "C",
    "I-19": "C", "I-20": "C", "I-21": "C", "I-22": "C", "I-23": "C", "I-24": "C", "I-25": "C",
    "I-26": "C", "I-27": "C",
    "I-28": "D", "I-29": "D",
    "I-30": "E",
    "I-31": "F",
    "I-32": "G", "I-33": "G",
    "I-34": "H", "I-35": "H", "I-36": "H", "I-37": "H", "I-38": "H", "I-39": "H",
    "I-40": "I", "I-41": "I",
    "I-42": "J",
    "I-43": "K", "I-44": "K", "I-45": "K", "I-46": "K",
    "I-47": "L",
    "I-48": "MN",
    "I-49": "O",
    "I-50": "P",
    "I-51": "Q",
    "I-52": "RSTU",
}

SEKTOR_NAMA = {
    "A": "Pertanian, Kehutanan, dan Perikanan", "B": "Pertambangan dan Penggalian",
    "C": "Industri Pengolahan", "D": "Pengadaan Listrik dan Gas",
    "E": "Pengadaan Air, Pengelolaan Sampah, Limbah & Daur Ulang", "F": "Konstruksi",
    "G": "Perdagangan Besar dan Eceran, serta Reparasi Mobil dan Sepeda Motor",
    "H": "Transportasi dan Pergudangan", "I": "Penyediaan Akomodasi dan Makan Minum",
    "J": "Informasi dan Komunikasi", "K": "Jasa Keuangan dan Asuransi", "L": "Real Estat",
    "MN": "Jasa Perusahaan", "O": "Administrasi Pemerintahan, Pertahanan & Jaminan Sosial",
    "P": "Jasa Pendidikan", "Q": "Jasa Kesehatan dan Kegiatan Sosial", "RSTU": "Jasa Lainnya",
}

CODE_RE = re.compile(r"^I-\d{2}$")
TOTAL_OUTPUT_COL = "3100"

class _GridParser(HTMLParser):

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._cur: list[str] | None = None
        self._buf = ""
        self._in_cell = False

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag == "tr":
            self._cur = []
        elif tag in ("td", "th"):
            self._buf = ""
            self._in_cell = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "tr" and self._cur is not None:
            self.rows.append(self._cur)
            self._cur = None
        elif tag in ("td", "th") and self._in_cell and self._cur is not None:
            self._cur.append(re.sub(r"\s+", " ", self._buf).strip())
            self._in_cell = False

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._buf += data

def _num(x: str) -> float:
    x = (x or "").replace(",", "").strip()
    if x in ("", "-"):
        return 0.0
    try:
        return float(x)
    except ValueError:
        return 0.0

def _invert(m: list[list[float]]) -> list[list[float]]:
    n = len(m)
    a = [row[:] for row in m]
    inv = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(a[r][col]))
        if abs(a[piv][col]) < 1e-12:
            raise ValueError(f"matriks singular pada kolom {col}")
        a[col], a[piv] = a[piv], a[col]
        inv[col], inv[piv] = inv[piv], inv[col]
        d = a[col][col]
        a[col] = [v / d for v in a[col]]
        inv[col] = [v / d for v in inv[col]]
        for r in range(n):
            if r != col and a[r][col]:
                f = a[r][col]
                a[r] = [a[r][k] - f * a[col][k] for k in range(n)]
                inv[r] = [inv[r][k] - f * inv[col][k] for k in range(n)]
    return inv

def main() -> None:
    data = bps.view_statictable(TABLE_ID)
    raw = html.unescape(data.get("table") or "")
    if not raw:
        print("[linkage] tabel I-O kosong dari WebAPI", file=sys.stderr)
        sys.exit(1)
    m = re.search(r"\b(20\d{2})\b", data.get("title") or "")
    tahun = int(m.group(1)) if m else 2016

    p = _GridParser()
    p.feed(raw)

    rowmap: dict[str, list[str]] = {}
    for r in p.rows:
        if len(r) > 2 and CODE_RE.match(r[1].strip()) and not CODE_RE.match(r[0].strip()):
            rowmap.setdefault(r[1].strip(), r)
    codes = [f"I-{i:02d}" for i in range(1, 53)]
    missing = [c for c in codes if c not in rowmap]
    if missing:
        print(f"[linkage] baris industri hilang: {missing}", file=sys.stderr)
        sys.exit(1)

    out_col = None
    for r in p.rows:
        if sum(1 for c in r if CODE_RE.match(c.strip())) > 40 and TOTAL_OUTPUT_COL in r:
            out_col = r.index(TOTAL_OUTPUT_COL) + 2
            break
    n = 52
    desc = {c: rowmap[c][0] for c in codes}
    Z = [[_num(rowmap[codes[i]][2 + j]) for j in range(n)] for i in range(n)]
    if out_col is not None:
        X = [_num(rowmap[codes[i]][out_col]) for i in range(n)]
    else:
        X = [_num(rowmap[codes[i]][-1]) for i in range(n)]

    A = [[(Z[i][j] / X[j] if X[j] else 0.0) for j in range(n)] for i in range(n)]
    leontief_minus = [[(1.0 if i == j else 0.0) - A[i][j] for j in range(n)] for i in range(n)]
    L = _invert(leontief_minus)

    bl_raw = [sum(L[i][j] for i in range(n)) for j in range(n)]
    fl_raw = [sum(L[i][j] for j in range(n)) for i in range(n)]
    avg = sum(bl_raw) / n
    if avg <= 0:
        print("[linkage] rata-rata Leontief non-positif", file=sys.stderr)
        sys.exit(1)
    BL = [v / avg for v in bl_raw]
    FL = [v / avg for v in fl_raw]

    def kuadran(bl: float, fl: float) -> int:
        if bl > 1 and fl > 1:
            return 1
        if bl > 1:
            return 2
        if fl > 1:
            return 3
        return 4

    rows = []
    for i, code in enumerate(codes):
        s17 = SEKTOR17.get(code, "")
        rows.append({
            "kode": code,
            "industri": desc[code],
            "sektor_kode": s17,
            "sektor": SEKTOR_NAMA.get(s17, ""),
            "bl": round(BL[i], 4),
            "fl": round(FL[i], 4),
            "kuadran": kuadran(BL[i], FL[i]),
            "tahun": tahun,
        })

    sys.stdout.reconfigure(newline="")
    w = csv.DictWriter(sys.stdout, fieldnames=["kode", "industri", "sektor_kode", "sektor",
                                               "bl", "fl", "kuadran", "tahun"])
    w.writeheader()
    w.writerows(rows)
    dist = {q: sum(1 for r in rows if r["kuadran"] == q) for q in (1, 2, 3, 4)}
    print(f"[linkage] {len(rows)} industri, tahun {tahun}, kuadran {dist}", file=sys.stderr)

if __name__ == "__main__":
    main()
