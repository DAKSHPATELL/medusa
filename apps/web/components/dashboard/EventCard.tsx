"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  BrainCircuit,
  Camera,
  Compass,
  Keyboard,
  Languages,
  Moon,
  MousePointerClick,
  PhoneOff,
  PhoneOutgoing,
  Save,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Sunrise,
} from "lucide-react";
import type { AgentEvent, CaseStatus } from "@clearborder/shared";
import { CASE_STATUS_LABEL } from "@clearborder/shared";
import type { ReceivedEvent } from "@/lib/dashboard/useAgentStream";
import { timeOf } from "@/lib/dashboard/format";
import { Typewriter } from "./Typewriter";

type Hue = "status" | "call" | "browser" | "memory" | "approval" | "sleep" | "danger";

const HUE_TEXT: Record<Hue, string> = {
  status: "text-ev-status",
  call: "text-ev-call",
  browser: "text-ev-browser",
  memory: "text-ev-memory",
  approval: "text-ev-approval",
  sleep: "text-ev-sleep",
  danger: "text-ev-danger",
};

const HUE_CHIP: Record<Hue, string> = {
  status: "border-ev-status/25 bg-ev-status/10",
  call: "border-ev-call/25 bg-ev-call/10",
  browser: "border-ev-browser/25 bg-ev-browser/10",
  memory: "border-ev-memory/25 bg-ev-memory/10",
  approval: "border-ev-approval/25 bg-ev-approval/10",
  sleep: "border-ev-sleep/25 bg-ev-sleep/10",
  danger: "border-ev-danger/25 bg-ev-danger/10",
};

function meta(event: AgentEvent): { icon: LucideIcon; hue: Hue; label: string } {
  switch (event.type) {
    case "case.status_changed":
      return { icon: ArrowRightLeft, hue: "status", label: "Status change" };
    case "agent.thought":
      return { icon: Sparkles, hue: "status", label: "Agent reasoning" };
    case "call.started":
      return { icon: PhoneOutgoing, hue: "call", label: "Call started" };
    case "call.transcript_partial":
    case "call.transcript_final":
      return { icon: Languages, hue: "call", label: "Live translation" };
    case "call.ended":
      return { icon: PhoneOff, hue: "call", label: "Call ended" };
    case "browser.action":
      return {
        icon:
          event.action === "navigate" ? Compass : event.action === "type" ? Keyboard : MousePointerClick,
        hue: "browser",
        label: "Browser action",
      };
    case "browser.screenshot":
      return { icon: Camera, hue: "browser", label: "Screen capture" };
    case "memory.read":
      return { icon: BrainCircuit, hue: "memory", label: "Memory recall" };
    case "memory.write":
      return { icon: Save, hue: "memory", label: "Memory write" };
    case "approval.requested":
      return { icon: ShieldAlert, hue: "approval", label: "Approval requested" };
    case "approval.granted":
      return { icon: ShieldCheck, hue: "approval", label: "Approved" };
    case "approval.rejected":
      return { icon: ShieldX, hue: "danger", label: "Rejected" };
    case "agent.sleep":
      return { icon: Moon, hue: "sleep", label: "Agent sleeping" };
    case "agent.wake":
      return { icon: Sunrise, hue: "sleep", label: "Agent woke up" };
  }
}

function StatusChip({ status }: { status: CaseStatus }) {
  return (
    <span className="rounded-md border border-line bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-mist">
      {CASE_STATUS_LABEL[status]}
    </span>
  );
}

function MemoryTypeBadge({ type }: { type: "episodic" | "semantic" | "procedural" }) {
  const styles = {
    episodic: "text-ev-approval border-ev-approval/30 bg-ev-approval/10",
    semantic: "text-ev-memory border-ev-memory/30 bg-ev-memory/10",
    procedural: "text-accent border-accent/30 bg-accent/10",
  } as const;
  return (
    <span
      className={`rounded-full border px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider ${styles[type]}`}
    >
      {type}
    </span>
  );
}

