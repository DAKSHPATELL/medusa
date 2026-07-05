"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Smartphone } from "lucide-react";
import type { CallView } from "@/lib/demo/useAgentStream";
import type { LiveVoiceStatus } from "@/lib/demo/useLiveVoiceSession";
import { durationLabel } from "@/lib/demo/format";
import { useRingTone } from "@/lib/demo/useRingTone";

interface IncomingCallOverlayProps {
  call: CallView;
  voiceMode: "browser" | "twilio" | "mock" | null;
  trackingNumber?: string;
  phase: "ringing" | "active" | null;
  twilioBrowserFallback: boolean;
  liveStatus: LiveVoiceStatus;
  micOn: boolean;
  muted: boolean;
  startedAt: number | null;
  onAccept: () => void;
  onDecline: () => void;
  onBrowserFallback: () => void;
  onToggleMute: () => void;
  onEndCall: () => void;
}

function RingPulse() {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden>
      <span className="absolute inset-0 rounded-full border border-ev-call/30 animate-attention" />
      <span
        className="absolute inset-2 rounded-full border border-ev-call/20 animate-breathe"
        style={{ animationDelay: "0.4s" }}
      />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-ev-call/15 text-ev-call">
        <PhoneIncoming size={28} strokeWidth={1.75} />
      </span>
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [0.5, 0.9, 0.35, 0.75, 1, 0.55, 0.85, 0.4, 0.95, 0.6, 0.8, 0.3];
  return (
    <div className="flex h-6 items-center justify-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${active ? "bg-ev-call/80 animate-wave" : "bg-white/[0.12]"}`}
          style={
            active
              ? {
                  height: `${h * 100}%`,
                  animationDelay: `${(i % 5) * 0.11}s`,
                  animationDuration: `${0.9 + (i % 4) * 0.14}s`,
                }
              : { height: "3px" }
          }
        />
      ))}
    </div>
  );
}

export function IncomingCallOverlay({
  call,
  voiceMode,
  trackingNumber,
  phase,
  twilioBrowserFallback,
  liveStatus,
  micOn,
  muted,
  startedAt,
  onAccept,
  onDecline,
  onBrowserFallback,
  onToggleMute,
  onEndCall,
}: IncomingCallOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const isRinging = phase === "ringing";
  const isActive = phase === "active";
  const showTwilioPhoneNote = voiceMode === "twilio" && !twilioBrowserFallback;

  useRingTone(isRinging);

  useEffect(() => {
    if (!isActive || !startedAt) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, startedAt]);

  if (!call.started || !phase) return null;

  const { shipperName, phone } = call.started;

  return (
    <AnimatePresence>
      <motion.div
        key={call.started.callId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-abyss/90 p-6 backdrop-blur-md sm:items-center"
        data-testid="incoming-call-overlay"
      >
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="w-full max-w-sm overflow-hidden rounded-3xl border border-ev-call/30 bg-[#0a0e14]/95 shadow-[0_0_80px_-12px_rgba(52,211,153,0.35)]"
        >
          <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center">
            {isRinging ? (
              <>
                <p className="m-0 font-display text-[10px] font-bold uppercase tracking-[0.24em] text-ev-call">
                  Incoming call
                </p>
                <div className="mt-6">
                  <RingPulse />
                </div>
                <p className="mt-6 mb-0 text-[22px] font-semibold text-mist">{shipperName}</p>
                {trackingNumber ? (
                  <p className="mt-1 mb-0 font-mono text-[12px] text-faint">{trackingNumber}</p>
                ) : null}
                <p className="mt-1 mb-0 font-mono text-[11px] text-dim">{phone}</p>
                {showTwilioPhoneNote ? (
                  <p className="mt-4 mb-0 max-w-[260px] text-[12.5px] leading-relaxed text-dim">
                    ClearBorder is calling the shipper on your phone. Answer there, or talk here for free.
                  </p>
                ) : (
                  <p className="mt-4 mb-0 text-[12.5px] text-dim">
                    Customs agent calling about shipment value
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="m-0 font-display text-[10px] font-bold uppercase tracking-[0.24em] text-ev-call">
                  {liveStatus === "connecting" ? "Connecting…" : "On call"}
                </p>
                <div className="mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-ev-call/15 text-ev-call">
                  <Phone size={26} strokeWidth={1.75} className={liveStatus === "live" ? "animate-pulse" : ""} />
                </div>
                <p className="mt-4 mb-0 text-[20px] font-semibold text-mist">{shipperName}</p>
                {trackingNumber ? (
                  <p className="mt-1 mb-0 font-mono text-[11px] text-faint">{trackingNumber}</p>
                ) : null}
                <p className="mt-2 mb-0 font-mono text-[13px] tabular-nums text-ev-call">
                  {liveStatus === "live" && startedAt ? durationLabel(elapsed) : "—:—"}
                </p>
                <div className="mt-3 w-full">
                  <Waveform active={liveStatus === "live"} />
                </div>
                <p className="mt-3 mb-0 text-[12px] text-dim">
                  {liveStatus === "connecting"
                    ? "Allow microphone when prompted"
                    : micOn
                      ? muted
                        ? "Microphone muted"
                        : "Speak — Gemini Live is listening"
                      : "Microphone unavailable"}
                </p>
              </>
            )}
          </div>

          {isRinging ? (
            <div className="space-y-3 border-t border-ev-call/15 px-6 py-5">
              {showTwilioPhoneNote ? (
                <button
                  type="button"
                  onClick={onBrowserFallback}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-accent/35 bg-accent/10 px-4 py-3 text-[13px] font-semibold text-accent transition-colors hover:bg-accent/20"
                  data-testid="call-browser-fallback"
                >
                  <Smartphone size={16} />
                  Talk here instead (free)
                </button>
              ) : null}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onDecline}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.04] px-4 py-3.5 text-[14px] font-medium text-dim transition-colors hover:border-ev-danger/40 hover:text-ev-danger"
                  data-testid="call-decline"
                >
                  <PhoneOff size={16} />
                  Decline
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ev-call/40 bg-ev-call/20 px-4 py-3.5 text-[14px] font-semibold text-ev-call transition-all hover:bg-ev-call/30"
                  data-testid="call-accept"
                >
                  <Phone size={16} />
                  Accept
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 border-t border-ev-call/15 px-6 py-5">
              <button
                type="button"
                onClick={onToggleMute}
                disabled={!micOn || liveStatus !== "live"}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-line bg-white/[0.04] text-dim transition-colors hover:border-ev-call/35 hover:text-ev-call disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={muted ? "Unmute" : "Mute"}
                data-testid="call-mute"
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="button"
                onClick={onEndCall}
                disabled={liveStatus === "done"}
                className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-ev-danger/40 bg-ev-danger/15 text-ev-danger transition-all hover:bg-ev-danger/25 disabled:opacity-50"
                aria-label="End call"
                data-testid="call-end"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
