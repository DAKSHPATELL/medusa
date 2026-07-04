"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  Compass,
  Keyboard,
  MousePointerClick,
  ShieldCheck,
  ShieldX,
  Sparkles,
} from "lucide-react";
import type { CaseStatus } from "@clearborder/shared";
import { CASE_STATUS_LABEL } from "@clearborder/shared";
import type { ReceivedEvent } from "@/lib/demo/useAgentStream";
import { timeOf } from "@/lib/demo/format";
import { Typewriter } from "./Typewriter";

function StatusChip({ status }: { status: CaseStatus }) {
  return (
    <span className="rounded-md border border-line bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-mist">
      {CASE_STATUS_LABEL[status]}
    </span>
  );
}

function meta(event: ReceivedEvent): { icon: LucideIcon; label: string; hue: string } | null {
  switch (event.type) {
    case "case.status_changed":
      return { icon: ArrowRightLeft, label: "Status", hue: "text-ev-status" };
    case "agent.thought":
      return { icon: Sparkles, label: "Agent", hue: "text-accent" };
    case "browser.action":
      return {
        icon:
          event.action === "navigate"
            ? Compass
            : event.action === "type"
              ? Keyboard
              : MousePointerClick,
        label: "Portal",
        hue: "text-ev-browser",
      };
    case "approval.granted":
      return { icon: ShieldCheck, label: "Approved", hue: "text-ev-call" };
    case "approval.rejected":
      return { icon: ShieldX, label: "Rejected", hue: "text-ev-danger" };
    default:
      return null;
  }
}

export function StoryBeat({
  event,
  isLatest,
}: {
  event: ReceivedEvent;
  isLatest: boolean;
}) {
  const fresh = event.receivedAt > 0 && Date.now() - event.receivedAt < 30_000;
  const m = meta(event);

  if (event.type === "agent.thought") {
    return (
      <blockquote
        className={`border-l-2 border-accent/40 py-1 pl-5 ${fresh ? "animate-rise" : ""}`}
      >
        <p className="m-0 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-accent/80">
          ClearBorder
        </p>
        <p className="mt-2 mb-0 text-[17px] leading-relaxed text-mist">
          <Typewriter text={event.text} active={fresh && isLatest} />
        </p>
      </blockquote>
    );
  }

  if (!m) return null;

  let body: ReactNode = null;
  switch (event.type) {
    case "case.status_changed":
      body = (
        <>
          <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] text-dim">
            <StatusChip status={event.from} />
            <span className="text-faint">→</span>
            <StatusChip status={event.to} />
          </p>
          {event.reason ? (
            <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-dim">{event.reason}</p>
          ) : null}
        </>
      );
      break;
    case "browser.action":
      body = <p className="m-0 text-[14px] leading-relaxed text-mist">{event.description}</p>;
      break;
    case "approval.granted":
      body = (
        <p className="m-0 text-[14px] text-dim">
          Approved — the agent continues with the staged submission.
        </p>
      );
      break;
    case "approval.rejected":
      body = (
        <p className="m-0 text-[14px] text-dim">
          Rejected{event.reason ? ` — ${event.reason}` : " — action abandoned."}
        </p>
      );
      break;
  }

  return (
    <div className={`flex gap-3 ${fresh ? "animate-rise" : ""}`}>
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
        <m.icon size={14} className={m.hue} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className={`font-display text-[10px] font-semibold uppercase tracking-[0.16em] ${m.hue}`}>
            {m.label}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-faint">{timeOf(event.at)}</span>
        </div>
        {body}
      </div>
    </div>
  );
}
