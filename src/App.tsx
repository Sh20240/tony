import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal, Cpu, Zap, Volume2, Mic, MicOff, Send, HelpCircle, 
  Settings, Activity, ShieldAlert, Sparkles, AlertTriangle, 
  Trash2, Play, RefreshCw, Sun, CheckCircle2, ChevronRight, Video, VideoOff
} from "lucide-react";
import { Message, SystemDiagnostics, SystemLog, VoiceSetting } from "./types";
import ArcReactor from "./components/ArcReactor";
import CameraStream from "./components/CameraStream";
import AudioVisualizer from "./components/AudioVisualizer";

// Voice configurations available on Gemini TTS
const AVAILABLE_VOICES: VoiceSetting[] = [
  { voiceName: "Zephyr", displayName: "Zephyr Core", description: "Default crisp, witty British advisor archetype." },
  { voiceName: "Fenrir", displayName: "Fenrir Subroutine", description: "Deep baritone resonance, calculated and commanding." },
  { voiceName: "Charon", displayName: "Charon Auxiliary", description: "Classic scholarly elder profile, structured and measured." },
  { voiceName: "Kore", displayName: "Kore Logic Gate", description: "Balanced, soft, highly technical supportive module." },
];

// Initial diagnostic logs explaining boot values
const INITIAL_SYSTEM_LOGS: SystemLog[] = [
  { id: "log-1", timestamp: new Date(Date.now() - 3500).toLocaleTimeString(), level: "INFO", message: "Initialising TONY Core protocols..." },
  { id: "log-2", timestamp: new Date(Date.now() - 2800).toLocaleTimeString(), level: "DIAG", message: "Registering server-to-engine proxy paths." },
  { id: "log-3", timestamp: new Date(Date.now() - 2100).toLocaleTimeString(), level: "DIAG", message: "WebAudio synthesis pipeline established. Ready at 24000Hz." },
  { id: "log-4", timestamp: new Date(Date.now() - 1400).toLocaleTimeString(), level: "SUCCESS", message: "Sreehari Industries Reactor interface: LOCKED TO CENTRAL GRID." },
  { id: "log-5", timestamp: new Date(Date.now() - 700).toLocaleTimeString(), level: "INFO", message: "Diagnostics state: STABLE. Thermal: 36.4C. Load: 84.2%." },
];

// Float32 input audio conversion to little-endian 16-bit Int16 raw PCM
function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8050 : s * 0x7fff, true);
  }
  return buffer;
}

