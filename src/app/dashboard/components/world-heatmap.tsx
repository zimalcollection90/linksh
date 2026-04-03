"use client";

import React, { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { motion, AnimatePresence } from "framer-motion";
import { Map as MapIcon, MousePointer2 } from "lucide-react";

type HeatmapPoint = {
  code: string;
  value: number;
};

export default function WorldHeatmap({ data }: { data: HeatmapPoint[] }) {
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

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

  const geoUrl = "https://raw.githubusercontent.com/lotusms/world-map-data/main/world.json";

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 relative overflow-hidden group/map">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <MapIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-none text-foreground">Global Reach</h3>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-medium">Click distribution by country</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/30 border border-border/50">
          <MousePointer2 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Hover for details</span>
        </div>
      </div>

      <div 
        className="relative rounded-xl bg-muted/10 border border-border/40 overflow-hidden cursor-crosshair"
        style={{ height: "400px" }}
        onMouseMove={handleMouseMove}
      >
        <ComposableMap 
          projection="geoMercator" 
          projectionConfig={{ scale: 120 }} 
          width={800} 
          height={400} 
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={geoUrl}>
            {(props: any) =>
              (props.geographies || []).map((geo: any) => {
                const code = (geo.properties?.ISO_A2 ||
                  geo.properties?.["Alpha-2"] ||
                  geo.id ||
                  geo.properties?.code ||
                  "").toString().toUpperCase();
                const value = dataMap.get(code) || 0;
                const name = geo.properties?.name || code;

                // Alpha is scaled by relative intensity.
                const alpha = Math.min(0.9, 0.15 + (value / max) * 0.75);
                const isSelected = value > 0;
                const fill = isSelected 
                  ? `rgba(124, 58, 237, ${alpha})` 
                  : "rgba(148, 163, 184, 0.08)";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={isSelected ? "rgba(255, 255, 255, 0.15)" : "rgba(148, 163, 184, 0.2)"}
                    strokeWidth={0.5}
                    onMouseEnter={() => {
                      setTooltipContent(`${name}: ${value.toLocaleString()} clicks`);
                    }}
                    onMouseLeave={() => {
                      setTooltipContent(null);
                    }}
                    style={{
                      default: { outline: "none", transition: "all 250ms ease" },
                      hover: { 
                        outline: "none", 
                        fill: isSelected ? "rgba(124, 58, 237, 1)" : "rgba(148, 163, 184, 0.2)",
                        stroke: "#fff",
                        strokeWidth: 1,
                        cursor: "pointer"
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2 p-3 rounded-lg bg-background/80 backdrop-blur-md border border-border/50 shadow-xl">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Intensity</p>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">Low</span>
            <div className="w-24 h-1.5 rounded-full bg-gradient-to-r from-primary/20 via-primary/60 to-primary shadow-sm" />
            <span className="text-[9px] text-muted-foreground">High</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {tooltipContent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            className="fixed pointer-events-none z-[100] px-3 py-1.5 bg-foreground text-background rounded-lg shadow-2xl text-[11px] font-bold border border-background/10 backdrop-blur-sm"
            style={{ 
              left: tooltipPos.x + 15, 
              top: tooltipPos.y - 15 
            }}
          >
            {tooltipContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

