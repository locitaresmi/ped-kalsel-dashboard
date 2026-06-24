from __future__ import annotations

import time
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://djpk.kemenkeu.go.id/portal/csv_apbd"
PROVINSI = "16"
_NS = "{urn:schemas-microsoft-com:office:spreadsheet}"
_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

PEMDA: dict[str, tuple[str, str]] = {
    "00": ("6300", "Provinsi Kalimantan Selatan"),
    "08": ("6301", "Tanah Laut"),
    "06": ("6302", "Kotabaru"),
    "01": ("6303", "Banjar"),
    "02": ("6304", "Barito Kuala"),
    "09": ("6305", "Tapin"),
    "03": ("6306", "Hulu Sungai Selatan"),
    "04": ("6307", "Hulu Sungai Tengah"),
    "05": ("6308", "Hulu Sungai Utara"),
    "07": ("6309", "Tabalong"),
    "13": ("6310", "Tanah Bumbu"),
    "12": ("6311", "Balangan"),
    "11": ("6371", "Kota Banjarmasin"),
    "10": ("6372", "Kota Banjarbaru"),
}


def _fetch(pemda: str, periode: int, tahun: int, retries: int = 4, timeout: int = 60) -> str:
    url = f"{BASE}?type=apbd&periode={periode}&tahun={tahun}&provinsi={PROVINSI}&pemda={pemda}"
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            raw = urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "replace")
            if "<Workbook" not in raw:
                raise ValueError("balasan bukan XML spreadsheet")
            return raw
        except Exception as e:
            last = e
            if i < retries - 1:
                time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"DJPK gagal pemda {pemda} {tahun}-{periode}: {last}")


def _fnum(x: str | None) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def parse_apbd(raw: str) -> dict[str, tuple[float, float]]:
    root = ET.fromstring(raw)
    out: dict[str, tuple[float, float]] = {}
    for row in root.iter(f"{_NS}Row"):
        cells = [c.text for c in row.iter(f"{_NS}Data")]
        if not cells or not cells[0] or cells[0].strip() == "Akun":
            continue
        akun = cells[0].strip()
        if akun in out:
            continue
        out[akun] = (_fnum(cells[1] if len(cells) > 1 else None),
                     _fnum(cells[2] if len(cells) > 2 else None))
    return out


def get_apbd(pemda: str, periode: int, tahun: int) -> dict[str, tuple[float, float]]:
    return parse_apbd(_fetch(pemda, periode, tahun))


def latest_periode(tahun_kandidat: list[int],
                   periode_kandidat: tuple[int, ...] = (12, 9, 6, 3)) -> tuple[int, int] | None:
    for th in tahun_kandidat:
        for pr in periode_kandidat:
            try:
                d = get_apbd("00", pr, th)
            except Exception:
                continue
            if d.get("Pendapatan Daerah", (0.0, 0.0))[0] > 0:
                return th, pr
    return None
