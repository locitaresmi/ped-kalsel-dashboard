import { hitungAnalisis } from "./analisis";

type Row = Record<string, any>;

export interface Kriteria {
  status: boolean | null;
  alasan: string;
}

export interface Usulan {
  wilayah_id?: string;
  wilayah?: string;
  komoditas: string;
  subsektor_kode: string;
  subsektor: string;
  produksi_ton?: number;
  luas_panen_ha?: number;
  produksi_kalsel?: number | null;
  satuan?: string;
  peringkat_nasional?: number | null;
  tahunProduksi: number;
  kriteria: { produksi: Kriteria; ekspor: Kriteria; subsektor: Kriteria };
  skor: number;
  skorMax: number;
  tier: string;
  level?: string;
}

const NAMA_SUBSEKTOR: Record<string, string> = {
  A: "Pertanian, Kehutanan, dan Perikanan",
  B: "Pertambangan dan Penggalian",
  C: "Industri Pengolahan",
};

const KOMODITAS_HS: Record<string, string> = {
  Padi: "10",
};

const STATUS_KLASSEN: Record<number, string> = {
  1: "Basis dan tumbuh cepat",
  2: "Basis tapi melambat",
  3: "Tumbuh cepat, belum jadi basis",
  4: "Kecil dan tumbuh lambat",
};

const HS_NAMA_ID: Record<string, string> = {
  "03": "Ikan dan hasil laut", "09": "Kopi, teh, dan rempah", "10": "Serealia (beras/jagung)",
  "15": "Minyak nabati dan hewani (CPO)", "17": "Gula", "18": "Kakao dan olahannya",
  "27": "Batu bara dan bahan bakar mineral", "40": "Karet dan barang dari karet",
  "44": "Kayu dan produk kayu",
};

function indeksEkspor(ekspor: Row[] | undefined): Map<string, Row> {
  const m = new Map<string, Row>();
  for (const e of ekspor ?? []) m.set(String(e.kodehs).padStart(2, "0"), e);
  return m;
}

function kriteriaEkspor(
  hs: string | undefined,
  eksporHS: Map<string, Row>,
  basisEkspor: string
): Kriteria {
  if (!eksporHS || eksporHS.size === 0) {
    return { status: null, alasan: "Data ekspor dari BPS belum tersedia" };
  }
  if (!hs) return { status: null, alasan: "Komoditas ini belum punya data ekspor" };
  const e = eksporHS.get(String(hs).padStart(2, "0"));
  const namaEkspor = HS_NAMA_ID[String(hs).padStart(2, "0")] ?? "kelompok ekspor ini";
  if (!e) return { status: false, alasan: `Ekspor ${namaEkspor} tidak tercatat dari Kalsel` };
  const top = e[basisEkspor === "nasional" ? "top10_nasional" : "top10_kalsel"];
  const rank = e[basisEkspor === "nasional" ? "peringkat_nasional" : "peringkat_kalsel"];
  const lolos = top === true || top === "true";
  return {
    status: lolos,
    alasan: lolos
      ? `Ekspor ${namaEkspor} dari Kalsel masuk 10 besar nasional (peringkat ke-${rank || "?"})`
      : `Ekspor ${namaEkspor} dari Kalsel ada di luar 10 besar nasional`,
  };
}

function klassenMap(
  wilayahId: string,
  { pdrb, wilayah, tahun }: { pdrb: Row[]; wilayah: Row[]; tahun: number }
): Map<string, { unggul: boolean; kuadran: number }> {
  const a = hitungAnalisis({ pdrb, wilayah, wilayahId, akhir: tahun });
  const m = new Map<string, { unggul: boolean; kuadran: number }>();
  for (const s of a.sektor) m.set(s.sektor_kode, { unggul: s.unggul, kuadran: s.kuadran });
  return m;
}

export function skorKomoditasProvinsi({
  komoditasProv, ekspor, pdrb, wilayah, tahun,
  topProv = 10, maksUsulan = 6, basisEkspor = "kalsel",
}: {
  komoditasProv: Row[]; ekspor?: Row[]; pdrb: Row[]; wilayah: Row[]; tahun: number;
  topProv?: number; maksUsulan?: number; basisEkspor?: string;
}): Usulan[] {
  const eksporHS = indeksEkspor(ekspor);
  const klassen = klassenMap("6300", { pdrb, wilayah, tahun });
  const out: Usulan[] = [];
  for (const k of komoditasProv ?? []) {
    const rank = k.peringkat_nasional;
    const adaProduksi = rank !== "" && rank != null && !Number.isNaN(+rank);

    const kriteriaProduksi: Kriteria = adaProduksi
      ? {
          status: +rank <= topProv,
          alasan: +rank <= topProv
            ? `Kalsel termasuk ${topProv} besar produsen nasional (peringkat ke-${rank} dari ${k.n_provinsi} provinsi)`
            : `Kalsel ada di luar 10 besar produsen nasional (peringkat ke-${rank} dari ${k.n_provinsi} provinsi)`,
        }
      : { status: null, alasan: "Data produksi tidak tersedia di BPS. Untuk batu bara, sumbernya ada di ESDM." };

    const kriteriaEksporV = kriteriaEkspor(k.hs_chapter, eksporHS, basisEkspor);

    const kl = klassen.get(k.subsektor_kode);
    const kriteriaSubsektor: Kriteria = {
      status: !!kl?.unggul,
      alasan: kl
        ? `Subsektor ${NAMA_SUBSEKTOR[k.subsektor_kode] || k.subsektor_kode} tergolong "${STATUS_KLASSEN[kl.kuadran]}"`
        : "Subsektor ini belum bisa dianalisis",
    };

    const skor = [kriteriaProduksi, kriteriaEksporV, kriteriaSubsektor].filter((c) => c.status === true).length;
    out.push({
      komoditas: k.komoditas, subsektor_kode: k.subsektor_kode,
      subsektor: NAMA_SUBSEKTOR[k.subsektor_kode] || k.subsektor_kode,
      produksi_kalsel: adaProduksi ? k.produksi_kalsel : null, satuan: k.satuan,
      peringkat_nasional: adaProduksi ? +rank : null, tahunProduksi: k.tahun,
      kriteria: { produksi: kriteriaProduksi, ekspor: kriteriaEksporV, subsektor: kriteriaSubsektor },
      skor, skorMax: 3, tier: "A", level: "provinsi",
    });
  }
  return out
    .filter((u) => u.skor > 0)
    .sort((a, b) => b.skor - a.skor || (b.produksi_kalsel ?? 0) - (a.produksi_kalsel ?? 0))
    .slice(0, maksUsulan);
}

