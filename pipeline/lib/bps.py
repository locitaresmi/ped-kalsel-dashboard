from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
from itertools import product

BASE = "https://webapi.bps.go.id/v1/api"

def _load_dotenv() -> None:
    if os.environ.get("BPS_API_KEY"):
        return
    here = os.path.abspath(os.getcwd())
    for _ in range(6):
        env_path = os.path.join(here, ".env")
        if os.path.isfile(env_path):
            try:
                with open(env_path, encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, val = line.split("=", 1)
                        os.environ.setdefault(key.strip(), val.strip())
            except OSError:
                pass
            return
        parent = os.path.dirname(here)
        if parent == here:
            break
        here = parent

def _key() -> str:
    k = os.environ.get("BPS_API_KEY", "").strip()
    if not k:
        _load_dotenv()
        k = os.environ.get("BPS_API_KEY", "").strip()
    if not k:
        raise RuntimeError("BPS_API_KEY tidak diset di environment / .env")
    return k

def th_id(tahun: int) -> int:
    return tahun - 1900

def _get(path: str, *, retries: int = 4, backoff: float = 1.5, timeout: int = 60) -> dict:
    url = f"{BASE}/{path}"
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ped-kalsel-dashboard"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                payload = json.loads(r.read().decode("utf-8"))
            status = str(payload.get("status", "")).lower()
            if status and status != "ok":

                raise RuntimeError(f"BPS status={payload.get('status')} untuk {path}")
            return payload
        except Exception as e:
            last = e
            if i < retries - 1:
                time.sleep(backoff * (2 ** i))
    raise RuntimeError(f"Gagal GET {path}: {last}")

def list_var(domain: str, *, subject: str | int | None = None, lang: str = "ind") -> list[dict]:
    key = _key()
    sub = f"subject/{subject}/" if subject is not None else ""
    out: list[dict] = []
    page = 1
    while True:
        path = (f"list/model/var/lang/{lang}/domain/{domain}/{sub}key/{key}/"
                f"?page={page}")
        payload = _get(path)
        data = payload.get("data")
        if not data or len(data) < 2 or not data[1]:
            break
        meta, rows = data[0], data[1]
        out.extend(rows)
        pages = int(meta.get("pages", page))
        if page >= pages:
            break
        page += 1
    return out

def list_subject(domain: str, *, lang: str = "ind") -> list[dict]:
    key = _key()
    out: list[dict] = []
    page = 1
    while True:
        path = f"list/model/subject/lang/{lang}/domain/{domain}/key/{key}/?page={page}"
        payload = _get(path)
        data = payload.get("data")
        if not data or len(data) < 2 or not data[1]:
            break
        meta, rows = data[0], data[1]
        out.extend(rows)
        if page >= int(meta.get("pages", page)):
            break
        page += 1
    return out

def cari_var(domain: str, *, subject: str | int | None = None,
             judul_ada: tuple[str, ...] = (), judul_tdk: tuple[str, ...] = ()) -> list[dict]:
    ada = [k.lower() for k in judul_ada]
    tdk = [k.lower() for k in judul_tdk]
    out = []
    for v in list_var(domain, subject=subject):
        t = (v.get("title") or "").lower()
        if all(k in t for k in ada) and not any(k in t for k in tdk):
            out.append({"var_id": v.get("var_id"), "title": v.get("title")})
    return out

def pilih_var(domain: str, *, subject: str | int | None = None,
              judul_ada: tuple[str, ...] = (), judul_tdk: tuple[str, ...] = (),
              probe: tuple[int, ...] = (2025, 2024, 2023, 2022, 2021, 2020),
              vervar_ada: tuple[str, ...] = ()) -> dict | None:
    want = [k.lower() for k in vervar_ada]
    best = None
    for c in cari_var(domain, subject=subject, judul_ada=judul_ada, judul_tdk=judul_tdk):
        for y in probe:
            try:
                resp = data_table(domain, c["var_id"], y)
            except Exception:
                continue
            recs = parse_datacontent(resp)
            if not recs:
                continue
            if want:
                vlabels = " ".join(_clean_label(l).lower() for _, l in _label_map(resp.get("vervar")))
                if not all(k in vlabels for k in want):
                    break
            if best is None or y > best["tahun"]:
                best = {"var_id": c["var_id"], "title": c["title"], "tahun": y}
            break
    return best

def data_table(domain: str, var: int | str, tahun: list[int] | int, *,
               lang: str = "ind") -> dict:
    key = _key()
    if isinstance(tahun, int):
        tahun = [tahun]
    if len(tahun) > 2:
        raise ValueError("Maks 2 tahun per panggilan data_table")
    th = ";".join(str(th_id(t)) for t in tahun)
    path = (f"list/model/data/lang/{lang}/domain/{domain}/var/{var}/"
            f"th/{th}/key/{key}/")
    return _get(path)

def _label_map(items: list[dict]) -> list[tuple[str, str]]:
    return [(str(it["val"]), str(it.get("label", ""))) for it in (items or [])]

def parse_datacontent(resp: dict) -> list[dict]:
    dc = resp.get("datacontent") or {}
    vervar = _label_map(resp.get("vervar"))
    var = _label_map(resp.get("var"))
    turvar = _label_map(resp.get("turvar"))
    tahun = _label_map(resp.get("tahun"))
    turtahun = _label_map(resp.get("turtahun"))

    records: list[dict] = []
    for (vv, vvl), (vr, vrl), (tv, tvl), (th, thl), (tt, ttl) in product(
            vervar, var, turvar, tahun, turtahun):
        kunci = f"{vv}{vr}{tv}{th}{tt}"
        if kunci in dc:
            records.append({
                "vervar_id": vv, "vervar": vvl,
                "var_id": vr, "var": vrl,
                "turvar_id": tv, "turvar": tvl,
                "tahun_id": th, "tahun": thl,
                "turtahun_id": tt, "turtahun": ttl,
                "nilai": dc[kunci],
            })
    return records

SEKTOR_KEYWORD: list[tuple[str, str]] = [
    ("jasa perusahaan", "MN"),
    ("jasa pendidikan", "P"),
    ("pendidikan", "P"),
    ("kesehatan", "Q"),
    ("jasa lainnya", "RSTU"),
    ("administrasi pemerintahan", "O"),
    ("real estat", "L"),
    ("jasa keuangan", "K"),
    ("keuangan dan asuransi", "K"),
    ("informasi dan komunikasi", "J"),
    ("informasi", "J"),
    ("akomodasi", "I"),
    ("transportasi", "H"),
    ("perdagangan", "G"),
    ("konstruksi", "F"),
    ("pengadaan air", "E"),
    ("sampah", "E"),
    ("pengadaan listrik", "D"),
    ("listrik dan gas", "D"),
    ("industri pengolahan", "C"),
    ("industri", "C"),
    ("pertambangan", "B"),
    ("penggalian", "B"),
    ("pertanian", "A"),
    ("kehutanan", "A"),
    ("perikanan", "A"),
]

def _clean_label(label: str) -> str:
    s = re.sub(r"<[^>]+>", "", label or "")
    return s.strip()

_KODE_KATEGORI_RE = re.compile(r"^[A-Z](\s*,\s*[A-Z])*\.\s")

SEKTOR_NAMA: dict[str, str] = {
    "A": "Pertanian, Kehutanan, dan Perikanan",
    "B": "Pertambangan dan Penggalian",
    "C": "Industri Pengolahan",
    "D": "Pengadaan Listrik dan Gas",
    "E": "Pengadaan Air, Pengelolaan Sampah, Limbah & Daur Ulang",
    "F": "Konstruksi",
    "G": "Perdagangan Besar & Eceran; Reparasi Mobil & Sepeda Motor",
    "H": "Transportasi dan Pergudangan",
    "I": "Penyediaan Akomodasi dan Makan Minum",
    "J": "Informasi dan Komunikasi",
    "K": "Jasa Keuangan dan Asuransi",
    "L": "Real Estat",
    "MN": "Jasa Perusahaan",
    "O": "Administrasi Pemerintahan, Pertahanan & Jaminan Sosial",
    "P": "Jasa Pendidikan",
    "Q": "Jasa Kesehatan dan Kegiatan Sosial",
    "RSTU": "Jasa Lainnya",
}

def kode_sektor(label: str) -> str | None:
    s = _clean_label(label).lower()
    if "produk domestik regional bruto" in s or s in {"", "jumlah", "total"}:
        return None
    for kw, kode in SEKTOR_KEYWORD:
        if kw in s:
            return kode
    return None

def is_kategori_row(label: str) -> bool:
    return bool(_KODE_KATEGORI_RE.match(_clean_label(label)))

def baris_sektor(resp: dict) -> list[tuple[str, str, str]]:
    vervar = _label_map(resp.get("vervar"))
    coded = [(vid, kode_sektor(lbl), _clean_label(lbl))
             for vid, lbl in vervar if is_kategori_row(lbl)]
    coded = [(vid, k, lbl) for vid, k, lbl in coded if k]
    if len({k for _, k, _ in coded}) >= 15:
        return coded

    seen: set[str] = set()
    out: list[tuple[str, str, str]] = []
    for vid, lbl in vervar:
        k = kode_sektor(lbl)
        if k and k not in seen:
            seen.add(k)
            out.append((vid, k, _clean_label(lbl)))
    return out

_JUDUL_TOLAK = ("pengeluaran", "distribusi", "laju", "indeks", "triwulan",
                "seri 2000", "kabupaten/kota", "seluruh", "implisit")

def _is_pdrb_lapangan_usaha(title: str) -> bool:
    t = (title or "").lower()
    if "pdrb" not in t and "produk domestik" not in t and "pdb" not in t:
        return False
    if any(w in t for w in _JUDUL_TOLAK):
        return False

    return ("lapangan usaha" in t or "konstan" in t or "berlaku" in t
            or "menurut lapangan" in t or "adh" in t)

def kandidat_var_pdrb(domain: str) -> list[dict]:
    out = []
    for v in list_var(domain):
        title = v.get("title", "")
        if _is_pdrb_lapangan_usaha(title):
            out.append({"var_id": v.get("var_id"), "title": title})
    out.sort(key=lambda c: (0 if "lapangan usaha" in c["title"].lower() else 1,
                            c["var_id"]))
    return out

def pilih_var_pdrb(domain: str, *, probe_years: tuple[int, ...] = (2024, 2023, 2022),
                   minimal: int = 15, harga: str = "ADHK") -> dict | None:
    best = None
    for c in kandidat_var_pdrb(domain):
        for py in probe_years:
            try:
                d = ambil_pdrb_sektor(domain, c["var_id"], py,
                                      harga=harga, title=c["title"])
            except Exception:
                continue
            if len(d) >= minimal:
                key = (py, len(d))
                if best is None or key > best["_key"]:
                    best = {"var_id": c["var_id"], "title": c["title"],
                            "n_sektor": len(d), "tahun_terbaru": py, "_key": key}
                break
        if best and best["tahun_terbaru"] == probe_years[0] and best["n_sektor"] >= 17:
            break
    if best:
        best.pop("_key", None)
    return best

def validasi_sektor(resp: dict, *, minimal: int = 17) -> int:
    kode = {kode_sektor(vl) for _, vl in _label_map(resp.get("vervar"))}
    kode.discard(None)
    return len(kode)

def _turtahun_tahunan(resp: dict) -> set[str]:
    out = set()
    for tid, lbl in _label_map(resp.get("turtahun")):
        l = lbl.lower()
        if "triwulan" not in l and ("tahun" in l or l in {"", "tahunan"}):
            out.add(tid)
    return out

def _extract_sektor(resp: dict, tahun: int, harga: str, title: str = "") -> dict[str, float]:
    sektor_vid = {vid: kode for vid, kode, _ in baris_sektor(resp)}
    turtahun_ok = _turtahun_tahunan(resp)
    th = str(th_id(tahun))
    want_konstan = harga.upper() == "ADHK"

    turvar_items = _label_map(resp.get("turvar"))
    konstan_ids = {tid for tid, l in turvar_items if "konstan" in l.lower()}
    berlaku_ids = {tid for tid, l in turvar_items if "berlaku" in l.lower()}
    if konstan_ids or berlaku_ids:
        turvar_ok = konstan_ids if want_konstan else berlaku_ids
        if not turvar_ok:
            return {}
    else:
        t = (title or "").lower()
        if want_konstan and "berlaku" in t and "konstan" not in t:
            return {}
        if not want_konstan and "konstan" in t and "berlaku" not in t:
            return {}
        turvar_ok = None

    out: dict[str, float] = {}
    for r in parse_datacontent(resp):
        if r["vervar_id"] not in sektor_vid:
            continue
        if turvar_ok is not None and r["turvar_id"] not in turvar_ok:
            continue
        if turtahun_ok and r["turtahun_id"] not in turtahun_ok:
            continue
        if r["tahun_id"] != th:
            continue
        try:
            out[sektor_vid[r["vervar_id"]]] = float(r["nilai"])
        except (TypeError, ValueError):
            continue
    return out

def ambil_pdrb_sektor(domain: str, var: int | str, tahun: int, *,
                      harga: str = "ADHK", title: str = "") -> dict[str, float]:
    return _extract_sektor(data_table(domain, var, tahun), tahun, harga, title)

KALSEL_POD = (
    "BANJARMASIN", "TRISAKTI", "SATUI", "BATULICIN", "KOTABARU", "MEKAR PUTIH",
    "BUNATI", "SUNGAI DANAU", "PAGATAN", "PELAIHARI", "TANJUNG PEMANCINGAN",
    "STAGEN", "TARJUN", "PULAU LAUT",
)

def dataexim(kodehs: str | int, tahun: int, *, sumber: int = 1, jenishs: int = 1,
             periode: int = 1) -> dict:
    key = _key()
    path = (f"dataexim/sumber/{sumber}/kodehs/{kodehs}/jenishs/{jenishs}/"
            f"tahun/{tahun}/periode/{periode}/key/{key}")
    return _get(path)

def ekspor_chapter(kodehs: str, tahun: int) -> dict | None:
    try:
        d = dataexim(kodehs, tahun)
    except Exception:
        return None
    rows = d.get("data") or []
    if not rows:
        return None
    total = 0.0
    kalsel = 0.0
    bulan = set()
    for r in rows:
        v = r.get("value") or 0
        total += v
        bulan.add(r.get("bulan"))
        if any(p in (r.get("pod") or "").upper() for p in KALSEL_POD):
            kalsel += v
    return {
        "kodehs": str(kodehs).zfill(2),
        "label": rows[0].get("kodehs", f"[{kodehs}]"),
        "nilai_nasional": total,
        "nilai_kalsel": kalsel,
        "n_bulan": len(bulan),
    }

def view_statictable(table_id: int | str, *, domain: str = "6300", lang: str = "ind") -> dict:
    key = _key()
    path = f"view/domain/{domain}/model/statictable/lang/{lang}/id/{table_id}/key/{key}"
    payload = _get(path)
    return payload.get("data") or {}

def ambil_padi(tahun: int, *, domain: str = "6300", var: int = 344) -> dict[str, dict]:
    resp = data_table(domain, var, tahun)
    th = str(th_id(tahun))
    out: dict[str, dict] = {}
    for r in parse_datacontent(resp):
        if r["tahun_id"] != th:
            continue
        lbl = _clean_label(r["vervar"])
        t = r["turvar"].lower()
        try:
            nilai = float(r["nilai"])
        except (TypeError, ValueError):
            continue
        d = out.setdefault(lbl, {})
        if "luas" in t:
            d["luas"] = nilai
        elif "produksi" in t:
            d["produksi"] = nilai
    return out

if __name__ == "__main__":

    import sys
    dom = sys.argv[1] if len(sys.argv) > 1 else "6300"
    for c in kandidat_var_pdrb(dom):
        print(f"{c['var_id']}\t{c['title']}")
