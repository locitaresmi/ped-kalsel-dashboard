import { useMemo } from "react";
import { sum, group, max } from "d3-array";
import { useDataset } from "../hooks/useDataset";
import { SEKTOR, namaPendek } from "../lib/sektor";
import { OJK_COLORS, type EChartsOption } from "../lib/echarts";
import { fmt0, fmt1, num } from "../lib/format";
import { EChart } from "../components/EChart";
import { Card, KpiCard, InfoTip, HeroNote } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { ErrorBlock } from "./Ringkasan";
import type { Row } from "../lib/data";

const KALSEL = "Kalimantan Selatan";
const rpT = (v: number) => `Rp ${fmt1(v / 1e12)} T`;
const pct1 = (f: number) => (f * 100).toFixed(1) + "%";

const fmtBulan = (v: unknown): string =>
  v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}` : String(v ?? "—");
const KODE17 = SEKTOR.map((s) => s.kode);

interface GapRow {
  kode: string; sektor: string; pdrbShare: number; kreditShare: number; gap: number; kredit: number;
}

export function Pembiayaan() {
  const { csv, loading, error } = useDataset({
    csv: ["kredit_bu", "dpk_bu", "bpr_bprs", "pdrb"],
  });
  const kreditBU = csv.kredit_bu ?? [];
  const dpkBU = csv.dpk_bu ?? [];
  const bpr = csv.bpr_bprs ?? [];
  const pdrb = csv.pdrb ?? [];
  const bulan = fmtBulan(kreditBU[0]?.bulan);

  const kalselKredit = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of kreditBU) if (r.provinsi === KALSEL) m.set(r.sektor_kode, (num(r.nilai) ?? 0));
    return m;
  }, [kreditBU]);
  const kalselTotal = sum([...kalselKredit.values()]);
  const kalselRT = kalselKredit.get("RT") ?? 0;
  const kalselUsaha = kalselTotal - kalselRT;

  const provTotalKredit = useMemo(() => {
    const g = group(kreditBU, (r) => r.provinsi as string);
    return [...g.entries()].map(([provinsi, rows]) => ({ provinsi, kredit: sum(rows, (r) => num(r.nilai) ?? 0) }));
  }, [kreditBU]);
  const dpkMap = useMemo(() => new Map(dpkBU.map((r) => [r.provinsi as string, num(r.dpk) ?? 0])), [dpkBU]);
  const kalselDpk = dpkMap.get(KALSEL) ?? 0;
  const kalselLDR = kalselDpk ? kalselTotal / kalselDpk : 0;
  const nasKredit = sum(provTotalKredit, (d) => d.kredit);
  const nasDpk = sum([...dpkMap.values()]);
  const nasLDR = nasDpk ? nasKredit / nasDpk : 0;

  const gapRows = useMemo<GapRow[]>(() => {
    const thn = max(pdrb, (d) => d.tahun as number);
    const pdrbThn = pdrb.filter((d) => d.tahun === thn);
    const pdrbShare = new Map<string, number>();
    for (const d of pdrbThn) pdrbShare.set(d.sektor_kode, num(d.share_prov) ?? 0);
    return KODE17.map((kode) => {
      const kredit = kalselKredit.get(kode) ?? 0;
      const ks = kalselUsaha ? kredit / kalselUsaha : 0;
      const ps = pdrbShare.get(kode) ?? 0;
      return { kode, sektor: SEKTOR.find((s) => s.kode === kode)!.nama, pdrbShare: ps, kreditShare: ks, gap: ps - ks, kredit };
    });
  }, [pdrb, kalselKredit, kalselUsaha]);
  const gapTerbesar = useMemo(() => [...gapRows].sort((a, b) => b.gap - a.gap)[0], [gapRows]);

  function gapOption(): EChartsOption {
    const asc = [...gapRows].sort((a, b) => a.pdrbShare - b.pdrbShare);
    return {
      legend: { top: 0, data: ["Porsi ekonomi (PDRB)", "Porsi kredit"], textStyle: { fontSize: 11, color: "#52525B" }, itemWidth: 12, itemHeight: 8 },
      grid: { top: 36, right: 40, bottom: 28, left: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: (v: number) => (v * 100).toFixed(0) + "%", color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: asc.map((d) => namaPendek(d.kode, d.sektor)), axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false } },
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const d = asc[p.dataIndex];
          const arah = d.gap > 0 ? "porsi kredit di bawah porsi ekonomi" : "porsi kredit di atas porsi ekonomi";
          return `<div style="font-weight:600">${d.sektor}</div><div>Porsi ekonomi (PDRB): <strong>${pct1(d.pdrbShare)}</strong></div><div>Porsi kredit: <strong>${pct1(d.kreditShare)}</strong></div><div style="font-size:11px;margin-top:2px;color:#D4A017">${arah}</div>`;
        },
      },
      series: [
        { name: "Porsi ekonomi (PDRB)", type: "bar", barGap: "-100%", barWidth: 15, z: 1, itemStyle: { color: "#E4E4E7", borderRadius: [0, 3, 3, 0] }, data: asc.map((d) => d.pdrbShare) },
        { name: "Porsi kredit", type: "bar", barWidth: 8, z: 2, itemStyle: { color: OJK_COLORS.primary, borderRadius: [0, 3, 3, 0] }, data: asc.map((d) => d.kreditShare) },
      ],
    };
  }

  function provOption(field: "kredit" | "ldr"): EChartsOption {
    const data = provTotalKredit
      .map((d) => ({ provinsi: d.provinsi, kredit: d.kredit, ldr: dpkMap.get(d.provinsi) ? d.kredit / (dpkMap.get(d.provinsi) as number) : 0 }))
      .filter((d) => (field === "ldr" ? d.ldr > 0 : true))
      .sort((a, b) => a[field] - b[field]);
    const top = data.slice(-15);
    return {
      grid: { top: 12, right: 52, bottom: 28, left: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: field === "ldr" ? (v: number) => (v * 100).toFixed(0) + "%" : (v: number) => fmt0(v / 1e12) + " T", color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: top.map((d) => d.provinsi), axisLabel: { fontSize: 10, color: "#52525B" }, axisTick: { show: false } },
      tooltip: { trigger: "item", formatter: (p: any) => { const d = top[p.dataIndex]; return `<div style="font-weight:600">${d.provinsi}</div>` + (field === "ldr" ? `<div>LDR: <strong>${pct1(d.ldr)}</strong></div>` : `<div>Kredit: <strong>${rpT(d.kredit)}</strong></div>`); } },
      series: [
        {
          type: "bar", barMaxWidth: 14,
          data: top.map((d) => ({ value: d[field], itemStyle: { color: d.provinsi === KALSEL ? OJK_COLORS.primary : "#E4A8AB", borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: "right", fontSize: 9, color: "#52525B", formatter: (p: any) => field === "ldr" ? (p.value * 100).toFixed(0) + "%" : fmt1(p.value / 1e12) },
          markLine: field === "ldr" ? { silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#A1A1AA" }, data: [{ xAxis: nasLDR }], label: { show: false } } : undefined,
        },
      ],
    };
  }

  const bprByProv = useMemo(() => {
    const g = group(bpr, (r) => r.provinsi as string);
    return [...g.entries()].map(([provinsi, rows]) => ({
      provinsi,
      kredit: sum(rows, (r) => num(r.kredit) ?? 0),
      umkm: sum(rows, (r) => num(r.kredit_umkm) ?? 0),
      dpk: sum(rows, (r) => num(r.dpk) ?? 0),
      kantor: sum(rows, (r) => num(r.kantor) ?? 0),
    }));
  }, [bpr]);
  const bprKalsel = bprByProv.find((d) => d.provinsi === KALSEL);
  const bprKalselUmkmShare = bprKalsel && bprKalsel.kredit ? bprKalsel.umkm / bprKalsel.kredit : 0;
  const bprBulan = fmtBulan(bpr[0]?.bulan);

  function bprOption(): EChartsOption {
    const top = [...bprByProv].sort((a, b) => a.kredit - b.kredit).slice(-15);
    return {
      grid: { top: 12, right: 52, bottom: 28, left: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: (v: number) => fmt0(v / 1e12) + " T", color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: top.map((d) => d.provinsi), axisLabel: { fontSize: 10, color: "#52525B" }, axisTick: { show: false } },
      tooltip: { trigger: "item", formatter: (p: any) => { const d = top[p.dataIndex]; return `<div style="font-weight:600">${d.provinsi}</div><div>Kredit BPR+BPRS: <strong>${rpT(d.kredit)}</strong></div><div>Kantor: ${fmt0(d.kantor)}</div>`; } },
      series: [{ type: "bar", barMaxWidth: 14, data: top.map((d) => ({ value: d.kredit, itemStyle: { color: d.provinsi === KALSEL ? OJK_COLORS.primary : "#E4A8AB", borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", fontSize: 9, color: "#52525B", formatter: (p: any) => fmt1(p.value / 1e12) } }],
    };
  }

  const gapCols: Column<GapRow>[] = [
    { key: "sektor", header: "Sektor", value: (r) => r.sektor, render: (r) => r.sektor },
    { key: "pdrbShare", header: "Porsi ekonomi", align: "right", value: (r) => r.pdrbShare, render: (r) => pct1(r.pdrbShare) },
    { key: "kreditShare", header: "Porsi kredit", align: "right", value: (r) => r.kreditShare, render: (r) => pct1(r.kreditShare) },
    { key: "kredit", header: "Nilai kredit", align: "right", value: (r) => r.kredit, render: (r) => rpT(r.kredit) },
    {
      key: "gap", header: "Selisih", align: "right", value: (r) => r.gap,
      render: (r) => <span style={{ color: r.gap > 0.01 ? "var(--color-danger-600)" : r.gap < -0.01 ? "var(--color-success-600)" : "#71717A", fontWeight: 600 }}>{r.gap > 0 ? "+" : ""}{(r.gap * 100).toFixed(1)} poin</span>,
    },
  ];

  if (error) return <ErrorBlock error={error} />;
  if (loading) return (
    <div>
      <h1 className="page-title">Pembiayaan</h1>
      <div className="loading-block">Memuat data…</div>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Pembiayaan dan sektor keuangan</h1>
      <p className="page-lede">
        Halaman ini menjawab pertanyaan: seberapa besar pembiayaan perbankan mengalir ke tiap sektor
        ekonomi Kalimantan Selatan, dan sektor unggulan mana yang masih kurang dibiayai. Tahap ini
        melengkapi Kajian PED dengan kinerja lembaga jasa keuangan dan indikasi gap pembiayaan.
        Semua angka berasal dari portal data resmi OJK
      </p>

      <HeroNote variant="warning">
        <strong>Catatan data.</strong> Angka kredit dan DPK adalah posisi bulan{" "}
        <strong>{bulan ?? "—"}</strong> (Bank Umum) dan <strong>{bprBulan ?? "—"}</strong> (BPR/BPRS),
        ditarik otomatis dari portal data OJK. Portal sesekali perlu beberapa kali percobaan, jadi
        pembaruan dijadwalkan dan jika gagal data terakhir tetap dipakai. Bank Umum Syariah belum
        dirinci per sektor di sini
      </HeroNote>

      <div className="kpi-grid">
        <KpiCard label="Kredit Bank Umum" info="Baki debet kredit Bank Umum yang disalurkan di Kalimantan Selatan" value={rpT(kalselTotal)} context={`Posisi ${bulan ?? ""}. Termasuk kredit usaha dan konsumsi rumah tangga`} />
        <KpiCard label="Dana Pihak Ketiga" info="Simpanan masyarakat (giro, tabungan, deposito) di Bank Umum Kalsel" value={rpT(kalselDpk)} context="Dana masyarakat yang dihimpun perbankan" />
        <KpiCard label="Rasio kredit terhadap DPK (LDR)" info="Loan to Deposit Ratio. Seberapa besar dana yang dihimpun disalurkan kembali jadi kredit" value={pct1(kalselLDR)} context={`Rata-rata nasional ${pct1(nasLDR)}`} />
        <KpiCard label="Kredit BPR dan BPRS" info="Kredit Bank Perekonomian Rakyat (konvensional dan syariah), banyak melayani UMKM" value={bprKalsel ? rpT(bprKalsel.kredit) : "—"} context={bprKalsel ? `${pct1(bprKalselUmkmShare)} untuk usaha kecil dan menengah. ${fmt0(bprKalsel.kantor)} kantor` : ""} />
      </div>

      <h2 className="section-title">
        Gap pembiayaan: kredit per sektor vs bobot ekonominya{" "}
        <InfoTip teks="Membandingkan porsi kredit yang diterima tiap sektor dengan porsi sektor itu dalam PDRB. Bila porsi kredit jauh di bawah porsi ekonomi, sektor itu berpotensi kurang dibiayai" />
      </h2>
      {gapTerbesar && (
        <HeroNote>
          Sektor <strong>{gapTerbesar.sektor}</strong> menyumbang{" "}
          <strong>{pct1(gapTerbesar.pdrbShare)}</strong> ekonomi Kalsel namun hanya menerima{" "}
          <strong>{pct1(gapTerbesar.kreditShare)}</strong> kredit usaha. Selisih sebesar{" "}
          <strong>{(gapTerbesar.gap * 100).toFixed(1)} poin</strong> ini menjadi indikasi sektor yang
          paling layak didorong pembiayaannya. Kredit konsumsi rumah tangga ({rpT(kalselRT)}) tidak
          dihitung di sini karena bukan kredit ke lapangan usaha
        </HeroNote>
      )}
      <Card
        title="Porsi kredit usaha vs porsi PDRB per sektor"
        subtitle="Batang abu = porsi sektor dalam ekonomi (PDRB). Batang merah = porsi sektor dalam kredit usaha. Bila merah jauh lebih pendek, sektor itu kurang dibiayai"
      >
        <div className="plain-summary">Perhatikan sektor dengan batang abu panjang tetapi batang merah pendek. Itu sektor yang bobot ekonominya besar tetapi pembiayaannya tertinggal</div>
        <EChart option={gapOption()} height={Math.max(360, 28 * gapRows.length + 60)} noZoom />
      </Card>
      <details className="detail-block">
        <summary>Lihat tabel gap pembiayaan per sektor</summary>
        <DataTable rows={gapRows} columns={gapCols} initialSort="gap" initialReverse />
      </details>

      <h2 className="section-title">Posisi Kalsel dibanding provinsi lain</h2>
      <HeroNote>
        Total kredit Bank Umum di Kalsel sebesar {rpT(kalselTotal)} dan rasio kredit terhadap DPK
        (LDR) {pct1(kalselLDR)}. LDR di atas rata-rata nasional menandakan dana yang dihimpun banyak
        kembali disalurkan sebagai kredit di daerah
      </HeroNote>
      <div className="chart-grid-2">
        <Card title="Total kredit Bank Umum per provinsi" subtitle="15 provinsi terbesar, dalam triliun rupiah">
          <EChart option={provOption("kredit")} height={420} noZoom />
        </Card>
        <Card title="Rasio kredit terhadap DPK (LDR) per provinsi" subtitle="15 provinsi tertinggi. Garis putus-putus = rata-rata nasional">
          <EChart option={provOption("ldr")} height={420} noZoom />
        </Card>
      </div>

      <h2 className="section-title">BPR dan BPRS: pembiayaan UMKM dan inklusi keuangan</h2>
      <HeroNote>
        Bank Perekonomian Rakyat (konvensional dan syariah) banyak melayani usaha kecil dan menengah
        serta wilayah perdesaan.
        {bprKalsel ? (
          <> Di Kalsel, BPR dan BPRS menyalurkan kredit {rpT(bprKalsel.kredit)} ({pct1(bprKalselUmkmShare)} untuk UMKM), menghimpun DPK {rpT(bprKalsel.dpk)}, melalui {fmt0(bprKalsel.kantor)} kantor.</>
        ) : null}
      </HeroNote>
      <Card title="Kredit BPR dan BPRS per provinsi" subtitle="15 provinsi terbesar, dalam triliun rupiah">
        <EChart option={bprOption()} height={420} noZoom />
      </Card>
    </div>
  );
}
