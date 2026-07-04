"use client";

import { BrainCircuit, Save } from "lucide-react";
import type { ReceivedEvent } from "@/lib/demo/useAgentStream";

const TYPE_BADGE = {
  episodic: "text-ev-approval border-ev-approval/30 bg-ev-approval/10",
  semantic: "text-ev-memory border-ev-memory/30 bg-ev-memory/10",
  procedural: "text-accent border-accent/30 bg-accent/10",
} as const;

export function MemoryBeat({
  op,
}: {
  op: ReceivedEvent & { type: "memory.read" | "memory.write" };
}) {
  const isRead = op.type === "memory.read";
  const fresh = op.receivedAt > 0 && Date.now() - op.receivedAt < 4000;

  return (
    <section
      className={`rounded-2xl border p-5 ${
        isRead
          ? "border-ev-memory/25 bg-gradient-to-b from-ev-memory/[0.08] to-transparent"
          : "border-accent/20 bg-gradient-to-b from-accent/[0.06] to-transparent"
      } ${fresh && isRead ? "animate-recall" : ""} ${fresh ? "animate-rise" : ""}`}
      data-testid="memory-beat"
    >
      <div className="flex items-center gap-2">
        {isRead ? (
          <BrainCircuit size={15} className="shrink-0 text-ev-memory" />
        ) : (
          <Save size={15} className="shrink-0 text-accent" />
        )}
        <span
          className={`font-display text-[10px] font-bold uppercase tracking-[0.2em] ${
            isRead ? "text-ev-memory" : "text-accent"
          }`}
        >
          {isRead ? "Memory recalled" : "Memory written"}
        </span>
        <span
          className={`rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider ${TYPE_BADGE[op.record.type]}`}
        >
          {op.record.type}
        </span>
      </div>
      <p className="mt-3 mb-0 text-[15px] leading-relaxed text-mist">{op.record.content}</p>
      {isRead ? (
        <p className="mt-2 mb-0 text-[13px] italic leading-snug text-ev-memory/75">↳ {op.why}</p>
      ) : (
        <p className="mt-2 mb-0 text-[11.5px] text-faint">source: {op.record.source}</p>
      )}
    </section>
  );
}
