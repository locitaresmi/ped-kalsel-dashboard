import { useEffect, useState } from "react";
import { loadCsv, loadJson, loadGeo, type Row } from "../lib/data";

export interface DatasetResult {
  csv: Record<string, Row[]>;
  json: Record<string, unknown>;
  geo: Record<string, unknown>;
  loading: boolean;
  error: Error | null;
}

export interface DatasetSpec {
  csv?: string[];
  json?: string[];
  geo?: string[];
}

export function useDataset(spec: DatasetSpec): DatasetResult {
  const key = JSON.stringify(spec);
  const [state, setState] = useState<DatasetResult>({
    csv: {}, json: {}, geo: {}, loading: true, error: null,
  });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.all([
      Promise.all((spec.csv ?? []).map((n) => loadCsv(n).then((d) => [n, d] as const))),
      Promise.all((spec.json ?? []).map((n) => loadJson(n).then((d) => [n, d] as const))),
      Promise.all((spec.geo ?? []).map((n) => loadGeo(n).then((d) => [n, d] as const))),
    ])
      .then(([csvPairs, jsonPairs, geoPairs]) => {
        if (!alive) return;
        setState({
          csv: Object.fromEntries(csvPairs),
          json: Object.fromEntries(jsonPairs),
          geo: Object.fromEntries(geoPairs),
          loading: false,
          error: null,
        });
      })
      .catch((error: Error) => {
        if (!alive) return;
        setState({ csv: {}, json: {}, geo: {}, loading: false, error });
      });
    return () => {
      alive = false;
    };

  }, [key]);

  return state;
}
