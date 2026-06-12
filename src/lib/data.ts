import { csvParse, autoType } from "d3-dsv";

export type Row = Record<string, any>;

const BASE = import.meta.env.BASE_URL;
const cache = new Map<string, Promise<unknown>>();

function fetchOnce<T>(path: string, parse: (text: string) => T): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path).then((r) => {
        if (!r.ok) throw new Error(`Gagal memuat ${path}: HTTP ${r.status}`);
        return r.text().then(parse);
      })
    );
  }
  return cache.get(path)! as Promise<T>;
}

export function loadCsv(name: string): Promise<Row[]> {
  return fetchOnce(`${BASE}data/${name}.csv`, (text) =>
    csvParse(text, autoType) as unknown as Row[]
  );
}

export function loadJson<T = unknown>(name: string): Promise<T> {
  return fetchOnce(`${BASE}data/${name}.json`, (text) => JSON.parse(text) as T);
}

export function loadGeo<T = unknown>(name: string): Promise<T> {
  return fetchOnce(`${BASE}data/${name}.geojson`, (text) => JSON.parse(text) as T);
}
