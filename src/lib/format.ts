import { format } from "d3-format";

export const fmt0 = format(",.0f");
export const fmt1 = format(",.1f");
export const fmt2 = format(",.2f");
export const pctSigned = format("+.2f");
export const si = format("~s");

export const fmtRp = (x: number | null | undefined): string =>
  x ? fmt0(x) : "-";

export const pctFrac = (x: number | null | undefined): string =>
  x == null ? "-" : format("+.1%")(x);

export const pctPlain = (x: number | null | undefined): string =>
  x == null ? "-" : format(".1%")(x);

export const num = (v: unknown): number | null =>
  v === "" || v == null || Number.isNaN(+(v as number)) ? null : +(v as number);
