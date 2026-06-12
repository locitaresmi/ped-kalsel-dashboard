import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "pipeline", "data")
INPUTS_DIR = os.path.join(ROOT, "pipeline", "inputs")
OUT_DIR = os.path.join(ROOT, "public", "data")

STATIC_INPUTS = ["tier_b.csv", "inisiatif.csv", "usulan_ai.json"]
GEOJSON_SRC = os.path.join(ROOT, "kalsel.geojson")

def jalankan_loader(path: str, keluaran: str) -> bool:
    nama = os.path.basename(path)
    try:

        hasil = subprocess.run(
            [sys.executable, path],
            capture_output=True, text=True, env=os.environ, timeout=900,
        )
    except Exception as e:
        print(f"[run] {nama}: GAGAL menjalankan ({e}) — file lama dibiarkan", file=sys.stderr)
        return False
    if hasil.returncode != 0 or not hasil.stdout.strip():
        pesan = (hasil.stderr or "").strip().splitlines()
        ekor = pesan[-1] if pesan else "tanpa keluaran"
        print(f"[run] {nama}: GAGAL ({ekor}) — file lama dibiarkan", file=sys.stderr)
        return False
    with open(keluaran, "w", encoding="utf-8", newline="") as fh:
        fh.write(hasil.stdout)
    if hasil.stderr.strip():
        print(f"[run] {nama}: {hasil.stderr.strip().splitlines()[-1]}", file=sys.stderr)
    return True

def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    loaders = sorted(f for f in os.listdir(DATA_DIR) if f.endswith(".csv.py"))
    ok = 0
    for f in loaders:
        stem = f[:-len(".csv.py")]
        if jalankan_loader(os.path.join(DATA_DIR, f), os.path.join(OUT_DIR, stem + ".csv")):
            ok += 1

    for nama in STATIC_INPUTS:
        src = os.path.join(INPUTS_DIR, nama)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(OUT_DIR, nama))
    if os.path.exists(GEOJSON_SRC):
        shutil.copy2(GEOJSON_SRC, os.path.join(OUT_DIR, "kalsel.geojson"))

    print(f"[run] selesai: {ok}/{len(loaders)} loader sukses, aset statis disalin ke public/data/",
          file=sys.stderr)

if __name__ == "__main__":
    main()
