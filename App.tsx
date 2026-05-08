// App.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Aarav English Tutor — Main Application
// Indian-Modern aesthetic: Saffron × Indigo, Baloo 2 + DM Sans
// Framer Motion: "Magic Pulse" listening animation, wave bars for speaking
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import {
  AaravBrain,
  ChatMessage,
  EnrichedWord,
  TutorStatus,
  translateWord,
  enrichText,
} from "./AaravBrain";
import "./Theme.css";

// ── ENV: set VITE_GEMINI_API_KEY in your .env file ─────────────────────────
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Rangoli Corner Ornament ───────────────────────────────────────────────────
function RangoliOrnament({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={`corner-ornament ${className ?? ""}`}
    >
      {[160, 130, 100, 70].map((r, i) => (
        <circle
          key={r}
          cx="0" cy="0" r={r}
          fill="none"
          stroke={i % 2 === 0 ? "#D4A017" : "#F4861A"}
          strokeWidth={i % 2 === 0 ? "2" : "1"}
        />
      ))}
      {[0, 22.5, 45, 67.5, 90].map((angle) => (
        <line
          key={angle}
          x1="0" y1="0"
          x2={Math.cos((angle * Math.PI) / 180) * 190}
          y2={Math.sin((angle * Math.PI) / 180) * 190}
          stroke="#D4A017"
          strokeWidth="1"
          opacity="0.6"
        />
      ))}
      {[30, 60].map((a) =>
        [60, 100, 140].map((r) => (
          <circle
            key={`${a}-${r}`}
            cx={Math.cos((a * Math.PI) / 180) * r}
            cy={Math.sin((a * Math.PI) / 180) * r}
            r="5"
            fill="#F4861A"
            opacity="0.75"
          />
        ))
      )}
    </svg>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_META: Record<TutorStatus, { label: string; dot: string; badge: string }> = {
  idle:       { label: "Taiyaar hai",   dot: "bg-saffron-400", badge: "status-idle" },
  connecting: { label: "Jud raha hai…", dot: "bg-yellow-400",  badge: "status-thinking" },
  listening:  { label: "Sun raha hai",  dot: "bg-indigo-500",  badge: "status-listening" },
  thinking:   { label: "Soch raha hai…",dot: "bg-gray-400",    badge: "status-thinking" },
  speaking:   { label: "Bol raha hai",  dot: "bg-teal",        badge: "status-speaking" },
  error:      { label: "Error",         dot: "bg-red-500",     badge: "status-thinking" },
};

function StatusBadge({ status }: { status: TutorStatus }) {
  const meta = STATUS_META[status];
  return (
    <motion.div
      layout
      className={`status-badge ${meta.badge}`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      key={status}
    >
      <motion.span
        className={`w-2 h-2 rounded-full ${meta.dot}`}
        animate={
          status === "listening" || status === "thinking"
            ? { scale: [1, 1.4, 1] }
            : { scale: 1 }
        }
        transition={{ repeat: Infinity, duration: 1.2 }}
      />
      {meta.label}
    </motion.div>
  );
}

// ── Magic Pulse Orb ───────────────────────────────────────────────────────────
interface OrbProps {
  status: TutorStatus;
  audioLevel: number;         // 0–1
  onClick: () => void;
}

const PULSE_COUNT = 3;

function MagicOrb({ status, audioLevel, onClick }: OrbProps) {
  const isListening = status === "listening";
  const isSpeaking  = status === "speaking";
  const isThinking  = status === "thinking";
  const isDisabled  = status === "connecting" || status === "error";

  const orbClass = isListening
    ? "orb-listening"
    : isSpeaking
    ? "orb-speaking"
    : isThinking
    ? "orb-thinking"
    : "orb-idle";

  // Dynamic scale from mic level when listening
  const micScale = isListening ? 1 + audioLevel * 0.18 : 1;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      {/* ── Pulse rings (listening) */}
      <AnimatePresence>
        {isListening &&
          Array.from({ length: PULSE_COUNT }).map((_, i) => (
            <motion.div
              key={`pulse-${i}`}
              className="absolute rounded-full border-2 border-indigo-500"
              style={{ width: "100%", height: "100%" }}
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{
                duration: 1.8,
                ease: "easeOut",
                delay: i * 0.55,
                repeat: Infinity,
                repeatDelay: 0,
              }}
            />
          ))}
      </AnimatePresence>

      {/* ── Wave rings (speaking) */}
      <AnimatePresence>
        {isSpeaking &&
          Array.from({ length: PULSE_COUNT }).map((_, i) => (
            <motion.div
              key={`wave-${i}`}
              className="absolute rounded-full border-2"
              style={{
                width: "100%",
                height: "100%",
                borderColor: "#0C8A7B",
              }}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{
                scale: [1, 1.5 + i * 0.2, 1],
                opacity: [0.6, 0, 0.6],
              }}
              transition={{
                duration: 1.4,
                ease: "easeInOut",
                delay: i * 0.3,
                repeat: Infinity,
              }}
            />
          ))}
      </AnimatePresence>

      {/* ── Core orb button */}
      <motion.button
        onClick={onClick}
        disabled={isDisabled}
        className={`absolute inset-0 rounded-full flex flex-col items-center justify-center
                    select-none cursor-pointer outline-none ${orbClass}`}
        animate={{
          scale: micScale,
        }}
        whileHover={!isDisabled ? { scale: micScale * 1.05 } : {}}
        whileTap={!isDisabled ? { scale: micScale * 0.94 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Icon */}
        <motion.div
          className="text-white text-4xl leading-none"
          animate={isThinking ? { rotate: [0, 15, -15, 0] } : { rotate: 0 }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        >
          {isListening
            ? "👂"
            : isSpeaking
            ? "🔊"
            : isThinking
            ? "🧠"
            : "🎙️"}
        </motion.div>

        {/* Thinking dots */}
        {isThinking && (
          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-white"
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
      </motion.button>
    </div>
  );
}

// ── Waveform Visualizer (speaking state) ──────────────────────────────────────
const BAR_COUNT = 28;

function WaveVisualizer({ active }: { active: boolean }) {
  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height: 40 }}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <motion.div
          key={i}
          className="wave-bar"
          style={{
            height: "100%",
            background: `linear-gradient(to top, #0C8A7B, #4ecdc4)`,
          }}
          animate={
            active
              ? {
                  scaleY: [
                    0.15,
                    0.3 + Math.random() * 0.7,
                    0.15 + Math.random() * 0.4,
                    0.8,
                    0.15,
                  ],
                }
              : { scaleY: 0.12 }
          }
          transition={{
            repeat: Infinity,
            duration: 0.6 + (i % 5) * 0.08,
            delay: (i / BAR_COUNT) * 0.4,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ── Word Pill (Tap to Translate) ──────────────────────────────────────────────
function WordPill({
  word,
  apiKey,
}: {
  word: EnrichedWord;
  apiKey: string;
  key?: React.Key;
}) {
  const [meaning, setMeaning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);

  const handleTap = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (!meaning && !loading) {
      setLoading(true);
      try {
        const m = await translateWord(word.word.replace(/[^a-zA-Z]/g, ""), apiKey);
        setMeaning(m);
      } catch {
        setMeaning("अर्थ नहीं मिला");
      } finally {
        setLoading(false);
      }
    }
  };

  if (!word.isComplex) {
    return <span>{word.word} </span>;
  }

  return (
    <span className="word-pill" onClick={handleTap} role="button" tabIndex={0}>
      {word.word}
      <AnimatePresence>
        {open && (
          <motion.div
            className="translate-tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.18 }}
          >
            {loading ? "…" : meaning ?? ""}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── Chat Bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg, apiKey }: { msg: ChatMessage; apiKey: string; key?: React.Key }) {
  const isUser = msg.role === "user";

  return (
    <motion.div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-9 h-9 rounded-full flex-shrink-0 mr-2 mt-1 flex items-center justify-center text-base"
             style={{ background: "linear-gradient(135deg,#FFA630,#F4861A)" }}>
          🦁
        </div>
      )}

      <div
        className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed ${
          isUser ? "bubble-user" : "bubble-aarav"
        }`}
      >
        {/* Role label */}
        <div className="section-label mb-1">
          {isUser ? "Aap" : "Aarav"}
        </div>

        {/* Text — enriched with word pills for Aarav */}
        <div className="font-body">
          {isUser || !msg.words ? (
            <span style={{ fontFamily: "var(--font-devanagari, sans-serif)" }}>
              {msg.text}
            </span>
          ) : (
            msg.words.map((w, i) => (
              <WordPill key={i} word={w} apiKey={apiKey} />
            ))
          )}
        </div>

        {/* Timestamp */}
        <div className="text-[10px] mt-1.5 opacity-40 text-right">
          {msg.timestamp.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-9 h-9 rounded-full flex-shrink-0 ml-2 mt-1 flex items-center justify-center text-base"
             style={{ background: "linear-gradient(135deg,#4361EE,#2541C4)" }}>
          🙋
        </div>
      )}
    </motion.div>
  );
}

// ── Interim Transcript Banner ─────────────────────────────────────────────────
function InterimBanner({ text }: { text: string }) {
  if (!text) return null;
  return (
    <motion.div
      className="flex justify-end px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="max-w-[78%] px-4 py-2 rounded-2xl rounded-br-md text-sm italic"
           style={{
             background: "rgba(67,97,238,0.08)",
             border: "1.5px dashed rgba(67,97,238,0.3)",
             color: "var(--text-secondary)",
             fontFamily: "var(--font-devanagari, sans-serif)",
           }}>
        {text}…
      </div>
    </motion.div>
  );
}

// ── Text Input Fallback ───────────────────────────────────────────────────────
function TextFallback({
  onSend,
  disabled,
}: {
  onSend: (t: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="flex gap-2 items-center px-4 pb-2">
      <input
        className="input-hinglish flex-1 text-sm"
        placeholder="Type karein (Hindi ya English)…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={disabled}
        style={{ fontFamily: "var(--font-devanagari, sans-serif)" }}
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="btn-primary !px-4 !py-3 text-base disabled:opacity-40"
        title="Send"
      >
        ➤
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [status, setStatus]       = useState<TutorStatus>("idle");
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [interim, setInterim]     = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError]         = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const brainRef   = useRef<AaravBrain | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interim]);

  // ── Auto-dismiss error
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Initialise AaravBrain
  const initBrain = useCallback(() => {
    brainRef.current = new AaravBrain({
      geminiApiKey: API_KEY,
      onStatusChange: setStatus,
      onMessageReceived: (msg) =>
        setMessages((prev) => [...prev, msg]),
      onInterimTranscript: setInterim,
      onAudioLevel: setAudioLevel,
      onError: (err) => setError(err.message),
    });
  }, []);

  const handleUnlockAudio = () => {
    // Create and resume a dummy context to satisfy browser requirements
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.resume();
    setAudioUnlocked(true);
  };

  // ── Connect / Disconnect toggle
  const handleOrbClick = async () => {
    if (!audioUnlocked) return;
    if (connected) {
      // Interrupt or disconnect
      if (status === "speaking" || status === "thinking") {
        brainRef.current?.interrupt();
      } else {
        await brainRef.current?.disconnect();
        setConnected(false);
        setInterim("");
      }
      return;
    }

    if (!API_KEY) {
      setError("Gemini API key nahi mila! .env mein VITE_GEMINI_API_KEY set karein.");
      return;
    }

    initBrain();
    try {
      await brainRef.current!.connect();
      setConnected(true);

      // Greet on first connect
      if (messages.length === 0) {
        setMessages([
          {
            id: "welcome",
            role: "aarav",
            text: "Namaste! 🙏 Main Aarav hoon, aapka English **tutor**. Koi bhi sawaal poochein — main **Hindi** mein samjhaunga!",
            words: enrichText(
              "Namaste! 🙏 Main Aarav hoon, aapka English **tutor**. Koi bhi sawaal poochein — main **Hindi** mein samjhaunga!"
            ).words,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setError("Connect nahi ho saka. Dobara try karein.");
    }
  };

  // ── Text fallback
  const handleTextSend = (text: string) => {
    if (!brainRef.current || !connected) return;
    const userMsg = brainRef.current.sendTextMessage(text);
    setMessages((prev) => [...prev, userMsg]);
    setInterim("");
  };

  // ── Clear chat
  const handleClear = () => {
    setMessages([]);
    setInterim("");
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="relative flex flex-col min-h-dvh overflow-hidden">
      {/* Background */}
      <div className="aarav-bg" />

      {/* Rangoli corners */}
      <RangoliOrnament className="tl" />
      <RangoliOrnament className="br" />

      {/* ── Main Content ── */}
      <div className="relative z-10 flex flex-col min-h-dvh max-w-lg mx-auto w-full px-4">

        {/* ── Audio Unlock Overlay */}
        <AnimatePresence>
          {!audioUnlocked && (
            <motion.div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: "rgba(254, 251, 244, 0.95)" }}
            >
              <div className="text-center max-w-xs transition-all">
                <div className="text-6xl mb-6">🎙️</div>
                <h2 className="font-display font-bold text-2xl mb-2" style={{ color: "var(--color-saffron-600)" }}>
                  Aarav se baat karein?
                </h2>
                <p className="text-sm mb-8 text-muted" style={{ fontFamily: "var(--font-devanagari)" }}>
                  शुरू करने के लिए ऑडियो चालू करें।<br/>
                  (Enable audio to start learning!)
                </p>
                <button
                  onClick={handleUnlockAudio}
                  className="btn-primary w-full shadow-warm"
                >
                  Enable Audio
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header */}
        <motion.header
          className="flex items-center justify-between pt-6 pb-3"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-warm"
              style={{
                background: "linear-gradient(135deg,#FFA630,#F4861A)",
                boxShadow: "var(--shadow-warm)",
              }}
            >
              🦁
            </div>
            <div>
              <h1
                className="font-display font-extrabold text-2xl leading-none text-gradient-saffron"
              >
                Aarav
              </h1>
              <p className="text-[11px] font-body text-muted mt-0.5"
                 style={{ color: "var(--text-muted)" }}>
                English Sikho • Learn English
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs px-3 py-1.5 rounded-xl transition-all hover:bg-black/5"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
              >
                Clear
              </button>
            )}
          </div>
        </motion.header>

        {/* ── Divider */}
        <div className="h-px w-full" style={{ background: "var(--border-warm)" }} />

        {/* ── Chat Area */}
        <div className="chat-scroll flex-1 overflow-y-auto py-4 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.length === 0 && status === "idle" ? (
              /* Empty state */
              <motion.div
                className="flex-1 flex flex-col items-center justify-center text-center py-20 gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="text-6xl"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                >
                  🪔
                </motion.div>
                <h2
                  className="font-display font-bold text-2xl"
                  style={{ color: "var(--teal)" }}
                >
                  Aarav se baat karein!
                </h2>
                <p
                  className="text-sm max-w-[260px] leading-relaxed"
                  style={{ color: "var(--text-muted)", fontFamily: "var(--font-devanagari)" }}
                >
                  नीचे का बटन दबाएं और English सीखना शुरू करें।
                  <br />
                  <span style={{ fontFamily: "var(--font-body)" }}>
                    (Press the button below to start!)
                  </span>
                </p>
              </motion.div>
            ) : (
              messages.map((msg) => (
                <ChatBubble key={msg.id} msg={msg} apiKey={API_KEY} />
              ))
            )}
          </AnimatePresence>

          {/* Interim transcript */}
          <AnimatePresence>
            {interim && <InterimBanner text={interim} />}
          </AnimatePresence>

          <div ref={chatEndRef} />
        </div>

        {/* ── Waveform (speaking) */}
        <AnimatePresence>
          {status === "speaking" && (
            <motion.div
              className="py-2"
              initial={{ opacity: 0, scaleY: 0.5 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.5 }}
            >
              <WaveVisualizer active />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Central Orb + CTA */}
        <div className="flex flex-col items-center gap-4 pt-4 pb-2">
          <MagicOrb
            status={status}
            audioLevel={audioLevel}
            onClick={handleOrbClick}
          />

          {/* CTA Label */}
          <motion.p
            key={status}
            className="font-display font-semibold text-base"
            style={{ color: "var(--text-secondary)" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {status === "idle" && !connected
              ? "🎙️ Aarav se baat karein"
              : status === "listening"
              ? "Boliye… Aarav sun raha hai"
              : status === "thinking"
              ? "Soch raha hai…"
              : status === "speaking"
              ? "Tap to stop"
              : status === "connecting"
              ? "Connect ho raha hai…"
              : "Taiyaar"}
          </motion.p>

          {/* Hint: tap to translate */}
          {messages.some((m) => m.role === "aarav" && m.words?.some((w) => w.isComplex)) && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              💡 Orange wale words tap karein — Hindi meaning dekhein!
            </p>
          )}
        </div>

        {/* ── Text Fallback Input */}
        {connected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pb-4"
          >
            <TextFallback
              onSend={handleTextSend}
              disabled={status === "thinking" || status === "speaking"}
            />
          </motion.div>
        )}
      </div>

      {/* ── Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm shadow-lg"
            style={{ background: "#B5500A", maxWidth: "90vw" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            ⚠️ {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}