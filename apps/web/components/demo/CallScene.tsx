"use client";

import { PhoneCall, PhoneOff } from "lucide-react";
import type { CallView } from "@/lib/demo/useAgentStream";
import { durationLabel } from "@/lib/demo/format";

function Waveform({ active }: { active: boolean }) {
  const bars = [
    0.5, 0.9, 0.35, 0.75, 1, 0.55, 0.85, 0.4, 0.95, 0.6, 0.8, 0.3, 0.7, 0.9, 0.45, 0.65, 0.85,
    0.5, 0.75, 0.4, 0.9, 0.55, 0.35, 0.8,
  ];
  return (
    <div className="flex h-8 items-center justify-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${active ? "bg-ev-call/80 animate-wave" : "bg-white/[0.12]"}`}
          style={
            active
              ? {
                  height: `${h * 100}%`,
                  animationDelay: `${(i % 7) * 0.11}s`,
                  animationDuration: `${0.9 + (i % 5) * 0.14}s`,
                }
              : { height: "3px" }
          }
        />
      ))}
    </div>
  );
}

export function CallScene({ call }: { call: CallView }) {
  if (!call.started) return null;

  const { started, ended, transcripts, live } = call;
  const lastEvent = transcripts[transcripts.length - 1];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-ev-call/25 bg-gradient-to-b from-ev-call/[0.06] to-transparent"
      data-testid="call-scene"
    >
      <div className="border-b border-ev-call/15 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="m-0 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-ev-call">
              Multilingual call
            </p>
            <p className="mt-1.5 m-0 text-[17px] font-semibold text-mist">{started.shipperName}</p>
            <p className="m-0 mt-0.5 font-mono text-[11px] text-faint">{started.phone}</p>
          </div>
          <div className="shrink-0 text-right">
            {live ? (
              <span className="flex items-center gap-1.5 rounded-full border border-ev-call/35 bg-ev-call/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-ev-call">
                <PhoneCall size={11} />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-dim">
                <PhoneOff size={11} />
                Ended {ended ? `· ${durationLabel(ended.durationSec)}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-ev-call/30 bg-ev-call/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ev-call">
            {started.sourceLang}
          </span>
          <span className="text-[11px] text-faint">⇄</span>
          <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent">
            {started.targetLang}
          </span>
          <span className="text-[10.5px] text-faint">realtime translation</span>
        </div>
        <div className="mt-2">
          <Waveform active={live} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-line/60 px-5 py-2">
        <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.2em] text-dim">
          Original
        </span>
        <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.2em] text-accent">
          Translation
        </span>
      </div>

      <div
        className="demo-scroll max-h-[420px] space-y-4 overflow-y-auto px-5 py-4"
        data-testid="call-transcript"
      >
        {transcripts
          .filter((t, i) => t.type === "call.transcript_final" || i === transcripts.length - 1)
          .map((t) => {
            const partial = t.type === "call.transcript_partial";
            const agentSide = t.speaker === "agent";
            return (
              <div key={t.id} className={`grid grid-cols-2 gap-4 ${partial ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <span
                    className={`mb-1 inline-block rounded px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wider ${
                      agentSide ? "bg-accent/15 text-accent" : "bg-ev-call/15 text-ev-call"
                    }`}
                  >
                    {agentSide ? "Agent" : "Shipper"}
                  </span>
                  <p className="m-0 text-[13.5px] leading-relaxed text-dim">
                    {t.sourceText}
                    {partial ? (
                      <span className="ml-0.5 inline-block h-[1em] w-[6px] translate-y-[2px] bg-ev-call/70 animate-caret" />
                    ) : null}
                  </p>
                </div>
                <div className="min-w-0 border-l border-line pl-4">
                  <span className="mb-1 inline-block font-mono text-[9px] font-semibold uppercase tracking-wider text-faint">
                    {t.targetLang}
                  </span>
                  <p className="m-0 text-[13.5px] leading-relaxed text-mist">
                    {t.translatedText}
                    {partial ? (
                      <span className="ml-0.5 inline-block h-[1em] w-[6px] translate-y-[2px] bg-accent/70 animate-caret" />
                    ) : null}
                  </p>
                </div>
              </div>
            );
          })}
        {ended?.summary ? (
          <div className="rounded-lg border border-line bg-white/[0.025] px-4 py-3">
            <p className="m-0 font-display text-[9.5px] font-bold uppercase tracking-[0.2em] text-dim">
              Call summary
            </p>
            <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-dim">{ended.summary}</p>
          </div>
        ) : null}
        {lastEvent === undefined && live ? (
          <p className="m-0 text-center text-[12px] text-faint">Connecting…</p>
        ) : null}
      </div>
    </section>
  );
}
