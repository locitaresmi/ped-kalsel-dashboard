import { useMemo } from "react";
import { useDataset } from "../hooks/useDataset";
import { useFilters } from "../hooks/useFilters";
import { isSemua, namaPendek } from "../lib/sektor";
import { hitungAnalisis, type SektorMetrik } from "../lib/analisis";
import { OJK_COLORS, safeAxisMax, type EChartsOption } from "../lib/echarts";
import { pctFrac, fmt0, fmt2, koma } from "../lib/format";
import { EChart } from "../components/EChart";
import { Card, InfoTip, HeroNote, LangkahLanjut } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { FilterBar } from "../components/FilterBar";
import { ErrorBlock } from "./Ringkasan";

const warnaKuadran: Record<number, string> = { 1: "#C0272D", 2: "#D4A017", 3: "#2563EB", 4: "#94A3B8" };
const labelKuadran: Record<number, string> = {
  1: "Basis dan tumbuh cepat",
  2: "Basis tapi pertumbuhannya melambat",
  3: "Tumbuh cepat, belum jadi basis",
  4: "Kecil dan tumbuh lambat",
};
const statusDeskriptif: Record<string, string> = {
  Prima: labelKuadran[1], "Maju tertekan": labelKuadran[2],
  Potensial: labelKuadran[3], Tertinggal: labelKuadran[4],
};

const warnaLinkage: Record<number, string> = { 1: "#C0272D", 2: "#D4A017", 3: "#2563EB", 4: "#94A3B8" };
const labelLinkage: Record<number, string> = {
  1: "Sektor kunci", 2: "Penarik input", 3: "Pemasok input", 4: "Keterkaitan lemah",
};
const descLinkage: Record<number, string> = {
  1: "Banyak membutuhkan input sekaligus banyak memasok sektor lain. Mengembangkannya memberi efek domino dua arah paling besar",
  2: "Banyak membutuhkan input dari sektor lain. Permintaannya ikut menggerakkan sektor pemasok",
  3: "Hasilnya banyak dipakai sebagai input sektor lain. Cocok sebagai penyedia bahan bagi sektor hilir",
  4: "Efek dominonya ke sektor lain relatif kecil",
};

interface LinkageRow {
  kode: string; industri: string; sektor_kode: string; sektor: string;
  bl: number; fl: number; kuadran: number; tahun: number;
}

function labelIndustri(industri: string): string {
  const s = industri.replace(/^(Industri|Jasa|Pengadaan|Penyediaan|Pertambangan)\s+/i, "");
  return s.length > 16 ? s.slice(0, 15).trimEnd() + "…" : s;
}

