import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Eye, RefreshCw } from "lucide-react";

interface CameraStreamProps {
  onCapture: (base64Image: string) => void;
  isScanning: boolean;
  addLog: (msg: string, level?: "INFO" | "WARN" | "SUCCESS" | "DIAG") => void;
  forceActive?: boolean;
  onLiveFrame?: (base64Image: string) => void;
}

export default function CameraStream({
  onCapture,
  isScanning,
  addLog,
  forceActive = false,
  onLiveFrame,
}: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [hudCoordinates, setHudCoordinates] = useState({ x: 120, y: 150 });
  const animationRef = useRef<number | null>(null);

  const onLiveFrameRef = useRef(onLiveFrame);
  const addLogRef = useRef(addLog);

  useEffect(() => {
    onLiveFrameRef.current = onLiveFrame;
  }, [onLiveFrame]);

  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  // Sync camera active state with parent command trigger
  useEffect(() => {
    if (forceActive && !isActive) {
      startCamera();
    } else if (!forceActive && isActive) {
      stopCamera();
    }
  }, [forceActive]);

  // Handle continuous live streaming of video frames to live endpoint (at most 1 FPS)
  useEffect(() => {
    if (!isActive || !onLiveFrameRef.current) return;
    
    addLogRef.current("Engaging live camera stream linkage (1 FPS)...", "DIAG");
    const intervalId = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            // Lower compression quality for lightning-fast Live API frames sync
            const base64Image = canvas.toDataURL("image/jpeg", 0.45);
            const base64Clean = base64Image.includes("base64,") 
              ? base64Image.split("base64,")[1] 
              : base64Image;
            if (onLiveFrameRef.current) {
              onLiveFrameRef.current(base64Clean);
            }
          } catch (err) {
            console.error("Live frame capture failing: ", err);
          }
        }
      }
    }, 1000);
    
    return () => {
      clearInterval(intervalId);
      addLogRef.current("Live camera stream linkage disengaged.", "INFO");
    };
  }, [isActive]);

  // Start/Stop Camera Feed
  const toggleCamera = async () => {
    if (isActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  const startCamera = async () => {
    addLog("Initializing visual scanner feed...", "INFO");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      setStream(mediaStream);
      setIsActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      addLog("Visual scanner online. Resolute: 640x480px.", "SUCCESS");
    } catch (err: any) {
      console.error("Camera access failed:", err);
      addLog(`Failed to acquire visual feed: ${err.message || err}`, "WARN");
      setIsActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    addLog("Visual feeds suspended. Scanner standby.", "INFO");
  };

  // Capture frame as JPEG base64 string
  const captureFrame = () => {
    if (!isActive || !videoRef.current || !canvasRef.current) {
      addLog("Unable to scan: camera stream is not active.", "WARN");
      return;
    }

    addLog("Isolating video frame...", "DIAG");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Draw current video frame to hidden canvas
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Target Capture Base64
      try {
        const base64Image = canvas.toDataURL("image/jpeg", 0.85);
        addLog("Frame capture complete. Initiating visual analysis.", "SUCCESS");
        onCapture(base64Image);
      } catch (err) {
        addLog("Error creating image stream package.", "WARN");
      }
    }
  };

  // Draw Sreehari HUD graphic elements onto active canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let scanLineY = 0;
    let coordinateTimer = 0;

    const drawHud = () => {
      // Clear canvas on every frame loop
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;

      // Draw Corner Reticles
      ctx.strokeStyle = "rgba(14, 165, 233, 0.6)";
      ctx.lineWidth = 2;
      
      // Top Left Corner Bracket
      ctx.beginPath();
      ctx.moveTo(30, 15); ctx.lineTo(15, 15); ctx.lineTo(15, 30);
      ctx.stroke();

      // Top Right Corner Bracket
      ctx.beginPath();
      ctx.moveTo(width - 30, 15); ctx.lineTo(width - 15, 15); ctx.lineTo(width - 15, 30);
      ctx.stroke();

      // Bottom Left Corner Bracket
      ctx.beginPath();
      ctx.moveTo(30, height - 15); ctx.lineTo(15, height - 15); ctx.lineTo(15, height - 30);
      ctx.stroke();

      // Bottom Right Corner Bracket
      ctx.beginPath();
      ctx.moveTo(width - 30, height - 15); ctx.lineTo(width - 15, height - 15); ctx.lineTo(width - 15, height - 30);
      ctx.stroke();

      // Draw sweeping scanner line if general camera is active of if scanning
      scanLineY += isScanning ? 4 : 2;
      if (scanLineY > height) scanLineY = 0;

      // Sweep bar gradient
      const sweepGrad = ctx.createLinearGradient(0, scanLineY - 12, 0, scanLineY);
      sweepGrad.addColorStop(0, "transparent");
      sweepGrad.addColorStop(1, isScanning ? "rgba(249, 115, 22, 0.4)" : "rgba(14, 165, 233, 0.25)");
      
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(15, scanLineY - 12, width - 30, 12);

      ctx.strokeStyle = isScanning ? "rgba(249, 115, 22, 0.8)" : "rgba(14, 165, 233, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(15, scanLineY);
      ctx.lineTo(width - 15, scanLineY);
      ctx.stroke();

      // Draw locked reticle in current target coordinates
      coordinateTimer++;
      if (coordinateTimer % 60 === 0) {
        // randomly jitter locked hud pointer
        setHudCoordinates({
          x: Math.floor(width * 0.3 + Math.random() * (width * 0.4)),
          y: Math.floor(height * 0.3 + Math.random() * (height * 0.4)),
        });
      }

      const tx = hudCoordinates.x;
      const ty = hudCoordinates.y;

      // Draw targeted reticle box
      ctx.strokeStyle = isScanning ? "rgba(249, 115, 22, 0.8)" : "rgba(14, 165, 233, 0.5)";
      ctx.strokeRect(tx - 35, ty - 35, 70, 70);
      
      // Draw inner target brackets
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fillStyle = isScanning ? "rgba(249, 115, 22, 0.7)" : "rgba(14, 165, 233, 0.4)";
      ctx.fill();

      // Draw telemetry status text next to target
      ctx.fillStyle = isScanning ? "rgba(249, 115, 22, 0.9)" : "rgba(14, 165, 233, 0.8)";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText(`TARGET_LOC: [X:${tx} Y:${ty}]`, tx + 45, ty - 15);
      ctx.fillText(`LOCK: ${isScanning ? "ENGAGED" : "AUTO_TRACK"}`, tx + 45, ty);
      ctx.fillText(`SENS: 100%`, tx + 45, ty + 15);

      // Pulse state tag
      ctx.fillStyle = "rgba(14, 165, 233, 0.9)";
      ctx.fillText("SYS_RESOLV: REALTIME_VISION", 30, 35);
      ctx.fillText("INDEXING_CORE: TRUE", 30, 50);

      animationRef.current = requestAnimationFrame(drawHud);
    };

    if (isActive) {
      canvas.width = 640;
      canvas.height = 480;
      animationRef.current = requestAnimationFrame(drawHud);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, hudCoordinates, isScanning]);

  // Handle clean-up when component is destroyed
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div id="visual-scanner-panel" className="flex flex-col glass-panel rounded-3xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-matrix opacity-10 pointer-events-none" />

      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-cyan-400" />
          <span className="font-display font-medium text-slate-200 tracking-wider text-sm">
            OPTICAL SCANNER FEED
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              FEED LIVE
            </span>
          )}
          <button
            onClick={toggleCamera}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg border transition-all duration-300 ${
              isActive
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
                : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            }`}
          >
            {isActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            {isActive ? "SHUTDOWN" : "INIT_OPTICS"}
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="relative aspect-video w-full rounded-2xl bg-slate-950/90 border border-white/10 overflow-hidden flex items-center justify-center">
        {isActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-75"
            />
            {/* HUD Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover z-20 pointer-events-none"
            />
            
            {/* Holographic light flicker bar overlay */}
            <div className="absolute inset-x-0 h-[2px] bg-sky-400/10 pointer-events-none animate-scanline z-30" />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-950/90 font-mono text-slate-500 relative w-full h-full">
            {/* Holographic Radar Scanner Overlay when off */}
            <div className="absolute w-44 h-44 rounded-full border border-white/5 flex items-center justify-center opacity-60">
              <div className="absolute w-full h-[1px] bg-white/5 rotate-45" />
              <div className="absolute w-full h-[1px] bg-white/5 -rotate-45" />
              <div className="absolute w-32 h-32 rounded-full border border-white/5" />
              <div className="absolute w-20 h-20 rounded-full border border-white/5" />
              <div className="w-2.5 h-2.5 bg-cyan-500/20 rounded-full animate-ping" />
            </div>

            <CameraOff className="w-10 h-10 text-slate-800 mb-3 z-10" />
            <span className="text-xs tracking-widest text-slate-500 z-10 font-bold mb-1">
              SYS_OPTICAL_FEED: OFFLINE
            </span>
            <span className="text-[10px] text-slate-600 max-w-[220px] leading-relaxed z-10">
              Click INIT_OPTICS to activate visual awareness. Permit camera access.
            </span>
          </div>
        )}
      </div>

      {/* Capture CTA Bar */}
      {isActive && (
        <div className="mt-4 flex gap-2 z-10 animate-fade-in">
          <button
            onClick={captureFrame}
            disabled={isScanning}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-mono text-xs font-semibold text-cyan-400 tracking-wider shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="w-4 h-4" />
            {isScanning ? "ANALYSING..." : "ACQUIRE ENVIRONMENT SCAN"}
          </button>
        </div>
      )}
    </div>
  );
}