function Body({ event, fresh }: { event: ReceivedEvent; fresh: boolean }) {
  switch (event.type) {
    case "case.status_changed":
      return (
        <div>
          <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] text-dim">
            <StatusChip status={event.from} />
            <span className="text-faint">→</span>
            <StatusChip status={event.to} />
          </p>
          {event.reason ? (
            <p className="mt-1.5 mb-0 text-[12.5px] leading-relaxed text-dim">{event.reason}</p>
          ) : null}
        </div>
      );
    case "agent.thought":
      return (
        <p className="m-0 text-[13.5px] leading-relaxed text-mist">
          <Typewriter text={event.text} active={fresh} />
        </p>
      );
    case "call.started":
      return (
        <div className="text-[13px] text-dim">
          <p className="m-0">
            Dialing <span className="font-medium text-mist">{event.shipperName}</span>
            <span className="ml-2 font-mono text-[11.5px] text-faint">{event.phone}</span>
          </p>
          <p className="mt-1.5 mb-0 flex items-center gap-1.5">
            <span className="rounded-md border border-ev-call/30 bg-ev-call/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-ev-call">
              {event.sourceLang}
            </span>
            <span className="text-faint">⇄</span>
            <span className="rounded-md border border-ev-call/30 bg-ev-call/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-ev-call">
              {event.targetLang}
            </span>
            <span className="ml-1 text-[11.5px] text-faint">live translation</span>
          </p>
        </div>
      );
    case "call.transcript_final": {
      // Lead with the operator-language side (English), original underneath.
      const agentSide = event.speaker === "agent";
      const primary = agentSide ? event.sourceText : event.translatedText;
      const secondary = agentSide ? event.translatedText : event.sourceText;
      return (
        <div className="text-[13px]">
          <p className="m-0 leading-relaxed text-mist">
            <span
              className={`mr-2 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider ${
                agentSide ? "bg-accent/15 text-accent" : "bg-ev-call/15 text-ev-call"
              }`}
            >
              {event.speaker}
            </span>
            {primary}
          </p>
          <p className="mt-1 mb-0 pl-1 text-[12px] leading-relaxed text-faint">{secondary}</p>
        </div>
      );
    }
    case "call.transcript_partial":
      return null;
    case "call.ended":
      return (
        <div className="text-[13px] text-dim">
          <p className="m-0">
            Duration{" "}
            <span className="font-mono text-mist">
              {Math.floor(event.durationSec / 60)}:{String(event.durationSec % 60).padStart(2, "0")}
            </span>
          </p>
          {event.summary ? (
            <p className="mt-1.5 mb-0 text-[12.5px] leading-relaxed">{event.summary}</p>
          ) : null}
        </div>
      );
    case "browser.action":
      return (
        <div className="text-[13px] text-dim">
          <p className="m-0 text-mist">{event.description}</p>
          <p className="mt-1 mb-0 flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-faint">
            <span className="rounded border border-line bg-white/[0.04] px-1.5 py-0.5 uppercase">
              {event.action}
            </span>
            {event.coordinates ? (
              <span>
                ({event.coordinates.x}, {event.coordinates.y})
              </span>
            ) : null}
            {event.url ? <span className="truncate max-w-[300px]">{event.url}</span> : null}
          </p>
        </div>
      );
    case "browser.screenshot":
      return (
        <div>
          {event.caption ? (
            <p className="mt-0 mb-2 text-[12.5px] text-dim">{event.caption}</p>
          ) : null}
          {event.ref.kind === "path" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.ref.path}
              alt={event.caption ?? "Agent browser screenshot"}
              className="h-32 w-auto rounded-lg border border-line object-cover object-top"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>
      );
    case "memory.read":
      return (
        <div className="text-[13px]">
          <p className="m-0 flex items-center gap-2">
            <MemoryTypeBadge type={event.record.type} />
            <span className="font-mono text-[10.5px] text-faint">{event.record.id}</span>
          </p>
          <p className="mt-1.5 mb-0 leading-relaxed text-mist">{event.record.content}</p>
          <p className="mt-1.5 mb-0 text-[12px] italic text-ev-memory/80">↳ why: {event.why}</p>
        </div>
      );
    case "memory.write":
      return (
        <div className="text-[13px]">
          <p className="m-0 flex items-center gap-2">
            <MemoryTypeBadge type={event.record.type} />
            <span className="font-mono text-[10.5px] text-faint">{event.record.id}</span>
          </p>
          <p className="mt-1.5 mb-0 leading-relaxed text-mist">{event.record.content}</p>
          <p className="mt-1.5 mb-0 text-[12px] text-faint">source: {event.record.source}</p>
        </div>
      );
    case "approval.requested":
      return (
        <div className="text-[13px]">
          <p className="m-0 leading-relaxed text-mist">{event.summary}</p>
          <div className="mt-2 space-y-1">
            {event.diff.map((d) => (
              <p key={d.field} className="m-0 flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
                <span className="text-dim">{d.label ?? d.field}</span>
                <span className="text-ev-danger/90 line-through">{d.before}</span>
                <span className="text-faint">→</span>
                <span className="font-semibold text-ev-call">{d.after}</span>
              </p>
            ))}
          </div>
        </div>
      );
    case "approval.granted":
      return (
        <p className="m-0 text-[13px] text-dim">
          Approved by <span className="font-medium text-mist">{event.decidedBy ?? "operator"}</span> —
          resuming the staged action.
        </p>
      );
    case "approval.rejected":
      return (
        <p className="m-0 text-[13px] text-dim">
          Rejected by <span className="font-medium text-mist">{event.decidedBy ?? "operator"}</span>
          {event.reason ? ` — ${event.reason}` : " — action abandoned."}
        </p>
      );
    case "agent.sleep":
      return null; // rendered as a special block
    case "agent.wake":
      return null; // rendered as a special block
  }
}

