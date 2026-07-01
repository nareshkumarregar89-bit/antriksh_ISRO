/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Globe,
  RefreshCw,
  Sliders,
  Grid,
  Radio,
  Eye,
  Activity,
  ArrowRight
} from "lucide-react";
import { motion } from "motion/react";

export default function SatelliteViewer() {
  const [pollutant, setPollutant] = useState<"NO2" | "CO" | "SO2" | "Aerosol">("NO2");
  const [lat, setLat] = useState("23.0225");
  const [lng, setLng] = useState("72.5714");
  const [gridData, setGridData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSatelliteGrid = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/satellite/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          pollutant
        })
      });

      const data = await res.json();
      setGridData(data);
    } catch (e) {
      console.error("Satellite fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSatelliteGrid();
  }, [pollutant]);

  const handleUpdateBounds = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSatelliteGrid();
  };

  const getCellColor = (val: number) => {
    if (pollutant === "NO2") {
      // 0 to 250
      const norm = Math.min(1.0, val / 180);
      return `rgba(239, 68, 68, ${norm})`; // Red
    } else if (pollutant === "CO") {
      // 0 to 2.0
      const norm = Math.min(1.0, val / 1.5);
      return `rgba(245, 158, 11, ${norm})`; // Orange
    } else if (pollutant === "SO2") {
      // 0 to 50
      const norm = Math.min(1.0, val / 40);
      return `rgba(168, 85, 247, ${norm})`; // Purple
    } else {
      // Aerosol: 0 to 1.0
      const norm = Math.min(1.0, val / 0.8);
      return `rgba(6, 182, 212, ${norm})`; // Cyan
    }
  };

  const getMetricUnit = () => {
    if (pollutant === "NO2") return "10¹⁵ molecules/cm²";
    if (pollutant === "CO") return "mg/m³";
    if (pollutant === "SO2") return "Dobson Units (DU)";
    return "AOD Index";
  };

  return (
    <div id="satellite-viewer-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* Left Column: Bounds selector and metadata */}
      <div className="space-y-6">
        <form onSubmit={handleUpdateBounds} className="bg-[#0f172a]/85 border border-slate-800 rounded-lg p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Globe className="w-5 h-5 text-cyan-400 animate-spin-slow" />
            <h2 className="text-lg font-semibold font-display text-white">Sentinel-5P Scanner</h2>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold block mb-1">Spectral Pollutant Selection</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(["NO2", "CO", "SO2", "Aerosol"] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPollutant(p)}
                    className={`py-2 px-3 rounded text-xs font-mono border transition-all ${
                      pollutant === p
                        ? "bg-cyan-950 border-cyan-500 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.1)]"
                        : "bg-[#020617] border-slate-900 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-900 pt-3">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Scanner Lat</span>
                <input
                  type="text" value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs font-mono outline-none focus:border-cyan-500 mt-1"
                />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Scanner Lng</span>
                <input
                  type="text" value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs font-mono outline-none focus:border-cyan-500 mt-1"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-850/50">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-display text-xs font-bold tracking-wider rounded border border-cyan-400/20 shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              RE-TRIGGER SPECTRAL SCAN
            </button>
          </div>
        </form>

        <div className="p-4 bg-[#020617] border border-slate-800 rounded-lg text-[10px] font-mono text-slate-500 space-y-1.5">
          <div className="flex justify-between items-center">
            <span>DOWNLOAD ENGINE:</span>
            <a
              href="https://earthdata.nasa.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline hover:text-cyan-300 transition-all font-bold"
            >
              NASA EarthData GSLV-MK3
            </a>
          </div>
          <div className="flex justify-between">
            <span>GRID RESOLUTION:</span>
            <span>10x10 PIXEL MAPPING</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-relaxed uppercase pt-1 border-t border-slate-900 mt-1">
            * NASA earth observation networks supply ESA Copernicus Sentinel <a href="https://sentinel.esa.int/web/sentinel/missions/sentinel-5p" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline">Sentinel-5P</a> tropospheric gas maps *
          </p>
        </div>
      </div>

      {/* Middle/Right Column: 10x10 matrix and info HUD */}
      <div className="lg:col-span-2 bg-[#0f172a]/85 border border-slate-800 rounded-lg p-5 flex flex-col justify-between shadow-2xl min-h-[480px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Grid className="w-5 h-5 text-cyan-400" />
              <a
                href="https://sentinel.esa.int/web/sentinel/missions/sentinel-5p"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold font-display text-white hover:text-cyan-400 hover:underline transition-all"
              >
                ESA Sentinel-5P Multi-Spectral Raster
              </a>
            </div>
            <span className="text-xs font-mono text-slate-500">MODULE 6: SATELLITE</span>
          </div>

          {gridData ? (
            <div className="space-y-4">
              {/* Info Metrics HUD */}
              <div className="grid grid-cols-2 gap-4 bg-[#020617] p-3.5 rounded border border-slate-900 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Layer Type</span>
                  <span className="text-white font-bold">{pollutant} Raster Grid</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Calculated Mean Density</span>
                  <span className="text-cyan-400 font-bold">{gridData.density} <span className="text-[10px] text-slate-500 font-normal">{getMetricUnit()}</span></span>
                </div>
              </div>

              {/* RENDER SPECTRAL GRID */}
              <div className="bg-slate-950 p-4 rounded border border-slate-900 flex justify-center relative">
                {loading && (
                  <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center font-mono text-xs text-cyan-400 z-10 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>FETCHING TROPOSPHERIC MAPS...</span>
                  </div>
                )}
                
                <div className="grid grid-cols-10 gap-1 w-full max-w-[280px] aspect-square">
                  {gridData.matrix.map((row: number[], rIdx: number) =>
                    row.map((val: number, cIdx: number) => (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        className="rounded-sm transition-all relative group aspect-square hover:scale-110 hover:z-20 hover:shadow-lg hover:border hover:border-white/50"
                        style={{ backgroundColor: getCellColor(val) }}
                      >
                        {/* Custom tooltip cell values */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-950 border border-slate-800 p-1.5 rounded shadow-2xl text-[9px] font-mono text-white whitespace-nowrap z-30">
                          [{rIdx},{cIdx}] Density: {val} {getMetricUnit()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-xs font-mono text-slate-500">
              Awaiting scanner trigger.
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-900 text-[10px] font-mono text-slate-500 flex justify-between mt-4">
          <span>COPERNICUS CONNECT: YES</span>
          <span>RASTER REFRESH: ON</span>
        </div>
      </div>
    </div>
  );
}
