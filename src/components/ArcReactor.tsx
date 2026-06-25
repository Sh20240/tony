import React from "react";
import { Cpu, Zap, Activity } from "lucide-react";

interface ArcReactorProps {
  isThinking: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  reactorLoad: string;
  onClick: () => void;
}

export default function ArcReactor({
  isThinking,
  isSpeaking,
  isListening,
  reactorLoad,
  onClick,
}: ArcReactorProps) {
  // Determine reactor color theme based on active operational state
  let coreColor = "bg-sky-400 shadow-[0_0_25px_rgba(14,165,233,0.8)]";
  let ringBorderColor = "border-sky-500/40";
  let ringSegmentColor = "border-sky-400";
  let statusLabel = "CORE SECURE";

  if (isThinking) {
    coreColor = "bg-amber-500 shadow-[0_0_35px_rgba(245,158,11,0.9)] animate-pulse";
    ringBorderColor = "border-amber-500/40";
    ringSegmentColor = "border-amber-400";
    statusLabel = "CALCULATING...";
  } else if (isListening) {
    coreColor = "bg-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.95)] animate-ping";
    ringBorderColor = "border-emerald-500/40";
    ringSegmentColor = "border-emerald-400";
    statusLabel = "RECEIVING INPUT";
  } else if (isSpeaking) {
    coreColor = "bg-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.9)] animate-pulse";
    ringBorderColor = "border-cyan-500/50";
    ringSegmentColor = "border-cyan-300";
    statusLabel = "TRANSMITTING VOICE";
  }

  return (
    <div id="arc-reactor-control" className="flex flex-col items-center justify-center p-6 glass-panel rounded-3xl relative overflow-hidden">
      {/* Background glowing matrix */}
      <div className="absolute inset-0 bg-dot-matrix opacity-30 pointer-events-none" />

      {/* Interactive Reactor Center */}
      <div 
        className="relative w-64 h-64 flex items-center justify-center cursor-pointer group"
        onClick={onClick}
        title="Ping Tony CORE"
      >
        {/* Outer glowing halo */}
        <div className={`absolute inset-0 rounded-full transition-all duration-700 opacity-20 group-hover:opacity-40 filter blur-lg ${isThinking ? 'bg-amber-500' : isListening ? 'bg-emerald-500' : isSpeaking ? 'bg-cyan-500' : 'bg-sky-500'}`} />

        {/* Ring 1 - Slow Outer Rotation */}
        <div className={`absolute w-60 h-60 rounded-full border border-dashed animate-spin-slow ${ringBorderColor}`} />

        {/* Ring 2 - Reverse Medium Rotation */}
        <div className={`absolute w-52 h-52 rounded-full border-2 border-t-transparent border-b-transparent animate-spin-reverse-slow ${ringSegmentColor} opacity-70`} />

        {/* Ring 3 - Tech brackets ring */}
        <div className="absolute w-44 h-44 rounded-full border border-sky-900/30 flex items-center justify-center">
          <div className="absolute w-full h-[2px] bg-sky-500/15 rotate-45" />
          <div className="absolute w-full h-[2px] bg-sky-500/15 -rotate-45" />
          <div className="absolute h-full w-[2px] bg-sky-500/15" />
          <div className="absolute w-full h-[2px] bg-sky-500/15" />
        </div>

        {/* Ring 4 - Segmented rotating teeth */}
        <div className={`absolute w-36 h-36 rounded-full border-4 border-double border-r-transparent border-l-transparent animate-spin-slow ${ringBorderColor}`} />

        {/* Central Core Circle */}
        <div className="absolute w-24 h-24 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur-lg flex items-center justify-center shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] z-10 transition-transform duration-300 group-hover:scale-105">
          {/* Active Reactor Core */}
          <div className={`w-14 h-14 rounded-full transition-all duration-500 ${coreColor} flex items-center justify-center relative`}>
            <Zap className={`w-6 h-6 text-slate-950 ${isListening ? 'animate-bounce' : ''}`} />
            
            {/* Pulsing overlay ring for high tech aesthetic */}
            <div className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping opacity-35" />
          </div>
        </div>

        {/* Interactive hover instruction label */}
        <div className="absolute bottom-3 text-[10px] tracking-[0.25em] text-slate-400 font-mono opacity-80 group-hover:opacity-100 group-hover:text-cyan-400 transition-all duration-300">
          {isListening ? "LISTENING" : "TAP CORE TO SPEAK"}
        </div>
      </div>

      {/* Metrics Grid Overlay inside reactor frame */}
      <div className="w-full grid grid-cols-3 gap-2 mt-6 border-t border-white/10 pt-4 z-10 font-mono">
        <div className="text-center">
          <div className="flex justify-center items-center gap-1 text-[10px] text-slate-500 tracking-wider">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>LOAD</span>
          </div>
          <div className="text-sm font-semibold text-slate-200 tracking-tight mt-0.5 glow-cyber">
            {reactorLoad}
          </div>
        </div>

        <div className="text-center border-x border-white/10 px-2">
          <div className="flex justify-center items-center gap-1 text-[10px] text-slate-500 tracking-wider">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>CORE</span>
          </div>
          <div className={`text-xs font-bold tracking-widest mt-1 uppercase ${
            isThinking ? 'text-amber-400 animate-pulse' :
            isListening ? 'text-emerald-400' :
            isSpeaking ? 'text-cyan-400' : 'text-cyan-400'
          }`}>
            {statusLabel}
          </div>
        </div>

        <div className="text-center">
          <div className="flex justify-center items-center gap-1 text-[10px] text-slate-500 tracking-wider">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>THERMAL</span>
          </div>
          <div className="text-sm font-semibold text-emerald-400 tracking-tight mt-0.5">
            36.4°C
          </div>
        </div>
      </div>
    </div>
  );
}
