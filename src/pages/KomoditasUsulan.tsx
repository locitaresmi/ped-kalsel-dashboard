import { useMemo } from "react";
import { group } from "d3-array";
import { format } from "d3-format";
import { useDataset } from "../hooks/useDataset";
import { useFilters } from "../hooks/useFilters";
import { isSemua, WILAYAH, TAHUN } from "../lib/sektor";
import { skorKomoditas, skorKomoditasProvinsi, type Usulan } from "../lib/komoditas";
import { Card, HeroNote, LangkahLanjut } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
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

interface MergedKomoditas {
  komoditas: string;
  tierA?: Usulan;
  ai?: Row;
  tierB?: Row;
  l1?: Row | null;
}

interface BuktiBullet {
  tipe: "bps" | "resmi" | "berita";
  teks: string;
  sumber?: Array<{ url: string; tanggal: string; jenis: string }>;
  url?: string;
}

function kekuatan(m: MergedKomoditas): number {
  if (m.tierA && m.tierA.skor >= 2) return 4;
  if (m.tierA && m.tierA.skor === 1) return 3;
  if (m.ai?.tier === "B" || m.tierB) return 2;
  if (m.ai?.tier === "C") return 1;
  return 0;
}

function mergePerWilayah(
  tierAList: Usulan[],
  aiList: Row[],
  tierBList: Row[],
  cariL1: (k: string) => Row | null
): MergedKomoditas[] {
  const order: string[] = [];
  const merged = new Map<string, MergedKomoditas>();

  const upsert = (key: string, nama: string, patch: Partial<MergedKomoditas>) => {
    if (!merged.has(key)) {
      order.push(key);
      merged.set(key, { komoditas: nama });
    }
    Object.assign(merged.get(key)!, patch);
  };

  for (const u of tierAList) {
    const key = normKom(u.komoditas);
    upsert(key, u.komoditas, { tierA: u });
    merged.get(key)!.l1 ??= cariL1(u.komoditas);
  }
  for (const u of aiList) {
    const key = normKom(u.komoditas);
    upsert(key, u.komoditas, { ai: u });
    merged.get(key)!.l1 ??= cariL1(u.komoditas);
  }
  for (const t of tierBList) {
    const key = normKom(t.komoditas);
    upsert(key, t.komoditas, { tierB: t });
    merged.get(key)!.l1 ??= cariL1(t.komoditas);
  }

  return order.map((k) => merged.get(k)!).sort((a, b) => kekuatan(b) - kekuatan(a));
}


