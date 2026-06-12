from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request

BASE = "https://data.ojk.go.id/SJKPublic/Dataset/Dataset/GetGridCSVData"
KALSEL = "Kalimantan Selatan"
KALSEL_BPR = "PROVINSI KALIMANTAN SELATAN"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://data.ojk.go.id/SJKPublic",
}

def _build_url(table: str, metric: int | str, *, field: str, values: list[str],
               skip: int = 0, take: int = 70000) -> str:
    raw_filter = "?".join(f"{field}\\=\\{v}" for v in values)
    q = {
        "skip": skip, "take": take, "requireTotalCount": "true",
        "_filter": raw_filter,
        "_field": ",".join([field] * len(values)),
        "_data": ",".join(values),
        "namaTable": table, "metricID": metric,
    }
    return f"{BASE}?{urllib.parse.urlencode(q)}"

def get_grid(table: str, metric: int | str, *, field: str = "Bulan",
             values: list[str], take: int = 70000, skip: int = 0, retries: int = 5,
             timeout: int = 120) -> tuple[list[dict], int]:
    url = _build_url(table, metric, field=field, values=values, skip=skip, take=take)
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                txt = r.read().decode("utf-8", "replace")
            if not txt.lstrip().startswith("{"):
                raise ValueError("balasan non-JSON (kemungkinan tantangan WAF)")
            d = json.loads(txt)
            return d.get("data") or [], int(d.get("totalCount") or 0)
        except Exception as e:
            last = e
            if i < retries - 1:
                time.sleep(2.0 * (i + 1))
    raise RuntimeError(f"OJK get_grid gagal {table}/{metric}: {last}")

def get_grid_paged(table: str, metric: int | str, *, field: str = "Bulan",
                   values: list[str], page: int = 50000, cap: int = 400000) -> list[dict]:
    out: list[dict] = []
    skip = 0
    while skip < cap:
        rows, total = get_grid(table, metric, field=field, values=values, take=page, skip=skip)
        out.extend(rows)
        if len(out) >= total or len(rows) < page:
            break
        skip += page
    return out

def latest_month(table: str, metric: int | str,
                 candidates: list[str], *, take: int = 1) -> str | None:
    for bln in candidates:
        try:
            rows, total = get_grid(table, metric, field="Bulan", values=[bln], take=take)
        except Exception:
            continue
        if total > 0 or rows:
            return bln
    return None

def bulan_kandidat(n: int = 8) -> list[str]:
    import datetime as dt
    now = dt.date.today()
    out = []
    y, m = now.year, now.month
    for _ in range(n):
        out.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return out

_SEKTOR_KW: list[tuple[str, str]] = [
    ("rumah tangga", "RT"), ("bukan lapangan usaha", "RT"), ("konsumsi", "RT"),

    ("administrasi pemerintahan", "O"), ("pemerintahan", "O"), ("pertahanan", "O"),
    ("profesional", "MN"), ("ilmiah", "MN"), ("jasa perusahaan", "MN"),
    ("penyewaan", "MN"), ("ketenagakerjaan", "MN"),
    ("jasa pendidikan", "P"), ("pendidikan", "P"),
    ("kesehatan", "Q"), ("kegiatan sosial", "Q"), ("aktivitas sosial", "Q"),
    ("kesenian", "RSTU"), ("hiburan", "RSTU"), ("rekreasi", "RSTU"),
    ("jasa lainnya", "RSTU"), ("badan internasional", "RSTU"),
    ("ekstra internasional", "RSTU"), ("jasa perorangan", "RSTU"),
    ("real estat", "L"),
    ("keuangan dan asuransi", "K"), ("perantara keuangan", "K"), ("asuransi", "K"),
    ("informasi dan komunikasi", "J"), ("informasi", "J"),
    ("akomodasi", "I"), ("makan minum", "I"), ("penyediaan makan", "I"),
    ("transportasi", "H"), ("pengangkutan", "H"), ("pergudangan", "H"),
    ("perdagangan", "G"), ("reparasi", "G"),
    ("konstruksi", "F"),
    ("pengelolaan air", "E"), ("pengadaan air", "E"), ("sampah", "E"),
    ("limbah", "E"), ("daur ulang", "E"),
    ("pengadaan listrik", "D"), ("listrik, gas", "D"), ("listrik dan gas", "D"),
    ("industri pengolahan", "C"), ("industri", "C"),
    ("pertambangan", "B"), ("penggalian", "B"),
    ("pertanian", "A"), ("kehutanan", "A"), ("perikanan", "A"), ("perkebunan", "A"),
]

def bersih_provinsi(s: str | None) -> str:
    s = (s or "").strip()
    s = re.sub(r"^PROVINSI\s+", "", s, flags=re.I)
    if s.isupper() or s.islower():
        s = s.title()
    s = re.sub(r"\bDki\b", "DKI", s)
    s = re.sub(r"\bDi\b", "DI", s)
    return s

def kode_sektor(label: str | None) -> str | None:
    if not label:
        return None
    s = label.lower()
    for kw, kode in _SEKTOR_KW:
        if kw in s:
            return kode
    return None
