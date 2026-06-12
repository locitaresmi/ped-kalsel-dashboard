import { SEMUA } from "./sektor";

export interface SektorMetrik {
  sektor_kode: string;
  sektor: string;
  lq: number;
  dlq: number;
  growth: number;
  growthRef: number;
  growthNas: number;
  ss: { ns: number; ps: number; ds: number; total: number };
  kuadran: 1 | 2 | 3 | 4;
  status: string;
  unggul: boolean;
  basis: boolean;
  prospektif: boolean;
  kompetitif: boolean;
}

export interface HasilAnalisis {
  base: number | null;
  akhir: number | null;
  sektor: SektorMetrik[];
}

type Row = Record<string, unknown>;

interface SeriSektor {
  kode: string;
  nama: string;
  th: Map<number, number>;
}

function cagr(awal: number, akhir: number, n: number): number | null {
  if (!(awal > 0) || !(akhir > 0) || n <= 0) return null;
  return Math.pow(akhir / awal, 1 / n) - 1;
}

function seriesPerSektor(
  rows: Row[],
  kolomNilai: string,
  filterFn?: (r: Row) => boolean
): Map<string, SeriSektor> {
  const out = new Map<string, SeriSektor>();
  for (const r of rows) {
    if (filterFn && !filterFn(r)) continue;
    const v = r[kolomNilai];
    if (v == null || Number.isNaN(+(v as number))) continue;
    const kode = String(r.sektor_kode);
    if (!out.has(kode)) {
      out.set(kode, {
        kode,
        nama: String(r.sektor ?? "").replace(/;\s*/g, ", "),
        th: new Map(),
      });
    }
    out.get(kode)!.th.set(+(r.tahun as number), +(v as number));
  }
  return out;
}

function totalPerTahun(series: Map<string, SeriSektor>): Map<number, number> {
  const out = new Map<number, number>();
  for (const { th } of series.values()) {
    for (const [t, v] of th) out.set(t, (out.get(t) || 0) + v);
  }
  return out;
}

const isProvinsi = (wilayahId: string | null | undefined): boolean =>
  wilayahId == null || wilayahId === SEMUA || wilayahId === "6300";

export function hitungAnalisis({
  pdrb,
  wilayah,
  wilayahId,
  base,
  akhir,
}: {
  pdrb: Row[];
  wilayah: Row[];
  wilayahId: string | null | undefined;
  base?: number;
  akhir?: number;
}): HasilAnalisis {
  const prov = isProvinsi(wilayahId);

  const regionSeries = prov
    ? seriesPerSektor(pdrb, "pdrb_prov")
    : seriesPerSektor(wilayah, "pdrb_wil", (r) => String(r.wilayah_id) === wilayahId);
  const nasSeries = seriesPerSektor(pdrb, "pdrb_nas");

  const tahunRegion = new Set<number>();
  for (const { th } of regionSeries.values()) for (const t of th.keys()) tahunRegion.add(t);
  const tahunList = [...tahunRegion].sort((a, b) => a - b);
  if (tahunList.length < 2) return { base: null, akhir: null, sektor: [] };
  base = base ?? (tahunList.includes(2021) ? 2021 : tahunList[0]);
  akhir = akhir ?? tahunList[tahunList.length - 1];
  const n = akhir - base;
  if (n <= 0) return { base, akhir, sektor: [] };

  const regTotal = totalPerTahun(regionSeries);
  const nasTotal = totalPerTahun(nasSeries);
  const RT1 = regTotal.get(akhir)!;
  const NT0 = nasTotal.get(base)!;
  const NT1 = nasTotal.get(akhir)!;
  const gRegionTotal = cagr(regTotal.get(base)!, RT1, n)!;
  const gNasTotal = cagr(NT0, NT1, n)!;
  const gNasTotalPeriode = NT0 > 0 ? NT1 / NT0 - 1 : 0;

  const hasil: SektorMetrik[] = [];
  for (const [kode, { nama, th }] of regionSeries) {
    const nas = nasSeries.get(kode);
    const E0r = th.get(base)!;
    const E1r = th.get(akhir)!;
    const E0n = nas?.th.get(base);
    const E1n = nas?.th.get(akhir);
    if (!(E0r > 0) || !(E1r > 0) || !(E0n! > 0) || !(E1n! > 0)) continue;

    const gSektorRegion = cagr(E0r, E1r, n)!;
    const gSektorNas = cagr(E0n!, E1n!, n)!;

    const lq = (E1r / RT1) / (E1n! / NT1);
    const dlq =
      ((1 + gSektorRegion) / (1 + gRegionTotal)) /
      ((1 + gSektorNas) / (1 + gNasTotal));

    const ratioNas = E1n! / E0n! - 1;
    const ratioReg = E1r / E0r - 1;
    const ns = E0r * gNasTotalPeriode;
    const ps = E0r * (ratioNas - gNasTotalPeriode);
    const ds = E0r * (ratioReg - ratioNas);
    const ssTotal = ns + ps + ds;

    const lqTinggi = lq >= 1;
    const tumbuhCepat = gSektorRegion >= gRegionTotal;
    let kuadran: 1 | 2 | 3 | 4;
    let status: string;
    if (lqTinggi && tumbuhCepat) { kuadran = 1; status = "Prima"; }
    else if (lqTinggi && !tumbuhCepat) { kuadran = 2; status = "Maju tertekan"; }
    else if (!lqTinggi && tumbuhCepat) { kuadran = 3; status = "Potensial"; }
    else { kuadran = 4; status = "Tertinggal"; }

    hasil.push({
      sektor_kode: kode, sektor: nama, lq, dlq,
      growth: gSektorRegion, growthRef: gRegionTotal, growthNas: gSektorNas,
      ss: { ns, ps, ds, total: ssTotal },
      kuadran, status, unggul: kuadran <= 2,
      basis: lq >= 1, prospektif: dlq >= 1, kompetitif: ds > 0,
    });
  }
  hasil.sort((a, b) => b.lq - a.lq);
  return { base, akhir, sektor: hasil };
}
