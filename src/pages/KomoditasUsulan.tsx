import { useMemo, useState, type ReactNode } from "react";
import { group } from "d3-array";
import { format } from "d3-format";
import { useDataset } from "../hooks/useDataset";
import { useFilters } from "../hooks/useFilters";
import { isSemua, WILAYAH, type Wilayah } from "../lib/sektor";
import { skorKomoditas, skorKomoditasProvinsi, type Usulan, type Kriteria } from "../lib/komoditas";
import { Card, InfoTip, HeroNote, BadgeTier } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { FilterBar } from "../components/FilterBar";
import { EcoIcon } from "../components/icons";
import { ErrorBlock } from "./Ringkasan";
import type { Row } from "../lib/data";

const fmtN = format(",.0f");
const kabList = WILAYAH.filter((w) => w.id !== "6300");
const namaWilayah = (wid: string | number) => WILAYAH.find((w) => w.id === String(wid))?.nama ?? String(wid);

function bersih(t: unknown): string {
  if (t == null) return "";
  return String(t)
    .replace(/\s*—\s*/g, ". ")
    .replace(/\s*;\s*/g, ". ")
    .replace(/\bloop ekonomi\b/gi, "siklus ekonomi")
    .replace(/\bclosed[- ]loop\b/gi, "rantai ekonomi lengkap")
    .replace(/\boff[- ]?taker\b/gi, "pembeli hasil panen");
}

const normKom = (s: unknown) => String(s ?? "").toLowerCase().replace(/\(.*?\)/g, "").trim();

const L1_BUCKET: [RegExp, string][] = [
  [/sawit|cpo|tbs/, "kelapa sawit"],
  [/ikan|udang|patin|nila|lele|haruan|papuyu|gabus|bandeng|gurame|perikanan|tambak|keramba|budidaya/, "perikanan budidaya"],
  [/padi|gabah|beras/, "padi"],
  [/jagung/, "jagung"],
  [/karet/, "karet"],
  [/kopi/, "kopi"],
  [/kakao|coklat|cokelat/, "kakao"],
  [/tebu/, "tebu"],
  [/batu ?bara/, "batu bara"],
  [/kelapa/, "kelapa"],
];

function ikonKriteria(s: boolean | "na" | null): ReactNode {
  if (s === true) return <span className="ikon-ya" title="kriteria terpenuhi">✓</span>;
  if (s === false) return <span className="ikon-tidak" title="kriteria tidak terpenuhi">✕</span>;
  return <span className="ikon-na" title="kriteria ini tidak berlaku / data belum tersedia">—</span>;
}

function LencanaKriteria({ k, label }: { k: Kriteria; label: string }) {
  const cls = k.status === true ? "pass" : k.status === false ? "fail" : "na";
  const ikon = k.status === true ? "✓" : k.status === false ? "✕" : "—";
  return <span className={`badge ${cls}`} data-tip={bersih(k.alasan)}>{ikon} {label}</span>;
}

function detailProduksi(u: Usulan): string {
  if (u.level === "provinsi") {
    if (u.produksi_kalsel == null) return `${u.subsektor} · data produksi BPS belum tersedia (sumber ada di ESDM)`;
    return `${u.subsektor} · produksi ${fmtN(u.produksi_kalsel)} ${u.satuan} · peringkat ke-${u.peringkat_nasional} nasional (${u.tahunProduksi})`;
  }
  return `${u.subsektor} · produksi ${fmtN(u.produksi_ton ?? 0)} ton (${u.tahunProduksi})`;
}

