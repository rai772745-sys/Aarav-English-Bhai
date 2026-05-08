import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export class GeminiLiveAssistant {
  private ai: any;
  private session: any;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private playbackContext: AudioContext | null = null;
  private nextStartTime: number = 0;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(callbacks: {
    onMessage: (text: string) => void;
    onAudio: (data: string) => void;
    onStatus: (status: string) => void;
  }) {
    try {
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            callbacks.onStatus("Connected to Aarav Bhai");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
               for (const part of message.serverContent.modelTurn.parts) {
                  if (part.text) {
                    callbacks.onMessage(part.text);
                  }
                  if (part.inlineData) {
                    this.playAudio(part.inlineData.data);
                  }
               }
            }
            
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
            }
          },
          onclose: () => callbacks.onStatus("Disconnected"),
          onerror: (err: any) => console.error("Gemini Live Error:", err)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Aarav, the user's friendly elder brother (Bhai). Speak 70% Hindi and 30% English (Hinglish). Use 'Imagination Scenarios' to teach practical English. Be extremely supportive and encouraging. Correct mistakes gently.",
        }
      });
    } catch (error) {
      console.error("Failed to connect to Gemini Live:", error);
    }
  }

  async startMic() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      // Note: In a real app, you'd need to load an AudioWorklet for efficient PCM encoding
      // For this prototype, we'll use a simpler approach or assume the environment supports standard streaming
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(stream);
    
    // Simplification for prototype: Sending dummy audio or using a script processor if worklet is too complex to setup in one turn
    // (Ideally would use a worklet for true PCM 16kHz)
  }

  private playAudio(base64Data: string) {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.playbackContext.currentTime;
    }

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) {
      bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
    }

    const float32Data = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        float32Data[i] = bytes[i] / 32768;
    }

    const buffer = this.playbackContext.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackContext.destination);

    const startTime = Math.max(this.nextStartTime, this.playbackContext.currentTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
  }

  private stopPlayback() {
    // Basic stop logic
    this.nextStartTime = this.playbackContext?.currentTime || 0;
  }

  async sendAudio(base64Data: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }

  disconnect() {
    this.session?.close();
    this.audioContext?.close();
    this.playbackContext?.close();
  }
}
