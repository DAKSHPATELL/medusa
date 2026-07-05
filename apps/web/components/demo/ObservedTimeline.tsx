"use client";

import { useEffect, useRef } from "react";
import { Activity, Clock3, Radio, ServerCrash } from "lucide-react";
import type { CaseRecord } from "@clearborder/shared";
import { dayDateLabel, shortTimeOf } from "@/lib/demo/format";
import type { ObservedTimelineEntry } from "@/lib/demo/observedEvents";
import { useObservedTimeline } from "@/lib/demo/useObservedTimeline";
import type { ReceivedEvent } from "@/lib/demo/useAgentStream";

const SOURCE_STYLE = {
  agent: "border-accent/30 bg-accent/10 text-accent",
  declaration: "border-ev-call/30 bg-ev-call/10 text-ev-call",
  case: "border-line bg-white/[0.04] text-dim",
} as const;

export function ObservedTimeline({
  selectedCase,
  caseEvents,
  connected,
  everConnected,
}: {
  selectedCase: CaseRecord | null;
  caseEvents: ReceivedEvent[];
  connected: boolean;
  everConnected: boolean;
}) {
  const {
    declaration,
    declarationLoading,
    declarationError,
    agentReachable,
    observedStateText,
    lastBrowserAction,
    entries,
    agentHttpBase,
  } = useObservedTimeline(selectedCase, caseEvents);

  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(entries.length);

  useEffect(() => {
    if (entries.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevCountRef.current = entries.length;
  }, [entries.length]);

  // Only block the view when health explicitly failed — not while the probe is pending.
  // WebSocket connection status is shown separately in the header.
  const showConnectAgent = !connected && !everConnected && agentReachable === false;

  return (
    <div className="demo-bg flex min-h-screen flex-col font-sans text-mist" data-testid="observed-timeline">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-abyss/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <div>
            <p className="m-0 font-display text-[10px] font-bold uppercase tracking-[0.24em] text-dim">
              Live observed timeline
            </p>
            <p className="m-0 mt-1 text-[13px] text-faint">Facts from agent events & declaration API only</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                connected
                  ? "border-ev-call/30 bg-ev-call/10 text-ev-call"
                  : "border-ev-danger/30 bg-ev-danger/10 text-ev-danger"
              }`}
              data-testid="timeline-connection"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-ev-call" : "bg-ev-danger animate-pulse-dot"}`}
              />
              {connected ? "Live" : everConnected ? "Reconnecting" : "Offline"}
            </span>
            <a
              href="/"
              className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-[11px] text-dim transition-colors hover:border-accent/35 hover:text-mist"
            >
              Demo
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {showConnectAgent ? (
          <ConnectAgentState agentHttpBase={agentHttpBase} />
        ) : !selectedCase ? (
          <EmptyPanel
            icon={Clock3}
            title="No case selected"
            message="Start or replay a case on the main demo — this view follows the active case automatically."
          />
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 font-mono text-[11px] text-faint">{selectedCase.reference}</p>
                  <p className="m-0 mt-1 text-[14px] font-medium text-mist">{selectedCase.declarationRef}</p>
                </div>
                {declarationLoading ? (
                  <span className="text-[10px] text-faint">Refreshing declaration…</span>
                ) : declarationError ? (
                  <span className="text-[10px] text-ev-approval">{declarationError}</span>
                ) : null}
              </div>

              {observedStateText ? (
                <div
                  className="rounded-xl border border-ev-call/25 bg-ev-call/5 px-4 py-3"
                  data-testid="observed-current-state"
                >
                  <p className="m-0 text-[10px] font-medium uppercase tracking-wider text-ev-call">
                    Current observed state
                  </p>
                  <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-mist">{observedStateText}</p>
                  {lastBrowserAction ? (
                    <p
                      className="m-0 mt-2 text-[11.5px] leading-relaxed text-dim"
                      data-testid="observed-last-browser-action"
                    >
                      Last portal action: {lastBrowserAction.description}
                    </p>
                  ) : null}
                  {declaration?.arrivedAt ? (
                    <p className="mb-0 mt-2 text-[11px] text-faint">
                      Customs arrival confirmed: {dayDateLabel(declaration.arrivedAt)} ·{" "}
                      {shortTimeOf(declaration.arrivedAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Activity size={14} className="text-accent" />
                <h2 className="m-0 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-dim">
                  Observed events
                </h2>
                <span className="ml-auto font-mono text-[10px] text-faint">{entries.length}</span>
              </div>

              <div
                ref={listRef}
                className="max-h-[min(520px,60vh)] space-y-2 overflow-y-auto rounded-2xl border border-line bg-white/[0.015] p-3"
                data-testid="observed-event-list"
              >
                {entries.length === 0 ? (
                  <p className="m-0 px-2 py-6 text-center text-[12.5px] text-dim">
                    Waiting for observed events from the agent…
                  </p>
                ) : (
                  entries.map((entry) => <ObservedEventRow key={entry.id} entry={entry} />)
                )}
              </div>
            </section>

            <p className="m-0 text-center font-mono text-[10px] text-faint">
              Agent {agentHttpBase} · WebSocket events + GET /api/cases/:id/declaration
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function ObservedEventRow({ entry }: { entry: ObservedTimelineEntry }) {
  return (
    <article
      className="rounded-xl border border-line/80 bg-white/[0.02] px-3 py-2.5"
      data-testid={`observed-event-${entry.type}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SOURCE_STYLE[entry.source]}`}
            >
              {entry.source}
            </span>
            <span className="font-mono text-[10px] text-faint">{entry.type}</span>
            {entry.live ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-ev-call">
                <Radio size={10} />
                live
              </span>
            ) : null}
          </div>
          <p className="m-0 mt-1.5 text-[13px] font-medium leading-snug text-mist">{entry.summary}</p>
          {entry.detail ? (
            <p className="m-0 mt-1 text-[11.5px] leading-relaxed text-dim">{entry.detail}</p>
          ) : null}
        </div>
        <time className="shrink-0 text-right font-mono text-[10px] leading-tight text-faint">
          <span className="block">{shortTimeOf(entry.at)}</span>
          <span className="block opacity-70">{dayDateLabel(entry.at).split(",")[0]}</span>
        </time>
      </div>
    </article>
  );
}

function ConnectAgentState({ agentHttpBase }: { agentHttpBase: string }) {
  return (
    <EmptyPanel
      icon={ServerCrash}
      title="Agent not reachable"
      message={`Start the agent on port 8787 (pnpm dev from repo root). This view reads ${agentHttpBase}/ws and the declaration API.`}
      testId="timeline-connect-agent"
    />
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  message,
  testId,
}: {
  icon: typeof Clock3;
  title: string;
  message: string;
  testId?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-line bg-white/[0.02] px-6 py-16 text-center"
      data-testid={testId}
    >
      <Icon size={28} className="mx-auto mb-4 text-faint" />
      <h2 className="m-0 font-display text-[15px] font-semibold text-mist">{title}</h2>
      <p className="mx-auto m-0 mt-2 max-w-md text-[13px] leading-relaxed text-dim">{message}</p>
    </div>
  );
}