function KartuTierA({ u }: { u: Usulan }) {
  return (
    <div className="usulan tier-a-prominent">
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="rekom-utama">★ Rekomendasi Utama OJK</span>
        <BadgeTier tier="A" />
      </div>
      <div className="komoditas-name">{u.komoditas}</div>
      <div className="komoditas-meta">{detailProduksi(u)}</div>
      <div className="skor-baris">
        <span className="skor">Skor {u.skor}/{u.skorMax}</span>
        <span className="skor-jelas">kriteria OJK terpenuhi (produksi, ekspor, subsektor unggulan)</span>
      </div>
      <div className="lencana">
        <LencanaKriteria k={u.kriteria.produksi} label="Produksi" />
        <LencanaKriteria k={u.kriteria.ekspor} label="Ekspor" />
        <LencanaKriteria k={u.kriteria.subsektor} label="Subsektor" />
      </div>
      <ul className="alasan">
        {(["produksi", "subsektor", "ekspor"] as const).map((k) => (
          <li key={k}>{bersih(u.kriteria[k].alasan)}</li>
        ))}
      </ul>
    </div>
  );
}

function EcoTile({ icon, label, value, gap }: { icon: string; label: string; value: unknown; gap?: boolean }) {
  return (
    <div className={`eco-tile ${gap ? "gap" : ""}`}>
      <div className="et-head"><EcoIcon name={icon} /> {label}</div>
      <div className="et-val">{bersih(value)}</div>
    </div>
  );
}

function BarisEvidence({ dimensi, teks, sumber }: { dimensi: string; teks: string; sumber?: Row[] }) {
  return (
    <div className="ev-row">
      <span className="ev-dim">{bersih(dimensi)}</span>
      <span className="ev-teks">{bersih(teks)}</span>
      {(sumber ?? []).length ? (
        <span className="ev-src">
          {(sumber ?? []).map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener">{s.jenis} ({s.tanggal})</a>
          ))}
        </span>
      ) : null}
    </div>
  );
}

