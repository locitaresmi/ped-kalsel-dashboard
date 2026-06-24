import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sum, rollups } from "d3-array";
import { useDataset } from "../hooks/useDataset";
import { useFilters, WILAYAH_OPSI } from "../hooks/useFilters";
import { isSemua, namaPendek, SEMUA, WILAYAH, type Wilayah } from "../lib/sektor";
import { skorKomoditas } from "../lib/komoditas";
import { fmtRp, fmt2, pctSigned } from "../lib/format";
import { KalselMap } from "../components/KalselMap";
import { EChart } from "../components/EChart";
import { Card, KpiCard, InfoTip, LangkahLanjut } from "../components/ui";
import { FilterBar } from "../components/FilterBar";
import type { EChartsOption } from "../lib/echarts";
import type { Row } from "../lib/data";

const RAMP_LQ = ["#ECFEFF", "#67E8F9", "#0E7490", "#155E75"];
const RAMP_BASIS = ["#F0FDFA", "#5EEAD4", "#0D9488", "#115E59"];

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return <div style={{ height: 34 }} />;
  const option: EChartsOption = {
    grid: { top: 3, right: 3, bottom: 3, left: 3 },
    xAxis: { type: "category", show: false, boundaryGap: false, data: values.map((_, i) => i) },
    yAxis: { type: "value", show: false, scale: true },
    tooltip: { show: false },
    series: [
      {
        type: "line", data: values, smooth: 0.35, showSymbol: false,
        lineStyle: { color, width: 1.75 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + "30" },
              { offset: 1, color: color + "00" },
            ],
          },
        },
      },
    ],
  };
  return <EChart option={option} height={34} noToolbox noZoom />;
}

