"use client";

import { BrainCircuit, Save } from "lucide-react";
import type { ReceivedEvent } from "@/lib/dashboard/useAgentStream";
import { timeOf } from "@/lib/dashboard/format";

const TYPE_BADGE = {
  episodic: "text-ev-approval border-ev-approval/30 bg-ev-approval/10",
  semantic: "text-ev-memory border-ev-memory/30 bg-ev-memory/10",
  procedural: "text-accent border-accent/30 bg-accent/10",
} as const;

export function MemoryPanel({
  ops,
  reads,
  writes,
}: {
  ops: Array<ReceivedEvent & { type: "memory.read" | "memory.write" }>;
  reads: number;
  writes: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Counters */}
      <div className="grid grid-cols-2 gap-3 border-b border-line px-4 py-3">
        <div className="rounded-lg border border-ev-memory/25 bg-ev-memory/[0.07] px-3 py-2">
          <p className="m-0 font-display text-[9px] font-bold uppercase tracking-[0.2em] text-ev-memory/80">
            Recalls
          </p>
          <p className="m-0 font-display text-[22px] font-bold leading-tight text-ev-memory tabular-nums">
            {reads}
          </p>
        </div>
        <div className="rounded-lg border border-accent/25 bg-accent/[0.07] px-3 py-2">
          <p className="m-0 font-display text-[9px] font-bold uppercase tracking-[0.2em] text-accent/80">
            Writes
          </p>
          <p className="m-0 font-display text-[22px] font-bold leading-tight text-accent tabular-nums">
            {writes}
          </p>
        </div>
      </div>

      {/* Memory cards, newest first */}
      <div className="dash-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3" data-testid="memory-ops">
        {ops.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <BrainCircuit size={26} className="text-faint" />
            <p className="m-0 text-[13px] text-dim">No memory activity yet.</p>
            <p className="m-0 text-[11.5px] leading-relaxed text-faint">
              Recalled facts and new long-term memories appear here as the agent works.
            </p>
          </div>
        ) : (
          [...ops].reverse().map((op) => {
            const isRead = op.type === "memory.read";
            const fresh = op.receivedAt > 0 && Date.now() - op.receivedAt < 4000;
            return (
              <div
                key={op.id}
                className={`rounded-xl border p-3 ${
                  isRead ? "border-ev-memory/25 bg-ev-memory/[0.05]" : "border-accent/20 bg-accent/[0.04]"
                } ${fresh && isRead ? "animate-recall" : ""} ${fresh ? "animate-rise" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {isRead ? (
                    <BrainCircuit size={13} className="shrink-0 text-ev-memory" />
                  ) : (
                    <Save size={13} className="shrink-0 text-accent" />
                  )}
                  <span
                    className={`font-display text-[9.5px] font-bold uppercase tracking-[0.18em] ${
                      isRead ? "text-ev-memory" : "text-accent"
                    }`}
                  >
                    {isRead ? "Recalled" : "Written"}
                  </span>
                  <span
                    className={`rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider ${TYPE_BADGE[op.record.type]}`}
                  >
                    {op.record.type}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[9.5px] text-faint">
                    {timeOf(op.at)}
                  </span>
                </div>
                <p className="mt-2 mb-0 text-[12px] leading-relaxed text-mist">
                  {op.record.content}
                </p>
                {isRead ? (
                  <p className="mt-1.5 mb-0 text-[11px] italic leading-snug text-ev-memory/75">
                    ↳ {op.why}
                  </p>
                ) : (
                  <p className="mt-1.5 mb-0 text-[10.5px] text-faint">
                    source: {op.record.source}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
