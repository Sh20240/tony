export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  hasImage?: boolean;
}

export interface SystemDiagnostics {
  status: string;
  reactorCore: string;
  reactorLoad: string;
  thermalState: string;
  diagnostics: string;
  timestamp: string;
}

export interface VoiceSetting {
  voiceName: "Zephyr" | "Fenrir" | "Charon" | "Kore";
  displayName: string;
  description: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "SUCCESS" | "DIAG";
  message: string;
}