export interface SkorKomoditasHasil {
  tahunProduksi: number;
  perWilayah: Map<string, Usulan[]>;
}

export function skorKomoditas({
  produksi, pdrb, wilayah, ekspor, tahun, topN = 5,
  maksUsulan = 3, basisEkspor = "kalsel",
}: {
  produksi: Row[]; pdrb: Row[]; wilayah: Row[]; ekspor?: Row[]; tahun: number;
  topN?: number; maksUsulan?: number; basisEkspor?: string;
}): SkorKomoditasHasil {
  const eksporHS = indeksEkspor(ekspor);
  const tahunProduksi = produksi.some((r) => r.tahun === tahun)
    ? tahun
    : Math.max(...produksi.map((r) => r.tahun));
  const prodTh = produksi.filter((r) => r.tahun === tahunProduksi);

  const peringkat = new Map<string, Map<string, number>>();
  const perKom = new Map<string, Row[]>();
  for (const r of prodTh) {
    if (!perKom.has(r.komoditas)) perKom.set(r.komoditas, []);
    perKom.get(r.komoditas)!.push(r);
  }
  for (const [kom, list] of perKom) {
    list.sort((a, b) => b.produksi_ton - a.produksi_ton);
    const m = new Map<string, number>();
    list.forEach((r, i) => m.set(String(r.wilayah_id), i + 1));
    peringkat.set(kom, m);
  }

  const klassenCache = new Map<string, Map<string, { unggul: boolean; kuadran: number }>>();
  function klassenWilayah(wid: string) {
    if (!klassenCache.has(wid)) {
      const a = hitungAnalisis({ pdrb, wilayah, wilayahId: wid, akhir: tahun });
      const m = new Map<string, { unggul: boolean; kuadran: number }>();
      for (const s of a.sektor) m.set(s.sektor_kode, { unggul: s.unggul, kuadran: s.kuadran });
      klassenCache.set(wid, m);
    }
    return klassenCache.get(wid)!;
  }

  const hasil = new Map<string, Usulan[]>();
  for (const r of prodTh) {
    const wid = String(r.wilayah_id);
    const rank = peringkat.get(r.komoditas)?.get(wid);

    const k1pass = rank != null && rank <= topN;
    const kriteriaProduksi: Kriteria = {
      status: k1pass,
      alasan: rank != null
        ? k1pass
          ? `Termasuk ${topN} besar produsen ${r.komoditas.toLowerCase()} di Kalsel (peringkat ke-${rank})`
          : `Di luar ${topN} besar produsen ${r.komoditas.toLowerCase()} di Kalsel (peringkat ke-${rank})`
        : "Produksi belum tercatat",
    };

    const kriteriaEksporV = kriteriaEkspor(KOMODITAS_HS[r.komoditas], eksporHS, basisEkspor);

    const kl = klassenWilayah(wid).get(r.subsektor_kode);
    const k3pass = !!kl?.unggul;
    const kriteriaSubsektor: Kriteria = {
      status: k3pass,
      alasan: kl
        ? `Subsektor ${NAMA_SUBSEKTOR[r.subsektor_kode] || r.subsektor_kode} tergolong "${STATUS_KLASSEN[kl.kuadran]}"`
        : "Subsektor ini belum bisa dianalisis",
    };

    const skor = [kriteriaProduksi, kriteriaEksporV, kriteriaSubsektor].filter((k) => k.status === true).length;
    const usulan: Usulan = {
      wilayah_id: wid, wilayah: r.wilayah,
      komoditas: r.komoditas, subsektor_kode: r.subsektor_kode,
      subsektor: NAMA_SUBSEKTOR[r.subsektor_kode] || r.subsektor_kode,
      produksi_ton: r.produksi_ton, luas_panen_ha: r.luas_panen_ha,
      tahunProduksi,
      kriteria: { produksi: kriteriaProduksi, ekspor: kriteriaEksporV, subsektor: kriteriaSubsektor },
      skor, skorMax: 3, tier: "A",
    };
    if (!hasil.has(wid)) hasil.set(wid, []);
    hasil.get(wid)!.push(usulan);
  }

  for (const [wid, list] of hasil) {
    const top = list
      .filter((u) => u.skor > 0)
      .sort((a, b) => b.skor - a.skor || (b.produksi_ton ?? 0) - (a.produksi_ton ?? 0))
      .slice(0, maksUsulan);
    hasil.set(wid, top);
  }
  return { tahunProduksi, perWilayah: hasil };
}
