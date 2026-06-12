import ReactECharts from "echarts-for-react";
import { mergeOption, type ChartOpts, type EChartsOption } from "../lib/echarts";

interface Props extends ChartOpts {
  option: EChartsOption;
  height?: number;
  renderer?: "svg" | "canvas";
  className?: string;
}

export function EChart({
  option,
  height = 320,
  renderer = "svg",
  noToolbox,
  noZoom,
  className,
}: Props) {
  return (
    <ReactECharts
      option={mergeOption(option, { noToolbox, noZoom })}
      notMerge
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer }}
      className={className}
    />
  );
}
