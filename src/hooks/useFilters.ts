import { useSearchParams } from "react-router-dom";
import { WILAYAH, SEKTOR, TAHUN, SEMUA, type Wilayah, type Sektor } from "../lib/sektor";

export const WILAYAH_OPSI: Wilayah[] = [{ id: SEMUA, nama: "Semua wilayah" }, ...WILAYAH];
export const SEKTOR_OPSI: Sektor[] = [{ kode: SEMUA, nama: "Semua sektor" }, ...SEKTOR];

export interface Filters {
  tahun: number;
  wilayah: Wilayah;
  sektor: Sektor;
  carry: string;
  setTahun: (t: number) => void;
  setWilayah: (id: string) => void;
  setSektor: (kode: string) => void;
}

export function useFilters(): Filters {
  const [params, setParams] = useSearchParams();

  const fromUrlTahun = +(params.get("tahun") ?? "");
  const tahun = TAHUN.includes(fromUrlTahun) ? fromUrlTahun : TAHUN[TAHUN.length - 1];

  const wilayah = WILAYAH_OPSI.find((w) => w.id === params.get("wilayah")) ?? WILAYAH_OPSI[0];
  const sektor = SEKTOR_OPSI.find((s) => s.kode === params.get("sektor")) ?? SEKTOR_OPSI[0];

  const carryParams = new URLSearchParams();
  if (wilayah.id !== SEMUA) carryParams.set("wilayah", wilayah.id);
  if (tahun !== TAHUN[TAHUN.length - 1]) carryParams.set("tahun", String(tahun));
  const carry = carryParams.toString() ? `?${carryParams}` : "";

  function update(key: string, value: string | null, isDefault: boolean) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value == null || value === "" || value === SEMUA || isDefault) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );
  }

  return {
    tahun,
    wilayah,
    sektor,
    carry,
    setTahun: (t) => update("tahun", String(t), t === TAHUN[TAHUN.length - 1]),
    setWilayah: (id) => update("wilayah", id, id === SEMUA),
    setSektor: (kode) => update("sektor", kode, kode === SEMUA),
  };
}