export function SubsektorUnggulan() {
  const f = useFilters();
  const { csv, loading, error } = useDataset({ csv: ["pdrb", "wilayah", "linkage"] });
  const pdrb = csv.pdrb ?? [];
  const wilayahCsv = csv.wilayah ?? [];
  const linkRows = (csv.linkage ?? []) as LinkageRow[];
  const tahunIO = linkRows[0]?.tahun ?? 2016;

  const wilayahId = isSemua(f.wilayah) ? "6300" : f.wilayah.id;
  const namaWilayah =
    isSemua(f.wilayah) || f.wilayah.id === "6300" ? "Provinsi Kalimantan Selatan" : f.wilayah.nama;

  const analisis = useMemo(
    () => hitungAnalisis({ pdrb, wilayah: wilayahCsv, wilayahId, akhir: f.tahun }),
    [pdrb, wilayahCsv, wilayahId, f.tahun]
  );
  const rows = analisis.sektor;

  const klassenOption = useMemo<EChartsOption>(() => {
    const avgGrowth = rows[0]?.growthRef ?? 0;
    const perKuadran = [1, 2, 3, 4].map((q) => ({
      name: labelKuadran[q],
      type: "scatter" as const,
      symbolSize: 14,
      itemStyle: { color: warnaKuadran[q], opacity: 0.9, borderColor: "#fff", borderWidth: 1 },
      label: {
        show: true, position: "top" as const, fontSize: 9, color: "#3F3F46",
        formatter: (p: any) => p.data.sektorNama,
      },
      emphasis: { focus: "series" as const, scale: 1.3 },
      data: rows
        .filter((d) => d.kuadran === q)
        .map((d) => ({
          value: [d.growth, d.lq],
          sektorNama: namaPendek(d.sektor_kode, d.sektor),
          sektorFull: d.sektor, lq: d.lq, dlq: d.dlq, growth: d.growth, kelompok: labelKuadran[q],
        })),
    }));
    const target = perKuadran.find((s) => s.data.length) ?? perKuadran[0];
    (target as any).markLine = {
      silent: true, symbol: "none",
      lineStyle: { type: "dashed", color: "#D4D4D8", width: 1 },
      label: { show: true, fontSize: 9, color: "#71717A", formatter: (p: any) => p.name },
      data: [
        { yAxis: 1, name: "LQ = 1 (batas basis)" },
        { xAxis: avgGrowth, name: "Rata-rata pertumbuhan" },
      ],
    };
    return {
      legend: { top: 0, left: 0, type: "scroll", textStyle: { fontSize: 10, color: "#52525B" }, itemWidth: 12, itemHeight: 8 },
      grid: { top: 56, right: 28, bottom: 48, left: 8, containLabel: true },
      xAxis: {
        type: "value", name: "Pertumbuhan sektor →", nameLocation: "end",
        nameTextStyle: { fontSize: 10, color: "#71717A" },
        axisLabel: { formatter: (v: number) => (v * 100).toFixed(0) + "%", color: "#52525B" },
        splitLine: { lineStyle: { color: "#F4F4F5" } },
      },
      yAxis: {
        type: "log", name: "↑ LQ (porsi vs nasional)", nameLocation: "end",
        nameTextStyle: { fontSize: 10, color: "#71717A" },
        axisLabel: { color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: any) =>
          `<div style="font-weight:600;margin-bottom:4px">${p.data.sektorFull}</div>` +
          `<div>LQ: <strong>${koma(p.data.lq)}</strong></div>` +
          `<div>DLQ: <strong>${koma(p.data.dlq)}</strong></div>` +
          `<div>Pertumbuhan: <strong>${pctFrac(p.data.growth)}</strong></div>` +
          `<div style="font-size:11px;margin-top:4px;color:#D4A017">${p.data.kelompok}</div>`,
      },
      series: perKuadran,
    };
  }, [rows]);

  const dayaSaingOption = useMemo<EChartsOption>(() => {
    const data = [...rows].filter((d) => Number.isFinite(d.ss?.ds)).sort((a, b) => a.ss.ds - b.ss.ds);
    const { axisMax, outlierThreshold } = safeAxisMax(data.map((d) => d.ss.ds));
    const fmtVal = (v: number) => (Math.abs(v) >= 1000 ? koma(v / 1000, 1) + "k" : v.toFixed(0));
    return {
      grid: { top: 24, right: 28, bottom: 40, left: 8, containLabel: true },
      xAxis: {
        type: "value", min: -axisMax, max: axisMax,
        axisLabel: { formatter: fmtVal, color: "#52525B" },
        splitLine: { lineStyle: { color: "#F4F4F5" } },
        name: "← lebih lambat   |   lebih cepat dari nasional →",
        nameLocation: "middle", nameGap: 28, nameTextStyle: { fontSize: 10, color: "#71717A" },
      },
      yAxis: {
        type: "category", data: data.map((d) => namaPendek(d.sektor_kode, d.sektor)),
        axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const v = p.data._real;
          const label = v > 0 ? "lebih cepat dari nasional" : "lebih lambat dari nasional";
          return `<div style="font-weight:600;margin-bottom:4px">${p.data._full}</div>` +
            `<div>Daya saing (DS): <strong>${v.toFixed(0)}</strong></div>` +
            `<div style="font-size:11px;color:#A1A1AA">${label}${p.data._outlier ? " (di luar skala)" : ""}</div>`;
        },
      },
      series: [
        {
          type: "bar",
          data: data.map((d) => {
            const v = d.ss.ds;
            const isOut = Math.abs(v) > outlierThreshold;
            return {
              value: isOut ? (v > 0 ? axisMax : -axisMax) : v,
              _real: v, _outlier: isOut, _full: d.sektor,
              itemStyle: {
                color: v > 0 ? OJK_COLORS.positive : OJK_COLORS.negative,
                opacity: isOut ? 0.65 : 1, borderRadius: v > 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
              },
            };
          }),
          label: {
            show: true, position: "right", fontSize: 9, color: "#52525B",
            formatter: (p: any) => (p.data._outlier ? `${fmtVal(p.data._real)} *` : fmtVal(p.data._real)),
          },
          barMaxWidth: 16,
        },
      ],
    };
  }, [rows]);

  const linkageOption = useMemo<EChartsOption>(() => {
    const perKuadran = [1, 2, 3, 4].map((q) => ({
      name: labelLinkage[q],
      type: "scatter" as const,
      symbolSize: 13,
      itemStyle: { color: warnaLinkage[q], opacity: 0.9, borderColor: "#fff", borderWidth: 1 },
      label: {
        show: q === 1, position: "right" as const, fontSize: 9, color: "#3F3F46",
        formatter: (p: any) => p.data.labelPendek,
      },
      emphasis: { focus: "series" as const, scale: 1.3 },
      data: linkRows
        .filter((d) => d.kuadran === q)
        .map((d) => ({
          value: [d.bl, d.fl],
          labelPendek: labelIndustri(d.industri),
          industri: d.industri, bl: d.bl, fl: d.fl, kelompok: labelLinkage[q],
        })),
    }));
    const target = perKuadran.find((s) => s.data.length) ?? perKuadran[0];
    (target as any).markLine = {
      silent: true, symbol: "none",
      lineStyle: { type: "dashed", color: "#D4D4D8", width: 1 },
      label: { show: true, fontSize: 9, color: "#71717A", formatter: (p: any) => p.name },
      data: [
        { xAxis: 1, name: "Rata-rata (Backward)" },
        { yAxis: 1, name: "Rata-rata (Forward)" },
      ],
    };
    return {
      legend: { top: 0, left: 0, type: "scroll", textStyle: { fontSize: 10, color: "#52525B" }, itemWidth: 12, itemHeight: 8 },
      grid: { top: 56, right: 28, bottom: 52, left: 8, containLabel: true },
      xAxis: {
        type: "value", name: "Butuh input dari sektor lain (Backward) →", nameLocation: "middle",
        nameGap: 30, nameTextStyle: { fontSize: 10, color: "#71717A" },
        axisLabel: { formatter: (v: number) => koma(v, 1), color: "#52525B" },
        splitLine: { lineStyle: { color: "#F4F4F5" } },
      },
      yAxis: {
        type: "value", name: "↑ Memasok sektor lain (Forward)", nameLocation: "end",
        nameTextStyle: { fontSize: 10, color: "#71717A" },
        axisLabel: { formatter: (v: number) => koma(v, 1), color: "#52525B" },
        splitLine: { lineStyle: { color: "#F4F4F5" } },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: any) =>
          `<div style="font-weight:600;margin-bottom:4px;max-width:240px;white-space:normal">${p.data.industri}</div>` +
          `<div>Backward Linkage: <strong>${koma(p.data.bl)}</strong></div>` +
          `<div>Forward Linkage: <strong>${koma(p.data.fl)}</strong></div>` +
          `<div style="font-size:11px;margin-top:4px;color:#D4A017">${p.data.kelompok}</div>`,
      },
      series: perKuadran,
    };
  }, [linkRows]);

  const linkageCols: Column<LinkageRow>[] = [
    { key: "industri", header: "Subsektor (52 industri)", width: 280 },
    {
      key: "sektor", header: "Termasuk sektor", width: 130,
      value: (r) => r.sektor_kode, render: (r) => namaPendek(r.sektor_kode, r.sektor),
    },
    { key: "bl", header: "Backward", value: (r) => r.bl, render: (r) => fmt2(r.bl) },
    { key: "fl", header: "Forward", value: (r) => r.fl, render: (r) => fmt2(r.fl) },
    {
      key: "kelompok", header: "Kelompok", width: 150, value: (r) => r.kuadran,
      render: (r) => (
        <span style={{ color: warnaLinkage[r.kuadran], fontWeight: 600 }}>
          {labelLinkage[r.kuadran]}
        </span>
      ),
    },
  ];

  const cols: Column<SektorMetrik>[] = [
    { key: "sektor", header: "Sektor", width: 220 },
    { key: "lq", header: "LQ", value: (r) => r.lq, render: (r) => fmt2(r.lq) },
    { key: "dlq", header: "DLQ", value: (r) => r.dlq, render: (r) => fmt2(r.dlq) },
    { key: "growth", header: "Tumbuh (wilayah)", value: (r) => r.growth, render: (r) => pctFrac(r.growth) },
    { key: "growthNas", header: "Tumbuh (nasional)", value: (r) => r.growthNas, render: (r) => pctFrac(r.growthNas) },
    { key: "ss", header: "Daya saing (DS)", value: (r) => r.ss.ds, render: (r) => fmt0(r.ss.ds) },
    {
      key: "status", header: "Kelompok", width: 230, value: (r) => r.kuadran,
      render: (r) => (
        <span style={{ color: warnaKuadran[r.kuadran], fontWeight: 600 }} title={r.status}>
          {statusDeskriptif[r.status] ?? r.status}
        </span>
      ),
    },
  ];

  if (error) return <ErrorBlock error={error} />;

  return (
    <div>
      <h1 className="page-title">Subsektor unggulan</h1>
      <p className="page-lede">
        Halaman ini menjawab pertanyaan: sektor mana yang paling kuat di wilayah ini? Tahap 2 metode
        Kajian PED memakai analisis LQ-DLQ dan Shift-Share, lalu memetakannya ke tipologi Klassen.
        Sektor disebut unggulan bila tergolong basis (LQ minimal 1) dan tumbuh
      </p>

      <FilterBar hint="Pilih kabupaten/kota atau tahun untuk memperbarui semua grafik" />

      {loading ? (
        <div className="loading-block">Memuat data…</div>
      ) : rows.length === 0 ? (
        <Card>
          <p className="muted">
            Pilih tahun untuk melihat analisis sektor. Butuh rentang minimal 1 tahun, jadi pilih
            tahun ≥ {(analisis.base ?? 2020) + 1}, atau wilayah dengan data PDRB tersedia
          </p>
        </Card>
      ) : (
        <>
          <HeroNote>
            Wilayah: <strong>{namaWilayah}</strong> · periode{" "}
            <strong>{analisis.base ?? "-"} sampai {analisis.akhir ?? "-"}</strong> · {rows.length} sektor
            dianalisis · ditemukan <strong>{rows.filter((d) => d.unggul).length}</strong> sektor unggulan
            (sektor basis yang juga tumbuh). Periode dimulai dari 2021 untuk menghindari distorsi akibat
            tahun pandemi COVID-19
          </HeroNote>
          <div className="chart-grid-2">
            <Card
              title={
                <>
                  Tipologi Klassen{" "}
                  <InfoTip teks="Tipologi Klassen menyilangkan dua hal: apakah sektor ini basis (LQ minimal 1) dan apakah ia tumbuh lebih cepat dari rata-rata wilayah. Hasilnya empat kelompok sektor" />
                </>
              }
              subtitle="Sumbu mendatar: seberapa cepat sektor tumbuh. Sumbu tegak: LQ, porsi sektor dibanding rata-rata nasional. Sektor di kanan atas paling kuat"
              sumber={{ sumber: "BPS, PDRB lapangan usaha", periode: `${analisis.base ?? "-"}-${analisis.akhir ?? "-"}`, tipe: "otomatis", kunci: "pdrb" }}
            >
              <div className="plain-summary">Sektor di kanan atas = paling menjanjikan untuk dikembangkan (porsinya besar sekaligus tumbuh cepat)</div>
              <EChart option={klassenOption} height={460} noZoom />
            </Card>
            <Card
              title={
                <>
                  Daya saing sektor vs rata-rata nasional{" "}
                  <InfoTip teks="Analisis Shift-Share memisahkan pertumbuhan sektor menjadi tiga komponen. Yang ditampilkan di sini adalah komponen keunggulan kompetitif daerah (differential shift)" />
                </>
              }
              subtitle="Hijau: tumbuh lebih cepat dari rata-rata nasional di bidang yang sama. Merah: lebih lambat"
              sumber={{ sumber: "BPS, PDRB lapangan usaha", periode: `${analisis.base ?? "-"}-${analisis.akhir ?? "-"}`, tipe: "otomatis", kunci: "pdrb" }}
            >
              <div className="plain-summary">Batang hijau ke kanan = sektor daerah unggul dari rata-rata nasional. Merah ke kiri = tertinggal</div>
              <EChart option={dayaSaingOption} height={Math.max(360, 28 * rows.length + 60)} noZoom />
            </Card>
          </div>

          <h2 className="section-title">Ringkasan metrik per sektor</h2>
          <Card className="kolom-legenda">
            <strong>Arti tiap kolom</strong> (klik judul kolom untuk mengurutkan):
            <ul>
              <li>
                <strong>LQ</strong>{" "}
                <InfoTip teks="Location Quotient. Lebih dari 1 artinya sektor ini lebih terspesialisasi dibanding rata-rata nasional" />{" "}
                seberapa besar porsi sektor dibanding rata-rata nasional
              </li>
              <li>
                <strong>DLQ</strong>{" "}
                <InfoTip teks="Dynamic LQ. Lebih dari 1 artinya potensi pertumbuhan lebih baik dari nasional" />{" "}
                potensi pertumbuhan sektor ke depan
              </li>
              <li>
                <strong>Daya saing (DS)</strong>{" "}
                <InfoTip teks="Differential Shift. Positif artinya tumbuh lebih cepat dari rata-rata nasional untuk sektor yang sama" />{" "}
                apakah sektor tumbuh lebih cepat dari rata-rata nasional
              </li>
              <li>
                <strong>Kelompok</strong>{" "}
                <InfoTip teks="Tipologi Klassen. Posisi sektor berdasarkan kombinasi LQ dan pertumbuhan" />{" "}
                ringkasan posisi sektor dalam bahasa biasa
              </li>
            </ul>
          </Card>

          <Card className="tabel-sektor">
            <DataTable rows={rows} columns={cols} initialSort="lq" initialReverse maxRows={18} />
          </Card>

          <h2 className="section-title">
            Keterkaitan antar-sektor (Forward dan Backward Linkage){" "}
            <InfoTip teks="Forward dan Backward Linkage mengukur efek domino antar sektor. Backward Linkage tinggi berarti sektor banyak membutuhkan input dari sektor lain. Forward Linkage tinggi berarti hasilnya banyak dipakai sektor lain. Sumbernya Tabel Input-Output BPS" />
          </h2>
          <HeroNote variant="warning">
            Analisis ini memakai Tabel Input-Output Kalimantan Selatan tahun <strong>{tahunIO}</strong>,
            data resmi BPS terbaru yang tersedia untuk metode ini. Angkanya berlaku untuk seluruh
            provinsi, jadi hasilnya sama untuk semua pilihan kabupaten/kota
          </HeroNote>

          {linkRows.length === 0 ? (
            <Card>
              <p className="muted">Data keterkaitan antar-sektor belum tersedia</p>
            </Card>
          ) : (
            <>
              <Card
                title="Posisi 52 subsektor berdasarkan keterkaitannya"
                subtitle="Sumbu mendatar: seberapa banyak sektor membutuhkan input dari sektor lain. Sumbu tegak: seberapa banyak hasilnya dipakai sektor lain. Garis putus-putus adalah rata-rata"
                sumber={{ sumber: "BPS, Tabel Input-Output Kalimantan Selatan", periode: `Tahun ${tahunIO}`, tipe: "berkala", kunci: "linkage" }}
              >
                <div className="plain-summary">
                  Subsektor di kanan atas adalah sektor kunci. Mengembangkannya memberi efek domino
                  terbesar ke sektor lain di Kalimantan Selatan
                </div>
                <EChart option={linkageOption} height={460} noZoom />
              </Card>

              <Card className="kolom-legenda">
                <strong>Arti keempat kelompok</strong> (posisi tiap subsektor di grafik dan tabel):
                <ul>
                  {[1, 2, 3, 4].map((q) => (
                    <li key={q}>
                      <span style={{ color: warnaLinkage[q], fontWeight: 600 }}>{labelLinkage[q]}</span>{" "}
                      {descLinkage[q]}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="tabel-sektor">
                <DataTable
                  rows={linkRows}
                  columns={linkageCols}
                  initialSort="bl"
                  initialReverse
                  searchable
                  searchPlaceholder="Cari subsektor…"
                  maxRows={12}
                />
              </Card>
            </>
          )}

          <p className="muted">
            Catatan: perhitungan memakai tahun dasar 2021 (setelah pandemi) untuk menghindari distorsi
            akibat titik terendah pandemi 2020
          </p>

          <LangkahLanjut
            teks={<>Sudah tahu sektor unggulannya? Lihat komoditas yang direkomendasikan per kabupaten/kota</>}
            aksi="Buka Komoditas Usulan"
            to="/komoditas-usulan"
          />
        </>
      )}
    </div>
  );
}