// Convert direct ArrayBuffer to standard base64 string
function base64EncodeArrayBuffer(arrayBuffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-first",
      role: "assistant",
      content: "At your service, sir. Online and fully ready. Grid feeds are locked. How may I assist you this fine morning?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [cameraSnapshot, setCameraSnapshot] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<"Tony" | "Toni">("Tony");
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics>({
    status: "ONLINE",
    reactorCore: "STABLE",
    reactorLoad: "84.2%",
    thermalState: "OPTIMAL",
    diagnostics: "ALL SYSTEMS OPERATIONAL",
    timestamp: new Date().toLocaleTimeString(),
  });
  const [logs, setLogs] = useState<SystemLog[]>(INITIAL_SYSTEM_LOGS);
  const [systemActive, setSystemActive] = useState<boolean>(false); 
  const [wakeWordHeard, setWakeWordHeard] = useState<boolean>(false);
  const [theme, setTheme] = useState<"dark" | "liquid-glass">("dark");

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "liquid-glass" : "dark";
    setTheme(newTheme);
    addLog(`UI interface styling shifted to: ${newTheme === "dark" ? "COSMIC OBSIDIAN CORE" : "WHITE SKY-BLUE LIQUID GLASS"}`, "SUCCESS");
  };

  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Live API States and Refs
  const [forceCameraActive, setForceCameraActive] = useState<boolean>(false);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);

  const liveWsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isWsOpenRef = useRef<boolean>(false);

  // Handle incoming live frames from CameraStream component (1 FPS)
  const handleLiveFrame = (base64Clean: string) => {
    if (isWsOpenRef.current && liveWsRef.current && liveWsRef.current.readyState === WebSocket.OPEN) {
      liveWsRef.current.send(JSON.stringify({ video: base64Clean }));
    }
  };

  const startLiveSession = async (overrideVoice?: "Tony" | "Toni") => {
    const voiceToUse = overrideVoice || selectedVoice;
    addLog("Initiating J.A.R.V.I.S. Multimodal Live API array connection...", "INFO");
    try {
      stopLiveSession();
      setForceCameraActive(true);

      // Dynamically map current window domain host to support standard Vercel serverless domains
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${voiceToUse}`;
      addLog(`Synchronising real-time secure link: ${wsUrl}`, "DIAG");

      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      ws.onopen = async () => {
        isWsOpenRef.current = true;
        setIsLiveActive(true);
        addLog("Secure live subspace bridge established. Mapping acoustics...", "SUCCESS");

        try {
          const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          inputAudioCtxRef.current = inputAudioCtx;

          const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          outputAudioCtxRef.current = outputAudioCtx;

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;

          const source = inputAudioCtx.createMediaStreamSource(stream);
          const processor = inputAudioCtx.createScriptProcessor(2048, 1, 1);
          micProcessorRef.current = processor;

          source.connect(processor);
          processor.connect(inputAudioCtx.destination);

          processor.onaudioprocess = (e) => {
            if (!isWsOpenRef.current || ws.readyState !== WebSocket.OPEN) return;
            const floatData = e.inputBuffer.getChannelData(0);
            const pcmBuffer = floatTo16BitPCM(floatData);
            const base64 = base64EncodeArrayBuffer(pcmBuffer);
            ws.send(JSON.stringify({ audio: base64 }));
          };

          addLog("Microphone voice transducer active & linked to live array.", "SUCCESS");
        } catch (micErr: any) {
          console.error("Microphone linkage failed:", micErr);
          addLog("Microphone array capture blocked. Continuing with visual scanner only.", "WARN");
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.audio) playLiveAudioChunk(data.audio);
          if (data.interrupted) muteAllActiveLiveVoices();
          if (data.transcriptText) addLog(`[Decoded Transcript]: "${data.transcriptText}"`, "DIAG");
          if (data.error) addLog(`Subprocessor telemetry error: ${data.error}`, "WARN");
        } catch (msgErr) {
          console.error("WebSocket payload error:", msgErr);
        }
      };

      ws.onclose = () => {
        isWsOpenRef.current = false;
        setIsLiveActive(false);
        addLog("Multimodal Live bridge closed.", "WARN");
      };

      ws.onerror = (err) => {
        console.error("WebSocket general session error:", err);
        addLog("Connection failure on the Live API gateway.", "WARN");
      };
    } catch (err: any) {
      console.error("Live boot setup failed:", err);
      addLog(`Failed to configure live array: ${err.message || err}`, "WARN");
    }
  };

  const playLiveAudioChunk = (base64Audio: string) => {
    const audioCtx = outputAudioCtxRef.current;
    if (!audioCtx) return;

    try {
      const binary = atob(base64Audio);
      const len = binary.length;
      const arrayBuffer = new ArrayBuffer(len);
      const view = new DataView(arrayBuffer);
      for (let i = 0; i < len; i++) {
        view.setUint8(i, binary.charCodeAt(i));
      }
      
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      let startTime = nextStartTimeRef.current;
      if (startTime < audioCtx.currentTime) {
        startTime = audioCtx.currentTime + 0.05;
      }
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      };
    } catch (e: any) {
      console.error("Live audio compilation crash:", e);
    }
  };

  const muteAllActiveLiveVoices = () => {
    activeSourcesRef.current.forEach((src) => {
      try { src.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
  };

  const stopLiveSession = () => {
    if (liveWsRef.current) {
      try { liveWsRef.current.close(); } catch (e) {}
      liveWsRef.current = null;
    }
    isWsOpenRef.current = false;
    setIsLiveActive(false);

    if (micProcessorRef.current) {
      try { micProcessorRef.current.disconnect(); } catch (e) {}
      micProcessorRef.current = null;
    }
    if (micStreamRef.current) {
      try { micStreamRef.current.getTracks().forEach((track) => track.stop()); } catch (e) {}
      micStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      try { inputAudioCtxRef.current.close(); } catch (e) {}
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      try { outputAudioCtxRef.current.close(); } catch (e) {}
      outputAudioCtxRef.current = null;
    }

    muteAllActiveLiveVoices();
    setForceCameraActive(false);
  };

  useEffect(() => {
    return () => { stopLiveSession(); };
  }, []);

  const addLog = (message: string, level: "INFO" | "WARN" | "SUCCESS" | "DIAG" = "INFO") => {
    const newLog: SystemLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prev) => [...prev.slice(-90), newLog]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        addLog("Mic input active. Awaiting acoustic command sequence...", "INFO");
      };

      rec.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e);
        if (e.error !== "no-speech") {
          addLog(`Speech Recognition Subsystem Alert: ${e.error}`, "WARN");
        }
        setIsListening(false);
      };

      rec.onend = () => { setIsListening(false); };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          addLog(`Acoustic transcript decoded: "${transcript}"`, "SUCCESS");
          const lowerTrans = transcript.toLowerCase();
          if (lowerTrans.includes("tony")) {
            setWakeWordHeard(true);
            addLog("Wake word [TONY] intercepted! Elevated processor locks active.", "SUCCESS");
            setTimeout(() => setWakeWordHeard(false), 3000);
          }
          submitVoiceQuery(transcript);
        }
      };

      recognitionRef.current = rec;
    } else {
      addLog("Local SpeechRecognition API unavailable on this host context. Fallback typing active.", "WARN");
    }
  }, [selectedVoice]);

  const clearAllAudioInstances = () => {
    if (activeAudioSourceRef.current) {
      try { activeAudioSourceRef.current.stop(); } catch (err) {}
      activeAudioSourceRef.current = null;
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (err) {}
    }
    activeSourcesRef.current.forEach((src) => {
      try { src.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
    addLog("Voice synthesizer feedback terminated by operator override.", "INFO");
  };

  const playPcmAudio = async (base64Audio: string): Promise<boolean> => {
    clearAllAudioInstances();
    addLog("Interpreting synthesized voice response stream...", "DIAG");
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binary = atob(base64Audio);
      const len = binary.length;
      const arrayBuffer = new ArrayBuffer(len);
      const view = new DataView(arrayBuffer);
      for (let i = 0; i < len; i++) {
        view.setUint8(i, binary.charCodeAt(i));
      }

      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        setIsSpeaking(false);
        addLog("Vocal feedback sequence complete.", "INFO");
      };

      activeAudioSourceRef.current = source;
      setIsSpeaking(true);
      source.start(0);
      return true;
    } catch (err: any) {
      console.error("PCM decoding failed:", err);
      addLog("Acoustic synthesis mapping collapsed.", "WARN");
      setIsSpeaking(false);
      return false;
    }
  };

  const speakClientFallback = (text: string, voice: "Tony" | "Toni") => {
    addLog("Local SpeechSynthesis disabled. Exclusively using server PCM Web Audio.", "DIAG");
  };

  const speakWithFallback = async (text: string, voice: "Tony" | "Toni", base64Audio: string | null) => {
    clearAllAudioInstances();
    if (base64Audio) {
      await playPcmAudio(base64Audio);
    } else {
      addLog("Local Web Speech fallback bypassed.", "DIAG");
    }
  };

  const speakGreeting = async (voice: "Tony" | "Toni") => {
    const greetingText = "Hi there, I am Tony built by sreeharitm.";
    addLog(`Synthesizing initial audio vocalization sequence for TONY [${voice === "Tony" ? "MALE" : "FEMALE"}]...`, "DIAG");
    try {
      const response = await fetch("/api/jarvis/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: greetingText, voiceName: voice }),
      });
      const data = await response.json();
      if (data.status === "success" && data.audio) {
        await speakWithFallback(greetingText, voice, data.audio);
      } else {
        await speakWithFallback(greetingText, voice, null);
      }
    } catch (err) {
      console.error("Vocal greeting sequence failed:", err);
      await speakWithFallback(greetingText, voice, null);
    }
  };

  const handleVoiceChange = async (voice: "Tony" | "Toni") => {
    setSelectedVoice(voice);
    addLog(`System Voice loaded: ${voice === "Tony" ? "TONY (MALE)" : "TONI (FEMALE)"}`, "SUCCESS");
    clearAllAudioInstances();
    speakGreeting(voice);

    if (isLiveActive) {
      addLog("Hot-swapping active bidirectional voice link parameters...", "DIAG");
      await startLiveSession(voice);
    }
  };

  const triggerSysBoot = async () => {
    addLog("Requesting biomechanical sensor authorization (Optics & Acoustics)...", "DIAG");
    try {
      const userPermissionsStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true
      });
      userPermissionsStream.getTracks().forEach((track) => track.stop());
      addLog("Sensory permission authorization established! Access granted.", "SUCCESS");
    } catch (err: any) {
      console.warn("Sensory permission pre-authorization restricted:", err);
      addLog("Hardware permission alert: Access restricted by security rules.", "WARN");
    }

    addLog("Booting master mainframe routine...", "DIAG");
    setSystemActive(true);
    addLog("All holographic HUD components ONLINE.", "SUCCESS");
    speakGreeting(selectedVoice);
    await startLiveSession();
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      addLog("Voice synthesis recognition engine disabled on system.", "WARN");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      clearAllAudioInstances();
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        addLog("Recognition context collision. Retry sequence.", "WARN");
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const query = inputText;
    setInputText("");
    submitQuery(query);
  };

  const submitQuery = async (text: string) => {
    clearAllAudioInstances();
    addLog(`Operator command received: "${text}"`, "INFO");

    const userMsgId = `msg-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
      hasImage: !!cameraSnapshot,
    };

    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setIsThinking(true);
    addLog("Forwarding telemetry to Gemini core analyzer...", "DIAG");

    const snapshotToUse = cameraSnapshot;
    setCameraSnapshot(null);

    try {
      const response = await fetch("/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages,
          image: snapshotToUse,
          voiceName: selectedVoice,
        }),
      });

      const data = await response.json();
      setIsThinking(false);

      if (data.status === "success") {
        addLog("Response retrieved from Gemini neural layer.", "SUCCESS");
        const assistantMsg: Message = {
          id: `msg-${Date.now()}-reply`,
          role: "assistant",
          content: data.text,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        await speakWithFallback(data.text, selectedVoice, data.audio);

        setDiagnostics((prev) => ({
          ...prev,
          reactorLoad: `${Math.floor(80 + Math.random() * 8)}.${Math.floor(Math.random() * 10)}%`,
          timestamp: new Date().toLocaleTimeString(),
        }));
      } else {
        throw new Error(data.error || "Unknown core transaction error");
      }
    } catch (err: any) {
      console.error("Mainframe request failed:", err);
      setIsThinking(false);
      addLog(`Neural exception: ${err.message || err}`, "WARN");
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-err`,
          role: "assistant",
          content: `Apologies, sir. My communications array encountered a bottleneck: ${err.message || "Mainframe synchronization failure."}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  const submitVoiceQuery = (transcriptText: string) => {
    submitQuery(transcriptText);
  };

  const clearTimeline = () => {
    setMessages([
      {
        id: "msg-first-reset",
        role: "assistant",
        content: "Core logs recycled and purged, sir. Chat interface reset.",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    addLog("System transaction records purged by operator request.", "WARN");
  };

  const handleCameraCapture = (base64Image: string) => {
    setCameraSnapshot(base64Image);
    addLog("Camera snapshot locked. Ready for query mapping context.", "INFO");
  };

  useEffect(() => {
    const picker = document.getElementById('biometric-uploader');
    if (picker) {
      const handleFileChange = function(e: any) {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(event: any) {
            const targetImg = document.getElementById('avatar-display-img') as HTMLImageElement | null;
            if (targetImg && event?.target) {
              targetImg.src = event.target.result;
              targetImg.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      };
      picker.addEventListener('change', handleFileChange);
      return () => { picker.removeEventListener('change', handleFileChange); };
    }
  }, [systemActive]);

  return (
    <div 
      id="jarvis-system-wrapper" 
      className={`w-full min-h-screen font-sans text-slate-300 relative bg-holo-grid selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden ${theme === 'liquid-glass' ? 'bg-[#f0f8ff] text-slate-800 border-cyan-200 shadow-sky-100' : 'bg-[#050a10]'}`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-cyan-950/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-blue-950/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Laser HUD scanning lines */}
      <div className="absolute inset-x-0 h-[1.5px] bg-cyan-500/5 pointer-events-none animate-scanline z-50" />

      {/* 1. OFF STATE BOOT LOADER SYSTEM */}
      {!systemActive ? (
        <div
          id="stark-boot-loader"
          onClick={triggerSysBoot}
          className="min-h-screen flex flex-col items-center justify-center p-6 text-center cursor-pointer relative z-10 select-none"
          title="Click to boot Tony"
        >
          <div className="absolute inset-0 bg-dot-matrix opacity-25 pointer-events-none" />
          
          <div className="relative mb-8 text-cyan-400 pointer-events-none">
            <div className="w-40 h-40 rounded-full border-2 border-dashed border-cyan-500/20 animate-spin-slow flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border border-cyan-400/30 animate-spin-reverse-slow flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-cyan-500/60 flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  <Cpu className="w-10 h-10 text-cyan-400" />
                </div>
              </div>
            </div>
          </div>

          <h1 id="core-mainframe-title" className="font-display font-bold text-3xl tracking-[0.25em] text-slate-100 glow-cyber uppercase mb-2 pointer-events-none">
            Tony Personal AI Assistant
          </h1>
          <p id="mainframe-codename" className="text-xs text-cyan-500 font-mono tracking-[0.4em] uppercase mb-12 pointer-events-none">
            PERSONAL AI CONVERSATIONAL COGNISANCE
          </p>

          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <div className="px-6 py-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400 animate-pulse font-semibold">
                Click anywhere to wake Tony
              </span>
            </div>
          </div>

          <div id="boot-subtext" className="mt-12 text-[10px] text-slate-600 font-mono tracking-widest pointer-events-none">
            SECURE ACCESS CODE REGISTERED : sreeharitm45@gmail.com
          </div>

          <div 
            onClick={(e) => e.stopPropagation()} 
            className="mt-8 flex items-center gap-3 bg-slate-900/60 border border-white/5 px-4 py-2.5 rounded-xl backdrop-blur-md z-30 pointer-events-auto"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400 font-medium">INITIAL VOICE DIRECTION:</span>
            <button
              onClick={() => setSelectedVoice("Tony")}
              className={`px-3 py-1.5 rounded-lg font-mono text-[10px] tracking-wider font-semibold transition-all cursor-pointer border ${
                selectedVoice === "Tony"
                  ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-300"
                  : "bg-transparent border-transparent text-slate-500"
              }`}
            >
              TONY (MALE)
            </button>
            <button
              onClick={() => setSelectedVoice("Toni")}
              className={`px-3 py-1.5 rounded-lg font-mono text-[10px] tracking-wider font-semibold transition-all cursor-pointer border ${
                selectedVoice === "Toni"
                  ? "bg-pink-500/10 border-pink-400/30 text-pink-300"
                  : "bg-transparent border-transparent text-slate-500"
              }`}
            >
              TONI (FEMALE)
            </button>
          </div>
        </div>
      ) : (
        /* 2. MAIN ACTIVE TONY HUD DASHBOARD */
        <div id="jarvis-dashboard" className="w-full min-h-screen flex flex-col justify-between p-3 md:p-4 box-border relative z-10 gap-4">
          
          {/* Header Bar */}
          <header id="stark-hud-header" className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-3 gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-[9px] text-cyan-400 tracking-[0.3em] font-semibold">
                  TONY 2.0 // MAIN ACCESS PROTOCOL
                </span>
                {wakeWordHeard && (
                  <span className="px-2 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 font-mono uppercase animate-bounce tracking-widest">
                    * Wake Word Verified
                  </span>
                )}
              </div>
              <h1 id="hud-branding" className="text-xl md:text-2xl font-display font-medium text-slate-100 uppercase tracking-wider mt-0.5">
                Tony <span className="text-cyan-400">Mainframe Matrix</span>
              </h1>
            </div>

            {/* Top Bar Navigation Controllers */}
            <div className="flex items-center flex-wrap gap-2">
              <button 
                onClick={toggleTheme}
                className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition"
                title="Toggle UI Styling Core"
              >
                <Sun className="w-4 h-4" />
              </button>
              <div className="flex bg-slate-900/80 border border-white/10 rounded-xl p-1 gap-1">
                <button
                  onClick={() => handleVoiceChange("Tony")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition ${selectedVoice === "Tony" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-500"}`}
                >
                  Tony Core
                </button>
                <button
                  onClick={() => handleVoiceChange("Toni")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition ${selectedVoice === "Toni" ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "text-slate-500"}`}
                >
                  Toni Mod
                </button>
              </div>
              <button 
                onClick={clearTimeline}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-mono transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Purge Logs
              </button>
            </div>
          </header>

          {/* Core HUD Grid Array */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 items-stretch min-h-0">
            
            {/* Left Column: Diagnostics & Mechanical Energy Core */}
            <div className="flex flex-col gap-4 border border-white/5 bg-slate-950/40 rounded-2xl p-4 backdrop-blur-md justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-4">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold">Reactor Telemetry</h3>
                </div>
                <div className="flex justify-center my-6">
                  <ArcReactor active={isLiveActive || isThinking || isSpeaking} />
                </div>
                
                {/* Diagnostics Metadata */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-slate-500">SYSTEM CODENAME:</span>
                    <span className="text-cyan-400 font-bold">TONY CORE</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-slate-500">REACTOR LOAD:</span>
                    <span className="text-amber-400 font-bold animate-pulse">{diagnostics.reactorLoad}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-slate-500">THERMAL STATE:</span>
                    <span className="text-emerald-400 font-bold">{diagnostics.thermalState}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-slate-500">CENTRAL INTEGRATION:</span>
                    <span className="text-cyan-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ONLINE</span>
                  </div>
                </div>
              </div>

              {/* Live Waveform Stream Visualizer */}
              <div className="border border-white/5 bg-black/40 rounded-xl p-3 mt-4">
                <span className="text-[10px] font-mono text-slate-500 block mb-2 uppercase tracking-wider">Acoustic Audio Waveform</span>
                <AudioVisualizer active={isSpeaking || isListening || isLiveActive} />
              </div>
            </div>

            {/* Center Column: Interactive Neural Terminal */}
            <div className="flex flex-col border border-white/10 bg-slate-950/60 rounded-2xl backdrop-blur-xl h-[60vh] lg:h-auto justify-between overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">Holographic HUD Transcripts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isLiveActive ? "bg-emerald-500 animate-ping" : "bg-slate-600"}`} />
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{isLiveActive ? "Live API Feed Locked" : "Standby"}</span>
                </div>
              </div>

              {/* Conversations Feed Block */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 font-sans text-sm shadow-md border ${
                      msg.role === "user" 
                        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-200 rounded-tr-none" 
                        : "bg-slate-900/80 border-white/10 text-slate-200 rounded-tl-none"
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      {msg.hasImage && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-mono text-cyan-400 mt-2 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                          <Sparkles className="w-2.5 h-2.5" /> Optics snapshot mapped
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mt-1 px-1">
                      {msg.role === "user" ? "Operator" : "Tony"} // {msg.timestamp}
                    </span>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 px-2 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Tony is calculating telemetry parameters...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Primary User Interactive Control Panel */}
              <div className="p-3 border-t border-white/5 bg-slate-900/20">
                <form onSubmit={handleFormSubmit} className="flex items-center gap-2 bg-slate-950/60 border border-white/10 rounded-xl p-1.5 relative">
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2.5 rounded-lg transition border ${isListening ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"}`}
                    title="Toggle Local Speech Recognition"
                  >
                    {isListening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Provide mainframe instruction array..."
                    className="flex-1 bg-transparent border-0 outline-none focus:ring-0 text-sm font-mono text-slate-200 px-2 placeholder:text-slate-600"
                  />

                  {cameraSnapshot && (
                    <div className="absolute right-14 top-[-45px] bg-cyan-950 border border-cyan-500/40 rounded-lg px-2 py-1 flex items-center gap-1 shadow-lg animate-bounce">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                      <span className="text-[10px] font-mono text-cyan-300 uppercase font-semibold">Frame Primed</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isThinking}
                    className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-40 transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Computer Vision Stream & Core Subsystem Activity Logs */}
            <div className="flex flex-col gap-4">
              
              {/* Optics Camera Scanner */}
              <div className="border border-white/10 bg-slate-950/40 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold">Optic Scanners</h3>
                  </div>
                  <button
                    onClick={isLiveActive ? stopLiveSession : () => startLiveSession()}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border transition ${isLiveActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/5 text-slate-500"}`}
                  >
                    {isLiveActive ? "Live API Connected" : "Link Live Matrix"}
                  </button>
                </div>

                <div className="aspect-video w-full rounded-xl bg-black/60 border border-white/5 relative overflow-hidden flex items-center justify-center">
                  <CameraStream 
                    active={systemActive || forceCameraActive} 
                    onCapture={handleCameraCapture}
                    onLiveFrame={handleLiveFrame}
                    isLiveActive={isLiveActive}
                  />
                  {!isLiveActive && !cameraSnapshot && (
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                      <span className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.25em] mb-1">[ Standby Frame Scanners ]</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mainframe Hardware Processing Log Terminal */}
              <div className="flex-1 flex flex-col border border-white/10 bg-slate-950/40 rounded-2xl p-4 backdrop-blur-md overflow-hidden min-h-[250px]">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-3">
                  <Settings className="w-4 h-4 text-cyan-400 animate-spin-slow" />
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold">Core Mainframe Logs</h3>
                </div>

                <div 
                  ref={logsContainerRef}
                  className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 pr-1 text-slate-400 select-all"
                >
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-1.5 leading-5 hover:bg-white/5 p-0.5 rounded transition">
                      <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                      <span className={`font-bold shrink-0 select-none px-1 text-[9px] rounded uppercase tracking-wider ${
                        log.level === "SUCCESS" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                        log.level === "WARN" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                        log.level === "DIAG" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                        "bg-cyan-500/10 text-cyan-400"
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-slate-300 break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* Core Footer Info Overlay */}
          <footer className="flex items-center justify-between border-t border-white/5 pt-2 text-[9px] font-mono text-slate-600 shrink-0 uppercase tracking-widest">
            <span>Built by Sreehari Tm</span>
            <span className="animate-pulse">Grid Feeds: Synced Secure // [ 24000Hz PCM Engine Ready ]</span>
          </footer>

        </div>
      )}

      {/* Hidden local uploader inputs linked via native DOM hooks */}
      <input type="file" id="biometric-uploader" className="hidden" accept="image/*" />
      <img id="avatar-display-img" className="hidden" alt="Biometric Register Array" />
    </div>
  );
}