function KartuAITab({ u, invMatch, cariL1 }: { u: Row; invMatch: Row[]; cariL1: (k: string) => Row | null }) {
  const [tab, setTab] = useState<"ringkasan" | "databps" | "analisis">("ringkasan");
  const tierC = u.tier === "C";
  const sk = u.sketsa ?? {};
  const l1 = cariL1(u.komoditas);
  const evL1: [string, string, Row[]][] = l1
    ? ([
        ["Pasar", l1.analisis?.pasar],
        ["Daya saing", l1.analisis?.kompetisi],
        ["Momentum", l1.analisis?.momentum],
      ].filter(([, t]) => t) as [string, string][]).map(([dim, teks]) => [dim, teks, l1.sumber])
    : [];
  const evidence: Row[] = u.evidence ?? [];

  return (
    <div className={`tcard ${tierC ? "tierc" : "tierb"}`}>
      <div className="tcard-head">
        <span>
          <BadgeTier tier={u.tier} />{" "}
          <span className="muted">{tierC ? "sinyal awal" : "indikasi resmi"}</span>
        </span>
        <div className="komoditas-name">{u.komoditas}</div>
      </div>
      <div className="tcard-tabs">
        <button className={`tcard-tab ${tab === "ringkasan" ? "active" : ""}`} onClick={() => setTab("ringkasan")}>Ringkasan</button>
        <button className={`tcard-tab ${tab === "databps" ? "active" : ""}`} onClick={() => setTab("databps")}>Data BPS</button>
        <button className={`tcard-tab ${tab === "analisis" ? "active" : ""}`} onClick={() => setTab("analisis")}>Analisis AI</button>
      </div>
      <div className="tcard-body">
        {tab === "ringkasan" && (
          <>
            <div className="tcard-verdik">{bersih(u.verdik_ekosistem)}</div>
            <div className="eco-tiles">
              <EcoTile icon="hulu" label="Hulu" value={sk.hulu || "—"} />
              <EcoTile icon="gap" label="Gap utama" value={sk.gap_utama || "—"} gap />
              <EcoTile icon="program" label="Program" value={sk.program || "—"} />
            </div>
            {tierC && (
              <p className="disclaimer">⚠ Sebagian sinyal dari berita/laporan. Perlu verifikasi; tidak memengaruhi skor Tier A</p>
            )}
          </>
        )}
        {tab === "databps" && (
          invMatch.length ? (
            <table className="inv-tab">
              <thead><tr><th>Komoditas</th><th>Tahun</th><th>Produksi / populasi</th></tr></thead>
              <tbody>
                {invMatch.map((it, i) => (
                  <tr key={i}>
                    <td>{it.komoditas}</td>
                    <td>{it.tahun}</td>
                    <td>{it.metrik_utama === "populasi" ? `${fmtN(it.populasi)} ekor` : `${fmtN(it.produksi)} ${it.satuan_produksi}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Data produksi BPS tingkat kab/kota untuk komoditas ini belum tersedia (umumnya hanya tingkat provinsi, atau sumber ESDM untuk batu bara). Lihat inventaris BPS lengkap di bawah</p>
          )
        )}
        {tab === "analisis" && (
          <>
            <div className="eco-tiles">
              <EcoTile icon="hulu" label="Hulu (produsen)" value={sk.hulu || "—"} />
              <EcoTile icon="offtaker" label="Pembeli / pengolah" value={sk.offtaker || "—"} />
              <EcoTile icon="pembiayaan" label="Akses modal" value={sk.pembiayaan || "—"} />
              <EcoTile icon="asistensi" label="Asistensi teknis" value={sk.asistensi || "—"} />
              <EcoTile icon="program" label="Program / dukungan" value={sk.program || "—"} />
              <EcoTile icon="gap" label="Gap utama" value={sk.gap_utama || "—"} gap />
            </div>
            {(evL1.length || evidence.length) ? (
              <details className="evidence" style={{ marginTop: "0.6rem" }}>
                <summary>Bukti dan sumber per dimensi</summary>
                {evL1.map(([dim, teks, src], i) => <BarisEvidence key={"l1" + i} dimensi={dim} teks={teks} sumber={src} />)}
                {evidence.map((e, i) => <BarisEvidence key={"e" + i} dimensi={e.dimensi} teks={e.teks} sumber={e.sumber} />)}
                {l1?.verdik_pasar && (
                  <div className="muted" style={{ marginTop: "0.4rem" }}>Ringkasan pasar (seluruh Kalsel): {bersih(l1.verdik_pasar)}</div>
                )}
              </details>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function KartuTierB({ t }: { t: Row }) {
  return (
    <div className="tcard tierb">
      <div className="tcard-head">
        <span><BadgeTier tier="B" /> <span className="muted">indikasi resmi pemerintah</span></span>
        <div className="komoditas-name">{t.komoditas}</div>
      </div>
      <div className="tcard-body">
        <div className="muted">{bersih(t.kategori)} · {bersih(t.status)}</div>
        <div className="alasan-sumber">Sumber: <a href={t.url} target="_blank" rel="noopener">{t.sumber}</a></div>
      </div>
    </div>
  );
}

function InventarisDetails({ rows }: { rows: Row[] }) {
  if (!rows.length) return null;
  const bySub = group(rows, (d) => d.subsektor as string);
  const nilaiSort = (d: Row) => d.produksi ?? d.populasi ?? 0;
  const nilaiSel = (it: Row) =>
    it.metrik_utama === "populasi"
      ? `${fmtN(it.populasi)} ekor`
      : `${fmtN(it.produksi)} ${it.satuan_produksi}` +
        (it.produktivitas != null && it.produktivitas !== "" ? ` · ${it.produktivitas} t/ha` : "");
  return (
    <details className="usulan inventaris">
      <summary>
        <strong>Inventaris produksi BPS (semua komoditas kab/kota)</strong>{" "}
        <span className="muted">{rows.length} komoditas tercatat (tahun bervariasi)</span>
      </summary>
      <div className="muted" style={{ margin: ".3rem 0 .5rem" }}>
        Tarikan otomatis BPS WebAPI. Sebagian data lama (lihat kolom Tahun)
      </div>
      {[...bySub].map(([sub, items]) => (
        <div key={sub}>
          <div className="inv-sub">{sub}</div>
          <table className="inv-tab">
            <thead><tr><th>Komoditas</th><th>Tahun</th><th>Produksi / populasi</th></tr></thead>
            <tbody>
              {[...items].sort((a, b) => nilaiSort(b) - nilaiSort(a)).map((it, i) => (
                <tr key={i}><td>{it.komoditas}</td><td>{it.tahun}</td><td>{nilaiSel(it)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </details>
  );
}

export function KomoditasUsulan() {
  const f = useFilters();
  const { csv, json, loading, error } = useDataset({
    csv: ["produksi", "pdrb", "wilayah", "ekspor", "komoditas_provinsi", "tier_b", "inisiatif", "produksi_kabkota"],
    json: ["usulan_ai"],
  });

  const produksi = csv.produksi ?? [];
  const pdrb = csv.pdrb ?? [];
  const wilayahCsv = csv.wilayah ?? [];
  const ekspor = csv.ekspor ?? [];
  const komoditasProv = csv.komoditas_provinsi ?? [];
  const tierB = csv.tier_b ?? [];
  const inisiatif = csv.inisiatif ?? [];
  const produksiKK = csv.produksi_kabkota ?? [];
  const usulanAI = (json.usulan_ai ?? {}) as { layer1?: Row[]; layer2?: Row[] };

  const { perWilayah, usulanProvinsi, tierBPerWilayah, aiL2PerWilayah, produksiKKPerWilayah, cariL1 } = useMemo(() => {
    const skor = skorKomoditas({ produksi, pdrb, wilayah: wilayahCsv, ekspor, tahun: f.tahun, basisEkspor: "kalsel" });
    const usulanProvinsi = skorKomoditasProvinsi({ komoditasProv, ekspor, pdrb, wilayah: wilayahCsv, tahun: f.tahun, topProv: 10, basisEkspor: "kalsel" });
    const tierBPerWilayah = group(tierB, (d) => String(d.wilayah_id));
    const aiL2PerWilayah = group(usulanAI.layer2 ?? [], (d) => String(d.wilayah_id));
    const aiL1ByKom = new Map((usulanAI.layer1 ?? []).map((d) => [normKom(d.komoditas), d]));
    const produksiKKPerWilayah = group(produksiKK ?? [], (d) => String(d.wilayah_id));
    const cariL1 = (komoditas: string): Row | null => {
      const k = normKom(komoditas);
      if (aiL1ByKom.has(k)) return aiL1ByKom.get(k)!;
      for (const [re, bucket] of L1_BUCKET) if (re.test(k)) return aiL1ByKom.get(bucket) ?? null;
      return null;
    };
    return { perWilayah: skor.perWilayah, usulanProvinsi, tierBPerWilayah, aiL2PerWilayah, produksiKKPerWilayah, cariL1 };
  }, [produksi, pdrb, wilayahCsv, ekspor, komoditasProv, tierB, usulanAI, produksiKK, f.tahun]);

  const semuaUsulan = useMemo(() => {
    const out: Row[] = [];
    const kstat = (s: boolean | null) => (s === true ? true : s === false ? false : "na");
    for (const [, list] of perWilayah)
      for (const u of list)
        out.push({ komoditas: u.komoditas, wilayah: u.wilayah, tier: "A", skor: u.skor, k_produksi: kstat(u.kriteria.produksi.status), k_ekspor: kstat(u.kriteria.ekspor.status), k_subsektor: kstat(u.kriteria.subsektor.status) });
    for (const u of usulanProvinsi)
      out.push({ komoditas: u.komoditas, wilayah: "Provinsi Kalsel", tier: "A", skor: u.skor, k_produksi: kstat(u.kriteria.produksi.status), k_ekspor: kstat(u.kriteria.ekspor.status), k_subsektor: kstat(u.kriteria.subsektor.status) });
    for (const [wid, list] of tierBPerWilayah)
      for (const t of list)
        out.push({ komoditas: t.komoditas, wilayah: t.wilayah || namaWilayah(wid), tier: "B", skor: "—", k_produksi: "na", k_ekspor: "na", k_subsektor: "na" });
    for (const [wid, list] of aiL2PerWilayah)
      for (const u of list)
        out.push({ komoditas: u.komoditas, wilayah: namaWilayah(wid), tier: u.tier, skor: "—", k_produksi: "na", k_ekspor: "na", k_subsektor: "na" });
    for (const d of inisiatif)
      out.push({ komoditas: d.komoditas, wilayah: "Seluruh Kalsel (program pemerintah)", tier: "B", skor: "—", k_produksi: "na", k_ekspor: "na", k_subsektor: "na" });
    return out;
  }, [perWilayah, usulanProvinsi, tierBPerWilayah, aiL2PerWilayah, inisiatif]);

  const cols: Column<Row>[] = [
    { key: "komoditas", header: "Komoditas", width: 150 },
    { key: "wilayah", header: "Kabupaten/kota", width: 180 },
    { key: "tier", header: "Tier", render: (r) => <BadgeTier tier={r.tier} /> },
    {
      key: "skor", header: "Skor", value: (r) => (typeof r.skor === "number" ? r.skor : -1),
      render: (r) =>
        typeof r.skor === "number" ? (
          <>
            <span className="skor-bar" title={`${r.skor} dari 3 kriteria`}><span className="skor-bar-fill" style={{ width: `${(r.skor / 3) * 100}%` }} /></span>
            <span className="skor-num">{r.skor}/3</span>
          </>
        ) : <span className="ikon-na" title="Tier B/C tidak memiliki skor numerik">—</span>,
    },
    { key: "k_produksi", header: "Produksi", align: "center", value: (r) => String(r.k_produksi), render: (r) => ikonKriteria(r.k_produksi) },
    { key: "k_ekspor", header: "Ekspor", align: "center", value: (r) => String(r.k_ekspor), render: (r) => ikonKriteria(r.k_ekspor) },
    { key: "k_subsektor", header: "Subsektor", align: "center", value: (r) => String(r.k_subsektor), render: (r) => ikonKriteria(r.k_subsektor) },
  ];

  const defaultWid = useMemo(() => {

    const count = (wid: string) =>
      (perWilayah.get(wid)?.length || 0) * 3 + (aiL2PerWilayah.get(wid)?.length || 0) * 2 +
      (tierBPerWilayah.get(wid)?.length || 0) * 2 + ((produksiKKPerWilayah.get(wid)?.length || 0) > 0 ? 1 : 0);
    return [...kabList].map((w) => w.id).sort((a, b) => count(b) - count(a))[0];
  }, [perWilayah, tierBPerWilayah, aiL2PerWilayah, produksiKKPerWilayah]);
  const selectedWid = !isSemua(f.wilayah) && f.wilayah.id !== "6300" ? f.wilayah.id : defaultWid;

  function invMatchFor(wid: string, komoditas: string): Row[] {
    const k = normKom(komoditas);
    return (produksiKKPerWilayah.get(wid) ?? []).filter((r) => {
      const rk = normKom(r.komoditas);
      return rk.includes(k) || k.includes(rk);
    });
  }

  function BlokProvinsi() {
    if (!usulanProvinsi.length) return null;
    return (
      <Card title="Tingkat provinsi (berlaku lintas kabupaten/kota)" subtitle="Komoditas unggulan se-Kalsel dari data produksi tingkat provinsi. Sebagian data (ekspor, produksi ikan/perkebunan) memang hanya tersedia di tingkat provinsi">
        <div className="grid-2">
          {usulanProvinsi.map((u, i) => <KartuTierA key={i} u={u} />)}
        </div>
      </Card>
    );
  }

  function BlokWilayah({ wid }: { wid: string }) {
    const w = WILAYAH.find((x) => x.id === wid)!;
    const list = perWilayah.get(wid) ?? [];
    const ai = aiL2PerWilayah.get(wid) ?? [];
    const tb = tierBPerWilayah.get(wid) ?? [];
    const inv = produksiKKPerWilayah.get(wid) ?? [];
    const kosong = !list.length && !ai.length && !tb.length && !inv.length;
    return (
      <Card title={w.nama} subtitle="Rekomendasi & indikasi komoditas untuk kabupaten/kota ini">
        {list.map((u, i) => <KartuTierA key={"a" + i} u={u} />)}
        {ai.map((u, i) => <KartuAITab key={"ai" + i} u={u} invMatch={invMatchFor(wid, u.komoditas)} cariL1={cariL1} />)}
        {tb.map((t, i) => <KartuTierB key={"b" + i} t={t} />)}
        <InventarisDetails rows={inv} />
        {kosong && <p className="empty">Belum ada indikasi komoditas dari sumber lain untuk wilayah ini</p>}
      </Card>
    );
  }

  if (error) return <ErrorBlock error={error} />;

  return (
    <div>
      <h1 className="page-title">Komoditas usulan</h1>
      <p className="page-lede">
        Komoditas apa yang direkomendasikan, dan di mana? Rekomendasi disusun dari kriteria resmi OJK
        dengan skoring transparan. Tiap usulan membawa lencana alasan yang bisa ditelusuri. Pilih
        kabupaten/kota di bawah untuk melihat rekomendasinya
      </p>

      <FilterBar showSektor={false} />

      <div className="card info-tier">
        <strong>Cara membaca tingkat keyakinan (tier)</strong>
        <p>
          Tier A paling kuat (data resmi BPS, skor 0–3 dari kriteria produksi/ekspor/subsektor). Tier B
          dari dokumen resmi pemerintah. Tier C sinyal awal yang perlu diverifikasi. Komoditas skor 0
          tidak ditampilkan
        </p>
        <p><BadgeTier tier="A" /> <BadgeTier tier="B" /> <BadgeTier tier="C" /></p>
      </div>

      {loading ? (
        <div className="loading-block">Memuat data…</div>
      ) : (
        <>
          <div>
            <span className="muted">Pilih kabupaten/kota:</span>
            <div className="kab-chips">
              {kabList.map((w) => (
                <button key={w.id} className={`chip ${w.id === selectedWid ? "active" : ""}`} onClick={() => f.setWilayah(w.id)}>
                  {w.nama}
                </button>
              ))}
            </div>
          </div>

          <BlokWilayah wid={selectedWid} />
          <BlokProvinsi />

          <details className="detail-block">
            <summary>Lihat semua komoditas dalam satu tabel ({semuaUsulan.length} baris)</summary>
            <DataTable
              rows={semuaUsulan}
              columns={cols}
              initialSort="skor"
              initialReverse
              searchable
              searchPlaceholder="Cari komoditas atau kabupaten/kota…"
              maxRows={40}
            />
          </details>
        </>
      )}

      <HeroNote>
        <strong>Keterbatasan data produksi per kabupaten/kota.</strong> Di sumber BPS, produksi per
        kabupaten/kota hanya tersedia untuk padi. Komoditas lain hanya tersedia di tingkat provinsi
        (ditampilkan pada blok tingkat provinsi). Data per kab/kota sebetulnya ada di{" "}
        <a href="https://bdsp2.pertanian.go.id/" target="_blank" rel="noopener">BDSP Kementan</a>, namun
        belum punya antarmuka data resmi yang andal, sehingga tidak diotomasi. Ditandai jujur sebagai
        keterbatasan
      </HeroNote>
    </div>
  );
}
