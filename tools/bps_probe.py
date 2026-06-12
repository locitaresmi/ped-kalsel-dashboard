from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "lib"))
import bps

def _key():
    return bps._key()

def list_subjects(domain: str) -> list[dict]:
    key = _key()
    out, page = [], 1
    while True:
        payload = bps._get(f"list/model/subject/lang/ind/domain/{domain}/key/{key}/?page={page}")
        data = payload.get("data")
        if not data or len(data) < 2 or not data[1]:
            break
        meta, rows = data[0], data[1]
        out.extend(rows)
        if page >= int(meta.get("pages", page)):
            break
        page += 1
    return out

def cmd_subjects(domain: str):
    for s in list_subjects(domain):
        print(f"{s.get('sub_id')}\t{s.get('title')}")

def cmd_vars(domain: str, keywords: list[str]):
    kws = [k.lower() for k in keywords]
    vars_ = bps.list_var(domain)
    print(f"# {len(vars_)} var total di domain {domain}", file=sys.stderr)
    for v in vars_:
        title = (v.get("title") or "")
        sub = (v.get("subj") or v.get("subject") or "")
        hay = f"{title} {sub}".lower()
        if not kws or all(k in hay for k in kws):
            print(f"{v.get('var_id')}\t{v.get('sub_id','')}\t{title}\t[{sub}]")

def cmd_table(domain: str, var: str, tahun: int):
    resp = bps.data_table(domain, var, int(tahun))
    for fld in ("vervar", "turvar", "tahun", "turtahun"):
        items = bps._label_map(resp.get(fld))
        print(f"== {fld} ({len(items)}) ==")
        for vid, lbl in items[:40]:
            print(f"   {vid}\t{bps._clean_label(lbl)}")
    recs = bps.parse_datacontent(resp)
    print(f"== datacontent: {len(recs)} record (contoh 12) ==")
    for r in recs[:12]:
        print(f"   ver={bps._clean_label(r['vervar'])[:34]!r} tur={r['turvar'][:24]!r} "
              f"th={r['tahun']} tt={r['turtahun'][:14]!r} -> {r['nilai']}")

def cmd_turvar(domain: str, var: str, tahun: int):
    resp = bps.data_table(domain, var, int(tahun))
    for fld in ("vervar", "turvar", "turtahun"):
        items = bps._label_map(resp.get(fld))
        print(f"== {fld} ({len(items)}) ==")
        for vid, lbl in items:
            print(f"   {vid}\t{bps._clean_label(lbl)}")

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    cmd, domain = sys.argv[1], sys.argv[2]
    rest = sys.argv[3:]
    if cmd == "subjects":
        cmd_subjects(domain)
    elif cmd == "vars":
        cmd_vars(domain, rest)
    elif cmd == "table":
        cmd_table(domain, rest[0], rest[1])
    elif cmd == "turvar":
        cmd_turvar(domain, rest[0], rest[1])
    else:
        print(__doc__)
        sys.exit(1)

if __name__ == "__main__":
    main()