function KartuKomoditas({ item, invMatch }: { item: MergedKomoditas; invMatch: Row[] }) {
  const { komoditas, tierA, ai, tierB, l1 } = item;

  const bukti: BuktiBullet[] = [];

  if (tierA) {
    if (tierA.kriteria.produksi.status === true)
      bukti.push({ tipe: "bps", teks: tierA.kriteria.produksi.alasan });
    if (tierA.kriteria.ekspor.status === true)
      bukti.push({ tipe: "bps", teks: tierA.kriteria.ekspor.alasan });
    if (tierA.kriteria.subsektor.status === true)
      bukti.push({ tipe: "bps", teks: tierA.kriteria.subsektor.alasan });
  }

  for (const ev of ai?.evidence ?? []) {
    if (!ev.teks) continue;
    bukti.push({
      tipe: ai?.tier === "B" ? "resmi" : "berita",
      teks: bersih(ev.teks),
      sumber: ev.sumber,
    });
  }

  if (tierB) {
    bukti.push({
      tipe: "resmi",
      teks: tierB.sumber
        ? `Tercantum dalam dokumen resmi: ${bersih(tierB.sumber)}`
        : "Tercantum dalam dokumen pemerintah resmi",
      url: tierB.url,
    });
  }

  const ringkasan = bersih(
    ai?.verdik_ekosistem ??
    (tierA
      ? `${tierA.subsektor}. Data statistik BPS tersedia${tierA.level === "provinsi" ? " di tingkat provinsi" : ""}`
      : "")
  );

  const gap = ai?.sketsa?.gap_utama ? bersih(ai.sketsa.gap_utama) : null;

  const hasBPSKuat = !!tierA && tierA.skor >= 2;
  const hasBPSParsial = !!tierA && tierA.skor === 1;
  const hasGovDoc = !!(ai?.tier === "B" || tierB);

  const basisKelas = hasBPSKuat ? "kuat" : hasBPSParsial || hasGovDoc ? "sedang" : "awal";
  const basisLabel = hasBPSKuat
    ? "Data statistik resmi"
    : hasBPSParsial
    ? "Sebagian data resmi"
    : hasGovDoc
    ? "Dokumen pemerintah"
    : "Indikasi awal";

  const limitasiNote = (() => {
    if (!hasBPSKuat && !hasBPSParsial && !hasGovDoc)
      return "Belum ada data statistik atau dokumen resmi yang mengkonfirmasi. Sinyal dari media, perlu verifikasi lapangan";
    if (tierA?.kriteria.produksi.status === null && tierA.skor < 2)
      return bersih(tierA.kriteria.produksi.alasan);
    return null;
  })();

  const invRel = invMatch.filter((r) => {
    const rk = normKom(r.komoditas);
    const k = normKom(komoditas);
    return rk.includes(k) || k.includes(rk);
  });

  return (
    <div className={`kk-card basis-${basisKelas}`}>
      <div className="kk-head">
        <span className="kk-nama">{komoditas}</span>
        <span className={`kk-tag basis-${basisKelas}`}>{basisLabel}</span>
      </div>

      {ringkasan && <p className="kk-ringkasan">{ringkasan}</p>}

      {bukti.length > 0 && (
        <ul className="kk-bukti">
          {bukti.map((b, i) => (
            <li key={i} className={`bukti-item tipe-${b.tipe}`}>
              <span className="bukti-teks">{b.teks}</span>
              <span className="bukti-srcs">
                {(b.sumber ?? []).map((s, j) => (
                  <a key={j} href={s.url} target="_blank" rel="noopener" className="bukti-src">
                    {s.jenis === "resmi" ? "dok. resmi" : "berita"} · {s.tanggal}
                  </a>
                ))}
                {b.url && (
                  <a href={b.url} target="_blank" rel="noopener" className="bukti-src">
                    lihat sumber
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {l1?.verdik_pasar && (
        <details className="kk-pasar">
          <summary>Konteks pasar (seluruh Kalsel)</summary>
          <p>{bersih(l1.verdik_pasar)}</p>
          <span className="bukti-srcs">
            {(l1.sumber ?? []).map((s: Row, i: number) => (
              <a key={i} href={s.url} target="_blank" rel="noopener" className="bukti-src">
                {s.jenis} · {s.tanggal}
              </a>
            ))}
          </span>
        </details>
      )}

      {gap && (
        <div className="kk-gap">
          <strong>Yang masih dibutuhkan:</strong> {gap}
        </div>
      )}

      {limitasiNote && <p className="kk-limitation">{limitasiNote}</p>}

      {invRel.length > 0 && (
        <details className="kk-inventaris">
          <summary>Data produksi BPS kab/kota untuk komoditas ini</summary>
          <table className="inv-tab">
            <thead>
              <tr><th>Komoditas</th><th>Tahun</th><th>Nilai</th></tr>
            </thead>
            <tbody>
              {invRel.map((it, i) => (
                <tr key={i}>
                  <td>{it.komoditas}</td>
                  <td>{it.tahun}</td>
                  <td>
                    {it.metrik_utama === "populasi"
                      ? `${fmtN(it.populasi)} ekor`
                      : `${fmtN(it.produksi)} ${it.satuan_produksi}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}


function InventarisLengkap({ rows }: { rows: Row[] }) {
  if (!rows.length) return null;
  const bySub = group(rows, (d) => d.subsektor as string);
  const nilaiSel = (it: Row) =>
    it.metrik_utama === "populasi"
      ? `${fmtN(it.populasi)} ekor`
      : `${fmtN(it.produksi)} ${it.satuan_produksi}` +
        (it.produktivitas != null && it.produktivitas !== "" ? ` · ${it.produktivitas} t/ha` : "");
  return (
    <details className="inventaris-lengkap">
      <summary>
        <strong>Seluruh komoditas tercatat di BPS kab/kota ini</strong>
        <span className="muted"> ({rows.length} jenis, tarikan otomatis BPS WebAPI)</span>
      </summary>
      <p className="muted" style={{ margin: ".3rem 0 .5rem", fontSize: "0.8rem" }}>
        Daftar ini mencakup semua komoditas yang datanya ada di BPS, termasuk yang belum memenuhi kriteria rekomendasi. Tahun data bervariasi
      </p>
      {[...bySub].map(([sub, items]) => (
        <div key={sub}>
          <div className="inv-sub">{sub}</div>
          <table className="inv-tab">
            <thead><tr><th>Komoditas</th><th>Tahun</th><th>Produksi / populasi</th></tr></thead>
            <tbody>
              {[...items]
                .sort((a, b) => (b.produksi ?? b.populasi ?? 0) - (a.produksi ?? a.populasi ?? 0))
                .map((it, i) => (
                  <tr key={i}><td>{it.komoditas}</td><td>{it.tahun}</td><td>{nilaiSel(it)}</td></tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </details>
  );
}


const tahunTerbaru = TAHUN[TAHUN.length - 1];

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
  const tierBCsv = csv.tier_b ?? [];
  const inisiatif = csv.inisiatif ?? [];
  const produksiKK = csv.produksi_kabkota ?? [];
  const usulanAI = (json.usulan_ai ?? {}) as { layer1?: Row[]; layer2?: Row[] };

  const { perWilayah, usulanProvinsi, tierBPerWilayah, aiL2PerWilayah, prodKKPerWilayah, cariL1 } = useMemo(() => {
    const skor = skorKomoditas({ produksi, pdrb, wilayah: wilayahCsv, ekspor, tahun: tahunTerbaru, basisEkspor: "kalsel" });
    const usulanProvinsi = skorKomoditasProvinsi({ komoditasProv, ekspor, pdrb, wilayah: wilayahCsv, tahun: tahunTerbaru, topProv: 10, basisEkspor: "kalsel" });
    const tierBPerWilayah = group(tierBCsv, (d) => String(d.wilayah_id));
    const aiL2PerWilayah = group(usulanAI.layer2 ?? [], (d) => String(d.wilayah_id));
    const aiL1ByKom = new Map((usulanAI.layer1 ?? []).map((d) => [normKom(d.komoditas), d]));
    const prodKKPerWilayah = group(produksiKK ?? [], (d) => String(d.wilayah_id));

    const cariL1 = (komoditas: string): Row | null => {
      const k = normKom(komoditas);
      if (aiL1ByKom.has(k)) return aiL1ByKom.get(k)!;
      for (const [re, bucket] of L1_BUCKET) if (re.test(k)) return aiL1ByKom.get(bucket) ?? null;
      return null;
    };

    return { perWilayah: skor.perWilayah, usulanProvinsi, tierBPerWilayah, aiL2PerWilayah, prodKKPerWilayah, cariL1 };
  }, [produksi, pdrb, wilayahCsv, ekspor, komoditasProv, tierBCsv, usulanAI, produksiKK]);

  const semuaUsulan = useMemo(() => {
    const out: Row[] = [];
    const src = (m: MergedKomoditas) =>
      (m.tierA?.skor ?? 0) >= 2 ? "Data statistik resmi"
      : (m.tierA?.skor ?? 0) === 1 ? "Sebagian data resmi"
      : m.ai?.tier === "B" || m.tierB ? "Dokumen pemerintah"
      : "Indikasi awal";

    for (const [wid, tierAList] of perWilayah) {
      const aiList = aiL2PerWilayah.get(String(wid)) ?? [];
      const tbList = tierBPerWilayah.get(String(wid)) ?? [];
      const merged = mergePerWilayah(tierAList, aiList, tbList, cariL1);
      for (const m of merged)
        out.push({ komoditas: m.komoditas, wilayah: tierAList[0]?.wilayah ?? namaWilayah(wid), dasar: src(m) });
    }
    for (const u of usulanProvinsi)
      out.push({ komoditas: u.komoditas, wilayah: "Provinsi Kalsel", dasar: u.skor >= 2 ? "Data statistik resmi" : "Sebagian data resmi" });
    for (const d of inisiatif)
      out.push({ komoditas: d.komoditas, wilayah: "Seluruh Kalsel (program pemerintah)", dasar: "Dokumen pemerintah" });
    return out;
  }, [perWilayah, usulanProvinsi, aiL2PerWilayah, tierBPerWilayah, inisiatif, cariL1]);

  const cols: Column<Row>[] = [
    { key: "komoditas", header: "Komoditas", width: 160 },
    { key: "wilayah", header: "Kabupaten/kota", width: 190 },
    { key: "dasar", header: "Dasar usulan", width: 180 },
  ];

  const defaultWid = useMemo(() => {
    const count = (wid: string) =>
      (perWilayah.get(wid)?.length ?? 0) * 3 +
      (aiL2PerWilayah.get(wid)?.length ?? 0) * 2 +
      (tierBPerWilayah.get(wid)?.length ?? 0) +
      ((prodKKPerWilayah.get(wid)?.length ?? 0) > 0 ? 1 : 0);
    return [...kabList].map((w) => w.id).sort((a, b) => count(b) - count(a))[0];
  }, [perWilayah, tierBPerWilayah, aiL2PerWilayah, prodKKPerWilayah]);

  const selectedWid = !isSemua(f.wilayah) && f.wilayah.id !== "6300" ? f.wilayah.id : defaultWid;

  function BlokWilayah({ wid }: { wid: string }) {
    const w = WILAYAH.find((x) => x.id === wid)!;
    const tierAList = perWilayah.get(wid) ?? [];
    const aiList = aiL2PerWilayah.get(wid) ?? [];
    const tbList = tierBPerWilayah.get(wid) ?? [];
    const inv = prodKKPerWilayah.get(wid) ?? [];

    const items = mergePerWilayah(tierAList, aiList, tbList, cariL1);

    return (
      <Card title={w.nama} subtitle="Komoditas yang diusulkan untuk kabupaten/kota ini">
        {items.map((item, i) => (
          <KartuKomoditas key={i} item={item} invMatch={inv} />
        ))}
        {items.length > 0 && inv.length > 0 && <InventarisLengkap rows={inv} />}
        {!items.length && !inv.length && (
          <p className="empty">Belum ada data untuk wilayah ini</p>
        )}
        {!items.length && inv.length > 0 && (
          <>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Belum ada komoditas yang memenuhi kriteria rekomendasi, tapi BPS mencatat data produksi berikut
            </p>
            <InventarisLengkap rows={inv} />
          </>
        )}
      </Card>
    );
  }

  function BlokProvinsi() {
    if (!usulanProvinsi.length) return null;
    const items = usulanProvinsi.map((u): MergedKomoditas => ({
      komoditas: u.komoditas,
      tierA: u,
      l1: cariL1(u.komoditas),
    }));
    return (
      <Card
        title="Tingkat provinsi Kalsel"
        subtitle="Komoditas unggulan berdasarkan data produksi tingkat provinsi. Sebagian data (ekspor, produksi ikan/perkebunan) memang hanya tersedia di tingkat provinsi, bukan per kabupaten/kota."
      >
        <div className="grid-2">
          {items.map((item, i) => <KartuKomoditas key={i} item={item} invMatch={[]} />)}
        </div>
      </Card>
    );
  }

  if (error) return <ErrorBlock error={error} />;

  return (
    <div>
      <h1 className="page-title">Komoditas usulan</h1>
      <p className="page-lede">
        Komoditas apa yang direkomendasikan, dan di mana? Setiap rekomendasi disertai dasar bukti
        yang bisa ditelusuri: data statistik, dokumen pemerintah, atau laporan. Rekomendasi memakai
        data tarikan terbaru secara otomatis. Pilih kabupaten/kota di bawah untuk melihat
        rekomendasinya
      </p>

      <div className="card info-dasar">
        <strong>Cara membaca dasar usulan</strong>
        <div className="dasar-legend">
          <span className="kk-tag basis-kuat">Data statistik resmi</span>
          <span>Data BPS (produksi, ekspor) dan analisis subsektor unggulan</span>
          <span className="kk-tag basis-sedang">Dokumen pemerintah</span>
          <span>RPJMD, Bappeda, atau portal dinas, belum ada data statistik</span>
          <span className="kk-tag basis-awal">Indikasi awal</span>
          <span>Sinyal dari berita atau laporan, perlu konfirmasi lapangan</span>
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--color-neutral-500)" }}>
          Urutan kartu mencerminkan kekuatan bukti, yang paling kuat di atas. Klik "Konteks pasar" untuk melihat analisis pasar global komoditas tersebut
        </p>
      </div>

      {loading ? (
        <div className="loading-block">Memuat data…</div>
      ) : (
        <>
          <div>
            <span className="muted">Pilih kabupaten/kota:</span>
            <div className="kab-chips">
              {kabList.map((w) => (
                <button
                  key={w.id}
                  className={`chip ${w.id === selectedWid ? "active" : ""}`}
                  onClick={() => f.setWilayah(w.id)}
                >
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
              initialSort="dasar"
              searchable
              searchPlaceholder="Cari komoditas atau kabupaten/kota…"
              maxRows={50}
            />
          </details>

          <LangkahLanjut
            teks={<>Sudah tahu komoditas unggulannya? Cek sektor mana yang masih kurang dibiayai perbankan</>}
            aksi="Buka Pembiayaan"
            to="/pembiayaan"
          />
        </>
      )}

      <HeroNote>
        <strong>Keterbatasan data produksi per kabupaten/kota</strong>. Di sumber BPS, data produksi
        per kabupaten/kota hanya tersedia untuk padi. Komoditas lain (sawit, karet, perikanan, dll.)
        hanya tersedia di tingkat provinsi. Data per kab/kota sebetulnya ada di{" "}
        <a href="https://bdsp2.pertanian.go.id/" target="_blank" rel="noopener">BDSP Kementan</a>,
        namun belum punya antarmuka data yang stabil. Rekomendasi berbasis dokumen pemerintah atau
        penelusuran AI mengisi celah ini, ditandai jujur sesuai sumbernya
      </HeroNote>
    </div>
  );
}
