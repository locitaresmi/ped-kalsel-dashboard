import ReactECharts from "echarts-for-react";
import { mergeOption, type ChartOpts, type EChartsOption } from "../lib/echarts";

interface Props extends ChartOpts {
  option: EChartsOption;
  height?: number;
  renderer?: "svg" | "canvas";
  className?: string;
  onEvents?: Record<string, (params: any) => void>;
  scrollOnMobile?: boolean;
}

export function EChart({
  option,
  height = 320,
  renderer = "svg",
  noToolbox,
  noZoom,
  className,
  onEvents,
  scrollOnMobile = true,
}: Props) {
  const chart = (
    <ReactECharts
      option={mergeOption(option, { noToolbox, noZoom })}
      notMerge
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer }}
      className={className}
      onEvents={onEvents}
    />
  );
  if (!scrollOnMobile) return chart;
  return <div className="echart-scroll">{chart}</div>;
}
