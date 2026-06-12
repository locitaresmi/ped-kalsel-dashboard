import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sum, rollups } from "d3-array";
import { useDataset } from "../hooks/useDataset";
import { useFilters, WILAYAH_OPSI } from "../hooks/useFilters";
import { isSemua, namaPendek, SEMUA, type Wilayah } from "../lib/sektor";
import { skorKomoditas } from "../lib/komoditas";
import { fmtRp, fmt2, pctSigned } from "../lib/format";
import { KalselMap } from "../components/KalselMap";
import { EChart } from "../components/EChart";
import { Card, KpiCard, InfoTip } from "../components/ui";
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

  if (error) return <ErrorBlock error={error} />;

  return (
    <div>
      <h1 className="page-title">Potensi Ekonomi Daerah Kalimantan Selatan</h1>

      <details className="detail-block">
        <summary>Cara pakai dasbor ini (3 langkah)</summary>
        <div className="orientasi-langkah">
          <div className="langkah">
            <span className="no">1</span>
            <div>
              <strong>Lihat gambaran umum</strong>
              <br />
              <span className="muted">Peta dan angka kunci Kalsel ada di halaman ini</span>
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

      <div className="hero-note">
        Dasbor ini membantu kamu menemukan komoditas unggulan di setiap kabupaten/kota Kalimantan
        Selatan berdasarkan data resmi yang diperbarui otomatis. Rekomendasi mengikuti metode Kajian
        Program Pengembangan Ekonomi Daerah (PED) OJK, yaitu program yang mendorong pengembangan
        ekonomi berbasis keunggulan daerah
      </div>

      <div className="quickstart">
        <span className="qs-text">Langsung mau lihat rekomendasi komoditas untuk kabupaten/kota tertentu?</span>
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

      <FilterBar hint="Atau jelajahi peta: pilih satu kabupaten/kota untuk melihat detail sektor dan komoditas unggulannya" />

      {loading ? (
        <div className="loading-block">Memuat data Kalsel…</div>
      ) : (
        <>
          <div className="grid-2">
            <Card
              title={
                <>
                  Peta potensi kabupaten/kota{" "}
                  <InfoTip teks="LQ (Location Quotient) menunjukkan seberapa terspesialisasi suatu daerah di sektor tertentu dibanding rata-rata nasional. LQ lebih dari 1 berarti sektor itu lebih kuat di daerah ini." />
                </>
              }
              subtitle={`Tahun ${tahun} · ${petaLabel}. Makin gelap warnanya, makin banyak sektor unggulannya`}
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
                />
              )}
            </Card>

            <Card title={isSemua(f.wilayah) ? "Ringkasan Provinsi Kalsel" : "Wilayah terpilih"}>
              <DetailWilayah
                w={f.wilayah}
                tahun={tahun}
                wilayahLQ={wilayahLQ}
                nSektorBasis={kpi.nSektorBasis}
                totalUsulan={usulan.totalUsulan}
                nWilayahUsulan={usulan.nWilayahUsulan}
              />
            </Card>
          </div>

          <h2 className="section-title">Angka kunci Provinsi Kalsel</h2>
          <div className="kpi-grid">
            <KpiCard
              label="PDRB harga konstan"
              info="PDRB adalah total nilai barang dan jasa yang diproduksi daerah dalam setahun. Harga konstan artinya sudah disesuaikan inflasi, sehingga bisa dibandingkan antar tahun."
              value={`Rp ${fmtRp(kpi.pdrbTotal)}`}
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
              value={kpi.pertumbuhan == null ? "—" : `${pctSigned(kpi.pertumbuhan)}%`}
              context={`Dibanding tahun ${tahun - 1}. Rata-rata nasional ${kpi.pertumbuhanNas == null ? "—" : pctSigned(kpi.pertumbuhanNas) + "%"}`}
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
                  {kpi.nSektorBasis || "—"}
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
              info="Tier A: komoditas dengan data produksi dan ekspor resmi yang tersedia dari BPS."
              value={usulan.totalUsulan || "—"}
              context={
                <>
                  Tier A, tersebar di {usulan.nWilayahUsulan} kab/kota ·{" "}
                  <Link to="/komoditas-usulan">lihat daftar</Link>
                </>
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

function DetailWilayah({
  w, tahun, wilayahLQ, nSektorBasis, totalUsulan, nWilayahUsulan,
}: {
  w: Wilayah; tahun: number; wilayahLQ: Row[];
  nSektorBasis: number; totalUsulan: number; nWilayahUsulan: number;
}) {
  if (isSemua(w)) {
    return (
      <div>
        <p>
          Provinsi Kalimantan Selatan terdiri dari <strong>13 kabupaten/kota</strong>. Pada tahun{" "}
          {tahun}, provinsi ini memiliki <strong>{nSektorBasis || "—"} sektor unggulan</strong>{" "}
          (sektor yang lebih kuat di Kalsel dibanding rata-rata nasional)
        </p>
        <p>
          Sudah ada <strong>{totalUsulan || "—"} komoditas terverifikasi</strong> yang
          direkomendasikan di {nWilayahUsulan} kabupaten/kota
        </p>
        <p className="muted">
          Pilih satu kabupaten/kota pada filter di atas untuk melihat sektor unggulan dan komoditas
          usulannya. Atau pilih satu sektor untuk mewarnai peta dengan LQ-nya
        </p>
        <p>
          <Link className="btn-cta" to="/komoditas-usulan">
            Lihat komoditas usulan
          </Link>
        </p>
      </div>
    );
  }
  if (w.id === "6300") {
    return (
      <div>
        <p>
          Level provinsi. Lihat angka kunci dan grafik di bawah, atau pilih satu kabupaten/kota untuk
          melihat detailnya
        </p>
        <p>
          <Link className="btn-cta" to="/komoditas-usulan">
            Lihat komoditas usulan
          </Link>
        </p>
      </div>
    );
  }
  const basis = wilayahLQ
    .filter((d) => String(d.wilayah_id) === w.id && d.tahun === tahun && (d.lq as number) >= 1)
    .sort((a, b) => (b.lq as number) - (a.lq as number));
  if (!basis.length) {
    return (
      <div>
        <p>
          Data rincian sektor (PDRB 17 sektor) belum tersedia untuk wilayah ini di sumber BPS,
          misalnya Kotabaru. Bagian ini sengaja dikosongkan dan ditandai sebagai keterbatasan
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="muted">
        Tahun {tahun} · {basis.length} sektor unggulan (LQ &gt; 1)
      </p>
      <p>Sektor terkuat di {w.nama} (LQ tertinggi):</p>
      <ul style={{ margin: "0.25rem 0", paddingLeft: "1.1rem" }}>
        {basis.slice(0, 5).map((d) => (
          <li key={String(d.sektor_kode)}>
            {String(d.sektor)} <strong>(LQ {fmt2(d.lq as number)})</strong>
          </li>
        ))}
      </ul>
      <p>
        <Link className="btn-cta" to={`/komoditas-usulan?wilayah=${w.id}`}>
          Komoditas usulan {w.nama}
        </Link>
      </p>
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
