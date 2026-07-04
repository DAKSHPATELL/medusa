"use client";

import type { CaseRecord, DemoState, Shipper } from "@clearborder/shared";
import { Wordmark } from "./Logo";
import { flagEmoji, shortTimeOf } from "@/lib/dashboard/format";

function AgentStateChip({ demo }: { demo: DemoState | null }) {
  const status = demo?.agentStatus ?? "idle";

  if (status === "sleeping") {
    return (
      <span className="flex items-center gap-2 rounded-full border border-ev-sleep/30 bg-ev-sleep/10 px-3.5 py-1.5 text-[12px] font-medium text-ev-sleep">
        <span className="relative flex h-2 w-2">
          <span className="h-2 w-2 rounded-full bg-ev-sleep animate-breathe" />
        </span>
        Sleeping
        {demo?.sleepUntil ? (
          <span className="font-mono text-[10.5px] text-ev-sleep/70">
            until {shortTimeOf(demo.sleepUntil)}
          </span>
        ) : null}
      </span>
    );
  }
  if (status === "awaiting_approval") {
    return (
      <span className="flex items-center gap-2 rounded-full border border-ev-approval/35 bg-ev-approval/10 px-3.5 py-1.5 text-[12px] font-medium text-ev-approval">
        <span className="h-2 w-2 rounded-full bg-ev-approval animate-pulse-dot" />
        Awaiting approval
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-[12px] font-medium text-accent">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
        Active
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-[12px] font-medium text-dim">
      <span className="h-2 w-2 rounded-full bg-faint" />
      Standing by
    </span>
  );
}

export function TopBar({
  demo,
  selectedCase,
  shipper,
  connected,
}: {
  demo: DemoState | null;
  selectedCase: CaseRecord | null;
  shipper: Shipper | null;
  connected: boolean;
}) {
  return (
    <header className="flex h-[62px] shrink-0 items-center justify-between gap-6 px-5">
      <div className="flex min-w-0 items-center gap-8">
        <Wordmark />
        {selectedCase ? (
          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <span className="text-[13px] font-mono text-dim">
              Case <span className="text-mist font-semibold">#{selectedCase.reference}</span>
            </span>
            <span className="h-3.5 w-px bg-line" />
            <span className="truncate text-[13px] text-dim">
              {shipper ? `${flagEmoji(shipper.countryCode)} ${shipper.name}` : ""}
              <span className="mx-1.5 text-faint">→</span>
              {flagEmoji(selectedCase.consignee.countryCode)} {selectedCase.consignee.name}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-5">
        <div className="flex items-baseline gap-2" title="Demo day">
          <span className="font-display text-[11px] font-medium uppercase tracking-[0.3em] text-dim">
            Day
          </span>
          <span
            key={demo?.day ?? 0}
            className="font-display text-[30px] font-bold leading-none text-mist tabular-nums animate-rise"
          >
            {demo?.day ?? "–"}
          </span>
          <span className="font-display text-[13px] text-faint">/ 3</span>
        </div>
        <span className="h-6 w-px bg-line" />
        <AgentStateChip demo={demo} />
        <span
          className="flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-wider text-faint"
          title={connected ? "Live link to agent service" : "Reconnecting to agent service"}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-ev-call" : "bg-ev-danger animate-pulse-dot"}`}
          />
          {connected ? "Link" : "Re-link"}
        </span>
      </div>
    </header>
  );
}
