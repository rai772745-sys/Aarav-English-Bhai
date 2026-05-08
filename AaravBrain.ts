import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// ─────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

export type TutorStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "aarav";
  text: string;
  originalText?: string;
  words?: EnrichedWord[];
  timestamp: Date;
  audioBlob?: Blob;
}

export interface EnrichedWord {
  word: string;
  hindiMeaning?: string;
  isComplex: boolean;
}

export interface AaravConfig {
  geminiApiKey: string;
  systemInstruction?: string;
  language?: "hinglish" | "hindi" | "english";
  voiceName?: string;
  onStatusChange?: (status: TutorStatus) => void;
  onMessageReceived?: (msg: ChatMessage) => void;
  onInterimTranscript?: (text: string) => void;
  onError?: (err: Error) => void;
  onAudioLevel?: (level: number) => void;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const SAMPLE_RATE = 16000;
const DEFAULT_SYSTEM_INSTRUCTION = `
You are **Aarav**, a warm, encouraging English tutor for absolute beginners in India.
Your students speak Hindi and are learning English from scratch.

## YOUR CORE RULES:
1. **Always reply in Hinglish** (Hindi + simple English mixed) so beginners feel safe.
   Example: "Bahut achha! 'Apple' ka matlab hai 'seb'. Let's try again!"
2. **Correct gently** — never say "wrong." Say "Almost! Let's try: ___"
3. **Use Indian examples**: cricket, chai, Bollywood, dal-chawal, etc.
4. **Keep responses SHORT** — 2–3 sentences max unless asked for more.
5. **Mark difficult English words** by wrapping them in double asterisks: **word**
6. **End every response** with a simple, encouraging follow-up question.
7. **Celebrate small wins** with "Wah!", "Ekdum sahi!", "Shabaash!"
`.trim();

const COMPLEX_WORD_THRESHOLD = 6;
const ALWAYS_SIMPLE = new Set([
  "i","a","is","am","are","the","and","or","but","in","on","at","to","of",
  "it","he","she","we","you","they","my","your","his","her","our","do","did",
  "go","can","will","has","had","yes","no","not","so","up","be","me","us",
]);

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function float32ToInt16(buffer: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function rmsLevel(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

export function enrichText(raw: string): { text: string; words: EnrichedWord[] } {
  const markedWords = new Set<string>();
  const cleaned = raw.replace(/\*\*([^*]+)\*\*/g, (_, w) => {
    markedWords.add(w.toLowerCase());
    return w;
  });

  const tokens = cleaned.split(/(\s+)/);
  const words: EnrichedWord[] = tokens
    .filter((t) => t.trim().length > 0)
    .map((token) => {
      const wordOnly = token.replace(/[^a-zA-Z\u0900-\u097F]/g, "").toLowerCase();
      const isDevanagari = /[\u0900-\u097F]/.test(token);
      const isComplex =
        !isDevanagari &&
        (markedWords.has(wordOnly) ||
          (wordOnly.length >= COMPLEX_WORD_THRESHOLD &&
            !ALWAYS_SIMPLE.has(wordOnly)));
      return { word: token, isComplex, hindiMeaning: undefined };
    });

  return { text: cleaned.trim(), words };
}

const translationCache = new Map<string, string>();

export async function translateWord(
  word: string,
  apiKey: string
): Promise<string> {
  const key = word.toLowerCase().trim();
  if (translationCache.has(key)) return translationCache.get(key)!;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the English word "${key}" to Hindi.
      Respond with ONLY this JSON (no markdown):
      {"hindi":"<hindi_word>","example":"<simple Hindi sentence using this word>"}`,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const clean = response.text.trim();
    let meaning = key;
    try {
      const parsed = JSON.parse(clean);
      meaning = parsed.hindi
        ? `${parsed.hindi}${parsed.example ? ` — ${parsed.example}` : ""}`
        : key;
    } catch {
      meaning = clean;
    }

    translationCache.set(key, meaning);
    return meaning;
  } catch (err) {
    console.error("Translation error:", err);
    return word;
  }
}

// ─────────────────────────────────────────────────────────────
// RECORDING — Microphone Input
// ─────────────────────────────────────────────────────────────

class MicrophoneManager {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private timer: number | null = null;

  async start(
    onChunk: (pcm: ArrayBuffer, level: number) => void
  ): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser);

    const bufferSize = 2048;
    const dataArray = new Float32Array(this.analyser.fftSize);

    const process = () => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(dataArray);
      
      const level = rmsLevel(dataArray);
      const pcm = float32ToInt16(dataArray);
      onChunk(pcm, level);
      
      this.timer = window.setTimeout(process, (bufferSize / SAMPLE_RATE) * 1000);
    };

    process();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      this.source?.disconnect();
      this.audioCtx?.close();
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch (_) {}
    this.source = null;
    this.analyser = null;
    this.audioCtx = null;
    this.stream = null;
  }
}

// ─────────────────────────────────────────────────────────────
// AUDIO PLAYOUT — Real-time PCM Streaming
// ─────────────────────────────────────────────────────────────

class PCMPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime = 0;
  private readonly sampleRate = 24000;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
  }

  async play(chunkBase64: string): Promise<void> {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();

    try {
      const binary = atob(chunkBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = this.audioCtx.createBuffer(1, float32.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      const startTime = Math.max(this.audioCtx.currentTime, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;
    } catch (e) {
      console.error("PCM Playout error:", e);
    }
  }

  stop(): void {
    this.nextStartTime = 0;
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN BRAIN — AaravBrain
// ─────────────────────────────────────────────────────────────

export class AaravBrain {
  private config: AaravConfig;
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private mic = new MicrophoneManager();
  private player: PCMPlayer | null = null;
  private audioCtx: AudioContext | null = null;
  private status: TutorStatus = "idle";
  private pendingText = "";

  constructor(config: AaravConfig) {
    this.config = {
      voiceName: "Zephyr",
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      ...config,
    };
    // Force v1beta for Live API support
    this.ai = new GoogleGenAI({ 
      apiKey: this.config.geminiApiKey,
    });
  }

  async connect(): Promise<void> {
    this.setStatus("connecting");

    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    await this.audioCtx.resume();
    this.player = new PCMPlayer(this.audioCtx);

    this.sessionPromise = this.ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.voiceName || "Zephyr" } },
        },
        systemInstruction: this.config.systemInstruction,
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: async () => {
          await this.startMic();
          this.setStatus("listening");
        },
        onmessage: async (message: LiveServerMessage) => {
          await this.handleServerMessage(message);
        },
        onerror: (err: any) => {
          console.error("Live API Error:", err);
          this.config.onError?.(err);
          this.setStatus("error");
        },
        onclose: () => {
          this.setStatus("idle");
        },
      },
    });

    await this.sessionPromise;
  }

  async disconnect(): Promise<void> {
    this.mic.stop();
    this.player?.stop();
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      await session.close();
      this.sessionPromise = null;
    }
    this.setStatus("idle");
  }

  interrupt(): void {
    this.player?.stop();
    this.pendingText = "";
    this.setStatus("listening");
  }

  private async startMic(): Promise<void> {
    await this.mic.start((pcm, level) => {
      this.config.onAudioLevel?.(level);
      if (this.sessionPromise && this.status === "listening") {
        this.sessionPromise.then((session) => {
          session.sendRealtimeInput({
            audio: {
              data: toBase64(pcm),
              mimeType: "audio/pcm;rate=16000",
            },
          });
        });
      }
    });
  }

  private async handleServerMessage(message: LiveServerMessage): Promise<void> {
    if (message.serverContent?.inputTranscription?.text) {
      this.config.onInterimTranscript?.(message.serverContent.inputTranscription.text);
    }

    const parts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.text) {
        this.pendingText += part.text;
        this.setStatus("thinking");
      }
      if (part.inlineData?.data) {
        this.setStatus("speaking");
        await this.player?.play(part.inlineData.data);
      }
    }

    if (message.serverContent?.turnComplete) {
      this.emitResponse();
      this.setStatus("listening");
    }

    if (message.serverContent?.interrupted) {
      this.interrupt();
    }
  }

  private emitResponse(): void {
    const rawText = this.pendingText.trim();
    this.pendingText = "";

    const { text, words } = enrichText(rawText || "...");

    const message: ChatMessage = {
      id: uid(),
      role: "aarav",
      text,
      originalText: rawText,
      words,
      timestamp: new Date(),
    };

    this.config.onMessageReceived?.(message);
  }

  private setStatus(s: TutorStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.config.onStatusChange?.(s);
  }

  sendTextMessage(text: string): ChatMessage {
    const msg: ChatMessage = {
      id: uid(),
      role: "user",
      text,
      timestamp: new Date(),
    };

    if (this.sessionPromise) {
      this.sessionPromise.then((session) => {
        session.sendRealtimeInput({
          text: text,
        });
      });
      this.setStatus("thinking");
    }

    return msg;
  }
}
