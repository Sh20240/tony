import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal, Cpu, Zap, Volume2, Mic, MicOff, Send, HelpCircle, 
  Settings, Activity, ShieldAlert, Sparkles, AlertTriangle, 
  Trash2, Play, RefreshCw, Sun, CheckCircle2, ChevronRight
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
  const [systemActive, setSystemActive] = useState<boolean>(false); // Starts with custom Sreehari boot loader
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

  // New Live API States and Refs
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
      // Clean up previous voice array instances
      stopLiveSession();

      // Force camera active state (displays face-to-face optics)
      setForceCameraActive(true);

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${voiceToUse}`;
      addLog(`Synchronising real-time secure link: ${wsUrl}`, "DIAG");

      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      ws.onopen = async () => {
        isWsOpenRef.current = true;
        setIsLiveActive(true);
        addLog("Secure live subspace bridge established. Mapping acoustics...", "SUCCESS");

        // Request microphone stream at native 16kHz resample mapping
        try {
          const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          inputAudioCtxRef.current = inputAudioCtx;

          const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          outputAudioCtxRef.current = outputAudioCtx;

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;

          const source = inputAudioCtx.createMediaStreamSource(stream);
          // Script processor to process PCM chunks
          const processor = inputAudioCtx.createScriptProcessor(2048, 1, 1);
          micProcessorRef.current = processor;

          source.connect(processor);
          processor.connect(inputAudioCtx.destination);

          processor.onaudioprocess = (e) => {
            if (!isWsOpenRef.current || ws.readyState !== WebSocket.OPEN) return;
            const floatData = e.inputBuffer.getChannelData(0);
            
            // Convert native Float32 buffer to 16-bit PCM buffer array
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
          
          if (data.audio) {
            playLiveAudioChunk(data.audio);
          }
          
          if (data.interrupted) {
            muteAllActiveLiveVoices();
          }

          if (data.transcriptText) {
            // Append Tony's speech transcriptions in real time to the HUD log array
            addLog(`[Decoded Transcript]: "${data.transcriptText}"`, "DIAG");
          }

          if (data.error) {
            addLog(`Subprocessor telemetry error: ${data.error}`, "WARN");
          }
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
        startTime = audioCtx.currentTime + 0.05; // tiny latency slice to bypass browser ticks popping
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
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
  };

  const stopLiveSession = () => {
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch (e) {}
      liveWsRef.current = null;
    }
    isWsOpenRef.current = false;
    setIsLiveActive(false);

    if (micProcessorRef.current) {
      try { micProcessorRef.current.disconnect(); } catch (e) {}
      micProcessorRef.current = null;
    }

    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
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

  // Clean-up active live web voice systems when page is closed
  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  // Print system updates on log stack
  const addLog = (message: string, level: "INFO" | "WARN" | "SUCCESS" | "DIAG" = "INFO") => {
    const newLog: SystemLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prev) => [...prev.slice(-90), newLog]);
  };

  // Scroll messages and logs to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle Speech Recognition setup using Web Speech API
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

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          addLog(`Acoustic transcript decoded: "${transcript}"`, "SUCCESS");
          
          // Check for user-defined wake words: "Tony", "Hi Tony", "Hey Tony"
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
      addLog("Local SpeechRecognition API unavailable on this host iframe context. Fallback typing active.", "WARN");
    }
  }, [selectedVoice]);

  // Completely mutates and silences all vocal/audio systems to prevent overlap
  const clearAllAudioInstances = () => {
    // 1. Terminate native TTS active buffer source
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
      } catch (err) {}
      activeAudioSourceRef.current = null;
    }

    // 2. Cancel local browser speech synthesis
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {}
    }
    
    // 3. Terminate all active Multi-Modal Live Audio streams in queue
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;

    setIsSpeaking(false);
    addLog("Voice synthesizer feedback terminated by operator override.", "INFO");
  };

  // Play 16-bit PCM little-endian audio returned from custom Gemini-TTS (24kHz)
  // Returns true if successfully played, false otherwise
  const playPcmAudio = async (base64Audio: string): Promise<boolean> => {
    clearAllAudioInstances(); // Cut off old speech before playing new speech
    addLog("Interpreting synthesized voice response stream...", "DIAG");
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Convert base64 to binary ArrayBuffer
      const binary = atob(base64Audio);
      const len = binary.length;
      const arrayBuffer = new ArrayBuffer(len);
      const view = new DataView(arrayBuffer);
      for (let i = 0; i < len; i++) {
        view.setUint8(i, binary.charCodeAt(i));
      }

      // Decode 16-bit signed integers (PCM) to floats
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0; // clamp bounds between -1.0 and 1.0
      }

      // Create Audio Buffer
      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      // Play Audio Buffer
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

  // Local client fallback TTS using native Web Speech Synthesis API (COMPLETELY DISABLED TO ELIMINATE DUAL-VOICE OVERLAP)
  const speakClientFallback = (text: string, voice: "Tony" | "Toni") => {
    // Disabled to prevent dual-voice startup glitch
    addLog("Local SpeechSynthesis disabled. Exclusively using server PCM Web Audio.", "DIAG");
  };

  // Speaks using PCM synthesized voice exclusively, avoiding native browser fallbacks
  const speakWithFallback = async (text: string, voice: "Tony" | "Toni", base64Audio: string | null) => {
    clearAllAudioInstances();

    if (base64Audio) {
      await playPcmAudio(base64Audio);
    } else {
      addLog("Local Web Speech fallback bypassed.", "DIAG");
    }
  };

  // Voice greeting synthesis matching selected character profile
  const speakGreeting = async (voice: "Tony" | "Toni") => {
    const greetingText = "Hi there, I am Tony built by sreeharitm.";
    
    addLog(`Synthesizing initial audio vocalization sequence for TONY [${voice === "Tony" ? "MALE" : "FEMALE"}]...`, "DIAG");
    try {
      const response = await fetch("/api/jarvis/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: greetingText,
          voiceName: voice 
        }),
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

  // Change active voice emulation profile instantly
  const handleVoiceChange = async (voice: "Tony" | "Toni") => {
    setSelectedVoice(voice);
    addLog(`System Voice loaded: ${voice === "Tony" ? "TONY (MALE)" : "TONI (FEMALE)"}`, "SUCCESS");
    
    // Silence active speech
    clearAllAudioInstances();
    
    // Play greeting instantly as specified
    speakGreeting(voice);

    // Dynamic Live Connection Voice Adapting (Hot-swapping live link)
    if (isLiveActive) {
      addLog("Hot-swapping active bidirectional voice link parameters...", "DIAG");
      await startLiveSession(voice);
    }
  };

  // Boot TONY system out loud
  const triggerSysBoot = async () => {
    addLog("Requesting biomechanical sensor authorization (Optics & Acoustics)...", "DIAG");
    try {
      // Prompt user for camera and microphone access
      const userPermissionsStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true
      });
      // Stop temporary tracks of pre-authorization stream so standard sub-sensors can capture cleanly
      userPermissionsStream.getTracks().forEach((track) => track.stop());
      addLog("Sensory permission authorization established! Access granted.", "SUCCESS");
    } catch (err: any) {
      console.warn("Sensory permission pre-authorization restricted:", err);
      addLog("Hardware permission alert: Access restricted by security rules.", "WARN");
    }

    addLog("Booting master mainframe routine...", "DIAG");
    setSystemActive(true);
    addLog("All holographic HUD components ONLINE.", "SUCCESS");

    // Play greeting voice and start real-time live link
    speakGreeting(selectedVoice);
    await startLiveSession();
  };

  // Toggle user voice recognition states
  const toggleListening = () => {
    if (!recognitionRef.current) {
      addLog("Voice synthesis recognition engine disabled on system.", "WARN");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      clearAllAudioInstances(); // Stop any pending vocals
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.error("Could not run recognition start:", err);
        addLog("Recognition context collision. Retry sequence.", "WARN");
      }
    }
  };

  // Handler for direct text typing submission
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    // Package parameters
    const query = inputText;
    setInputText("");
    submitQuery(query);
  };

  // Submit text input to proxy with optional image frame attached
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

    // Preserve snapshots to reset state immediately for future scans
    const snapshotToUse = cameraSnapshot;
    setCameraSnapshot(null); // Clear active frame lock indicator

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

        // Play synthetic reply voice
        await speakWithFallback(data.text, selectedVoice, data.audio);

        // Slight simulated load fluctuations
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

  // Voice submission helper (STT transcript path)
  const submitVoiceQuery = (transcriptText: string) => {
    submitQuery(transcriptText);
  };

  // Clear Chat History logs
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

  // Capture Base64 frame from CameraStream component
  const handleCameraCapture = (base64Image: string) => {
    setCameraSnapshot(base64Image);
    addLog("Camera snapshot locked. Ready for query mapping context.", "INFO");
  };

  // Isolated local listener for biometric-uploader and avatar-display-img
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
      return () => {
        picker.removeEventListener('change', handleFileChange);
      };
    }
  }, [systemActive]);

  return (
    <div 
      id="jarvis-system-wrapper" 
      className={`w-full font-sans text-slate-300 relative bg-holo-grid selection:bg-cyan-500/30 selection:text-cyan-200 ${theme === 'liquid-glass' ? 'liquid-glass' : 'bg-[#050a10]'}`}
      style={{ boxSizing: "border-box" }}
    >
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-cyan-950/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-blue-950/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Laser HUD scanning overlay lines */}
      <div className="absolute inset-x-0 h-[1.5px] bg-cyan-500/5 pointer-events-none animate-scanline z-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-slate-950 to-black pointer-events-none" />

      {/* 1. OFF STATE BOOT LOADER SYSTEM */}
      {!systemActive ? (
        <div
          id="stark-boot-loader"
          onClick={triggerSysBoot}
          className="min-h-screen flex flex-col items-center justify-center p-6 text-center cursor-pointer relative z-15 select-none"
          title="Click to boot Tony"
        >
          <div className="absolute inset-0 bg-dot-matrix opacity-25 pointer-events-none" />
          
          <div className="relative mb-8 text-cyan-400 pointer-events-none">
            {/* Spinning preview hologram core */}
            <div className="w-40 h-40 rounded-full border-2 border-dashed border-cyan-500/20 animate-spin-slow flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border border-cyan-400/30 animate-spin-reverse-slow flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-cyan-500/60 flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  <Cpu className="w-10 h-10 text-cyan-400 animate-spin-reverse-fast" />
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

          {/* Simple breath-glowing text instructions overlay in place of button */}
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <div className="px-6 py-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400 animate-pulse font-semibold">
                Click anywhere to wake Tony
              </span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono tracking-[0.2em] mt-2">
              [ ACCESS PORTAL STANDBY ]
            </span>
          </div>

          <div id="boot-subtext" className="mt-12 text-[10px] text-slate-600 font-mono tracking-widest pointer-events-none">
            SECURE ACCESS CODE REGISTERED : sreeharitm45@gmail.com
          </div>

          {/* Quick Voice Pre-selector before wakeup */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="mt-8 flex items-center gap-3 bg-slate-900/60 border border-white/5 px-4 py-2.5 rounded-xl backdrop-blur-md z-30 pointer-events-auto"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400 font-medium">INITIAL VOICE DIRECTION:</span>
            <button
              onClick={() => setSelectedVoice("Tony")}
              className={`px-3 py-1.5 rounded-lg font-mono text-[10px] tracking-wider font-semibold transition-all cursor-pointer border ${
                selectedVoice === "Tony"
                  ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-400"
              }`}
            >
              TONY (MALE)
            </button>
            <button
              onClick={() => setSelectedVoice("Toni")}
              className={`px-3 py-1.5 rounded-lg font-mono text-[10px] tracking-wider font-semibold transition-all cursor-pointer border ${
                selectedVoice === "Toni"
                  ? "bg-pink-500/10 border-pink-400/30 text-pink-300 shadow-[0_0_10px_rgba(244,114,182,0.1)]"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-400"
              }`}
            >
              TONI (FEMALE)
            </button>
          </div>
        </div>
      ) : (
        /* 2. MAIN ACTIVE TONY HUD DASHBOARD */
        <div id="jarvis-dashboard" className="w-full h-full flex flex-col justify-between overflow-hidden relative z-10 gap-3 p-3 md:p-4 box-border">
          
          {/* Header Bar */}
          <header id="stark-hud-header" className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-3 gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-[9px] text-cyan-400 tracking-[0.3em] font-semibold">
                  TONY 2.0 // MAIN ACCESS PROTOCOL
                </span>
                {wakeWordHeard && (
                  <span className="px-2 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 font-mono uppercase animate-bounce tracking-widest leading-none">
                    * Wake Word Verified
                  </span>
                )}
              </div>
              <h1 id="hud-branding" className="text-xl md:text-2xl font-display font-medium text-slate-100 uppercase tracking-wider mt-0.5">
                Tony <span className="text-cyan-400/50">Core</span> System Hub
              </h1>
            </div>

            {/* Operator Profile Capsule Badge & Shift Aesthetic Button */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Profile Badge Capsule */}
              <div 
                id="operator-profile-badge"
                className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-900/80 border border-cyan-500/30 rounded-full cursor-pointer hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all shrink-0"
                title="Initialize Biometrics / Upload Picture"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="font-display text-[9px] md:text-[10px] text-cyan-300 font-bold uppercase tracking-wider">
                  CHIEF EDITOR SREEHARI
                </span>
                <label htmlFor="biometric-uploader" className="cursor-pointer relative w-10 h-10 rounded-full overflow-hidden border border-cyan-400/40 bg-black shrink-0 ml-1 block">
                  <img 
                    id="avatar-display-img" 
                    src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300f0ff' stroke-width='2'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>" 
                    alt="Operator Biometrics" 
                    style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} 
                  />
                </label>
                <input 
                  type="file" 
                  id="biometric-uploader" 
                  accept="image/*" 
                  style={{ display: "none" }} 
                />
              </div>

              {/* Shift Aesthetic button */}
              <button
                id="shift-aesthetic-btn"
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-full border border-cyan-500/30 bg-slate-900/80 text-cyan-400 font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-wider hover:border-cyan-400 hover:text-cyan-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.25)] transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Sun className="w-3.5 h-3.5" />
                SHIFT AESTHETIC
              </button>
            </div>
          </header>

          {/* 2x2 Top Metrics Grid */}
          <div id="status-ribbon" className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {/* Box 1 */}
            <div className="glass-panel rounded-2xl p-3 font-mono text-left relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>SYS_GRID_PING</span>
              </div>
              <div className="text-xs md:text-sm text-cyan-300 font-bold mt-1 tracking-wider glow-cyber">
                22ms SECURE
              </div>
            </div>

            {/* Box 2 */}
            <div className="glass-panel rounded-2xl p-3 font-mono text-left relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>ARC_REACTOR</span>
              </div>
              <div className="text-xs md:text-sm text-cyan-300 font-bold mt-1 tracking-wider glow-cyber">
                STABLE ({diagnostics.reactorLoad})
              </div>
            </div>

            {/* Box 3 */}
            <div className="glass-panel rounded-2xl p-3 font-mono text-left relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>AI_CORE</span>
              </div>
              <div className="text-xs md:text-sm text-emerald-400 font-bold mt-1 tracking-wider">
                ONLINE
              </div>
            </div>

            {/* Box 4 */}
            <div className="glass-panel rounded-2xl p-3 font-mono text-left relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>OPERATOR</span>
              </div>
              <div className="text-xs md:text-sm text-slate-300 font-bold mt-1 tracking-wider truncate">
                SREEHARITM...
              </div>
            </div>
          </div>

          {/* Core App Layout Map */}
          <main id="hud-dashboard-grid" className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-y-auto md:overflow-hidden pr-1 box-border">
            
            {/* COLUMN 1 (LEFT 60%): Vocal Telemetry Records, Arc Reactor, Audio Visualizer, Voice Selector */}
            <section id="reactor-management-pane" className="w-full md:w-[60%] flex flex-col gap-4 min-h-0">
              
              {/* VOICE SYSTEM CORE component panel */}
              <div id="voice-system-core-panel" className="glass-panel rounded-3xl p-4 relative overflow-hidden shrink-0 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-fade-in">
                <div className="absolute inset-0 bg-dot-matrix opacity-10 pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                    <span className="font-display font-medium text-slate-200 text-xs tracking-wider uppercase">
                      VOICE SYSTEM CORE
                    </span>
                  </div>
                  <span className="font-mono text-[8px] text-cyan-400/70 border border-cyan-400/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest animate-pulse">
                    READY
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    id="core-voice-tony-btn"
                    onClick={() => handleVoiceChange("Tony")}
                    className={`flex items-center justify-center py-2.5 px-3 rounded-xl font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                      selectedVoice === "Tony"
                        ? "bg-cyan-500/15 border border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                        : "bg-slate-950/40 border border-cyan-500/20 text-slate-400 hover:text-slate-300 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                    }`}
                  >
                    <span>PROFILE M_01 // TONY (MALE)</span>
                  </button>
                  <button
                    id="core-voice-toni-btn"
                    onClick={() => handleVoiceChange("Toni")}
                    className={`flex items-center justify-center py-2.5 px-3 rounded-xl font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                      selectedVoice === "Toni"
                        ? "bg-pink-500/15 border border-pink-400 text-pink-300 shadow-[0_0_15px_rgba(244,114,182,0.25)]"
                        : "bg-slate-950/40 border border-cyan-500/20 text-slate-400 hover:text-slate-300 hover:border-pink-400 hover:shadow-[0_0_10px_rgba(244,114,182,0.15)]"
                    }`}
                  >
                    <span>PROFILE F_02 // TONI (FEMALE)</span>
                  </button>
                </div>
              </div>

              {/* Chat timeline interface dialog: VOCAL TELEMETRY RECORDS */}
              <div id="transcript-dialog-box" className="glass-panel rounded-3xl p-4 md:p-5 flex-1 flex flex-col justify-between overflow-hidden min-h-[350px] relative">
                <div className="absolute inset-0 bg-dot-matrix opacity-10 pointer-events-none" />
                
                {/* Unified Header with Link Controls */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 z-10 shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-cyan-400 font-bold font-mono">&gt;</span>
                    <span className="font-display font-medium text-slate-200 text-xs tracking-wider uppercase">
                      VOCAL TELEMETRY RECORDS
                    </span>
                    <span className="flex items-center gap-1.5 ml-1">
                      <span className={`w-2 h-2 rounded-full ${isLiveActive ? "bg-cyan-400 animate-pulse" : "bg-slate-600"} shrink-0`} />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                        {isLiveActive ? "CONNECTED" : "OFFLINE"}
                      </span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isLiveActive ? (
                      <button
                        id="stop-live-btn"
                        onClick={stopLiveSession}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 font-mono text-[9px] md:text-[10px] hover:bg-rose-500/30 transition-all font-semibold cursor-pointer"
                      >
                        DISCONNECT
                      </button>
                    ) : (
                      <button
                        id="start-live-btn"
                        onClick={() => startLiveSession()}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[9px] md:text-[10px] hover:bg-cyan-500/30 transition-all font-semibold cursor-pointer"
                      >
                        ESTABLISH LINK
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={clearTimeline}
                      title="Clear core record feeds"
                      className="p-1 px-2 rounded-lg border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 transition-all font-mono text-[9px] flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      RECYCLE
                    </button>
                  </div>
                </div>

                {/* Messages Timeline scrolling elements */}
                <div id="messages-scroller" className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-smooth z-10 min-h-0">
                  {messages.map((msg) => {
                    const isTony = msg.role === "assistant";
                    return (
                      <div
                        key={msg.id}
                        id={`chat-bubble-${msg.id}`}
                        className={`flex flex-col max-w-[85%] ${
                          isTony ? "mr-auto items-start" : "ml-auto items-end"
                        }`}
                      >
                        {/* Speaker tag label */}
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 mb-1 px-1">
                          <span>{isTony ? "TONY OS" : "CREATOR"}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        {/* Speech Bubble body */}
                        <div
                          className={`rounded-2xl p-3 text-xs leading-relaxed border transition-all ${
                            isTony
                              ? "bg-white/5 border-white/10 text-slate-200"
                              : "bg-cyan-500/10 border-cyan-500/20 text-cyan-50 shadow-sm shadow-cyan-950/25"
                          }`}
                        >
                          <p>{msg.content}</p>
                          
                          {/* Indicator for attached snapshot */}
                          {msg.hasImage && (
                            <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-mono text-amber-400 px-1.5 py-0.5 bg-amber-500/5 border border-amber-500/20 rounded">
                              <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                              * Multi-Modal Scanner Feed Attached *
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {isThinking && (
                    <div className="flex flex-col items-start max-w-[80%] mr-auto">
                      <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500 mb-1 px-1">
                        <span>TONY OS</span>
                        <span>•</span>
                        <span>SOLVING TELEMETRY</span>
                      </div>
                      <div className="rounded-2xl p-3 bg-white/5 border border-white/10 text-slate-400 text-xs flex items-center gap-2">
                        <span className="flex gap-1.5 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                        <span>Accessing neurosystem layers, sir...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Snapshot target buffer line */}
                {cameraSnapshot && (
                  <div id="camera-snapshot-bar" className="mt-2 flex items-center justify-between p-2 bg-amber-500/5 border border-amber-500/20 rounded-xl relative z-20 shrink-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-10 h-10 rounded border border-amber-500/40 overflow-hidden flex-shrink-0 bg-black">
                        <img src={cameraSnapshot} referrerPolicy="no-referrer" alt="snapshot" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-amber-400 font-bold tracking-wider">OPTICAL BUFFER LOCKED</div>
                        <div className="text-[9px] text-slate-500 truncate max-w-[150px]">Base64 Image Payload Locked</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setCameraSnapshot(null)}
                      className="p-1 px-2 text-slate-500 hover:text-rose-400 text-[10px] font-mono border border-transparent hover:border-rose-500/20 rounded"
                    >
                      CLEAR
                    </button>
                  </div>
                )}

                {/* Muted static/dots offline message in timeline */}
                {!isLiveActive && (
                  <div className="flex flex-col items-center justify-center py-2 text-slate-500 font-mono text-[9px] gap-0.5 z-10 shrink-0 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-1.5">
                      <MicOff className="w-3.5 h-3.5 text-slate-600 animate-pulse" />
                      <span className="tracking-widest uppercase">NEURAL FEED OFFLINE</span>
                    </div>
                    <div className="flex gap-1 mt-1 justify-center">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <span key={i} className="w-1 h-1 rounded-full bg-slate-800" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Input Text box bar */}
                <form id="speech-query-form" onSubmit={handleFormSubmit} className="mt-3 flex gap-2 relative z-20 shrink-0">
                  <input
                    id="hud-input-field"
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={isListening ? "Listening..." : "Provide command parameters, sir..."}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 hover:border-white/20 focus:border-cyan-500 text-white rounded-xl text-xs placeholder-slate-500 focus:outline-none transition-all font-mono backdrop-blur-sm"
                    disabled={isListening}
                  />
                  
                  {isSpeaking && (
                    <button
                      type="button"
                      id="silence-speech-btn"
                      onClick={clearAllAudioInstances}
                      title="Silence active diagnostics voice playback"
                      className="p-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-rose-400 rounded-xl transition-all flex items-center justify-center"
                    >
                      <Volume2 className="w-4 h-4 animate-bounce" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleListening}
                    id="hud-vocal-ping-btn"
                    className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                      isListening
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse"
                        : "bg-white/5 border-white/10 hover:border-cyan-500/30 text-cyan-400"
                    }`}
                    title="Trigger dynamic STT voice sequence"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    id="chat-submit-btn"
                    className="p-2 px-3.5 bg-white/15 border border-white/20 hover:bg-white/20 text-cyan-400 rounded-xl transition-all flex items-center justify-center font-mono text-xs"
                    disabled={!inputText.trim()}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

              </div>

              {/* Sub components row for Arc Reactor, Audio Visualizer, Voice Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0 animate-fade-in">
                {/* Arc Reactor Control */}
                <ArcReactor 
                  isThinking={isThinking}
                  isSpeaking={isSpeaking}
                  isListening={isListening}
                  reactorLoad={diagnostics.reactorLoad}
                  onClick={toggleListening}
                />

                {/* Right side of sub-grid: Visualizer + Selector */}
                <div className="flex flex-col gap-3">
                  <AudioVisualizer 
                    isThinking={isThinking}
                    isListening={isListening}
                    isSpeaking={isSpeaking}
                  />

                  {/* VOICE SYSTEM Selector */}
                  <div id="voice-subroutines" className="glass-panel rounded-3xl p-4 flex-1 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-dot-matrix opacity-10 pointer-events-none" />
                    
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-display font-medium text-slate-200 text-[10px] tracking-wider uppercase">
                          VOICE SYSTEM
                        </span>
                      </div>
                      <span className="font-mono text-[8px] text-cyan-400/70 border border-cyan-400/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest animate-pulse">
                        SYS ACTIVE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/5">
                      <button
                        id="voice-tony-btn"
                        onClick={() => handleVoiceChange("Tony")}
                        className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-lg font-mono text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
                          selectedVoice === "Tony"
                            ? "bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-bold"
                            : "border border-transparent text-slate-500 hover:text-slate-300 font-medium"
                        }`}
                      >
                        <span className="uppercase text-inherit">TONY (MALE)</span>
                      </button>
                      <button
                        id="voice-toni-btn"
                        onClick={() => handleVoiceChange("Toni")}
                        className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-lg font-mono text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
                          selectedVoice === "Toni"
                            ? "bg-pink-500/10 border border-pink-400/40 text-pink-300 shadow-[0_0_15px_rgba(244,114,182,0.15)] font-bold"
                            : "border border-transparent text-slate-500 hover:text-slate-300 font-medium"
                        }`}
                      >
                        <span className="uppercase text-inherit">TONI (FEMALE)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </section>

            {/* COLUMN 2 (RIGHT 40%): Camera optics, Diagnostics log terminal, and Intelligence Capabilities */}
            <section id="auxiliary-sensor-pane" className="w-full md:w-[40%] flex flex-col gap-4 min-h-0">
              
              {/* Camera Stream optic */}
              <div className="flex-1 min-h-[250px] flex flex-col">
                <CameraStream 
                  onCapture={handleCameraCapture}
                  isScanning={isThinking}
                  addLog={addLog}
                  forceActive={forceCameraActive}
                  onLiveFrame={handleLiveFrame}
                />
              </div>

              {/* Sreehari Mainframe Scrolling Diagnostic Log Stack */}
              <div id="diagnostics-terminal" className="glass-panel rounded-3xl p-4 md:p-5 flex flex-col h-[260px] shrink-0">
                
                {/* Header logs */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span className="font-display font-medium text-slate-200 text-xs tracking-wider uppercase">
                      DIAGNOSTICS & NEURAL LOGS
                    </span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                {/* Logs scroller */}
                <div 
                  ref={logsContainerRef}
                  id="logs-activity-stream"
                  className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px]"
                >
                  {logs.map((log) => {
                    let levelColor = "text-cyan-400";
                    if (log.level === "WARN") levelColor = "text-rose-400";
                    if (log.level === "SUCCESS") levelColor = "text-emerald-400";
                    if (log.level === "DIAG") levelColor = "text-amber-500";

                    return (
                      <div key={log.id} id={`log-item-${log.id}`} className="leading-normal flex gap-1 items-start select-text border-b border-white/5 pb-1">
                        <span className="text-slate-600 font-medium shrink-0">[{log.timestamp}]</span>
                        <span className={`font-semibold shrink-0 ${levelColor}`}>[{log.level}]</span>
                        <span className="text-slate-400 break-words">{log.message}</span>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Sreehari tech documentation list helper */}
              <div id="stark-telemetry-helper" className="glass-panel-light rounded-2xl p-3 font-mono text-[9px] text-slate-500 shrink-0">
                <div className="flex items-center gap-1 text-slate-400 font-semibold mb-1">
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>INTELLIGENCE CAPABILITIES</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Analyze snapshots of physical hardware schemas or UI drafts using <span className="text-cyan-400">Eye/Optical scanner buffer</span>.</li>
                  <li>Click <span className="text-cyan-400">ARC Core</span> and speak. TONY recognizes complex, contextually nested vocal questions.</li>
                  <li>Toggle different specialized emulative subroutines under Voice tuning parameters.</li>
                </ul>
              </div>

            </section>

          </main>

          {/* Holographic copyright block */}
          <footer id="jarvis-system-footer" className="border-t border-white/10 pt-2 pb-1 text-center text-slate-500 text-[9px] md:text-[10px] font-mono tracking-widest uppercase shrink-0">
            TONY CENTRAL MAINFRAME // SECURE_SOCKET v4.11 // OPERATIONAL SECURE // SREEHARI INDUSTRIES
          </footer>

        </div>
      )}
    </div>
  );
}

// Inject this isolated, local-only JavaScript handler at the absolute end of the script file to update the image:
if (typeof document !== 'undefined') {
  setTimeout(() => {
    const el = document.getElementById('biometric-uploader');
    if (el) {
      el.addEventListener('change', function(e: any) { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = function(event: any) { const imgElement = document.getElementById('avatar-display-img'); if (imgElement) { (imgElement as any).src = event.target.result; } }; reader.readAsDataURL(file); } });
    }
  }, 500);
}
