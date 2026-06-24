import { useMemo, useState } from "react";
import { sum, max, group } from "d3-array";
import { useDataset } from "../hooks/useDataset";
import { useFilters } from "../hooks/useFilters";
import { isSemua, namaPendek, SEKTOR_WARNA } from "../lib/sektor";
import { OJK_COLORS, type EChartsOption } from "../lib/echarts";
import { fmt0, fmt1, fmt2, pctSigned, num, koma } from "../lib/format";
import { format } from "d3-format";
import { EChart } from "../components/EChart";
import { KalselMap } from "../components/KalselMap";
import { Card, InfoTip, HeroNote, KpiCard, LangkahLanjut } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { FilterBar } from "../components/FilterBar";
import { ErrorBlock } from "./Ringkasan";
import type { Row } from "../lib/data";

const bersih = (s: unknown) => String(s ?? "").replace(/;\s*/g, ", ");
const fpct2 = format(".2f");
const fpct1 = format(".1f");
const TPT_RAMP = ["#FDF0F0", "#E05555", "#8B1A1A"];
const BULAN_NAMA = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const HS_NAMA_ID: Record<string, string> = {
  "27": "Bahan bakar mineral (batu bara)", "15": "Minyak & lemak nabati/hewani (CPO)",
  "38": "Produk kimia lainnya", "25": "Garam, belerang, batu, & semen",
  "23": "Ampas & sisa industri makanan (pakan)", "44": "Kayu & barang dari kayu",
  "16": "Olahan daging, ikan, & krustasea", "03": "Ikan, krustasea, & moluska",
  "40": "Karet & barang dari karet", "46": "Anyaman (rotan, bambu, dsb)",
};
const namaKomEkspor = (d: Row): string =>
  HS_NAMA_ID[String(d.kodehs).padStart(2, "0")] ?? String(d.label ?? "").replace(/^\[\d+\]\s*/, "");
const fmtUSD = (v: number): string =>
  v >= 1e9 ? `US$ ${fmt1(v / 1e9)} miliar`
  : v >= 1e6 ? `US$ ${fmt1(v / 1e6)} juta`
  : v >= 1e3 ? `US$ ${fmt0(v / 1e3)} ribu`
  : `US$ ${fmt0(v)}`;

interface RegRow { tahun: number; sektor_kode: string; sektor: string; nilai: number; share: number; lq: number }