export function Ringkasan() {
  const f = useFilters();
  const navigate = useNavigate();
  const [qsWil, setQsWil] = useState(SEMUA);
  const { csv, geo, loading, error } = useDataset({
    csv: ["pdrb", "wilayah", "produksi", "pdrb_provinsi"],
    geo: ["kalsel"],
  });

  const pdrb = csv.pdrb ?? [];
  const wilayahLQ = csv.wilayah ?? [];
  const produksi = csv.produksi ?? [];
  const pdrbProv = csv.pdrb_provinsi ?? [];
  const kalsel = geo.kalsel as { features: { properties: { wilayah_id: string; nama: string } }[] } | undefined;

  const tahun = f.tahun;

  const kpi = useMemo(() => {
    const pdrbTahun = pdrb.filter((d) => d.tahun === tahun);
    const pdrbTotal = sum(pdrbTahun, (d) => d.pdrb_prov as number);
    const nSektorBasis = pdrbTahun.filter((d) => (d.lq as number) >= 1).length;
    const prev = pdrb.filter((d) => d.tahun === tahun - 1);
    const pdrbTotalPrev = sum(prev, (d) => d.pdrb_prov as number);
    const pertumbuhan = pdrbTotalPrev ? (pdrbTotal / pdrbTotalPrev - 1) * 100 : null;
    const pdrbNasTotal = sum(pdrbTahun, (d) => d.pdrb_nas as number);
    const pdrbNasPrev = sum(prev, (d) => d.pdrb_nas as number);
    const pertumbuhanNas = pdrbNasPrev ? (pdrbNasTotal / pdrbNasPrev - 1) * 100 : null;
    return { pdrbTotal, nSektorBasis, pertumbuhan, pertumbuhanNas };
  }, [pdrb, tahun]);

  const pdrbRank = useMemo(() => {
    if (!pdrbProv.length) return null;
    const years = [...new Set(pdrbProv.map((d) => d.tahun as number))].sort((a, b) => a - b);
    const y = years.includes(tahun) ? tahun : years[years.length - 1];
    const provOnly = pdrbProv.filter(
      (d) => d.tahun === y && !(d.nasional === true || d.nasional === "true")
    );
    const sorted = [...provOnly].sort((a, b) => b.share_pdrb_pct - a.share_pdrb_pct);
    const rank = sorted.findIndex((d) => /kalimantan selatan/i.test(d.provinsi)) + 1;
    return rank > 0 ? { rank, n: provOnly.length } : null;
  }, [pdrbProv, tahun]);

  const usulan = useMemo(() => {
    if (!produksi.length || !pdrb.length || !wilayahLQ.length)
      return { totalUsulan: 0, nWilayahUsulan: 0 };
    const skor = skorKomoditas({ produksi, pdrb, wilayah: wilayahLQ, tahun });
    const lists = [...skor.perWilayah.values()];
    return {
      totalUsulan: lists.reduce((s, l) => s + l.length, 0),
      nWilayahUsulan: lists.filter((l) => l.length).length,
    };
  }, [produksi, pdrb, wilayahLQ, tahun]);

  const pdrbSpark = useMemo(
    () =>
      rollups(pdrb, (v) => sum(v, (d) => d.pdrb_prov as number), (d) => d.tahun as number)
        .sort((a, b) => a[0] - b[0])
        .map((d) => d[1]),
    [pdrb]
  );

  const petaMode = isSemua(f.sektor) ? "basis" : "lq";
  const valueByWid = useMemo(() => {
    const m = new Map<string, number | null>();
    if (!kalsel) return m;
    for (const ft of kalsel.features) {
      const wid = ft.properties.wilayah_id;
      const baris = wilayahLQ.filter((d) => String(d.wilayah_id) === wid && d.tahun === tahun);
      if (!baris.length) { m.set(wid, null); continue; }
      if (petaMode === "basis") m.set(wid, baris.filter((d) => (d.lq as number) >= 1).length);
      else {
        const r = baris.find((d) => d.sektor_kode === f.sektor.kode);
        m.set(wid, r ? (r.lq as number) : null);
      }
    }
    return m;
  }, [kalsel, wilayahLQ, tahun, petaMode, f.sektor.kode]);

  const petaLabel =
    petaMode === "basis"
      ? "Jumlah sektor unggulan (LQ > 1)"
      : `LQ sektor ${namaPendek(f.sektor.kode, f.sektor.nama)}`;

  const topDaerah = useMemo(() => {
    if (!wilayahLQ.length) return [];
    return WILAYAH.filter((w) => w.id !== "6300")
      .map((w) => ({
        id: w.id,
        nama: w.nama,
        n: wilayahLQ.filter(
          (d) => String(d.wilayah_id) === w.id && d.tahun === tahun && (d.lq as number) >= 1
        ).length,
      }))
      .filter((d) => d.n > 0)
      .sort((a, b) => b.n - a.n);
  }, [wilayahLQ, tahun]);

  const selWil = !isSemua(f.wilayah) && f.wilayah.id !== "6300" ? f.wilayah : null;
  const selBasisN = selWil
    ? wilayahLQ.filter(
        (d) => String(d.wilayah_id) === selWil.id && d.tahun === tahun && (d.lq as number) >= 1
      ).length
    : 0;

  if (error) return <ErrorBlock error={error} />;

  return (
    <div>
      <h1 className="page-title">Potensi Ekonomi Daerah Kalimantan Selatan</h1>
      <p className="page-lede">
        Temukan komoditas unggulan tiap kabupaten/kota Kalimantan Selatan dari data resmi BPS yang
        diperbarui otomatis. Rekomendasi mengikuti metode Kajian Program Pengembangan Ekonomi Daerah
        (PED) OJK, program yang mendorong pengembangan ekonomi berbasis keunggulan daerah
      </p>

      <details className="detail-block">
        <summary>Cara pakai dasbor ini (3 langkah)</summary>
        <div className="orientasi-langkah">
          <div className="langkah">
            <span className="no">1</span>
            <div>
              <strong>Lihat gambaran umum</strong>
              <br />
              <span className="muted">Peta dan indikator utama Kalsel ada di halaman ini</span>
            </div>
          </div>          <div className="langkah">
            <span className="no">2</span>
            <div>
              <strong>Pelajari kekuatan sektor</strong>
              <br />
              <span className="muted">Buka Kondisi Ekonomi dan Subsektor Unggulan</span>
            </div>
          </div>          <div className="langkah">
            <span className="no">3</span>
            <div>
              <strong>Lihat rekomendasi</strong>
              <br />
              <span className="muted">Buka Komoditas Usulan untuk rekomendasi per kabupaten/kota</span>
            </div>
          </div>
        </div>
      </details>

      <h2 className="section-title">Indikator utama Provinsi Kalimantan Selatan</h2>
      {loading ? (
        <div className="loading-block">Memuat indikator utama…</div>
      ) : (
        <div className="kpi-grid">
          <KpiCard
            label="PDRB harga konstan"
            info="PDRB adalah total nilai barang dan jasa yang diproduksi daerah dalam setahun. Harga konstan artinya sudah disesuaikan inflasi, sehingga bisa dibandingkan antar tahun."
            value={`Rp${fmtRp(kpi.pdrbTotal)}`}
            context={`miliar Rp, tahun ${tahun}.${pdrbRank ? ` Peringkat ke-${pdrbRank.rank} dari ${pdrbRank.n} provinsi se-Indonesia.` : ""} Sudah disesuaikan inflasi`}
          >
            {kpi.pertumbuhan != null && (
              <div className={`kpi-trend ${kpi.pertumbuhan >= 0 ? "up" : "down"}`}>
                {kpi.pertumbuhan >= 0 ? "▲" : "▼"} {pctSigned(kpi.pertumbuhan)}% dari {tahun - 1}
              </div>
            )}
            <Sparkline values={pdrbSpark} color="#0D9488" />
          </KpiCard>

          <KpiCard
            label="Pertumbuhan ekonomi"
            value={kpi.pertumbuhan == null ? "-" : `${pctSigned(kpi.pertumbuhan)}%`}
            context={`Dibanding tahun ${tahun - 1}. Rata-rata nasional ${kpi.pertumbuhanNas == null ? "-" : pctSigned(kpi.pertumbuhanNas) + "%"}`}
          >
            {kpi.pertumbuhan != null && kpi.pertumbuhanNas != null && (
              <span className={`kpi-badge ${kpi.pertumbuhan >= kpi.pertumbuhanNas ? "good" : "bad"}`}>
                {kpi.pertumbuhan >= kpi.pertumbuhanNas ? "▲ di atas" : "▼ di bawah"} rata-rata nasional
              </span>
            )}
          </KpiCard>

          <KpiCard
            label={
              <>
                Sektor unggulan (LQ &gt; 1){" "}
                <InfoTip teks="Sektor yang lebih kuat di Kalsel dibanding rata-rata nasional. LQ lebih dari 1 menandai sektor basis." />
              </>
            }
            value={
              <>
                {kpi.nSektorBasis || "-"}
                <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-neutral-400)" }}>
                  {" "}
                  / 17
                </span>
              </>
            }
            context="Sektor yang lebih kuat di Kalsel dibanding rata-rata nasional"
          />

          <KpiCard
            label="Komoditas terverifikasi"
            info="Komoditas dengan data produksi atau ekspor resmi BPS yang tersedia."
            value={usulan.totalUsulan || "-"}
            context={
              <>
                Berdasar data BPS, tersebar di {usulan.nWilayahUsulan} kab/kota ·{" "}
                <Link to="/komoditas-usulan">lihat daftar</Link>
              </>
            }
          />
        </div>
      )}

      <div className="quickstart">
        <span className="qs-text">Langsung ke rekomendasi komoditas per kabupaten/kota?</span>
        <select className="input-control" value={qsWil} onChange={(e) => setQsWil(e.target.value)} aria-label="Pilih kabupaten/kota">
          {WILAYAH_OPSI.map((w) => (
            <option key={w.id} value={w.id}>{w.id === SEMUA ? "Pilih daerah…" : w.nama}</option>
          ))}
        </select>
        <button
          className="btn-cta"
          onClick={() => navigate(`/komoditas-usulan${qsWil !== SEMUA ? `?wilayah=${qsWil}` : ""}`)}
        >
          Lihat komoditas usulan
        </button>
      </div>

      <h2 className="section-title">Jelajahi peta dan angka daerah</h2>
      <FilterBar showReset hint="Klik daerah di peta atau pilih di filter untuk melihat detail sektor dan komoditas unggulannya, atau pilih satu sektor untuk mewarnai peta dengan LQ-nya" />

      {loading ? (
        <div className="loading-block">Memuat peta Kalsel…</div>
      ) : (
        <div className="grid-2">
          <Card
            title={
              <>
                Peta potensi kabupaten/kota{" "}
                <InfoTip teks="LQ (Location Quotient) menunjukkan seberapa terspesialisasi suatu daerah di sektor tertentu dibanding rata-rata nasional. LQ lebih dari 1 berarti sektor itu lebih kuat di daerah ini." />
              </>
            }
            subtitle={`Tahun ${tahun} · ${petaLabel}. Makin gelap warnanya, makin banyak sektor unggulannya. Klik daerah untuk melihat detailnya`}
            sumber={{ sumber: "BPS, PDRB lapangan usaha kab/kota", periode: `Tahun ${tahun}`, tipe: "otomatis" }}
          >
            {kalsel && (
              <KalselMap
                geojson={kalsel}
                valueByWid={valueByWid}
                ramp={petaMode === "lq" ? RAMP_LQ : RAMP_BASIS}
                formatValue={(v) =>
                  v == null
                    ? "data belum tersedia"
                    : petaMode === "basis"
                      ? `${v} sektor unggulan (LQ > 1)`
                      : `LQ ${fmt2(v)}`
                }
                downloadName="peta-ped-kalsel"
                onPilihWilayah={(id) => f.setWilayah(id)}
              />
            )}
          </Card>

          <Card
            title={selWil ? selWil.nama : "Ringkasan Provinsi Kalimantan Selatan"}
            subtitle={selWil ? `Tahun ${tahun} · ${selBasisN} sektor unggulan (LQ > 1)` : undefined}
          >
            <DetailWilayah
              w={f.wilayah}
              tahun={tahun}
              wilayahLQ={wilayahLQ}
              topDaerah={topDaerah}
              nSektorBasis={kpi.nSektorBasis}
              totalUsulan={usulan.totalUsulan}
              nWilayahUsulan={usulan.nWilayahUsulan}
            />
          </Card>
        </div>
      )}

      <LangkahLanjut
        teks={<>Sudah lihat gambaran umumnya? Pelajari seberapa besar dan sehat ekonomi tiap daerah</>}
        aksi="Buka Kondisi Ekonomi"
        to="/kondisi-ekonomi"
      />
    </div>
  );
}

