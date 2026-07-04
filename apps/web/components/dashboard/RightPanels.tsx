"use client";

import { useEffect, useRef, useState } from "react";
import { AppWindow, BrainCircuit, PhoneCall } from "lucide-react";
import type { StreamState } from "@/lib/dashboard/useAgentStream";
import { useDerived } from "@/lib/dashboard/useAgentStream";
import { BrowserPanel } from "./panels/BrowserPanel";
import { CallPanel } from "./panels/CallPanel";
import { MemoryPanel } from "./panels/MemoryPanel";

type TabKey = "call" | "browser" | "memory";

const TABS: Array<{ key: TabKey; label: string; icon: typeof PhoneCall }> = [
  { key: "call", label: "Live Call", icon: PhoneCall },
  { key: "browser", label: "Browser", icon: AppWindow },
  { key: "memory", label: "Memory", icon: BrainCircuit },
];

/** How long a manual tab choice suppresses auto-follow (ms). */
const MANUAL_HOLD = 45_000;

export function RightPanels({
  state,
  selectedCaseId,
}: {
  state: StreamState;
  selectedCaseId: string | null;
}) {
  const derived = useDerived(state, selectedCaseId);
  const [tab, setTab] = useState<TabKey>("browser");
  const manualUntilRef = useRef(0);
  const lastSeqRef = useRef(0);

  // Auto-follow the story: switch tab toward the latest fresh event burst.
  const events = derived.caseEvents;
  useEffect(() => {
    const latest = events[events.length - 1];
    if (!latest || latest.seq === lastSeqRef.current) return;
    lastSeqRef.current = latest.seq;
    if (latest.receivedAt === 0) return; // backlog, not live
    if (Date.now() < manualUntilRef.current) return;
    if (latest.type.startsWith("call.")) setTab("call");
    else if (latest.type.startsWith("browser.")) setTab("browser");
    else if (latest.type.startsWith("memory.")) setTab("memory");
  }, [events]);

  const counts: Record<TabKey, number | null> = {
    call: derived.call.transcripts.filter((t) => t.type === "call.transcript_final").length || null,
    browser: derived.browser.recentActions.length || null,
    memory: derived.memory.ops.length || null,
  };

  return (
    <aside className="glass flex min-h-0 flex-col overflow-hidden">
      <div className="flex border-b border-line px-2 pt-2" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const live =
            (key === "call" && derived.call.live) ||
            (key === "memory" &&
              derived.memory.ops.some((o) => o.receivedAt > 0 && Date.now() - o.receivedAt < 4000));
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              data-testid={`panel-tab-${key}`}
              onClick={() => {
                setTab(key);
                manualUntilRef.current = Date.now() + MANUAL_HOLD;
              }}
              className={`relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-t-lg px-3 py-2.5 text-[12px] font-medium transition-colors ${
                active
                  ? "border-b-2 border-accent bg-white/[0.04] text-mist"
                  : "border-b-2 border-transparent text-dim hover:text-mist"
              }`}
            >
              <Icon size={13.5} className={active ? "text-accent" : ""} />
              {label}
              {counts[key] !== null ? (
                <span className="rounded-full border border-line bg-white/[0.05] px-1.5 py-px font-mono text-[9.5px] text-dim">
                  {counts[key]}
                </span>
              ) : null}
              {live ? (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-ev-call animate-pulse-dot" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {tab === "call" ? <CallPanel call={derived.call} /> : null}
        {tab === "browser" ? (
          <BrowserPanel
            lastShot={derived.browser.lastShot}
            lastAction={derived.browser.lastAction}
            recentActions={derived.browser.recentActions}
          />
        ) : null}
        {tab === "memory" ? (
          <MemoryPanel
            ops={derived.memory.ops}
            reads={derived.memory.reads}
            writes={derived.memory.writes}
          />
        ) : null}
      </div>
    </aside>
  );
}
