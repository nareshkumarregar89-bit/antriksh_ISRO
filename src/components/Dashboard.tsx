/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Cpu,
  ShieldAlert,
  Wind,
  Thermometer,
  Droplets,
  Gauge,
  Sparkles,
  Database,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Link as LinkIcon,
  Copy,
  Check
} from "lucide-react";
import { motion } from "motion/react";
import { PredictionResult, Alert } from "../types";

interface DashboardProps {
  userRole: string;
}

export default function Dashboard({ userRole }: DashboardProps) {
  const [summary, setSummary] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // Prediction Console inputs
  const [pm25, setPm25] = useState(42);
  const [pm10, setPm10] = useState(65);
  const [co, setCo] = useState(0.6);
  const [no2, setNo2] = useState(22);
  const [so2, setSo2] = useState(8);
  const [o3, setO3] = useState(35);
  const [temp, setTemp] = useState(26);
  const [humidity, setHumidity] = useState(52);
  const [windSpeed, setWindSpeed] = useState(2.4);
  const [pressure, setPressure] = useState(1011);

  // Prediction output
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchSummaryAndAlerts = async () => {
    try {
      const [sumRes, alertRes] = await Promise.all([
        fetch("/api/dashboard/summary"),
        fetch("/api/alerts")
      ]);
      const sumData = await sumRes.json();
      const alertData = await alertRes.json();

      setSummary(sumData);
      setAlerts(alertData.filter((a: Alert) => !a.resolved));
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryAndAlerts();
    const interval = setInterval(fetchSummaryAndAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePredict = async () => {
    setPredicting(true);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pm25,
          pm10,
          co,
          no2,
          so2,
          o3,
          temp,
          humidity,
          windSpeed,
          pressure,
          lat: 23.0225,
          lng: 72.5714,
          timestamp: new Date().toISOString()
        })
      });

      const data = await res.json();
      setPrediction(data);
    } catch (e) {
      console.error("Prediction failed", e);
    } finally {
      setPredicting(false);
    }
  };

  // Run initial prediction and load deep link parameters if available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let loadedPm25 = pm25;
    let loadedPm10 = pm10;
    let loadedCo = co;
    let loadedNo2 = no2;
    let loadedSo2 = so2;
    let loadedO3 = o3;
    let loadedTemp = temp;
    let loadedHumidity = humidity;
    let loadedWindSpeed = windSpeed;
    let loadedPressure = pressure;

    if (params.has("pm25")) { loadedPm25 = parseInt(params.get("pm25")!); setPm25(loadedPm25); }
    if (params.has("pm10")) { loadedPm10 = parseInt(params.get("pm10")!); setPm10(loadedPm10); }
    if (params.has("co")) { loadedCo = parseFloat(params.get("co")!); setCo(loadedCo); }
    if (params.has("no2")) { loadedNo2 = parseInt(params.get("no2")!); setNo2(loadedNo2); }
    if (params.has("so2")) { loadedSo2 = parseInt(params.get("so2")!); setSo2(loadedSo2); }
    if (params.has("o3")) { loadedO3 = parseInt(params.get("o3")!); setO3(loadedO3); }
    if (params.has("temp")) { loadedTemp = parseInt(params.get("temp")!); setTemp(loadedTemp); }
    if (params.has("humidity")) { loadedHumidity = parseInt(params.get("humidity")!); setHumidity(loadedHumidity); }
    if (params.has("windSpeed")) { loadedWindSpeed = parseFloat(params.get("windSpeed")!); setWindSpeed(loadedWindSpeed); }
    if (params.has("pressure")) { loadedPressure = parseInt(params.get("pressure")!); setPressure(loadedPressure); }

    const runPredict = async () => {
      setPredicting(true);
      try {
        const res = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pm25: loadedPm25,
            pm10: loadedPm10,
            co: loadedCo,
            no2: loadedNo2,
            so2: loadedSo2,
            o3: loadedO3,
            temp: loadedTemp,
            humidity: loadedHumidity,
            windSpeed: loadedWindSpeed,
            pressure: loadedPressure,
            lat: 23.0225,
            lng: 72.5714,
            timestamp: new Date().toISOString()
          })
        });

        const data = await res.json();
        setPrediction(data);
      } catch (e) {
        console.error("Prediction failed", e);
      } finally {
        setPredicting(false);
      }
    };
    runPredict();
  }, []);

  const handleCopyLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const query = `?pm25=${pm25}&pm10=${pm10}&co=${co}&no2=${no2}&so2=${so2}&o3=${o3}&temp=${temp}&humidity=${humidity}&windSpeed=${windSpeed}&pressure=${pressure}`;
    const fullUrl = baseUrl + query;

    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-cyan-400 font-mono gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span>INITIALIZING TELEMETRY STREAMS...</span>
      </div>
    );
  }

  // Define scale colors
  const getAqiColor = (aqi: number) => {
    if (aqi <= 50) return { text: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-800", colorCode: "#10b981" };
    if (aqi <= 100) return { text: "text-green-400", bg: "bg-green-950/40", border: "border-green-800", colorCode: "#22c55e" };
    if (aqi <= 200) return { text: "text-yellow-400", bg: "bg-yellow-950/40", border: "border-yellow-800", colorCode: "#eab308" };
    if (aqi <= 300) return { text: "text-orange-400", bg: "bg-orange-950/40", border: "border-orange-800", colorCode: "#f97316" };
    if (aqi <= 400) return { text: "text-red-400", bg: "bg-red-950/40", border: "border-red-800", colorCode: "#ef4444" };
    return { text: "text-rose-500 font-bold", bg: "bg-rose-950/40", border: "border-rose-900", colorCode: "#f43f5e" };
  };

  const aqiStyle = getAqiColor(summary.currentAqi);

  return (
    <div id="dashboard-container" className="space-y-6">
      {/* HUD Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current AQI Gauge */}
        <div className={`p-4 rounded-lg bg-[#0f172a]/80 border ${aqiStyle.border} shadow-[0_0_15px_rgba(15,23,42,0.2)] flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Atmospheric AQI</span>
            <span className="p-1 bg-slate-900 rounded border border-slate-800 text-cyan-400 font-mono text-[10px]">LIVE GRID</span>
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className={`text-4xl font-display font-bold ${aqiStyle.text}`}>{summary.currentAqi}</span>
            <span className="text-xs font-mono text-slate-400">PPM (Max Subindex)</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono border-t border-slate-900 pt-2 mt-2">
            <span className="text-slate-500">Delta 1h:</span>
            <span className={summary.aqiDelta >= 0 ? "text-red-400" : "text-emerald-400"}>
              {summary.aqiDelta >= 0 ? `+${summary.aqiDelta}` : summary.aqiDelta} PPM
            </span>
          </div>
        </div>

        {/* System Active Alarms */}
        <div className="p-4 rounded-lg bg-[#0f172a]/80 border border-slate-800 shadow-[0_0_15px_rgba(15,23,42,0.2)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Environmental Bulletins</span>
            <ShieldAlert className="w-4 h-4 text-orange-500" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-4xl font-display font-bold text-white font-mono">{summary.activeAlerts}</span>
            <span className="text-xs font-mono text-slate-400">Active</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono border-t border-slate-900 pt-2 mt-2">
            <span className="text-slate-500">Critical Threats:</span>
            <span className="text-red-400 font-bold">{summary.criticalAlerts}</span>
          </div>
        </div>

        {/* Telemetry Station Count */}
        <div className="p-4 rounded-lg bg-[#0f172a]/80 border border-slate-800 shadow-[0_0_15px_rgba(15,23,42,0.2)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Ground Stations</span>
            <Database className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-4xl font-display font-bold text-white font-mono">{summary.stationCount}</span>
            <span className="text-xs font-mono text-slate-400">Deployed</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono border-t border-slate-900 pt-2 mt-2">
            <span className="text-slate-500">Comm Health:</span>
            <span className="text-emerald-400">100% ONLINE</span>
          </div>
        </div>

        {/* Champion ML Model Core */}
        <div className="p-4 rounded-lg bg-[#0f172a]/80 border border-slate-800 shadow-[0_0_15px_rgba(15,23,42,0.2)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Active ML Model</span>
            <Cpu className="w-4 h-4 text-emerald-500 animate-pulse" />
          </div>
          <div className="my-3">
            <h3 className="text-sm font-semibold font-display text-emerald-400 truncate mt-1">
              {summary.championModel}
            </h3>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">CHAMPION CORE ACTIVE</p>
          </div>
          <div className="flex items-center justify-between text-xs font-mono border-t border-slate-900 pt-2 mt-2">
            <span className="text-slate-500">Local Training:</span>
            <span className="text-cyan-400 flex items-center gap-0.5">
              Verified <Sparkles className="w-3 h-3 text-yellow-400" />
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Prediction Console and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle: Predictive Analytical Simulator Console */}
        <div className="lg:col-span-2 bg-[#0f172a]/85 border border-slate-800 rounded-lg p-6 space-y-6 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold font-display text-white">Atmospheric Sub-index Simulator</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">MODULE 8: PREDICT ENGINE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Controls */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold mb-2">Simulated Pollutant Concentration</h3>

              {/* PM2.5 Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">PM2.5 (Fine dust)</span>
                  <span className="text-cyan-400">{pm25} µg/m³</span>
                </div>
                <input
                  type="range" min="1" max="500" value={pm25}
                  onChange={(e) => setPm25(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* PM10 Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">PM10 (Coarse dust)</span>
                  <span className="text-cyan-400">{pm10} µg/m³</span>
                </div>
                <input
                  type="range" min="1" max="600" value={pm10}
                  onChange={(e) => setPm10(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* NO2 Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">NO2 (Nitrogen Dioxide)</span>
                  <span className="text-cyan-400">{no2} ppb</span>
                </div>
                <input
                  type="range" min="0" max="300" value={no2}
                  onChange={(e) => setNo2(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* O3 Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">O3 (Ozone)</span>
                  <span className="text-cyan-400">{o3} ppb</span>
                </div>
                <input
                  type="range" min="0" max="300" value={o3}
                  onChange={(e) => setO3(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Gaseous parameters sub-grid */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-900 pt-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">CO (Carbon Monoxide)</span>
                  <input
                    type="number" step="0.1" value={co}
                    onChange={(e) => setCo(parseFloat(e.target.value))}
                    className="w-full bg-[#020617] border border-slate-800 rounded px-2 py-1 text-xs text-cyan-400 font-mono outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">SO2 (Sulfur Dioxide)</span>
                  <input
                    type="number" value={so2}
                    onChange={(e) => setSo2(parseInt(e.target.value))}
                    className="w-full bg-[#020617] border border-slate-800 rounded px-2 py-1 text-xs text-cyan-400 font-mono outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Atmospheric environmental parameters */}
              <div className="border-t border-slate-900 pt-3 space-y-3">
                <span className="text-[10px] font-mono text-slate-500 uppercase block tracking-wider font-semibold">Climate Matrix</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#020617] p-2 rounded border border-slate-900 flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                    <input
                      type="number" value={temp}
                      onChange={(e) => setTemp(parseInt(e.target.value))}
                      className="w-full bg-transparent text-xs text-white font-mono outline-none text-center"
                    />
                    <span className="text-[10px] text-slate-500">°C</span>
                  </div>
                  <div className="bg-[#020617] p-2 rounded border border-slate-900 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" />
                    <input
                      type="number" value={humidity}
                      onChange={(e) => setHumidity(parseInt(e.target.value))}
                      className="w-full bg-transparent text-xs text-white font-mono outline-none text-center"
                    />
                    <span className="text-[10px] text-slate-500">%</span>
                  </div>
                  <div className="bg-[#020617] p-2 rounded border border-slate-900 flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-teal-400" />
                    <input
                      type="number" step="0.1" value={windSpeed}
                      onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
                      className="w-full bg-transparent text-xs text-white font-mono outline-none text-center"
                    />
                    <span className="text-[10px] text-slate-500">m/s</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handlePredict}
                  disabled={predicting}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-display text-sm font-bold tracking-wide rounded border border-cyan-400/20 shadow-[0_0_12px_rgba(6,182,212,0.15)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {predicting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      RE-CALCULATE SENSOR PREDICTION
                    </>
                  )}
                </button>
                <button
                  onClick={handleCopyLink}
                  className={`py-2.5 px-4 rounded font-mono text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    copied
                      ? "bg-emerald-950/50 border-emerald-500 text-emerald-400"
                      : "bg-[#020617] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                  title="Copy shareable simulation link with current values"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 animate-pulse" />
                      COPIED!
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      SHARE LINK
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Model Output Display */}
            <div className="bg-[#020617] border border-slate-800 rounded p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 bg-slate-950 border-l border-b border-slate-800 text-[10px] font-mono text-slate-400">
                STATION ESTIMATOR
              </div>

              {prediction ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase block tracking-wider">Predictive Target AQI</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-5xl font-bold font-display ${getAqiColor(prediction.aqi).text}`}>
                        {prediction.aqi}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">PPM (Local Model Split)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-y border-slate-900 py-3">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block">Severity Category</span>
                      <span className={`text-sm font-semibold font-display ${getAqiColor(prediction.aqi).text}`}>
                        {prediction.category}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block">Predictive R² / Confidence</span>
                      <span className="text-sm font-semibold font-mono text-cyan-400">
                        {Math.round(prediction.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Actionable Recommendation</span>
                    <p className="text-xs text-slate-300 leading-relaxed font-mono">
                      {prediction.recommendation}
                    </p>
                  </div>

                  {/* Micro SHAP representation */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Local LIME/SHAP Drivers</span>
                    <div className="space-y-1">
                      {prediction.topFeatures.slice(0, 3).map((feat, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-400">{feat.feature}</span>
                          <div className="flex items-center gap-1.5 w-2/3">
                            <div className="w-full bg-slate-900 h-1.5 rounded relative overflow-hidden">
                              <div
                                className={`h-full rounded ${feat.impact >= 0 ? "bg-red-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.abs(feat.impact) * 100}%` }}
                              />
                            </div>
                            <span className={feat.impact >= 0 ? "text-red-400" : "text-emerald-400"}>
                              {feat.impact >= 0 ? "+" : ""}{(feat.impact * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-xs font-mono text-slate-500">
                  Awaiting input recalculation.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Tab: Active Systems Bulletin Deck */}
        <div className="bg-[#0f172a]/85 border border-slate-800 rounded-lg p-6 flex flex-col shadow-[0_0_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400 animate-pulse" />
              <h2 className="text-lg font-semibold font-display text-white">Ops Control Bulletins</h2>
            </div>
            <span className="text-[10px] font-mono text-slate-500">ALERTS</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[380px] pr-1">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded border text-xs font-mono space-y-1.5 transition-all ${
                    alert.severity === "critical"
                      ? "bg-red-950/20 border-red-900 text-red-300"
                      : "bg-orange-950/20 border-orange-900 text-orange-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {alert.title}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {alert.message}
                  </p>
                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-900 mt-1">
                    {userRole === "admin" || userRole === "researcher" ? (
                      <button
                        onClick={async () => {
                          await fetch("/api/alerts/resolve", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: alert.id })
                          });
                          fetchSummaryAndAlerts();
                        }}
                        className="text-[9px] font-bold text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer"
                      >
                        [ RESOLVE DISPATCH ]
                      </button>
                    ) : (
                      <span className="text-[9px] text-slate-600 font-semibold">[ VIEW ONLY ]</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-24 text-xs font-mono text-slate-500">
                All monitoring parameters clear. No warning alerts currently dispatched.
              </div>
            )}
          </div>

          {/* Planetary Telemetry Portals */}
          <div className="border-t border-slate-900 pt-3 mt-4 space-y-2">
            <span className="text-[9px] font-mono text-slate-500 uppercase block tracking-wider font-bold">Planetary Telemetry Downlinks</span>
            <div className="grid grid-cols-1 gap-1.5">
              <a
                href="https://bhuvan.nrsc.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded bg-[#020617] border border-slate-900 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-slate-300 hover:text-cyan-300 transition-all text-[11px] font-mono"
              >
                <span>ISRO Bhuvan Geo-Portal</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
              </a>
              <a
                href="https://sentinel.esa.int/web/sentinel/missions/sentinel-5p"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded bg-[#020617] border border-slate-900 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-slate-300 hover:text-cyan-300 transition-all text-[11px] font-mono"
              >
                <span>ESA Copernicus Sentinel-5P</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
              </a>
              <a
                href="https://earthdata.nasa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded bg-[#020617] border border-slate-900 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-slate-300 hover:text-cyan-300 transition-all text-[11px] font-mono"
              >
                <span>NASA EarthData Science</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
              </a>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3 mt-4 text-[9px] font-mono text-slate-500 flex justify-between">
            <span>SATELLITE DOWNLINK OK</span>
            <span>SYSTEM MONITOR: OK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
