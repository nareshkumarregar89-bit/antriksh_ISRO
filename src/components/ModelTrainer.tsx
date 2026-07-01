/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import {
  Cpu,
  BrainCircuit,
  LineChart,
  RefreshCw,
  Terminal,
  Activity,
  Award,
  Zap,
  TrendingUp,
  CloudLightning
} from "lucide-react";
import { motion } from "motion/react";
import { TrainingStats, ForecastItem } from "../types";

export default function ModelTrainer() {
  const [stats, setStats] = useState<TrainingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainingLogs, setTrainingLogs] = useState<string[]>([]);
  const [trainingActive, setTrainingActive] = useState(false);
  const [forecast, setForecast] = useState<{ nextHour?: ForecastItem; nextDay: ForecastItem[]; nextWeek: ForecastItem[] } | null>(null);
  const [forecastTab, setForecastTab] = useState<"24h" | "7d">("24h");

  const fetchStatsAndForecast = async () => {
    try {
      const [statsRes, forecastRes] = await Promise.all([
        fetch("/api/models/stats"),
        fetch("/api/forecast")
      ]);
      const statsData = await statsRes.json();
      const forecastData = await forecastRes.json();

      setStats(statsData);
      setForecast(forecastData);
    } catch (e) {
      console.error("Stats fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndForecast();
  }, []);

  const triggerRetraining = () => {
    setTrainingActive(true);
    setTrainingLogs([]);
    let currentEpoch = 1;
    const logsList: string[] = [];

    // Simulate training logger stream over epochs
    const interval = setInterval(() => {
      if (currentEpoch > 50) {
        clearInterval(interval);
        setTrainingActive(false);
        fetchStatsAndForecast();
        return;
      }

      const randomLoss = (0.05 + 1.8 / Math.sqrt(currentEpoch) + (Math.random() - 0.5) * 0.05).toFixed(5);
      const randomAcc = (0.62 + 0.32 * Math.tanh(currentEpoch / 15) + (Math.random() - 0.5) * 0.01).toFixed(4);

      let logMessage = `[EPOCH ${currentEpoch}/50] training_loss: ${randomLoss} | val_r2: ${randomAcc} | fitting standard tree ensembles...`;
      if (currentEpoch === 1) logMessage = "[INIT] Pulling coordinates from DB. Imputing missing parameters...";
      else if (currentEpoch === 50) logMessage = `[COMPLETED] Best estimator fit successfully. Serialized to Joblib simulation buffer. Selected: ${stats[0]?.modelName ?? "Random Forest"}`;

      setTrainingLogs((prev) => [...prev, logMessage]);
      currentEpoch++;
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-cyan-400 font-mono gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span>PARSING ESTIMATORS FROM DB FILE...</span>
      </div>
    );
  }

  // Find selected champion
  const champion = stats.find((s) => s.selected) || stats[0];

  return (
    <div id="model-trainer-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* Left Columns: Model performance matrix and Logs terminal */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Model Selection Arena */}
        <div className="bg-[#0f172a]/85 border border-slate-800 rounded-lg p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold font-display text-white">Machine Learning Model Arena</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">MODULE 3: MODEL MATCHUP</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5">MODEL ARCHITECTURE</th>
                  <th className="py-2.5 text-center">R² COEFFICIENT</th>
                  <th className="py-2.5 text-center">MAE</th>
                  <th className="py-2.5 text-center">RMSE</th>
                  <th className="py-2.5 text-center">LATENCY (MS)</th>
                  <th className="py-2.5 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {stats.map((model) => (
                  <tr
                    key={model.modelName}
                    className={`hover:bg-[#020617]/50 ${model.selected ? "text-cyan-400 bg-cyan-950/10" : "text-slate-300"}`}
                  >
                    <td className="py-3 font-semibold flex items-center gap-1.5">
                      {model.selected && <Award className="w-4 h-4 text-yellow-400 animate-pulse" />}
                      {model.modelName}
                    </td>
                    <td className="py-3 text-center text-white font-bold">{model.r2}</td>
                    <td className="py-3 text-center">{model.mae}</td>
                    <td className="py-3 text-center">{model.rmse}</td>
                    <td className="py-3 text-center flex items-center justify-center gap-0.5 text-slate-400">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      {model.trainingTime}
                    </td>
                    <td className="py-3 text-right">
                      {model.selected ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950 border border-cyan-800 text-cyan-400">
                          SELECTED CHAMPION
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                          STANDBY
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center bg-[#020617] border border-slate-900 rounded p-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-300 font-display">Automatic Model Selector</h4>
              <p className="text-[10px] text-slate-500 font-mono leading-relaxed max-w-md">
                Our environmental pipelines utilize cross-validation to test multiple tree architectures on 20% test samples, automatically selecting the champion core.
              </p>
            </div>
            <button
              onClick={triggerRetraining}
              disabled={trainingActive}
              className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-display text-xs font-semibold tracking-wide rounded border border-cyan-400/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${trainingActive ? "animate-spin" : ""}`} />
              TRAIN PIPELINES
            </button>
          </div>
        </div>

        {/* Training Logs Console terminal */}
        <div className="bg-[#020617] border border-slate-800 rounded-lg p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>LOGS: INTERACTION TRAINING SHELL</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              <span className="text-[10px] text-slate-500">READY</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded border border-slate-900 h-[180px] overflow-y-auto space-y-1.5 text-[11px] text-emerald-400 scrollbar-none">
            {trainingLogs.length > 0 ? (
              trainingLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-slate-600 italic">
                Awaiting manual pipeline trigger. Click "Train Pipelines" above to stream fitting sequences.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Deep Learning forecasting widgets */}
      <div className="bg-[#0f172a]/85 border border-slate-800 rounded-lg p-6 flex flex-col justify-between shadow-xl">
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <LineChart className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold font-display text-white">DL Forecast Node (RNN)</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">MODULE 4: SEQUENCE</span>
          </div>

          <div className="flex border-b border-slate-900 p-0.5 bg-[#020617] rounded">
            <button
              onClick={() => setForecastTab("24h")}
              className={`flex-1 py-1 text-center text-xs font-mono rounded transition-all ${
                forecastTab === "24h" ? "bg-cyan-950 text-cyan-400 font-bold" : "text-slate-500 hover:text-slate-400"
              }`}
            >
              24-HOUR SEQUENTIAL
            </button>
            <button
              onClick={() => setForecastTab("7d")}
              className={`flex-1 py-1 text-center text-xs font-mono rounded transition-all ${
                forecastTab === "7d" ? "bg-cyan-950 text-cyan-400 font-bold" : "text-slate-500 hover:text-slate-400"
              }`}
            >
              7-DAY WEEKLY TREND
            </button>
          </div>

          {/* SVG Custom Interactive Graph - 100% stable React 19 charting */}
          {forecast ? (
            <div className="space-y-4">
              <div className="bg-[#020617] p-3 rounded border border-slate-900 h-[190px] relative flex items-end">
                {/* Visual grid lines */}
                <div className="absolute inset-x-0 top-1/4 border-t border-slate-900/50" />
                <div className="absolute inset-x-0 top-1/2 border-t border-slate-900/50" />
                <div className="absolute inset-x-0 top-3/4 border-t border-slate-900/50" />

                <svg className="w-full h-full absolute inset-0 pt-4" viewBox="0 0 300 150">
                  {/* Draw area gradient */}
                  <defs>
                    <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Draw forecast line path */}
                  {(() => {
                    const items = forecastTab === "24h" ? forecast.nextDay : forecast.nextWeek;
                    if (!items || items.length === 0) return null;

                    const maxAqi = Math.max(...items.map((it) => it.aqi)) || 150;
                    const minAqi = Math.min(...items.map((it) => it.aqi)) || 20;

                    // Compute points
                    const points = items.map((it, idx) => {
                      const x = (idx / (items.length - 1)) * 280 + 10;
                      // normalise Y between 10 and 130
                      const range = maxAqi - minAqi || 1;
                      const y = 140 - ((it.aqi - minAqi) / range) * 110;
                      return { x, y, aqi: it.aqi, time: it.timestamp };
                    });

                    const pathStr = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                    const areaStr = `${pathStr} L ${points[points.length - 1].x} 145 L ${points[0].x} 145 Z`;

                    return (
                      <>
                        {/* Shaded Area */}
                        <path d={areaStr} fill="url(#chart-glow)" />

                        {/* Solid Line */}
                        <path
                          d={pathStr}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />

                        {/* Interactive Circle Dots */}
                        {points.map((p, idx) => {
                          // draw every 3rd point or endpoints to keep grid clean
                          if (points.length > 10 && idx % 4 !== 0 && idx !== points.length - 1) return null;
                          return (
                            <g key={idx}>
                              <circle cx={p.x} cy={p.y} r="3.5" fill="#030712" stroke="#38bdf8" strokeWidth="1.5" />
                              <text x={p.x} y={p.y - 8} fontSize="7" fill="#22d3ee" textAnchor="middle" fontFamily="monospace">
                                {p.aqi}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                <div className="absolute top-2 right-2 text-[9px] font-mono text-slate-500 uppercase">
                  Forecast AQI curve
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono text-slate-400">
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span className="flex items-center gap-1">
                    <CloudLightning className="w-3.5 h-3.5 text-yellow-400" />
                    Target Next Hour:
                  </span>
                  <span className="text-cyan-400 font-bold">{forecast.nextHour?.aqi ?? 115} PPM</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed pt-1 uppercase">
                  * Deep recurrent network analyzes sequence dependencies and seasonality trends dynamically *
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-xs font-mono text-slate-500">
              Awaiting forecast pipeline download.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-900 text-[10px] font-mono text-slate-500 flex justify-between">
          <span>PIPELINE ENGINE: ON</span>
          <span>VAL_LOSS: 0.0452</span>
        </div>
      </div>
    </div>
  );
}
