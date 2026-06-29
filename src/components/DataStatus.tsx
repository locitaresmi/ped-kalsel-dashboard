import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface SourceStatus {
  status?: "ok" | "stale" | "unavailable";
  rows?: number | null;
  last_ok?: string | null;
  reason?: string | null;
}

export interface DataStatus {
  checked_at?: string;
  sources?: Record<string, SourceStatus>;
}

const Ctx = createContext<DataStatus | null>(null);

export function DataStatusProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<DataStatus | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/data_status.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setS(d))
      .catch(() => alive && setS(null));
    return () => {
      alive = false;
    };
  }, []);
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

export function useSourceStatus(kunci?: string): SourceStatus | null {
  const ds = useContext(Ctx);
  if (!kunci || !ds?.sources) return null;
  return ds.sources[kunci] ?? null;
}
