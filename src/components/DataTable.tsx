import { useEffect, useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;

  render?: (row: T) => ReactNode;

  value?: (row: T) => string | number | null;
  align?: "left" | "right" | "center";
  width?: number;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  initialSort?: string;
  initialReverse?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  maxRows?: number;
}

function rawValue<T>(col: Column<T>, row: T): string | number | null {
  if (col.value) return col.value(row);
  const v = (row as Record<string, unknown>)[col.key];
  return v == null ? null : (v as string | number);
}

export function DataTable<T>({
  rows,
  columns,
  initialSort,
  initialReverse = false,
  searchable = false,
  searchPlaceholder = "Cari…",
  maxRows,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSort);
  const [reverse, setReverse] = useState(initialReverse);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      columns.some((c) => {
        const v = rawValue(c, row);
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const arr = [...filtered].sort((a, b) => {
      const va = rawValue(col, a);
      const vb = rawValue(col, b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "id");
    });
    return reverse ? arr.reverse() : arr;
  }, [filtered, columns, sortKey, reverse]);

  const totalPages = maxRows ? Math.max(1, Math.ceil(sorted.length / maxRows)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const start = maxRows ? safePage * maxRows : 0;
  const shown = maxRows ? sorted.slice(start, start + maxRows) : sorted;

  useEffect(() => {
    setPage(0);
  }, [query, sortKey, reverse]);

  function onSort(key: string) {
    if (sortKey === key) setReverse((r) => !r);
    else {
      setSortKey(key);
      setReverse(false);
    }
  }

  return (
    <div>
      {searchable && (
        <input
          className="input-control table-search-input"
          type="search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => onSort(c.key)}
                  style={{ width: c.width, textAlign: c.align ?? "left" }}
                >
                  {c.header}
                  {sortKey === c.key && <span className="sort-ind"> {reverse ? "▼" : "▲"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? "left" }}>
                    {c.render ? c.render(row) : (rawValue(c, row) as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {maxRows && sorted.length > maxRows && (
        <div className="table-pagination">
          <span className="muted">
            Menampilkan {start + 1}-{Math.min(start + maxRows, sorted.length)} dari {sorted.length} baris
          </span>
          <div className="tp-controls">
            <button
              type="button"
              className="tp-btn"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Sebelumnya
            </button>
            <span className="tp-page">
              Halaman {safePage + 1} dari {totalPages}
            </span>
            <button
              type="button"
              className="tp-btn"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