export function EventCard({ event, isLatest }: { event: ReceivedEvent; isLatest: boolean }) {
  const fresh = event.receivedAt > 0 && Date.now() - event.receivedAt < 30_000;

  // Special full-width blocks for the long-horizon beats.
  if (event.type === "agent.sleep") {
    return (
      <div className={`${fresh ? "animate-rise" : ""} rounded-xl border border-ev-sleep/25 bg-gradient-to-r from-ev-sleep/[0.12] via-ev-sleep/[0.05] to-transparent px-4 py-3.5`}>
        <div className="flex items-center gap-3">
          <Moon className="h-4.5 w-4.5 shrink-0 text-ev-sleep" size={18} />
          <div className="min-w-0">
            <p className="m-0 font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-ev-sleep">
              Agent sleeping · wakes{" "}
              {new Date(event.until).toLocaleString("en-GB", {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Zurich",
              })}
            </p>
            {event.reason ? (
              <p className="mt-1 mb-0 text-[12.5px] text-dim">{event.reason}</p>
            ) : null}
          </div>
          <span className="ml-auto shrink-0 font-mono text-[10.5px] text-faint">{timeOf(event.at)}</span>
        </div>
      </div>
    );
  }

  if (event.type === "agent.wake") {
    return (
      <div className={`${fresh ? "animate-rise" : ""} rounded-xl border border-accent/25 bg-gradient-to-r from-accent/[0.1] via-accent/[0.04] to-transparent px-4 py-3.5`}>
        <div className="flex items-start gap-3">
          <Sunrise className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent" size={18} />
          <div className="min-w-0">
            <p className="m-0 font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
              Agent woke up · context restored
            </p>
            <p className="mt-1.5 mb-0 text-[13.5px] leading-relaxed text-mist">
              <Typewriter text={event.recap} active={fresh && isLatest} />
            </p>
          </div>
          <span className="ml-auto shrink-0 font-mono text-[10.5px] text-faint">{timeOf(event.at)}</span>
        </div>
      </div>
    );
  }

  const m = meta(event);
  const body = <Body event={event} fresh={fresh && isLatest} />;
  if (body === null && event.type === "call.transcript_partial") return null;

  return (
    <div className={`${fresh ? "animate-rise" : ""} group flex gap-3`}>
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${HUE_CHIP[m.hue]}`}
      >
        <m.icon size={15} className={HUE_TEXT[m.hue]} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-line bg-white/[0.02] px-3.5 py-3 transition-colors group-hover:bg-white/[0.035]">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span
            className={`font-display text-[10.5px] font-semibold uppercase tracking-[0.16em] ${HUE_TEXT[m.hue]}`}
          >
            {m.label}
          </span>
          <span className="shrink-0 font-mono text-[10.5px] text-faint">{timeOf(event.at)}</span>
        </div>
        {body}
      </div>
    </div>
  );
}