function dotBasis(n: number, max: number): string {
  const r = max ? n / max : 0;
  return r >= 0.75 ? RAMP_BASIS[3] : r >= 0.5 ? RAMP_BASIS[2] : r >= 0.25 ? RAMP_BASIS[1] : RAMP_BASIS[0];
}

function DetailWilayah({
  w, tahun, wilayahLQ, topDaerah, nSektorBasis, totalUsulan, nWilayahUsulan,
}: {
  w: Wilayah; tahun: number; wilayahLQ: Row[]; topDaerah: { id: string; nama: string; n: number }[];
  nSektorBasis: number; totalUsulan: number; nWilayahUsulan: number;
}) {
  if (isSemua(w) || w.id === "6300") {
    const maxN = topDaerah[0]?.n ?? 0;
    return (
      <div>
        <p className="muted" style={{ marginTop: 0 }}>
          13 kabupaten/kota, <strong>{nSektorBasis || "-"} sektor unggulan</strong> di tingkat
          provinsi, dan <strong>{totalUsulan || "-"} komoditas terverifikasi</strong> tersebar di{" "}
          {nWilayahUsulan} kab/kota
        </p>

        {topDaerah.length > 0 && (
          <div className="top-daerah">
            <div className="top-daerah-title">Daerah dengan sektor unggulan terbanyak</div>
            {topDaerah.slice(0, 5).map((d, i) => (
              <Link key={d.id} className="td-item" to={`/komoditas-usulan?wilayah=${d.id}`}>
                <span className="td-dot" style={{ background: dotBasis(d.n, maxN) }} />
                <span className="td-name">{d.nama}</span>
                <span className="td-val" style={{ opacity: i < 3 ? 1 : 0.6 }}>
                  {d.n} sektor
                </span>
              </Link>
            ))}
          </div>
        )}

        <Link className="btn-cta btn-block" to="/komoditas-usulan">
          Lihat komoditas usulan Kalsel
        </Link>
      </div>
    );
  }

  const rows = wilayahLQ.filter((d) => String(d.wilayah_id) === w.id && d.tahun === tahun);
  if (!rows.length) {
    return (
      <p className="muted" style={{ marginTop: 0 }}>
        Data rincian sektor (PDRB 17 sektor) belum tersedia untuk wilayah ini di sumber BPS. Bagian
        ini sengaja dikosongkan dan ditandai sebagai keterbatasan
      </p>
    );
  }

  const basis = rows
    .filter((d) => (d.lq as number) >= 1)
    .sort((a, b) => (b.lq as number) - (a.lq as number));
  const pdrbWil = sum(rows, (d) => d.pdrb_wil as number);
  const prev = wilayahLQ.filter((d) => String(d.wilayah_id) === w.id && d.tahun === tahun - 1);
  const pdrbPrev = sum(prev, (d) => d.pdrb_wil as number);
  const growth = pdrbPrev ? (pdrbWil / pdrbPrev - 1) * 100 : null;
  const maxLq = basis[0] ? (basis[0].lq as number) : 1;

  return (
    <div>
      <div className="mini-stats">
        <div className="mini-stat">
          <div className="ms-val">{pdrbWil ? fmtRp(pdrbWil) : "-"}</div>
          <div className="ms-lbl">PDRB (miliar Rp)</div>
        </div>
        <div className="mini-stat">
          <div className={`ms-val ${growth != null ? (growth >= 0 ? "pos" : "neg") : ""}`}>
            {growth == null ? "-" : `${pctSigned(growth)}%`}
          </div>
          <div className="ms-lbl">Pertumbuhan</div>
        </div>
        <div className="mini-stat">
          <div className="ms-val">{basis.length}/17</div>
          <div className="ms-lbl">Sektor unggulan</div>
        </div>
      </div>

      {basis.length > 0 ? (
        <div className="lq-list">
          <div className="top-daerah-title">Sektor terkuat (LQ)</div>
          {basis.slice(0, 5).map((d) => (
            <div key={String(d.sektor_kode)} className="lq-row">
              <span className="lq-name">{namaPendek(String(d.sektor_kode), String(d.sektor))}</span>
              <span className="lq-track">
                <span
                  className="lq-fill"
                  style={{ width: `${Math.max(8, ((d.lq as number) / maxLq) * 100)}%` }}
                />
              </span>
              <span className="lq-val">{fmt2(d.lq as number)}</span>
            </div>
          ))}
          <div className="lq-note">LQ &gt; 1 = lebih kuat dari rata-rata nasional</div>
        </div>
      ) : (
        <p className="muted">Belum ada sektor dengan LQ di atas 1 untuk wilayah ini pada {tahun}</p>
      )}

      <Link className="btn-cta btn-block" to={`/komoditas-usulan?wilayah=${w.id}`}>
        Komoditas usulan {w.nama}
      </Link>
    </div>
  );
}

export function ErrorBlock({ error }: { error: Error }) {
  return (
    <div className="hero-note small">
      <strong>Gagal memuat data.</strong> {error.message} Jalankan <code>npm run data</code> untuk
      mengisi <code>public/data/</code>
    </div>
  );
}