export function KondisiEkonomi() {
  const f = useFilters();
  const { csv, geo, loading, error } = useDataset({
    csv: ["pdrb", "wilayah", "pdrb_provinsi", "kesejahteraan", "inflasi", "ketenagakerjaan", "pdrb_kalimantan", "exim_kalsel", "ekspor", "apbd"],
    geo: ["kalsel"],
  });

  const pdrb = csv.pdrb ?? [];
  const wilayahCsv = csv.wilayah ?? [];
  const pdrbProv = csv.pdrb_provinsi ?? [];
  const kesra = csv.kesejahteraan ?? [];
  const inflasi = csv.inflasi ?? [];
  const tenagaKerja = csv.ketenagakerjaan ?? [];
  const pdrbKalimantan = csv.pdrb_kalimantan ?? [];
  const kalsel = geo.kalsel as { features: { properties: { wilayah_id: string; nama: string } }[] } | undefined;

  const isProv = isSemua(f.wilayah) || f.wilayah.id === "6300";
  const wid = isProv ? "6300" : f.wilayah.id;
  const namaW = isProv ? "Provinsi Kalimantan Selatan" : f.wilayah.nama;

  const regRows: RegRow[] = useMemo(
    () =>
      isProv
        ? pdrb.map((d) => ({ tahun: d.tahun, sektor_kode: d.sektor_kode, sektor: bersih(d.sektor), nilai: d.pdrb_prov, share: d.share_prov, lq: d.lq }))
        : wilayahCsv
            .filter((d) => String(d.wilayah_id) === wid)
            .map((d) => ({ tahun: d.tahun, sektor_kode: d.sektor_kode, sektor: bersih(d.sektor), nilai: d.pdrb_wil, share: d.share_wil, lq: d.lq })),
    [pdrb, wilayahCsv, isProv, wid]
  );

  const tahunAda = useMemo(() => [...new Set(regRows.map((d) => d.tahun))].sort((a, b) => a - b), [regRows]);
  const thisYear = tahunAda.includes(f.tahun) ? f.tahun : tahunAda[tahunAda.length - 1];
  const prevYear = thisYear - 1;

  const totalSeries = useMemo(
    () => tahunAda.map((y) => ({ tahun: y, total: sum(regRows.filter((d) => d.tahun === y), (d) => d.nilai) })),
    [tahunAda, regRows]
  );
  const totalThis = totalSeries.find((d) => d.tahun === thisYear)?.total ?? 0;
  const totalPrev = totalSeries.find((d) => d.tahun === prevYear)?.total ?? null;
  const growth = totalPrev ? (totalThis / totalPrev - 1) * 100 : null;
  const strukturThis = useMemo(
    () => regRows.filter((d) => d.tahun === thisYear).sort((a, b) => b.share - a.share),
    [regRows, thisYear]
  );
  const dominan = strukturThis[0];
  const nBasis = strukturThis.filter((d) => d.lq >= 1).length;

  const isNas = (d: Row) => d.nasional === true || d.nasional === "true";
  const isKal = (d: Row) => d.kalimantan === true || d.kalimantan === "true";
  const ppYears = [...new Set(pdrbProv.map((d) => d.tahun))].sort((a, b) => a - b);
  const ppYear = ppYears.includes(thisYear) ? thisYear : ppYears[ppYears.length - 1];
  const ppTh = pdrbProv.filter((d) => d.tahun === ppYear);
  const provOnly = ppTh.filter((d) => !isNas(d));
  const nasRow = ppTh.find(isNas);
  const kalselRow = ppTh.find((d) => /kalimantan selatan/i.test(d.provinsi));
  const sortedShare = [...provOnly].sort((a, b) => b.share_pdrb_pct - a.share_pdrb_pct);
  const kalselRank = sortedShare.findIndex((d) => /kalimantan selatan/i.test(d.provinsi)) + 1;
  const kalProv = provOnly.filter(isKal).sort((a, b) => b.share_pdrb_pct - a.share_pdrb_pct);
  const kalAgg = sum(kalProv, (d) => d.share_pdrb_pct);
  const gKalsel = kalselRow?.growth_pct;
  const gNas = nasRow?.growth_pct;

  function barProvinsiOption(rowsAsc: Row[], valKey: string, satuan = "%", ruleAt: number | null = null): EChartsOption {
    return {
      grid: { top: 12, right: 48, bottom: 36, left: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: `{value}${satuan}`, color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: rowsAsc.map((d) => d.provinsi), axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false } },
      tooltip: { trigger: "item", formatter: (p: any) => `<div style="font-weight:600">${p.name}</div><div>${koma(p.value)}${satuan}</div>` },
      series: [
        {
          type: "bar", barMaxWidth: 18,
          data: rowsAsc.map((d) => ({
            value: d[valKey],
            itemStyle: { color: /kalimantan selatan/i.test(d.provinsi) ? OJK_COLORS.primary : "#E4A8AB", borderRadius: [0, 4, 4, 0] },
          })),
          label: { show: true, position: "right", fontSize: 10, color: "#52525B", formatter: (p: any) => koma(p.value) + satuan },
          markLine: ruleAt == null ? undefined : {
            silent: true, symbol: "none", lineStyle: { type: "dashed", color: OJK_COLORS.negative, width: 1 },
            data: [{ xAxis: ruleAt }], label: { show: false },
          },
        },
      ],
    };
  }

  const pkYear = pdrbKalimantan.length ? max(pdrbKalimantan, (d) => d.tahun as number) : null;
  const pkRows: Row[] = pdrbKalimantan
    .filter((d) => d.tahun === pkYear)
    .map((d) => ({ ...d, sektor: bersih(d.sektor), sektorPendek: namaPendek(d.sektor_kode, d.sektor) }));
  const pkProvOrder = ["Kalimantan Timur", "Kalimantan Selatan", "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Utara"];

  function kalStrukturOption(): EChartsOption {
    const byKode = group(pkRows, (d) => d.sektor_kode as string);
    const orderProv = [...pkProvOrder].reverse();
    const series = [...byKode.keys()].map((kode) => {
      const items = byKode.get(kode)!;
      const m = new Map(items.map((d) => [d.provinsi, d.share_pct]));
      return {
        name: items[0].sektorPendek, type: "bar" as const, stack: "total",
        emphasis: { focus: "series" as const },
        itemStyle: { color: SEKTOR_WARNA[kode] ?? "#999" },
        data: orderProv.map((p) => m.get(p) ?? 0),
      };
    });
    return {
      legend: { type: "scroll", bottom: 0, textStyle: { fontSize: 10, color: "#52525B" }, itemWidth: 12, itemHeight: 8 },
      grid: { top: 16, right: 24, bottom: 44, left: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: "{value}%", color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: orderProv, axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false } },
      tooltip: { trigger: "item", formatter: (p: any) => `<div style="font-weight:600">${p.seriesName}</div><div>${p.name}: ${koma(+p.value, 1)}%</div>` },
      series,
    };
  }

  const kotaInflasi = [...new Set(inflasi.map((d) => d.kota as string))].filter((k) => !/kalimantan selatan/i.test(k));
  const [kotaPilih, setKotaPilih] = useState<string[] | null>(null);
  const kotaSel = kotaPilih ?? kotaInflasi.filter((k) => /banjarmasin|tanjung/i.test(k));
  const infView = useMemo<Row[]>(
    () =>
      inflasi
        .filter((d) => kotaSel.includes(d.kota) && d.ihk !== "" && d.ihk != null)
        .map((d) => ({ ...d, ts: new Date(d.tanggal).getTime() })),
    [inflasi, kotaSel]
  );
  const infYears = [...new Set(inflasi.map((d) => d.tahun as number))].sort((a, b) => a - b);

  function lineKotaOption(valKey: string, opts: { zeroLine?: boolean; fmt?: string; suffix?: string } = {}): EChartsOption {
    const byKota = group(infView, (d) => d.kota as string);
    const series = [...byKota.keys()].map((kota) => {
      const s: any = {
        name: kota, type: "line", smooth: 0.3, showSymbol: false, symbol: "circle", symbolSize: 6,
        emphasis: { focus: "series" }, lineStyle: { width: 2 },
        data: [...byKota.get(kota)!]
          .filter((d) => (d as any)[valKey] !== "" && (d as any)[valKey] != null)
          .sort((a, b) => a.ts - b.ts)
          .map((d) => [d.ts, +(d as any)[valKey]]),
      };
      return s;
    });
    if (opts.zeroLine && series.length) {
      series[0].markLine = { silent: true, symbol: "none", lineStyle: { color: "#D4D4D8" }, data: [{ yAxis: 0 }], label: { show: false } };
    }
    return {
      legend: { top: 0, type: "scroll", textStyle: { fontSize: 10, color: "#52525B" } },
      grid: { top: 40, right: 20, bottom: 56, left: 8, containLabel: true },
      xAxis: { type: "time", axisLabel: { color: "#52525B" }, splitLine: { show: false } },
      yAxis: { type: "value", scale: true, axisLabel: { color: "#52525B", formatter: opts.fmt || "{value}" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      tooltip: { trigger: "axis", valueFormatter: (v: any) => (v == null ? "" : koma(+v) + (opts.suffix || "")) },
      series,
    };
  }

  const exim = csv.exim_kalsel ?? [];
  const eximView = useMemo<Row[]>(
    () => exim.map((d) => ({ ...d, ts: new Date(d.tanggal).getTime() })).sort((a, b) => a.ts - b.ts),
    [exim]
  );
  const eximYears = [...new Set(exim.map((d) => d.tahun as number))].sort((a, b) => a - b);
  const eximLatest = eximView[eximView.length - 1];
  const eximYearStats = eximYears.map((y) => {
    const rs = exim.filter((d) => d.tahun === y && num(d.ekspor) != null);
    return { y, months: rs.length, ekspor: sum(rs, (d) => num(d.ekspor) ?? 0), impor: sum(rs, (d) => num(d.impor) ?? 0) };
  });
  const eximFull = [...eximYearStats].reverse().find((s) => s.months >= 12) ?? eximYearStats[eximYearStats.length - 1];

  function eximLineOption(): EChartsOption {
    const mk = (key: string, name: string, color: string) => ({
      name, type: "line" as const, smooth: 0.3, showSymbol: false, symbol: "circle", symbolSize: 6,
      emphasis: { focus: "series" as const }, lineStyle: { width: 2, color }, itemStyle: { color },
      data: eximView.filter((d) => num(d[key]) != null).map((d) => [d.ts, num(d[key])]),
    });
    return {
      legend: { top: 0, textStyle: { fontSize: 10, color: "#52525B" } },
      grid: { top: 40, right: 20, bottom: 56, left: 8, containLabel: true },
      xAxis: { type: "time", axisLabel: { color: "#52525B" }, splitLine: { show: false } },
      yAxis: { type: "value", scale: true, axisLabel: { color: "#52525B", formatter: (v: number) => format("~s")(v) }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      tooltip: { trigger: "axis", valueFormatter: (v: any) => (v == null ? "" : "US$ " + fmt0(+v) + " jt") },
      series: [
        mk("ekspor", "Ekspor", OJK_COLORS.primary),
        mk("impor", "Impor", "#0891B2"),
        mk("neraca", "Neraca (surplus)", OJK_COLORS.accent),
      ],
    };
  }

  const ekspor = csv.ekspor ?? [];
  const eksporKom = useMemo<Row[]>(
    () => ekspor
      .map((d) => ({ ...d, kalsel: num(d.nilai_kalsel_usd) ?? 0, nas: num(d.nilai_nasional_usd) ?? 0 }))
      .filter((d) => (d.kalsel as number) > 0)
      .sort((a, b) => (b.kalsel as number) - (a.kalsel as number)),
    [ekspor]
  );
  const eksporTahun = ekspor[0]?.tahun;
  const eksporNasAll = sum(ekspor, (d) => num(d.nilai_nasional_usd) ?? 0);
  const eksporKalselAll = sum(ekspor, (d) => num(d.nilai_kalsel_usd) ?? 0);
  const eksporShareNas = eksporNasAll ? eksporKalselAll / eksporNasAll : 0;
  const eksporTop1 = eksporKom[0];
  const eksporTop2 = eksporKom[1];
  const shareNas = (d: Row) => ((d.nas as number) ? (d.kalsel as number) / (d.nas as number) : 0);
  const fmtShare = (s: number) => (s >= 0.1 ? fpct1(s * 100) : fpct2(s * 100)) + "%";

  function eksporKomOption(): EChartsOption {
    const asc = [...eksporKom].reverse();
    return {
      legend: { top: 0, data: ["Kalimantan Selatan", "Nasional"], textStyle: { fontSize: 11, color: "#52525B" }, itemWidth: 12, itemHeight: 8 },
      grid: { top: 36, right: 96, bottom: 36, left: 8, containLabel: true },
      xAxis: { type: "log", min: 1e4, axisLabel: { formatter: (v: number) => "$" + format("~s")(v), color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: asc.map(namaKomEkspor), axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false } },
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const d = asc[p.dataIndex];
          return `<div style="font-weight:600">${namaKomEkspor(d)}</div>` +
            `<div>Kalsel: <strong>${fmtUSD(d.kalsel)}</strong></div>` +
            `<div>Nasional: ${fmtUSD(d.nas)}</div>` +
            `<div style="font-size:11px;margin-top:2px;color:#D4A017">Kalsel = ${fmtShare(shareNas(d))} ekspor nasional · peringkat #${d.peringkat_nasional}</div>`;
        },
      },
      series: [
        {
          name: "Nasional", type: "bar", barWidth: 15, barGap: "-100%", z: 1,
          itemStyle: { color: "#E4E4E7", borderRadius: [0, 3, 3, 0] },
          data: asc.map((d) => d.nas as number),
        },
        {
          name: "Kalimantan Selatan", type: "bar", barWidth: 8, z: 2,
          itemStyle: { color: OJK_COLORS.primary, borderRadius: [0, 3, 3, 0] },
          data: asc.map((d) => d.kalsel as number),
          label: { show: true, position: "right", fontSize: 9, color: "#52525B", formatter: (p: any) => fmtShare(shareNas(asc[p.dataIndex])) },
        },
      ],
    };
  }

  const eksporCols: Column<Row>[] = [
    { key: "komoditas", header: "Komoditas", value: (r) => namaKomEkspor(r), render: (r) => namaKomEkspor(r) },
    { key: "kalsel", header: "Ekspor Kalsel", align: "right", value: (r) => r.kalsel as number, render: (r) => fmtUSD(r.kalsel as number) },
    { key: "nas", header: "Ekspor nasional", align: "right", value: (r) => r.nas as number, render: (r) => fmtUSD(r.nas as number) },
    { key: "share", header: "Porsi Kalsel", align: "right", value: (r) => shareNas(r), render: (r) => (r.nas ? fmtShare(shareNas(r)) : "-") },
    { key: "peringkat_nasional", header: "Peringkat nasional", align: "right", value: (r) => num(r.peringkat_nasional), render: (r) => "#" + r.peringkat_nasional },
  ];

  const tkYears = [...new Set(tenagaKerja.map((d) => d.tahun as number))].sort((a, b) => a - b);
  const tkYear = tkYears.includes(thisYear) ? thisYear : tkYears[tkYears.length - 1];
  const tkTh = tenagaKerja.filter((d) => d.tahun === tkYear);
  const tkKab = tkTh.filter((d) => d.level === "kabkota");
  const tkProv = tkTh.find((d) => d.level === "provinsi");
  const tkWil = tkTh.find((d) => String(d.wilayah_id) === wid);
  const tkPeriode = tkTh[0]?.periode ?? "";

  const tptByWid = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const d of tkKab) m.set(String(d.wilayah_id), num(d.tpt));
    return m;
  }, [tkKab]);

  function tptTpakOption(): EChartsOption {
    const data = tkKab
      .map((d) => ({ wilayah: d.wilayah, id: String(d.wilayah_id), tpt: num(d.tpt), tpak: num(d.tpak) }))
      .filter((d) => d.tpt != null)
      .sort((a, b) => (a.tpt as number) - (b.tpt as number));
    return {
      legend: { top: 0, data: ["TPT", "TPAK"], textStyle: { fontSize: 11, color: "#52525B" } },
      grid: { top: 36, right: 24, bottom: 36, left: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: "{value}%", color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: data.map((d) => d.wilayah), axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false } },
      tooltip: { trigger: "item", formatter: (p: any) => `<div style="font-weight:600">${p.name}</div><div>${p.seriesName}: ${p.value[0]}%</div>` },
      series: [
        { name: "TPAK", type: "scatter", symbolSize: 9, itemStyle: { color: "#0891B2" }, data: data.map((d) => [d.tpak, d.wilayah]) },
        { name: "TPT", type: "scatter", symbolSize: 9, itemStyle: { color: OJK_COLORS.negative }, data: data.map((d) => [d.tpt, d.wilayah]) },
      ],
    };
  }

  function strukturOption(): EChartsOption {
    const asc = [...strukturThis].reverse();
    return {
      grid: { top: 12, right: 44, bottom: 36, left: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: (v: number) => (v * 100).toFixed(0) + "%", color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: asc.map((d) => namaPendek(d.sektor_kode, d.sektor)), axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false } },
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const d = asc[p.dataIndex];
          return `<div style="font-weight:600">${d.sektor}</div><div>Pangsa: ${koma(d.share * 100)}%</div><div>LQ: ${koma(d.lq)}</div>`;
        },
      },
      series: [
        {
          type: "bar", barMaxWidth: 16,
          data: asc.map((d) => ({
            value: d.share,
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              color: !isSemua(f.sektor)
                ? d.sektor_kode === f.sektor.kode ? OJK_COLORS.accent : "#D4D4D8"
                : d.lq >= 1 ? OJK_COLORS.primary : "#E4A8AB",
            },
          })),
          label: { show: true, position: "right", fontSize: 10, color: "#52525B", formatter: (p: any) => koma(p.value * 100, 1) + "%" },
        },
      ],
    };
  }

  function trenOption(): EChartsOption {
    return {
      grid: { top: 16, right: 20, bottom: 36, left: 8, containLabel: true },
      xAxis: { type: "category", data: tahunAda.map(String), boundaryGap: false, axisLabel: { color: "#52525B" } },
      yAxis: { type: "value", scale: true, axisLabel: { color: "#52525B", formatter: (v: number) => format("~s")(v) }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      tooltip: { trigger: "axis", valueFormatter: (v: any) => fmt0(v) },
      series: [
        {
          type: "line", smooth: 0.3, symbol: "circle", symbolSize: 6, showSymbol: false,
          lineStyle: { color: OJK_COLORS.primary, width: 2 }, itemStyle: { color: OJK_COLORS.primary },
          emphasis: { lineStyle: { width: 3 } },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(192,39,45,0.15)" }, { offset: 1, color: "rgba(192,39,45,0)" }] } },
          data: totalSeries.map((d) => d.total),
        },
      ],
    };
  }

  function komposisiOption(): EChartsOption {
    const byKode = group(regRows, (d) => d.sektor_kode);
    const series = [...byKode.keys()].map((kode) => {
      const items = byKode.get(kode)!;
      const m = new Map(items.map((d) => [d.tahun, d.share]));
      return {
        name: namaPendek(kode, items[0].sektor), type: "bar" as const, stack: "total", emphasis: { focus: "series" as const },
        itemStyle: { color: SEKTOR_WARNA[kode] ?? "#999" },
        data: tahunAda.map((t) => { const v = m.get(t); return v == null ? 0 : +(v * 100).toFixed(2); }),
      };
    });
    return {
      legend: { type: "scroll", bottom: 0, textStyle: { fontSize: 10, color: "#52525B" }, itemWidth: 12, itemHeight: 8 },
      grid: { top: 16, right: 24, bottom: 48, left: 8, containLabel: true },
      xAxis: { type: "category", data: tahunAda.map(String), axisLabel: { color: "#52525B" } },
      yAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%", color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      tooltip: { trigger: "item", formatter: (p: any) => `<div style="font-weight:600">${p.seriesName} (${p.name})</div><div>${koma(+p.value)}%</div>` },
      series,
    };
  }

  const ksYears = [...new Set(kesra.map((d) => d.tahun as number))].sort((a, b) => a - b);
  const ksYear = ksYears.includes(thisYear) ? thisYear : ksYears[ksYears.length - 1];
  const ksTh = kesra.filter((d) => d.tahun === ksYear);
  const ksWil = ksTh.find((d) => String(d.wilayah_id) === wid);
  const ksKalsel = ksTh.find((d) => String(d.wilayah_id) === "6300");
  const ksNas = ksTh.find((d) => d.level === "nasional");
  const ksKab = ksTh.filter((d) => d.level === "kabkota");

  function rankOption(field: string, label: string): EChartsOption {
    const data = ksKab
      .map((d) => ({ wilayah: d.wilayah, val: num(d[field]), id: String(d.wilayah_id) }))
      .filter((d) => d.val != null)
      .sort((a, b) => (field === "miskin_pct" ? (b.val as number) - (a.val as number) : (a.val as number) - (b.val as number)));
    const nas = num(ksNas?.[field]);
    return {
      grid: { top: 12, right: 40, bottom: 36, left: 8, containLabel: true },
      xAxis: {
        type: "value", name: label, nameLocation: "middle", nameGap: 26, nameTextStyle: { fontSize: 10, color: "#71717A" },
        axisLabel: { color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } },
      },
      yAxis: { type: "category", data: data.map((d) => d.wilayah), axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false } },
      tooltip: { trigger: "item", formatter: (p: any) => `<div style="font-weight:600">${p.name}</div><div>${label}: ${p.value}</div>` },
      series: [
        {
          type: "bar", barMaxWidth: 15,
          data: data.map((d) => ({
            value: d.val,
            itemStyle: { borderRadius: [0, 4, 4, 0], color: !isProv && d.id === wid ? OJK_COLORS.accent : "#E4A8AB" },
          })),
          markLine: nas == null ? undefined : { silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#A1A1AA" }, data: [{ xAxis: nas }], label: { show: false } },
        },
      ],
    };
  }

  const sektorCols: Column<RegRow>[] = [
    { key: "sektor", header: "Sektor" },
    { key: "nilai", header: "PDRB ADHK", align: "right", value: (r) => r.nilai, render: (r) => fmt0(r.nilai) },
    { key: "share", header: "Pangsa", align: "right", value: (r) => r.share, render: (r) => fpct2(r.share * 100) + "%" },
    {
      key: "lq", header: "LQ", align: "right", value: (r) => r.lq,
      render: (r) => <span style={{ color: r.lq >= 1 ? "var(--color-primary-700)" : "#888", fontWeight: r.lq >= 1 ? 600 : 400 }}>{fmt2(r.lq)}</span>,
    },
  ];

  const apbd = csv.apbd ?? [];
  const apbdYears = [...new Set(apbd.map((d) => d.tahun as number))].sort((a, b) => a - b);
  const apbdTahun = apbdYears.includes(thisYear) ? thisYear : apbdYears[apbdYears.length - 1];
  const apbdTh = apbd.filter((d) => d.tahun === apbdTahun);
  const apbdKab = apbdTh.filter((d) => String(d.wilayah_id) !== "6300");
  const apbdWil = apbdTh.find((d) => String(d.wilayah_id) === wid);
  const apbdProv = apbdTh.find((d) => String(d.wilayah_id) === "6300");
  const realisasiBelanja = (r: Row | undefined) =>
    r && num(r.belanja) ? (num(r.belanja_real) ?? 0) / (num(r.belanja) as number) : null;

  function apbdOption(): EChartsOption {
    const data = apbdKab
      .map((d) => ({ wilayah: d.wilayah, id: String(d.wilayah_id), val: (num(d.rasio_tkd) ?? 0) * 100 }))
      .sort((a, b) => b.val - a.val);
    const provVal = apbdProv ? (num(apbdProv.rasio_tkd) ?? 0) * 100 : null;
    return {
      grid: { top: 12, right: 44, bottom: 36, left: 8, containLabel: true },
      xAxis: { type: "value", name: "Ketergantungan transfer pusat", nameLocation: "middle", nameGap: 26, nameTextStyle: { fontSize: 10, color: "#71717A" }, axisLabel: { formatter: "{value}%", color: "#52525B" }, splitLine: { lineStyle: { color: "#F4F4F5" } } },
      yAxis: { type: "category", data: data.map((d) => d.wilayah), axisLabel: { fontSize: 11, color: "#52525B" }, axisTick: { show: false } },
      tooltip: { trigger: "item", formatter: (p: any) => `<div style="font-weight:600">${p.name}</div><div>Ketergantungan transfer: ${koma(+p.value, 1)}%</div>` },
      series: [
        {
          type: "bar", barMaxWidth: 15,
          data: data.map((d) => ({ value: d.val, itemStyle: { borderRadius: [0, 4, 4, 0], color: !isProv && d.id === wid ? OJK_COLORS.accent : "#E4A8AB" } })),
          label: { show: true, position: "right", fontSize: 9, color: "#52525B", formatter: (p: any) => (+p.value).toFixed(0) + "%" },
          markLine: provVal == null ? undefined : { silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#A1A1AA" }, data: [{ xAxis: provVal }], label: { show: false } },
        },
      ],
    };
  }

  const apbdCols: Column<Row>[] = [
    { key: "wilayah", header: "Wilayah", value: (r) => r.wilayah, render: (r) => r.wilayah },
    { key: "pendapatan", header: "Pendapatan", align: "right", value: (r) => num(r.pendapatan), render: (r) => "Rp" + fmt1((num(r.pendapatan) ?? 0) / 1e12) + " T" },
    { key: "rasio_pad", header: "PAD", align: "right", value: (r) => num(r.rasio_pad), render: (r) => fpct1((num(r.rasio_pad) ?? 0) * 100) + "%" },
    { key: "rasio_tkd", header: "Transfer pusat", align: "right", value: (r) => num(r.rasio_tkd), render: (r) => fpct1((num(r.rasio_tkd) ?? 0) * 100) + "%" },
    { key: "realisasi", header: "Realisasi belanja", align: "right", value: (r) => realisasiBelanja(r) ?? 0, render: (r) => { const x = realisasiBelanja(r); return x == null ? "-" : fpct1(x * 100) + "%"; } },
  ];

  if (error) return <ErrorBlock error={error} />;
  if (loading) return (
    <div>
      <h1 className="page-title">Kondisi ekonomi daerah</h1>
      <div className="loading-block">Memuat data…</div>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Kondisi ekonomi daerah</h1>
      <p className="page-lede">
        Halaman ini menjawab pertanyaan: seberapa besar dan sehat ekonomi daerah ini? Tahap 1 metode
        Kajian PED melihat PDRB, pertumbuhan, dan struktur ekonomi per wilayah dan periode. Semua
        angka berasal dari data resmi BPS
      </p>

      <FilterBar />

      <p className="context-inline">
        Menampilkan data <strong>{namaW}</strong>, tahun <strong>{thisYear}</strong>.
        {f.tahun !== thisYear ? <em> Data tahun {f.tahun} belum tersedia; yang ditampilkan tahun {thisYear}.</em> : null}
      </p>

      <div className="kpi-grid">
        <KpiCard label="PDRB harga konstan" info="PDRB adalah total nilai barang dan jasa yang diproduksi daerah dalam setahun. Harga konstan artinya sudah disesuaikan inflasi" value={fmt0(totalThis)} context={`${isProv ? "miliar Rp" : "skala tabel kab/kota BPS"}, tahun ${thisYear}`} />
        <KpiCard label="Pertumbuhan ekonomi" value={growth == null ? "-" : `${pctSigned(growth)}%`} context={`Dibanding tahun ${prevYear}. Makin tinggi, makin cepat ekonomi tumbuh`} />
        <KpiCard label="Sektor terbesar" value={<span style={{ fontSize: "1.15rem" }}>{dominan?.sektor ?? "-"}</span>} context={dominan ? `Menyumbang ${fpct1(dominan.share * 100)}% dari total ekonomi${dominan.sektor_kode === "B" ? ". Ketergantungan pada tambang menunjukkan pentingnya diversifikasi" : ""}` : ""} />
        <KpiCard label="Sektor unggulan" info="Sektor yang lebih kuat di wilayah ini dibanding rata-rata nasional (LQ > 1)" value={nBasis} context="Dari 17 sektor ekonomi, lebih kuat dari rata-rata nasional (LQ > 1)" />
      </div>

      <h2 className="section-title">Posisi spasial: Kalsel dibanding nasional dan se-Kalimantan</h2>
      <HeroNote>
        Berdasarkan ukuran ekonomi, Kalsel berada di peringkat <strong>ke-{kalselRank}</strong> dari{" "}
        {provOnly.length} provinsi se-Indonesia, dan peringkat{" "}
        <strong>ke-{kalProv.findIndex((d) => /kalimantan selatan/i.test(d.provinsi)) + 1}</strong> di
        antara provinsi Kalimantan. PDRB Kalsel menyumbang {fpct2(kalselRow?.share_pdrb_pct ?? 0)}% dari
        ekonomi nasional, dan seluruh Kalimantan menyumbang {fpct2(kalAgg)}%. Pertumbuhan ekonomi Kalsel{" "}
        {pctSigned(gKalsel ?? 0)}% pada {ppYear}. Angka ini{" "}
        {(gKalsel ?? 0) >= (gNas ?? 0) ? "lebih tinggi dari" : "lebih rendah dari"} rata-rata nasional{" "}
        {pctSigned(gNas ?? 0)}%
      </HeroNote>

      <div className="chart-grid-2">
        <Card title="Kontribusi PDB provinsi Kalimantan" subtitle={`% terhadap PDB nasional, ${ppYear} (Kalsel disorot)`} sumber={{ sumber: "BPS, PDRB provinsi", periode: `Tahun ${ppYear}`, tipe: "otomatis" }}>
          <EChart option={barProvinsiOption([...kalProv].sort((a, b) => a.share_pdrb_pct - b.share_pdrb_pct), "share_pdrb_pct", "%")} height={240} noZoom />
        </Card>
        <Card title="Pertumbuhan ekonomi Kalimantan dan nasional" subtitle={`% yoy, ${ppYear}. Garis putus-putus = rata-rata nasional ${fpct2(gNas ?? 0)}%`} sumber={{ sumber: "BPS, PDRB provinsi", periode: `Tahun ${ppYear}`, tipe: "otomatis" }}>
          <EChart option={barProvinsiOption([...kalProv].sort((a, b) => a.growth_pct - b.growth_pct), "growth_pct", "%", gNas ?? null)} height={240} noZoom />
        </Card>
      </div>

      <Card title="Struktur ekonomi komparatif 5 provinsi Kalimantan" subtitle={`Pangsa tiap lapangan usaha terhadap total PDRB ADHK provinsi, ${pkYear ?? "-"}. Kaltim & Kalsel bertumpu pertambangan, Kalbar & Kalteng lebih ke pertanian`} sumber={{ sumber: "BPS, PDRB lapangan usaha provinsi", periode: `Tahun ${pkYear ?? "-"}`, tipe: "otomatis" }}>
        {pkRows.length ? <EChart option={kalStrukturOption()} height={300} noZoom /> : <p className="muted">Data struktur Kalimantan belum tersedia</p>}
      </Card>

      <h2 className="section-title">Inflasi: indeks harga konsumen (IHK) kota di Kalsel</h2>
      <div className="filter-bar" style={{ alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-neutral-600)" }}>Kota IHK:</span>
        {kotaInflasi.map((k) => (
          <label key={k} style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: "0.82rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={kotaSel.includes(k)}
              onChange={(e) => {
                const next = e.target.checked ? [...kotaSel, k] : kotaSel.filter((x) => x !== k);
                setKotaPilih(next);
              }}
            />
            {k}
          </label>
        ))}
      </div>
      <HeroNote>
        Indeks Harga Konsumen (IHK) bulanan kota IHK Kalimantan Selatan (BPS, {infYears[0]}-{infYears[infYears.length - 1]}).
        Banjarmasin dan Tanjung adalah dua kota IHK utama. IHK mengukur tingkat harga, bukan laju
        kenaikannya. Tiap kota punya tahun dasar masing-masing, jadi bandingkan <em>arah tren</em>,
        bukan selisih nilai absolutnya
      </HeroNote>
      <div className="chart-grid-2">
        <Card title="Tren IHK bulanan" subtitle="Indeks harga konsumen per kota. Geser slider untuk memperbesar rentang waktu" sumber={{ sumber: "BPS, IHK kota", periode: `${infYears[0]}-${infYears[infYears.length - 1]}`, tipe: "otomatis" }}>
          {infView.length ? <EChart option={lineKotaOption("ihk")} height={320} /> : <p className="muted">Pilih minimal satu kota</p>}
        </Card>
        <Card title="Inflasi bulanan" subtitle="% perubahan IHK dibanding bulan sebelumnya" sumber={{ sumber: "BPS, IHK kota", periode: `${infYears[0]}-${infYears[infYears.length - 1]}`, tipe: "otomatis" }}>
          {infView.some((d) => (d as any).inflasi_mtm !== "") ? <EChart option={lineKotaOption("inflasi_mtm", { zeroLine: true, fmt: "{value}%", suffix: "%" })} height={320} /> : <p className="muted">Data inflasi belum tersedia</p>}
        </Card>
      </div>

      <h2 className="section-title">
        Ekspor, impor, dan neraca perdagangan Kalsel{" "}
        <InfoTip teks="Neraca perdagangan adalah selisih nilai ekspor dikurangi impor. Positif berarti surplus (Kalsel menjual lebih banyak ke luar daripada membeli)" />
      </h2>
      {eximView.length ? (
        <>
          <HeroNote>
            Nilai ekspor, impor, dan neraca perdagangan <strong>seluruh Provinsi Kalimantan Selatan</strong>{" "}
            per bulan, dalam juta US$ (BPS, {eximYears[0]}-{eximYears[eximYears.length - 1]}). Angka ini
            adalah total resmi tingkat provinsi untuk semua komoditas. Rincian per komoditas ada di
            halaman Komoditas Usulan. Karena berlaku se-provinsi, datanya sama untuk semua pilihan
            kabupaten/kota
          </HeroNote>
          <div className="kpi-grid">
            <KpiCard
              label="Ekspor bulan terakhir"
              value={`US$ ${fmt0(num(eximLatest?.ekspor) ?? 0)} jt`}
              context={eximLatest ? `${BULAN_NAMA[eximLatest.bulan as number]} ${eximLatest.tahun}` : ""}
            />
            <KpiCard
              label="Impor bulan terakhir"
              value={`US$ ${fmt0(num(eximLatest?.impor) ?? 0)} jt`}
              context={eximLatest ? `${BULAN_NAMA[eximLatest.bulan as number]} ${eximLatest.tahun}` : ""}
            />
            <KpiCard
              label="Neraca perdagangan"
              value={`US$ ${fmt0(num(eximLatest?.neraca) ?? 0)} jt`}
              context={
                <span style={{ color: (num(eximLatest?.neraca) ?? 0) >= 0 ? "var(--color-success-600)" : "var(--color-danger-600)", fontWeight: 600 }}>
                  {(num(eximLatest?.neraca) ?? 0) >= 0 ? "▲ surplus" : "▼ defisit"}
                </span>
              }
            />
            <KpiCard
              label={`Total ekspor ${eximFull?.y ?? ""}`}
              value={`US$ ${fmt1((eximFull?.ekspor ?? 0) / 1000)} miliar`}
              context={eximFull && eximFull.months < 12 ? `Sampai ${eximFull.months} bulan ${eximFull.y}` : `Sepanjang ${eximFull?.y ?? ""}`}
            />
          </div>
          <Card
            title="Tren ekspor, impor, dan neraca perdagangan bulanan"
            subtitle="Juta US$ per bulan. Geser slider untuk memperbesar rentang waktu. Jarak antara garis ekspor dan impor adalah surplus"
            sumber={{ sumber: "BPS, ekspor-impor provinsi", periode: `${eximYears[0]}-${eximYears[eximYears.length - 1]}`, tipe: "otomatis" }}
          >
            <div className="plain-summary">
              Ekspor Kalsel jauh di atas impor sehingga neraca perdagangannya surplus besar, ditopang
              terutama oleh ekspor batu bara
            </div>
            <EChart option={eximLineOption()} height={340} />
          </Card>
        </>
      ) : (
        <Card><p className="muted">Data ekspor-impor provinsi belum tersedia</p></Card>
      )}

      {eksporKom.length > 0 && (
        <>
          <HeroNote>
            Ekspor lewat pelabuhan Kalsel setara <strong>{fpct1(eksporShareNas * 100)}%</strong> dari
            nilai ekspor nasional ({eksporTahun}). Kalsel adalah pengekspor{" "}
            <strong>{namaKomEkspor(eksporTop1)}</strong> peringkat{" "}
            <strong>#{eksporTop1.peringkat_nasional}</strong>
            {eksporTop2 ? (
              <> dan <strong>{namaKomEkspor(eksporTop2)}</strong> peringkat <strong>#{eksporTop2.peringkat_nasional}</strong></>
            ) : null}{" "}
            nasional
          </HeroNote>
          <Card
            title="Komoditas ekspor: Kalsel dibanding nasional"
            subtitle={`Nilai ekspor per golongan barang, ${eksporTahun ?? ""}. Batang merah = Kalsel, batang abu = nasional. Skala mendatar logaritmik karena nilainya berentang sangat lebar`}
            sumber={{ sumber: "BPS, ekspor menurut golongan barang (HS 2 digit)", periode: `Tahun ${eksporTahun ?? "-"}`, tipe: "otomatis" }}
          >
            <div className="plain-summary">
              Untuk batu bara, Kalsel menyumbang porsi besar dari ekspor nasional. Untuk komoditas
              lain, porsinya kecil meski nilainya tetap signifikan di tingkat daerah
            </div>
            <EChart option={eksporKomOption()} height={Math.max(320, 34 * eksporKom.length + 60)} noZoom />
          </Card>
          <HeroNote variant="warning">
            <strong>Keterbatasan.</strong> Data ini golongan besar (kode HS 2 digit) dan diperkirakan
            dari pelabuhan muat di Kalsel. Rincian per kode HS lengkap (8 digit) menurut negara tujuan
            dan pelabuhan, seperti pada alat ekspor-impor BPS, tidak tersedia di API publik sehingga
            tidak diotomasi di sini
          </HeroNote>
          <details className="detail-block">
            <summary>Lihat tabel komoditas ekspor (nilai dan peringkat nasional)</summary>
            <DataTable rows={eksporKom} columns={eksporCols} initialSort="kalsel" initialReverse />
          </details>
        </>
      )}

      <h2 className="section-title">Ketenagakerjaan: pengangguran dan partisipasi kerja</h2>
      <HeroNote>
        Tingkat Pengangguran Terbuka (TPT) dan Tingkat Partisipasi Angkatan Kerja (TPAK) per
        kabupaten/kota, BPS Sakernas {tkPeriode} {tkYear}. TPT rendah dan TPAK tinggi umumnya
        menandakan pasar kerja yang sehat.
        {tkWil ? (
          <>
            {" "}
            <strong>{namaW}</strong>: TPT {num(tkWil.tpt) ?? "-"}%, TPAK {num(tkWil.tpak) ?? "-"}%.
            {!isProv && tkProv ? ` Pembanding provinsi Kalsel: TPT ${num(tkProv.tpt) ?? "-"}%, TPAK ${num(tkProv.tpak) ?? "-"}%` : ""}
          </>
        ) : null}
      </HeroNote>
      <div className="chart-grid-2">
        <Card title="Peta TPT kabupaten/kota" subtitle={`% pengangguran terbuka, ${tkPeriode} ${tkYear} (makin gelap makin tinggi)`} sumber={{ sumber: "BPS, Sakernas", periode: `${tkPeriode} ${tkYear}`, tipe: "otomatis" }}>
          {kalsel && <KalselMap geojson={kalsel} valueByWid={tptByWid} ramp={TPT_RAMP} formatValue={(v) => (v == null ? "data belum tersedia" : `TPT ${fmt2(v)}%`)} downloadName="peta-tpt-kalsel" />}
        </Card>
        <Card title="TPT dan TPAK antar kab/kota" subtitle={`${tkPeriode} ${tkYear}. Titik merah = TPT (pengangguran), titik biru = TPAK (partisipasi kerja)`} sumber={{ sumber: "BPS, Sakernas", periode: `${tkPeriode} ${tkYear}`, tipe: "otomatis" }}>
          <EChart option={tptTpakOption()} height={Math.max(360, 26 * tkKab.length + 60)} noZoom />
        </Card>
      </div>
      <HeroNote variant="warning">
        <strong>Keterbatasan.</strong> Struktur pekerja per lapangan usaha tingkat kabupaten/kota tidak
        tersedia sebagai tabel dinamis di BPS WebAPI, sehingga tidak diotomasi di sini
      </HeroNote>

      <h2 className="section-title">Struktur sektoral</h2>
      <div className="chart-grid-2">
        <Card title="Struktur PDRB menurut lapangan usaha" subtitle={`Pangsa tiap sektor, ${thisYear}${!isSemua(f.sektor) ? ` · sorot ${namaPendek(f.sektor.kode, f.sektor.nama)}` : ""}`} sumber={{ sumber: `BPS, PDRB lapangan usaha (${namaW})`, periode: `Tahun ${thisYear}`, tipe: "otomatis" }}>
          <div className="plain-summary">Tiap batang = porsi satu sektor terhadap total ekonomi daerah. Makin panjang, makin besar sumbangannya</div>
          <EChart option={strukturOption()} height={Math.max(360, 26 * strukturThis.length + 40)} noZoom />
        </Card>
        <Card title="Tren PDRB total" subtitle={`${tahunAda[0]}-${tahunAda[tahunAda.length - 1]} (harga konstan)`} sumber={{ sumber: `BPS, PDRB lapangan usaha (${namaW})`, periode: `${tahunAda[0]}-${tahunAda[tahunAda.length - 1]}`, tipe: "otomatis" }}>
          <EChart option={trenOption()} height={300} noZoom />
        </Card>
      </div>
      <Card title="Pergeseran komposisi ekonomi dari tahun ke tahun" subtitle="Pangsa (%) tiap sektor per tahun. Arahkan kursor ke salah satu lapisan untuk melihat nama sektor dan persentasenya" sumber={{ sumber: `BPS, PDRB lapangan usaha (${namaW})`, periode: `${tahunAda[0]}-${tahunAda[tahunAda.length - 1]}`, tipe: "otomatis" }}>
        <EChart option={komposisiOption()} height={380} noZoom />
      </Card>

      <h2 className="section-title">Rincian per sektor</h2>
      <details className="detail-block">
        <summary>Lihat tabel rincian per sektor (PDRB, pangsa, LQ)</summary>
        <DataTable rows={strukturThis} columns={sektorCols} initialSort="share" initialReverse maxRows={18} />
      </details>

      <h2 className="section-title">Kesejahteraan dibanding nasional</h2>
      <HeroNote>
        Indikator kesejahteraan (Kajian PED 3.1.1.b) tahun <strong>{ksYear}</strong>, BPS. Pembanding:
        nasional (kemiskinan, Gini, IPM) & rata-rata provinsi (PDRB/kapita)
      </HeroNote>
      <div className="kpi-grid">
        <KartuMetrik label="PDRB per kapita" val={ksWil?.pdrb_kapita} pemb={ksKalsel?.pdrb_kapita} pembLabel="Kalsel" fmtFn={(v) => "Rp" + fmt1(v / 1000) + " jt"} lebihTinggiBaik info="Rata-rata pendapatan per orang per tahun. Makin tinggi, makin sejahtera secara rata-rata" />
        <KartuMetrik label="Tingkat kemiskinan" val={ksWil?.miskin_pct} pemb={ksNas?.miskin_pct} pembLabel="nasional" fmtFn={(v) => fpct2(v) + "%"} info="Persentase penduduk di bawah garis kemiskinan (indikator P0 BPS)" />
        <KartuMetrik label="Rasio Gini" val={ksWil?.gini} pemb={ksNas?.gini} pembLabel="nasional" fmtFn={(v) => format(".3f")(v)} info="Angka 0-1 yang mengukur ketimpangan pendapatan. Mendekati 0 = merata" gini />
        <KartuMetrik label="IPM (Indeks Pembangunan Manusia)" val={ksWil?.ipm} pemb={ksNas?.ipm} pembLabel="nasional" fmtFn={(v) => fpct2(v)} lebihTinggiBaik info="Gabungan kesehatan, pendidikan, dan pendapatan. Skala 0-100" />
      </div>
      <div className="chart-grid-2">
        <Card title="IPM antar kab/kota" subtitle={`${ksYear}${!isProv ? ` · ${namaW} disorot` : ""}. Garis putus-putus = rata-rata nasional`} sumber={{ sumber: "BPS, Indeks Pembangunan Manusia", periode: `Tahun ${ksYear}`, tipe: "otomatis" }}>
          <EChart option={rankOption("ipm", "IPM")} height={Math.max(340, 24 * ksKab.length + 50)} noZoom />
        </Card>
        <Card title="Kemiskinan (P0) antar kab/kota" subtitle={`% penduduk miskin, ${ksYear} (lebih rendah lebih baik)`} sumber={{ sumber: "BPS, kemiskinan kab/kota", periode: `Tahun ${ksYear}`, tipe: "otomatis" }}>
          <EChart option={rankOption("miskin_pct", "% miskin")} height={Math.max(340, 24 * ksKab.length + 50)} noZoom />
        </Card>
      </div>
      <Card title="PDRB per kapita antar kab/kota" subtitle={`Ribu rupiah per orang per tahun, ${ksYear}${!isProv ? ` · ${namaW} disorot` : ""}. Kab/kota tambang biasanya jauh lebih tinggi`} sumber={{ sumber: "BPS, PDRB per kapita kab/kota", periode: `Tahun ${ksYear}`, tipe: "otomatis" }}>
        <EChart option={rankOption("pdrb_kapita", "PDRB per kapita (ribu Rp)")} height={Math.max(340, 24 * ksKab.length + 50)} noZoom />
      </Card>

      {apbd.length > 0 && (
        <>
          <h2 className="section-title">
            Keuangan daerah: ketergantungan pada transfer pusat{" "}
            <InfoTip teks="Rasio Transfer ke Daerah (TKD) terhadap pendapatan daerah. Makin tinggi, makin bergantung pada dana dari pemerintah pusat. Sisi sebaliknya, porsi Pendapatan Asli Daerah (PAD) menunjukkan kemandirian fiskal" />
          </h2>
          <HeroNote>
            Kajian PED 3.1.1 menilai kondisi keuangan daerah lewat rasio Transfer ke Daerah terhadap
            APBD, untuk mengukur seberapa besar daerah bergantung pada dana pemerintah pusat. Data APBD{" "}
            <strong>{apbdTahun}</strong> bersumber dari DJPK Kemenkeu (SIKD). Rasio dihitung dari
            anggaran, realisasi masih berjalan
          </HeroNote>
          <div className="kpi-grid">
            <KpiCard label="Pendapatan daerah" info="Total anggaran pendapatan daerah pada APBD" value={apbdWil ? "Rp" + fmt1((num(apbdWil.pendapatan) ?? 0) / 1e12) + " T" : "-"} context={`APBD ${apbdTahun} · ${namaW}`} />
            <KpiCard label="Ketergantungan transfer pusat" info="Rasio Transfer ke Daerah (TKD) terhadap pendapatan. Makin tinggi, makin bergantung pada pemerintah pusat" value={apbdWil ? fpct1((num(apbdWil.rasio_tkd) ?? 0) * 100) + "%" : "-"} context="Indikator Kajian PED 3.1.1" />
            <KpiCard label="Kemandirian fiskal (PAD)" info="Porsi Pendapatan Asli Daerah terhadap total pendapatan. Makin tinggi, makin mandiri membiayai daerahnya" value={apbdWil ? fpct1((num(apbdWil.rasio_pad) ?? 0) * 100) + "%" : "-"} context="Sisi sebaliknya dari ketergantungan transfer" />
            <KpiCard label="Realisasi belanja" info="Bagian anggaran belanja yang sudah terealisasi sampai data terakhir" value={realisasiBelanja(apbdWil) == null ? "-" : fpct1((realisasiBelanja(apbdWil) as number) * 100) + "%"} context="Penyerapan anggaran berjalan" />
          </div>
          <Card
            title="Ketergantungan transfer pusat per kab/kota"
            subtitle={`Rasio TKD terhadap pendapatan, APBD ${apbdTahun}. Garis putus-putus = provinsi${!isProv ? ` · ${namaW} disorot` : ""}`}
            sumber={{ sumber: "DJPK Kemenkeu, SIKD", periode: `APBD ${apbdTahun}`, tipe: "otomatis" }}
          >
            <div className="plain-summary">Hampir semua kabupaten/kota sangat bergantung pada transfer pusat, sementara provinsi jauh lebih mandiri karena punya sumber pajak sendiri</div>
            <EChart option={apbdOption()} height={Math.max(340, 24 * apbdKab.length + 50)} noZoom />
          </Card>
          <details className="detail-block">
            <summary>Lihat tabel APBD per wilayah</summary>
            <DataTable rows={apbdTh} columns={apbdCols} initialSort="rasio_tkd" initialReverse />
          </details>
        </>
      )}

      <LangkahLanjut
        teks={<>Sudah memahami kondisi ekonominya? Lihat sektor mana yang paling kuat dan layak dikembangkan</>}
        aksi="Buka Subsektor Unggulan"
        to="/subsektor-unggulan"
      />
    </div>
  );
}

function KartuMetrik({
  label, val, pemb, pembLabel, fmtFn, lebihTinggiBaik, info, gini,
}: {
  label: string; val: unknown; pemb: unknown; pembLabel: string;
  fmtFn: (v: number) => string; lebihTinggiBaik?: boolean; info?: string; gini?: boolean;
}) {
  const v = num(val);
  const p = num(pemb);
  if (v == null) {
    return <KpiCard label={label} info={info} value="-" context="data tidak tersedia" />;
  }
  const baik = p == null ? null : lebihTinggiBaik ? v >= p : v <= p;
  const warna = baik == null ? "var(--color-neutral-500)" : baik ? "var(--color-success-600)" : "var(--color-danger-600)";
  return (
    <KpiCard
      label={label}
      info={info}
      value={fmtFn(v)}
      context={p == null ? "" : (
        <>
          vs {pembLabel} {fmtFn(p)}{" "}
          <span style={{ color: warna, fontWeight: 600 }}>{baik ? "▲ lebih baik" : "▼ lebih buruk"}</span>
        </>
      )}
    >
      {gini && (
        <div className="gini-skala">
          <div className="gini-track">
            <div className="gini-mark" style={{ left: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
          </div>
          <div className="gini-label"><span>0 merata</span><span>1 timpang</span></div>
        </div>
      )}
    </KpiCard>
  );
}
