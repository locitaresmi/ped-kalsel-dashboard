export interface Wilayah {
  id: string;
  nama: string;
}
export interface Sektor {
  kode: string;
  nama: string;
}

export const WILAYAH: Wilayah[] = [
  { id: "6300", nama: "Kalimantan Selatan (Provinsi)" },
  { id: "6301", nama: "Tanah Laut" },
  { id: "6302", nama: "Kotabaru" },
  { id: "6303", nama: "Banjar" },
  { id: "6304", nama: "Barito Kuala" },
  { id: "6305", nama: "Tapin" },
  { id: "6306", nama: "Hulu Sungai Selatan" },
  { id: "6307", nama: "Hulu Sungai Tengah" },
  { id: "6308", nama: "Hulu Sungai Utara" },
  { id: "6309", nama: "Tabalong" },
  { id: "6310", nama: "Tanah Bumbu" },
  { id: "6311", nama: "Balangan" },
  { id: "6371", nama: "Kota Banjarmasin" },
  { id: "6372", nama: "Kota Banjarbaru" },
];

export const SEKTOR: Sektor[] = [
  { kode: "A", nama: "Pertanian, Kehutanan, dan Perikanan" },
  { kode: "B", nama: "Pertambangan dan Penggalian" },
  { kode: "C", nama: "Industri Pengolahan" },
  { kode: "D", nama: "Pengadaan Listrik dan Gas" },
  { kode: "E", nama: "Pengadaan Air, Pengelolaan Sampah, Limbah & Daur Ulang" },
  { kode: "F", nama: "Konstruksi" },
  { kode: "G", nama: "Perdagangan Besar dan Eceran, serta Reparasi Mobil dan Sepeda Motor" },
  { kode: "H", nama: "Transportasi dan Pergudangan" },
  { kode: "I", nama: "Penyediaan Akomodasi dan Makan Minum" },
  { kode: "J", nama: "Informasi dan Komunikasi" },
  { kode: "K", nama: "Jasa Keuangan dan Asuransi" },
  { kode: "L", nama: "Real Estat" },
  { kode: "MN", nama: "Jasa Perusahaan" },
  { kode: "O", nama: "Administrasi Pemerintahan, Pertahanan & Jaminan Sosial" },
  { kode: "P", nama: "Jasa Pendidikan" },
  { kode: "Q", nama: "Jasa Kesehatan dan Kegiatan Sosial" },
  { kode: "RSTU", nama: "Jasa Lainnya" },
];

export const SEKTOR_PENDEK: Record<string, string> = {
  A: "Pertanian", B: "Tambang", C: "Industri", D: "Listrik & Gas",
  E: "Air & Sampah", F: "Konstruksi", G: "Perdagangan", H: "Transportasi",
  I: "Akomodasi & Kuliner", J: "Infokom", K: "Keuangan", L: "Real Estat",
  MN: "Jasa Perusahaan", O: "Pemerintahan", P: "Pendidikan", Q: "Kesehatan",
  RSTU: "Jasa Lainnya",
};

export function namaPendek(kode: string, fallback?: string): string {
  return SEKTOR_PENDEK[kode] ?? fallback ?? kode;
}

export const SEKTOR_WARNA: Record<string, string> = {
  A: "#2ca02c", B: "#8c564b", C: "#1f77b4", D: "#17becf", E: "#9edae5",
  F: "#ff7f0e", G: "#d62728", H: "#9467bd", I: "#e377c2", J: "#bcbd22",
  K: "#aec7e8", L: "#ffbb78", MN: "#98df8a", O: "#c5b0d5", P: "#c49c94",
  Q: "#f7b6d2", RSTU: "#7f7f7f",
};

export const TAHUN = [2020, 2021, 2022, 2023, 2024, 2025];

export const SEMUA = "__semua__";

export const isSemua = (v: unknown): boolean =>
  v == null ||
  v === SEMUA ||
  (typeof v === "object" && ((v as Wilayah).id === SEMUA || (v as Sektor).kode === SEMUA));
