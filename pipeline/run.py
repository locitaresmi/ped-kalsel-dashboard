import datetime as _dt
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate as _v

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "pipeline", "data")
INPUTS_DIR = os.path.join(ROOT, "pipeline", "inputs")
OUT_DIR = os.path.join(ROOT, "public", "data")

STATIC_INPUTS = ["tier_b.csv", "inisiatif.csv", "usulan_ai.json", "ai_status.json"]
GEOJSON_SRC = os.path.join(ROOT, "kalsel.geojson")
STATUS_OUT = os.path.join(OUT_DIR, "data_status.json")


def _baca(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return None


def _status_lama():
    teks = _baca(STATUS_OUT)
    if not teks:
        return {}
    try:
        return (json.loads(teks) or {}).get("sources", {})
    except json.JSONDecodeError:
        return {}


def proses_loader(path, out_path, stem, prev):
    nama = os.path.basename(path)
    now = _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")
    prev_last_ok = (prev.get(stem) or {}).get("last_ok")
    ada_lama = os.path.exists(out_path)

    def fallback(sebab):
        keadaan = "stale" if ada_lama else "unavailable"
        ekor = "pertahankan data lama" if ada_lama else "tidak ada data lama"
        print(f"[run] {nama}: {sebab} -> {ekor}", file=sys.stderr)
        return {"status": keadaan, "rows": None, "last_ok": prev_last_ok, "reason": sebab}

    try:
        hasil = subprocess.run(
            [sys.executable, path],
            capture_output=True, text=True, env=os.environ, timeout=900,
        )
    except Exception as e:
        return fallback(f"loader gagal dijalankan: {e}")
    if hasil.returncode != 0 or not hasil.stdout.strip():
        pesan = (hasil.stderr or "").strip().splitlines()
        return fallback(pesan[-1] if pesan else "loader tanpa keluaran")

    status, sebab, rows = _v.validate(stem, hasil.stdout, _baca(out_path))
    if status != "ok":
        return fallback(sebab or status)

    with open(out_path, "w", encoding="utf-8", newline="") as fh:
        fh.write(hasil.stdout)
    if hasil.stderr.strip():
        print(f"[run] {nama}: {hasil.stderr.strip().splitlines()[-1]}", file=sys.stderr)
    return {"status": "ok", "rows": rows, "last_ok": now, "reason": None}


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    prev = _status_lama()

    loaders = sorted(f for f in os.listdir(DATA_DIR) if f.endswith(".csv.py"))
    sources = {}
    ok = 0
    for f in loaders:
        stem = f[:-len(".csv.py")]
        st = proses_loader(os.path.join(DATA_DIR, f), os.path.join(OUT_DIR, stem + ".csv"), stem, prev)
        sources[stem] = st
        if st["status"] == "ok":
            ok += 1

    for nama in STATIC_INPUTS:
        src = os.path.join(INPUTS_DIR, nama)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(OUT_DIR, nama))
    if os.path.exists(GEOJSON_SRC):
        shutil.copy2(GEOJSON_SRC, os.path.join(OUT_DIR, "kalsel.geojson"))

    now = _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")
    with open(STATUS_OUT, "w", encoding="utf-8") as fh:
        json.dump({"checked_at": now, "sources": sources}, fh, ensure_ascii=False, indent=2)

    bermasalah = [s for s, d in sources.items() if d["status"] != "ok"]
    pesan = f"[run] selesai: {ok}/{len(loaders)} loader sukses dan valid"
    if bermasalah:
        pesan += f", BERMASALAH: {bermasalah}"
    print(pesan, file=sys.stderr)


if __name__ == "__main__":
    main()
