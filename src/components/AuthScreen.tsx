/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Shield, User as UserIcon, Lock, Cpu, Globe } from "lucide-react";
import { motion } from "motion/react";
import { User } from "../types";

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export default function AuthScreen({ onLogin }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"citizen" | "researcher" | "admin">("citizen");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin ? { username, password } : { username, password, role };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Successful Auth
      onLogin({
        id: data.id,
        username: data.username,
        role: data.role
      });
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-screen-container" className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Animated Tech Backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl animate-pulse delay-700" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-[#0f172a]/90 border border-slate-800 rounded-xl p-8 shadow-2xl backdrop-blur-md relative z-10"
      >
        {/* ISRO-inspired Title Head */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-cyan-950 border border-cyan-800 rounded-full text-cyan-400 mb-4 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Cpu className="w-8 h-8 animate-spin-slow" />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-white flex items-center justify-center gap-2">
            AQI VISION AI
          </h1>
          <p className="text-xs text-slate-400 tracking-wider font-mono mt-1 uppercase">
            INTELLIGENT GIS ENVIRONMENTAL STATION
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 rounded-md text-sm text-red-400 font-mono text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
              Station Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#020617] border border-slate-800 focus:border-cyan-500 rounded-md py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all font-mono"
                placeholder="Enter coordinate username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
              Security Cipher (Password)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#020617] border border-slate-800 focus:border-cyan-500 rounded-md py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all font-mono"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                Operational Clearance Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["citizen", "researcher", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-2 px-3 rounded text-xs font-mono uppercase border transition-all ${
                      role === r
                        ? "bg-cyan-950 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                        : "bg-[#020617] border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-md text-white text-sm font-semibold tracking-wider font-display transition-all duration-200 mt-2 flex items-center justify-center gap-2 border border-cyan-400/20 shadow-[0_4px_12px_rgba(6,182,212,0.2)]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Shield className="w-4 h-4" />
                {isLogin ? "INITIALIZE OPERATIONS DECK" : "GENERATE OPERATIONAL ACCESS"}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-xs font-mono text-slate-400 hover:text-cyan-400 transition-all underline decoration-cyan-500/50"
          >
            {isLogin
              ? "New Station? Register clearance level"
              : "Already have operational clearance? Log in"}
          </button>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-cyan-500/80" />
            <span>SATELLITE SECURE: GSLV-MK3</span>
          </div>
          <span>v2.11-PROD</span>
        </div>
      </motion.div>
    </div>
  );
}
