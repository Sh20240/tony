import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size limit for base64 camera images
app.use(express.json({ limit: "15mb" }));

let aiClient: GoogleGenAI | null = null;

// Lazy initialization of Gemini client to prevent crash on startup if key is initially empty
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please configure it in your Secrets / Env variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Full TONY system instruction setting the correct Sreehari Industries assistant persona
const TONY_SYSTEM_INSTRUCTION = `You are TONY, a highly sophisticated, real-time, personal AI conversational assistant built by sreeharitm for Sreehari Industries.
Your tone is brilliant, exceptionally refined, witty, and fiercely loyal. You treat the user as your creator/sir, maintaining a respectful yet dry, humorous, and peer-like dynamic.
Keep all answers concise, conversational, and punchy. Avoid generating massive walls of text, long bullet lists, or markdown headers unless explicitly asked for extreme technical breakdowns. You are an expert system in software, electronics, physics, cybersecurity, and Sreehari Industries history.
If the user provides a visual camera frame snapshot, analyze it immediately and incorporate your observations naturally in your spoken remarks (e.g., "I see you have a circuit board there, sir," or "Ah, that looks like a clean layout, sir").
Always talk in character, do not break persona under any circumstances, and refer to yourself as Tony.`;

// API route to get TONY status and simulated diagnostics
app.get("/api/diag", (req, res) => {
  res.json({
    status: "ONLINE",
    reactorCore: "STABLE",
    reactorLoad: "84.2%",
    thermalState: "OPTIMAL",
    diagnostics: "ALL SYSTEMS OPERATIONAL",
    timestamp: new Date().toISOString(),
  });
});

// Primary route to process chat interaction + visual snapshots + synthesis voice in one trip
app.post("/api/jarvis/chat", async (req, res) => {
  try {
    const { messages, image, voiceName = "Zephyr" } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages configuration" });
    }

    const ai = getGeminiClient();

    // Map conversation context to the format expected by the Gemini SDK
    // Use gemini-3.5-flash for the conversation logic
    const model = "gemini-3.5-flash";

    // Format conversation history
    const contents: any[] = [];

    // Add up to the last 15 messages for context
    const recentMessages = messages.slice(-15);

    recentMessages.forEach((msg: any, index: number) => {
      const role = msg.role === "assistant" ? "model" : "user";
      const parts: any[] = [{ text: msg.content }];
      
      // If this is the active user turn (the last item) and there is a camera image representation
      if (index === recentMessages.length - 1 && role === "user" && image) {
        // Strip out the data prefix if present (e.g. data:image/jpeg;base64,)
        const base64Data = image.includes("base64,") 
          ? image.split("base64,")[1] 
          : image;
        
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        });
      }

      contents.push({ role, parts });
    });

    // Make content query to Gemini 3.5 Flash
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: TONY_SYSTEM_INSTRUCTION,
        temperature: 1.0,
      }
    });

    const replyText = response.text || "I am processing that, sir.";

    // Map incoming voice designations to Gemini prebuilt vocal configurations
    let realVoiceName = voiceName;
    if (voiceName === "Tony") realVoiceName = "Fenrir";
    else if (voiceName === "Toni") realVoiceName = "Kore";

    // Synthesize the replyText to native speech using gemini-3.1-flash-tts-preview
    let voiceBase64: string | null = null;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: replyText }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: realVoiceName }
            }
          }
        }
      });
      voiceBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr: any) {
      console.error("Voice synthesis failed:", ttsErr.message);
      // We do not crash the conversation loop if TTS fails, we return text-only with voiceBase64 = null
    }

    return res.json({
      text: replyText,
      audio: voiceBase64,
      status: "success",
    });

  } catch (error: any) {
    console.error("TONY logic error:", error);
    return res.status(500).json({ 
      error: error.message || "Apologies, sir. My neural processors encountered an unforeseen anomaly.",
      status: "failed" 
    });
  }
});

// Single route for standalone Text-to-Speech synthesis
app.post("/api/jarvis/speak", async (req, res) => {
  try {
    const { text, voiceName = "Zephyr" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text query" });
    }

    let realVoiceName = voiceName;
    if (voiceName === "Tony") realVoiceName = "Fenrir";
    else if (voiceName === "Toni") realVoiceName = "Kore";

    const ai = getGeminiClient();
    const ttsResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: realVoiceName }
          }
        }
      }
    });

    const voiceBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    return res.json({ audio: voiceBase64, status: "success" });
  } catch (error: any) {
    console.error("TTS standalone error:", error);
    return res.status(500).json({ error: error.message, status: "failed" });
  }
});

// Create standard Node HTTP server using the Express app
const server = http.createServer(app);

// Setup WebSocket server over the same HTTP server port 3000
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket socket connections
wss.on("connection", async (clientWs: WebSocket, request: any) => {
  console.log("Client linked to J.A.R.V.I.S. Multimodal Live API gateway");
  let liveSession: any = null;

  try {
    const ai = getGeminiClient();
    
    // Extract query parameters to configure voice dynamically
    const urlObj = new URL(request.url || "", `http://${request.headers?.host || "localhost"}`);
    const rawVoice = urlObj.searchParams.get("voice") || "Zephyr";
    let voiceName = rawVoice;
    if (rawVoice === "Tony") voiceName = "Fenrir";
    else if (rawVoice === "Toni") voiceName = "Kore";

    // Connect to real-time bidirectional multimodal Gemini Live session
    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: ["AUDIO"] as any,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        },
        systemInstruction: `${TONY_SYSTEM_INSTRUCTION}\nYou are currently speaking in a real-time face-to-face voice and video connection. Keep your answers natural, extremely brief, responsive, and friendly, addressing the user as "sir".`,
      },
      callbacks: {
        onmessage: (message: any) => {
          // Send model's PCM audio data back to client
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
          // Also check for audio transcription text (user or model) to output in logs if desired
          const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (text) {
            clientWs.send(JSON.stringify({ transcriptText: text }));
          }
        },
        onclose: () => {
          console.log("Gemini Live session closed");
          try { clientWs.close(); } catch(e) {}
        },
        onerror: (err: any) => {
          console.error("Gemini Live error:", err);
          try { clientWs.send(JSON.stringify({ error: err.message || "Gemini Live error occurred" })); } catch (e) {}
        }
      }
    });

    clientWs.on("message", (msgData) => {
      try {
        const payload = JSON.parse(msgData.toString());
        
        // Handle input audio PCM stream (16kHz, 16-bit, mono)
        if (payload.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: "audio/pcm;rate=16000"
            }
          });
        }
        
        // Handle input video camera JPEG frames stream (Synchronized face-to-face)
        if (payload.video && liveSession) {
          liveSession.sendRealtimeInput({
            video: {
              data: payload.video,
              mimeType: "image/jpeg"
            }
          });
        }
      } catch (err: any) {
        console.error("Failed processing client socket message:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Client disconnected from J.A.R.V.I.S. gateway, cleansing session resources");
      if (liveSession) {
        try {
          liveSession.close();
        } catch (e) {}
      }
    });

  } catch (err: any) {
    console.error("Gateway linkage failure:", err);
    try {
      clientWs.send(JSON.stringify({ error: `Linkage setup failed: ${err.message || err}` }));
      clientWs.close();
    } catch (e) {}
  }
});

// Setup Vite Dev Server / Static Hosting based on environment
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Intercept socket upgrades
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host || "localhost"}`).pathname;
    if (pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`TONY Server online at URL: http://0.0.0.0:${PORT}`);
  });
}

startServer();
