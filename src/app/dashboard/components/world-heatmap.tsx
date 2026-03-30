"use client";

import React, { useMemo } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

type HeatmapPoint = {
  code: string;
  value: number;
};

export default function WorldHeatmap({ data }: { data: HeatmapPoint[] }) {
  const dataMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of data || []) {
      if (!row?.code) continue;
      m.set(row.code.toUpperCase(), row.value);
    }
    return m;
  }, [data]);

  const max = useMemo(() => {
    let m = 0;
    dataMap.forEach((v) => {
      m = Math.max(m, v);
    });
    return m || 1;
  }, [dataMap]);

  const geoUrl =
    "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
        <h3 className="font-semibold text-sm">World Heatmap</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          by country
        </span>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ComposableMap projection="geoMercator">
          <Geographies geography={geoUrl}>
            {(props: any) =>
              (props.geographies || []).map((geo: any) => {
                const code = (geo.properties?.ISO_A2 ||
                  geo.id ||
                  geo.properties?.code ||
                  "").toString().toUpperCase();
                const value = dataMap.get(code) || 0;

                // Alpha is scaled by relative intensity.
                const alpha = Math.min(0.85, 0.15 + (value / max) * 0.75);
                const fill = value > 0 ? `rgba(124, 58, 237, ${alpha})` : "rgba(148, 163, 184, 0.12)";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="rgba(148, 163, 184, 0.45)"
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", cursor: "pointer" },
                    }}
                    aria-label={`${code}: ${value} clicks`}
                    title={`${code}: ${value} clicks`}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
    </div>
  );
}

