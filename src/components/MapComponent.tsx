/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Layers,
  MapPin,
  Wind,
  Plus,
  Compass,
  Radio,
  Eye,
  Settings,
  Sparkles,
  Search,
  CheckCircle,
  Activity
} from "lucide-react";
import { motion } from "motion/react";
import { AQISample, Hotspot } from "../types";

interface MapComponentProps {
  onNodeAdded: () => void;
  userRole: string;
}

export default function MapComponent({ onNodeAdded, userRole }: MapComponentProps) {
  const [samples, setSamples] = useState<AQISample[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);

  // Layers Toggles
  const [showSatelliteGrid, setShowSatelliteGrid] = useState(true);
  const [showAqiHeatmap, setShowAqiHeatmap] = useState(true);
  const [showWindVectors, setShowWindVectors] = useState(true);
  const [showGasPlume, setShowGasPlume] = useState(false);
  const [clusterMethod, setClusterMethod] = useState<"none" | "kmeans" | "dbscan">("kmeans");

  // Hovered location coordinates
  const [hoverCoord, setHoverCoord] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);

  // Deploy Node Modal state
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployLat, setDeployLat] = useState(23.02);
  const [deployLng, setDeployLng] = useState(72.57);
  const [deployPm25, setDeployPm25] = useState(80);
  const [deployPm10, setDeployPm10] = useState(120);
  const [deployStationName, setDeployStationName] = useState("Satellite Node #5");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Geobounds mapping (Ahmedabad Region)
  const latMin = 23.00;
  const latMax = 23.12;
  const lngMin = 72.50;
  const lngMax = 72.68;

  // Convert Geo-coordinates to Canvas pixels
  const getXY = (lat: number, lng: number, width: number, height: number) => {
    // scale factor
    const x = ((lng - lngMin) / (lngMax - lngMin)) * width;
    // Y is inverted in canvas coordinates
    const y = height - (((lat - latMin) / (latMax - latMin)) * height);
    return { x, y };
  };

  // Convert Canvas pixels to Geo-coordinates
  const getLatLng = (x: number, y: number, width: number, height: number) => {
    const lng = lngMin + (x / width) * (lngMax - lngMin);
    const lat = latMin + ((height - y) / height) * (latMax - latMin);
    return { lat: parseFloat(lat.toFixed(5)), lng: parseFloat(lng.toFixed(5)) };
  };

  const fetchMapData = async () => {
    try {
      const sampleRes = await fetch("/api/samples");
      const sampleData = await sampleRes.json();
      setSamples(sampleData);

      if (clusterMethod !== "none") {
        const hotspotRes = await fetch(`/api/hotspots?method=${clusterMethod}`);
        const hotspotData = await hotspotRes.json();
        setHotspots(hotspotData);
      } else {
        setHotspots([]);
      }
    } catch (e) {
      console.error("Map fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
  }, [clusterMethod]);

  // Redraw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high pixel density
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Satellite Grid Background (Tech Blueprint grid)
    if (showSatelliteGrid) {
      ctx.strokeStyle = "rgba(14, 165, 233, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw coordinate ticks
      ctx.fillStyle = "rgba(14, 165, 233, 0.4)";
      ctx.font = "8px monospace";
      for (let x = 80; x < width; x += 160) {
        const geo = getLatLng(x, height - 10, width, height);
        ctx.fillText(`${geo.lng}°E`, x, height - 4);
      }
      for (let y = 80; y < height; y += 120) {
        const geo = getLatLng(10, y, width, height);
        ctx.fillText(`${geo.lat}°N`, 4, y);
      }
    }

    // 2. Draw Gaseous plumes Overlay (Naroda Industrial East sector)
    if (showGasPlume) {
      const gradient = ctx.createRadialGradient(
        width * 0.8, height * 0.3, 10,
        width * 0.8, height * 0.3, 150
      );
      gradient.addColorStop(0, "rgba(220, 38, 38, 0.25)");
      gradient.addColorStop(0.5, "rgba(234, 179, 8, 0.1)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(width * 0.8, height * 0.3, 150, 0, Math.PI * 2);
      ctx.fill();

      // Labels for sectors
      ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
      ctx.font = "bold 9px 'Space Grotesk'";
      ctx.fillText("NARODA INDUSTRIAL SECTOR: AMBIENT PLUME OVERLAY", width * 0.55, height * 0.18);
    }

    // 3. Draw AQI Heatmap contour overlays (from real sensor points)
    if (showAqiHeatmap && samples.length > 0) {
      samples.forEach(sample => {
        const pos = getXY(sample.lat, sample.lng, width, height);
        const aqi = sample.pm25 * 2.5; // proxy aqi
        
        let color = "rgba(16, 185, 129, 0.08)"; // good
        let radius = 60;
        if (aqi > 100 && aqi <= 200) {
          color = "rgba(234, 179, 8, 0.08)";
          radius = 100;
        } else if (aqi > 200) {
          color = "rgba(239, 68, 68, 0.09)";
          radius = 150;
        }

        const gradient = ctx.createRadialGradient(pos.x, pos.y, 5, pos.x, pos.y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 4. Draw Hotspot DBSCAN / KMeans clusters linking
    if (clusterMethod !== "none" && hotspots.length > 0) {
      // Find cluster groups and link them to average coordinates
      const clustersMap: Record<number, { sumX: number; sumY: number; count: number; aqi: number }> = {};
      hotspots.forEach(h => {
        if (h.clusterId === -1) return; // ignore DBSCAN noise
        const pos = getXY(h.lat, h.lng, width, height);
        if (!clustersMap[h.clusterId]) {
          clustersMap[h.clusterId] = { sumX: 0, sumY: 0, count: 0, aqi: 0 };
        }
        clustersMap[h.clusterId].sumX += pos.x;
        clustersMap[h.clusterId].sumY += pos.y;
        clustersMap[h.clusterId].count++;
        clustersMap[h.clusterId].aqi += h.aqi;
      });

      // Draw lines from members to centroids
      Object.keys(clustersMap).forEach(id => {
        const clusterId = parseInt(id);
        const c = clustersMap[clusterId];
        const cx = c.sumX / c.count;
        const cy = c.sumY / c.count;

        // Centroid marker (radar target)
        ctx.strokeStyle = "rgba(14, 165, 233, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        
        hotspots.forEach(h => {
          if (h.clusterId === clusterId) {
            const pos = getXY(h.lat, h.lng, width, height);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
          }
        });
        ctx.setLineDash([]);

        // Render Centroid pulse
        ctx.fillStyle = "rgba(6, 182, 212, 0.1)";
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "bold 8px monospace";
        ctx.fillText(`CLUSTER #${clusterId + 1}`, cx + 8, cy - 4);
      });
    }

    // 5. Draw Wind flow vectors (Arrows moving across screen)
    if (showWindVectors) {
      ctx.strokeStyle = "rgba(14, 165, 233, 0.15)";
      ctx.lineWidth = 1;
      const spacing = 80;
      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = spacing / 2; y < height; y += spacing) {
          // Flow direction pointing towards south-west (Ahmedabad standard flow)
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 15, y + 10);
          ctx.stroke();

          // Arrow head
          ctx.beginPath();
          ctx.moveTo(x - 15, y + 10);
          ctx.lineTo(x - 10, y + 10);
          ctx.lineTo(x - 15, y + 10);
          ctx.lineTo(x - 15, y + 5);
          ctx.stroke();
        }
      }
    }

    // 6. Draw Stations Markers
    samples.forEach((sample, idx) => {
      const pos = getXY(sample.lat, sample.lng, width, height);
      const aqi = Math.round(sample.pm25 * 2.5);

      // Pulse color
      let markerColor = "#10b981"; // good
      if (aqi > 100 && aqi <= 200) markerColor = "#eab308"; // mod
      else if (aqi > 200) markerColor = "#ef4444"; // poor

      // Radar pulse ring
      ctx.strokeStyle = markerColor;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10 + (idx % 3) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Small solid center dot
      ctx.fillStyle = markerColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Glow border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.stroke();

      // Metric Tag
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "rgba(14, 165, 233, 0.25)";
      ctx.lineWidth = 1;
      const tagW = 34;
      const tagH = 14;
      ctx.fillRect(pos.x + 8, pos.y - 7, tagW, tagH);
      ctx.strokeRect(pos.x + 8, pos.y - 7, tagW, tagH);

      ctx.fillStyle = markerColor;
      ctx.font = "bold 9px monospace";
      ctx.fillText(`${aqi}`, pos.x + 13, pos.y + 3);
    });

  }, [samples, hotspots, showSatelliteGrid, showAqiHeatmap, showWindVectors, showGasPlume, clusterMethod]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const geo = getLatLng(x, y, rect.width, rect.height);
    setHoverCoord({
      lat: geo.lat,
      lng: geo.lng,
      x,
      y
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const geo = getLatLng(x, y, rect.width, rect.height);
    setDeployLat(geo.lat);
    setDeployLng(geo.lng);
    setDeployStationName(`Station ${geo.lat.toFixed(3)}N, ${geo.lng.toFixed(3)}E`);
    setShowDeployModal(true);
  };

  const handleDeployNodeSubmit = async () => {
    const response = await fetch("/api/samples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pm25: deployPm25,
        pm10: deployPm10,
        co: 0.8,
        no2: 25,
        so2: 10,
        o3: 35,
        temp: 24,
        humidity: 50,
        windSpeed: 2.0,
        pressure: 1010,
        lat: deployLat,
        lng: deployLng,
        timestamp: new Date().toISOString()
      })
    });

    if (response.ok) {
      setShowDeployModal(false);
      onNodeAdded();
      fetchMapData();
    }
  };

  return (
    <div id="gis-engine-container" className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
      
      {/* Controls & Layer Options Panel */}
      <div className="bg-[#0f172a]/85 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-6 shadow-xl relative z-20">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold font-display text-white">GIS Overlays Deck</h2>
          </div>

          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold block">Atmospheric Layers</span>

            {/* Satellite Grid */}
            <label className="flex items-center justify-between p-2 rounded bg-[#020617] border border-slate-900 hover:border-slate-800 transition-all cursor-pointer">
              <span className="text-xs font-mono text-slate-300">Space Telemetry Grid</span>
              <input
                type="checkbox"
                checked={showSatelliteGrid}
                onChange={() => setShowSatelliteGrid(!showSatelliteGrid)}
                className="accent-cyan-500 rounded bg-slate-950 border-slate-800"
              />
            </label>

            {/* AQI Heatmap */}
            <label className="flex items-center justify-between p-2 rounded bg-[#020617] border border-slate-900 hover:border-slate-800 transition-all cursor-pointer">
              <span className="text-xs font-mono text-slate-300">AQI Contour Overlays</span>
              <input
                type="checkbox"
                checked={showAqiHeatmap}
                onChange={() => setShowAqiHeatmap(!showAqiHeatmap)}
                className="accent-cyan-500 rounded bg-slate-950 border-slate-800"
              />
            </label>

            {/* Wind flow Vectors */}
            <label className="flex items-center justify-between p-2 rounded bg-[#020617] border border-slate-900 hover:border-slate-800 transition-all cursor-pointer">
              <span className="text-xs font-mono text-slate-300">Wind Direction Vectors</span>
              <input
                type="checkbox"
                checked={showWindVectors}
                onChange={() => setShowWindVectors(!showWindVectors)}
                className="accent-cyan-500 rounded bg-slate-950 border-slate-800"
              />
            </label>

            {/* Gas plumes Overlay */}
            <label className="flex items-center justify-between p-2 rounded bg-[#020617] border border-slate-900 hover:border-slate-800 transition-all cursor-pointer">
              <span className="text-xs font-mono text-slate-300">Industrial Plume Overlay</span>
              <input
                type="checkbox"
                checked={showGasPlume}
                onChange={() => setShowGasPlume(!showGasPlume)}
                className="accent-cyan-500 rounded bg-slate-950 border-slate-800"
              />
            </label>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-800/60">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold block">Hotspot ML Method</span>
            <div className="grid grid-cols-3 gap-1">
              {(["none", "kmeans", "dbscan"] as const).map(method => (
                <button
                  key={method}
                  onClick={() => setClusterMethod(method)}
                  className={`py-1.5 px-1 rounded text-[10px] font-mono uppercase border transition-all ${
                    clusterMethod === method
                      ? "bg-cyan-950 border-cyan-500 text-cyan-400"
                      : "bg-[#020617] border-slate-900 text-slate-500 hover:border-slate-800"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
              {clusterMethod === "kmeans" && "K-Means locates optimal centroids to rank region-wide sub-indices."}
              {clusterMethod === "dbscan" && "DBSCAN clusters core density zones, filtering out noise sensors."}
              {clusterMethod === "none" && "Unsupervised geospatial clustering disabled."}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 text-[10px] font-mono text-slate-500 space-y-1.5">
          <div className="flex justify-between">
            <span>SATELLITE SECTOR:</span>
            <span className="text-cyan-400">ISRO-SAC-AHD</span>
          </div>
          <div className="flex justify-between">
            <span>GEO ENVELOPE:</span>
            <span>Ahmedabad West</span>
          </div>
        </div>
      </div>

      {/* Actual Mapping Canvas Panel */}
      <div className="lg:col-span-3 bg-[#0f172a]/85 border border-slate-800 rounded-lg p-3 relative flex flex-col min-h-[480px] shadow-2xl overflow-hidden">
        
        {/* Telemetry coordinate HUD */}
        <div className="absolute top-4 left-4 p-2 bg-slate-950/90 border border-slate-800 rounded text-[10px] font-mono text-slate-400 z-10 flex gap-4">
          <div>
            LATITUDE: <span className="text-cyan-400">{hoverCoord ? hoverCoord.lat.toFixed(5) : "23.06000"}°N</span>
          </div>
          <div>
            LONGITUDE: <span className="text-cyan-400">{hoverCoord ? hoverCoord.lng.toFixed(5) : "72.59000"}°E</span>
          </div>
          <div>
            TELEMETRY NODES: <span className="text-white">{samples.length}</span>
          </div>
        </div>

        {/* Quick legend info banner */}
        <div className="absolute bottom-4 left-4 p-2.5 bg-slate-950/90 border border-slate-800 rounded text-[9px] font-mono text-slate-400 z-10 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span>0 - 50: Ambient clean air quality</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span>101 - 200: Moderate sub-indices logged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span>201+: Critical pollution density detected</span>
          </div>
          <div className="text-[8px] text-slate-500 pt-1 uppercase border-t border-slate-900 mt-1">
            * Click grid coordinates to deploy a local node *
          </div>
        </div>

        <div ref={containerRef} className="flex-1 relative w-full h-full bg-[#030712] rounded border border-slate-900 overflow-hidden cursor-crosshair">
          <canvas
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setHoverCoord(null)}
            onClick={handleCanvasClick}
            className="absolute inset-0 w-full h-full block"
          />
        </div>

        {/* Modal: Deploy Node Modal */}
        {showDeployModal && (
          <div id="deploy-node-modal" className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-30">
            <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-semibold font-display text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-cyan-400" /> Deploy Telemetry Node
                </h3>
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="text-xs font-mono text-slate-500 hover:text-white"
                >
                  [ CLOSE ]
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Node Name</span>
                  <input
                    type="text" value={deployStationName}
                    onChange={(e) => setDeployStationName(e.target.value)}
                    className="w-full bg-[#020617] border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs outline-none focus:border-cyan-500 mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Latitude</span>
                    <span className="text-cyan-400 font-bold block mt-1">{deployLat.toFixed(5)}°N</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Longitude</span>
                    <span className="text-cyan-400 font-bold block mt-1">{deployLng.toFixed(5)}°E</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-900 pt-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">PM2.5 (µg/m³)</span>
                    <input
                      type="number" value={deployPm25}
                      onChange={(e) => setDeployPm25(parseInt(e.target.value))}
                      className="w-full bg-[#020617] border border-slate-800 rounded px-2 py-1 text-white text-xs outline-none focus:border-cyan-500 mt-1"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">PM10 (µg/m³)</span>
                    <input
                      type="number" value={deployPm10}
                      onChange={(e) => setDeployPm10(parseInt(e.target.value))}
                      className="w-full bg-[#020617] border border-slate-800 rounded px-2 py-1 text-white text-xs outline-none focus:border-cyan-500 mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleDeployNodeSubmit}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-display font-semibold text-xs rounded border border-cyan-400/20 shadow-lg transition-all"
                >
                  CONFIRM COORDINATE DISPATCH
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
