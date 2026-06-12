import { useFilters, WILAYAH_OPSI, SEKTOR_OPSI } from "../hooks/useFilters";
import { TAHUN } from "../lib/sektor";

interface Props {
  showSektor?: boolean;
  showTahun?: boolean;
  hint?: string;
}

export function FilterBar({ showSektor = true, showTahun = true, hint }: Props) {
  const f = useFilters();
  return (
    <>
      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="f-wilayah">Pilih kabupaten/kota</label>
          <select
            id="f-wilayah"
            className="input-control"
            value={f.wilayah.id}
            onChange={(e) => f.setWilayah(e.target.value)}
          >
            {WILAYAH_OPSI.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nama}
              </option>
            ))}
          </select>
        </div>

        {showSektor && (
          <div className="filter-field">
            <label htmlFor="f-sektor">Filter sektor ekonomi</label>
            <select
              id="f-sektor"
              className="input-control"
              value={f.sektor.kode}
              onChange={(e) => f.setSektor(e.target.value)}
            >
              {SEKTOR_OPSI.map((s) => (
                <option key={s.kode} value={s.kode}>
                  {s.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        {showTahun && (
          <div className="filter-field">
            <label htmlFor="f-tahun">Tahun data</label>
            <select
              id="f-tahun"
              className="input-control"
              value={f.tahun}
              onChange={(e) => f.setTahun(+e.target.value)}
            >
              {TAHUN.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {hint && <div className="filter-hint">{hint}</div>}
    </>
  );
}
