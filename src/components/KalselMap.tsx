import { useMemo } from "react";
import { EChart } from "./EChart";
import { registerKalselMap, type EChartsOption } from "../lib/echarts";

interface GeoFeature {
  properties: { wilayah_id: string; nama: string };
}
interface GeoJson {
  features: GeoFeature[];
}

interface Props {
  geojson: GeoJson;

  valueByWid: Map<string, number | null>;
  ramp: string[];

  formatValue: (v: number | null) => string;
  downloadName?: string;
  height?: number;
  onPilihWilayah?: (wilayahId: string) => void;
}

export function KalselMap({
  geojson,
  valueByWid,
  ramp,
  formatValue,
  downloadName = "peta-kalsel",
  height = 440,
  onPilihWilayah,
}: Props) {
  registerKalselMap(geojson);

  const idByNama = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of geojson.features) m.set(f.properties.nama, String(f.properties.wilayah_id));
    return m;
  }, [geojson]);

  const option = useMemo<EChartsOption>(() => {
    const data = geojson.features.map((f) => ({
      name: f.properties.nama,

      value: (valueByWid.get(String(f.properties.wilayah_id)) ?? null) as unknown as number,
    }));
    const vals = data
      .map((d) => d.value)
      .filter((v): v is number => v != null && !Number.isNaN(v));
    const minV = vals.length ? Math.min(...vals) : 0;
    const maxV = vals.length ? Math.max(...vals) : 1;

    return {
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const v = p.value == null || Number.isNaN(p.value) ? null : p.value;
          return `<div style="font-weight:600">${p.name}</div><div style="font-size:11px;color:#D4D4D8">${formatValue(v)}</div>`;
        },
      },
      toolbox: {
        feature: {
          restore: { title: "Reset tampilan" },
          saveAsImage: { title: "Unduh PNG", name: downloadName, pixelRatio: 2 },
        },
      },
      visualMap: {
        type: "continuous",
        min: minV,
        max: maxV === minV ? minV + 1 : maxV,
        calculable: true,
        left: 8,
        bottom: 6,
        orient: "horizontal",
        itemWidth: 12,
        itemHeight: 80,
        text: ["tinggi", "rendah"],
        textStyle: { fontSize: 10, color: "#52525B" },
        inRange: { color: ramp },
      },
      series: [
        {
          type: "map",
          map: "kalsel",
          nameProperty: "nama",
          roam: false,
          data,
          label: { show: true, fontSize: 8, color: "#27272A" },
          itemStyle: { borderColor: "#fff", borderWidth: 1, areaColor: "#eeeeee" },
          emphasis: {
            label: { show: true, fontWeight: "bold" },
            itemStyle: { areaColor: "#D4A017" },
          },
          select: { disabled: true },
        },
      ],
    };
  }, [geojson, valueByWid, ramp, formatValue, downloadName]);

  const events = useMemo(
    () =>
      onPilihWilayah
        ? {
            click: (p: any) => {
              const id = idByNama.get(p?.name);
              if (id) onPilihWilayah(id);
            },
          }
        : undefined,
    [onPilihWilayah, idByNama]
  );

  return (
    <EChart
      option={option}
      height={height}
      renderer="canvas"
      noZoom
      onEvents={events}
      scrollOnMobile={false}
      className={onPilihWilayah ? "peta-klikable" : undefined}
    />
  );
}
