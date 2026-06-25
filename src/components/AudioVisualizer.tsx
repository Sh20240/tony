import React, { useEffect, useRef } from "react";
import { Mic, Volume2 } from "lucide-react";

interface AudioVisualizerProps {
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
}

export default function AudioVisualizer({
  isSpeaking,
  isListening,
  isThinking,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;

    const renderWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      // Define wave configuration based on state
      let color = "rgba(14, 165, 233, 0.7)"; // Blue/Idle
      let glowColor = "rgba(14, 165, 233, 0.2)";
      let speed = 0.05;
      let amplitude = 12;
      let waveCount = 3;

      if (isThinking) {
        color = "rgba(245, 158, 11, 0.85)"; // Amber/Thinking
        glowColor = "rgba(245, 158, 11, 0.35)";
        speed = 0.15;
        amplitude = 6;
        waveCount = 5;
      } else if (isListening) {
        color = "rgba(52, 211, 153, 0.9)"; // Emerald/Listening
        glowColor = "rgba(52, 211, 153, 0.45)";
        speed = 0.08;
        amplitude = 22;
        waveCount = 4;
      } else if (isSpeaking) {
        color = "rgba(34, 211, 238, 0.95)"; // Cyan/Speaking
        glowColor = "rgba(34, 211, 238, 0.5)";
        speed = 0.12;
        amplitude = 30;
        waveCount = 4;
      }

      phaseRef.current += speed;

      // Draw standard holographic multi-sine wave ripples
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        ctx.lineWidth = w === 0 ? 2.5 : 1;
        ctx.strokeStyle = w === 0 ? color : color.replace(/[\d\.]+\)$/, `${0.2 - w * 0.03})`);
        
        ctx.shadowBlur = w === 0 ? 12 : 0;
        ctx.shadowColor = glowColor;

        const wavePhase = phaseRef.current + (w * Math.PI) / 4;
        const waveFreqOffset = 1 + w * 0.45;
        const waveAmpFactor = w === 0 ? 1 : 0.6 - w * 0.1;

        for (let x = 0; x < width; x++) {
          // Flatten standard sine curves at the edges using envelope math
          const edgeEnvelope = Math.sin((x / width) * Math.PI);
          const y = midY + Math.sin((x * 0.015 * waveFreqOffset) - wavePhase) * amplitude * waveAmpFactor * edgeEnvelope;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animFrame = requestAnimationFrame(renderWave);
    };

    // Set fixed canvas size for smooth sizing and crisp pixels
    canvas.width = 480;
    canvas.height = 70;
    renderWave();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [isSpeaking, isListening, isThinking]);

  return (
    <div id="neural-voice-oscillator" className="flex flex-col glass-panel rounded-2xl p-4 font-mono select-none">
      <div className="flex items-center justify-between text-[11px] text-slate-500 tracking-wider font-semibold mb-2">
        <div className="flex items-center gap-1.5 uppercase">
          {isListening ? (
            <>
              <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-emerald-400">INPUT AUDIO_SPECTRUM</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>TONY AUDIO_SYNTHESIS</span>
            </>
          )}
        </div>
        <div className="text-[9px] text-slate-600 font-mono tracking-widest uppercase">
          {isThinking ? "SOLVING..." : isListening ? "CAPTURING..." : isSpeaking ? "SYNTHESIZING..." : "SYSTEM STANDBY_"}
        </div>
      </div>

      <div className="relative h-18 bg-white/5 border border-white/5 rounded-xl overflow-hidden flex items-center justify-center">
        {/* Sine Wave Canvas */}
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {/* Top/Bottom ambient scanlines */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/5" />
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-white/5" />
      </div>
    </div>
  );
}
