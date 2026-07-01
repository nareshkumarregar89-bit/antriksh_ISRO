/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import {
  Compass,
  Cpu,
  Eye,
  Globe,
  Grid,
  Layers,
  LayoutDashboard,
  LineChart,
  LogOut,
  Radio,
  Sliders,
  Sparkles,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "./types";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import MapComponent from "./components/MapComponent";
import ModelTrainer from "./components/ModelTrainer";
import VisionAnalyzer from "./components/VisionAnalyzer";
import SatelliteViewer from "./components/SatelliteViewer";
import XaiViewer from "./components/XaiViewer";

type Tab = "dashboard" | "gis_map" | "ml_pipelines" | "vision_ai" | "satellite" | "xai";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("aqi_vision_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [telemetryTime, setTelemetryTime] = useState("");

  // Track live clock for space center look and feel
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTelemetryTime(now.toUTCString().replace("GMT", "UTC"));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Set default initial user on dev cold-starts to bypass auth if needed, or enforce standard login
  const handleLogin = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    try {
      localStorage.setItem("aqi_vision_user", JSON.stringify(authenticatedUser));
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem("aqi_vision_user");
    } catch (e) {
      console.error("Failed to clear session", e);
    }
    setActiveTab("dashboard");
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col selection:bg-cyan-500/30 selection:text-white">
      {/* Dynamic ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* TOP DECK OPERATIONS NAVIGATION HEADER */}
      <header className="relative z-10 border-b border-slate-800/80 bg-[#070b19]/90 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full border border-cyan-500/40 bg-cyan-950/25">
            <Globe className="w-5 h-5 text-cyan-400 animate-spin-slow" />
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/15 animate-spin" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight text-white flex items-center gap-1.5 leading-none">
              AQI VISION AI <span className="text-[9px] font-mono font-normal border border-cyan-500/30 text-cyan-400 px-1 rounded">DECK v2.1</span>
            </h1>
            <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-1">
              GSLV METEOROLOGICAL TELEMETRY COMMAND
            </p>
          </div>
        </div>

        {/* Telemetry and Clock HUD */}
        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          <div className="hidden lg:flex flex-col text-right font-mono">
            <span className="text-[9px] text-slate-500">OPERATIONS COORD</span>
            <span className="text-xs text-slate-300">23.0225° N, 72.5714° E</span>
          </div>

          <div className="flex flex-col text-right font-mono">
            <span className="text-[9px] text-slate-500">SYSTEM TIME (UTC)</span>
            <span className="text-xs text-cyan-400 font-bold tracking-wide">{telemetryTime}</span>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          {/* Signed User status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#020617] border border-slate-800 py-1.5 px-3 rounded">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold leading-none text-white">{user.username}</span>
                <span className="text-[8px] font-mono font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                  Clearance: {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
              title="De-authenticate Clearance"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* TAB NAVIGATION RAIL */}
      <nav className="relative z-10 bg-[#070b19]/60 border-b border-slate-900 px-6 py-2 flex flex-wrap gap-1.5 overflow-x-auto">
        {[
          { id: "dashboard", name: "Operations HUD", icon: LayoutDashboard },
          { id: "gis_map", name: "GIS Tactical Grid", icon: Compass },
          { id: "ml_pipelines", name: "ML Ensembles & Forecaster", icon: Cpu },
          { id: "vision_ai", name: "YOLOv11 Vision Intel", icon: Eye },
          { id: "satellite", name: "Sentinel Troposphere", icon: Layers },
          { id: "xai", name: "Explainable XAI", icon: Sliders }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 py-2 px-3.5 rounded text-xs font-mono uppercase tracking-wider border transition-all cursor-pointer ${
                isActive
                  ? "bg-cyan-950/40 border-cyan-500/80 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.1)] font-bold"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
              {tab.name}
            </button>
          );
        })}
      </nav>

      {/* CORE WORKSPACE PANEL */}
      <main className="relative z-10 flex-1 p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {activeTab === "dashboard" && <Dashboard userRole={user.role} />}
            {activeTab === "gis_map" && <MapComponent onNodeAdded={() => {}} userRole={user.role} />}
            {activeTab === "ml_pipelines" && <ModelTrainer />}
            {activeTab === "vision_ai" && <VisionAnalyzer />}
            {activeTab === "satellite" && <SatelliteViewer />}
            {activeTab === "xai" && <XaiViewer />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* SYSTEM OPERATIONS FOOTER BAR */}
      <footer className="relative z-10 border-t border-slate-900 bg-[#070b19]/90 px-6 py-4 mt-auto flex flex-col md:flex-row justify-between items-center text-[10px] font-mono text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
          <a
            href="https://bhuvan.nrsc.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 hover:underline transition-all flex items-center gap-1"
          >
            SATELLITE SECTOR COMMUNICATOR: ISRO BHUVAN DOWNLINK OPERATIONAL
          </a>
        </div>
        <div className="flex items-center gap-4">
          <span>GSLV-MK3 MISSION SECURE</span>
          <span className="text-cyan-500/80 flex items-center gap-0.5">
            Verified Production Terminal <Sparkles className="w-3 h-3 text-yellow-400" />
          </span>
        </div>
      </footer>
    </div>
  );
}
