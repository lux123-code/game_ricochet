/**
 * Ricochet: Orbit Breaker
 * Built strictly according to the foundational documents (ARCHITECTURE, CONCEPT, FEATURES, UI_UX)
 * and the iconic Ricochet space station reference.
 */

import React, { useState } from 'react';
import { RicochetGame } from './games/ricochet/RicochetGame';
import { sounds } from './audio/soundManager';
import { Rocket, Volume2, VolumeX, Maximize2 } from 'lucide-react';

export default function App() {
  const [muted, setMuted] = useState<boolean>(false);

  const toggleMute = () => {
    const isMuted = !sounds.toggleMute();
    setMuted(isMuted);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#040614] text-slate-100 flex flex-col font-rajdhani selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header Navigation */}
      <header className="border-b border-cyan-500/20 bg-slate-950/85 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-4">
          {/* Logo / Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-orbitron font-black text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-100 to-indigo-300">
                RICOCHET
              </div>
              <div className="text-[10px] uppercase font-orbitron tracking-widest text-rose-400/90 font-bold">
                Orbit Breaker • 50 Sectors
              </div>
            </div>
          </div>

          {/* Quick Audio & Display Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition"
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition hidden sm:block"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Ricochet Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4">
        <RicochetGame />
      </main>
    </div>
  );
}
