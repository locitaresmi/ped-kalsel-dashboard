import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

export const OJK_COLORS = {
  primary: "#C0272D",
  accent: "#D4A017",
  positive: "#16A34A",
  negative: "#DC2626",
  neutral: "#94A3B8",
  highlight: "#D4A017",
  series: ["#C0272D", "#D4A017", "#16A34A", "#2563EB", "#0891B2", "#EA580C"],
};

const DEFAULT_TOOLBOX = {
  show: true,
  right: 10,
  top: 4,
  itemSize: 14,
  itemGap: 8,
  iconStyle: { borderColor: "#A1A1AA", borderWidth: 1 },
  emphasis: { iconStyle: { borderColor: "#C0272D" } },
  feature: {
    dataZoom: { yAxisIndex: "none", title: { zoom: "Zoom area", back: "Reset zoom" } },
    restore: { title: "Reset tampilan" },
    saveAsImage: {
      title: "Unduh PNG",
      name: `ped-kalsel-${new Date().toISOString().slice(0, 10)}`,
      pixelRatio: 2,
      excludeComponents: ["toolbox"],
    },
  },
};

const DEFAULT_TOOLTIP = {
  trigger: "axis",
  backgroundColor: "#18181B",
  borderColor: "transparent",
  padding: [8, 12],
  textStyle: { color: "#F4F4F5", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif" },
  extraCssText: "border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.25);",
  axisPointer: {
    type: "cross",
    crossStyle: { color: "#D4D4D8", width: 1 },
    lineStyle: { color: "#D4D4D8", width: 1, type: "dashed" },
  },
};

const DEFAULT_GRID = { top: 52, right: 24, bottom: 48, left: 16, containLabel: true };

export interface ChartOpts {
  noToolbox?: boolean;
  noZoom?: boolean;
}

export function mergeOption(option: EChartsOption, opts: ChartOpts = {}): EChartsOption {
  const { noToolbox = false, noZoom = false } = opts;

  const dataZoomConfig = noZoom
    ? []
    : [
        { type: "inside", start: 0, end: 100, zoomOnMouseWheel: true },
        {
          type: "slider", start: 0, end: 100, height: 18, bottom: 4,
          borderColor: "#E4E4E7", fillerColor: "rgba(192, 39, 45, 0.08)",
          handleStyle: { color: "#C0272D", borderWidth: 0 },
          moveHandleStyle: { color: "#C0272D" },
          textStyle: { color: "#71717A", fontSize: 10 },
        },
      ];

  const o = option as Record<string, any>;
  return {
    color: OJK_COLORS.series,
    ...option,
    toolbox: noToolbox ? { show: false } : { ...DEFAULT_TOOLBOX, ...(o.toolbox || {}) },
    tooltip: { ...DEFAULT_TOOLTIP, ...(o.tooltip || {}) },
    grid: o.grid ? { ...DEFAULT_GRID, ...o.grid } : DEFAULT_GRID,
    dataZoom: noZoom ? [] : [...dataZoomConfig, ...(o.dataZoom || [])],
  } as EChartsOption;
}

export function safeAxisMax(values: number[], percentile = 0.95, padding = 1.15) {
  const clean = values.filter((v) => isFinite(v) && !isNaN(v)).map(Math.abs);
  if (clean.length === 0) return { axisMax: 1, hasOutliers: false, outlierThreshold: 1 };
  clean.sort((a, b) => a - b);
  const idx = Math.floor(clean.length * percentile);
  const threshold = clean[idx] || clean[clean.length - 1];
  const axisMax = threshold * padding;
  const hasOutliers = clean.some((v) => v > threshold);
  return { axisMax, hasOutliers, outlierThreshold: threshold };
}

let mapRegistered = false;
export function registerKalselMap(geojson: unknown): void {
  if (mapRegistered) return;
  echarts.registerMap("kalsel", geojson as any);
  mapRegistered = true;
}

export { echarts };
export type { EChartsOption };
