"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Radio } from "lucide-react";
import type { ReceivedEvent } from "@/lib/dashboard/useAgentStream";
import { dayDateLabel } from "@/lib/dashboard/format";
import { EventCard } from "./EventCard";
import { LogoMark } from "./Logo";

function DaySeparator({ day, at }: { day: number; at: string }) {
  return (
    <div className="flex items-center gap-4 pb-1 pt-4 first:pt-0">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-line" />
      <span className="flex items-baseline gap-2.5 rounded-full border border-line bg-white/[0.035] px-4 py-1.5 shadow-[0_0_24px_rgba(62,224,255,0.07)]">
        <span className="font-display text-[13px] font-bold uppercase tracking-[0.3em] text-accent">
          Day {day}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">
          {dayDateLabel(at)}
        </span>
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-line to-line" />
    </div>
  );
}

export function Timeline({ events }: { events: ReceivedEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticUntil = useRef(0);
  const [stick, setStick] = useState(true);

  const visible = useMemo(
    () => events.filter((e) => e.type !== "call.transcript_partial"),
    [events],
  );
  const latestId = visible.length > 0 ? visible[visible.length - 1]?.id : undefined;

  // Re-engage follow mode when the timeline is rebuilt (demo reset / day jump).
  const prevLen = useRef(0);
  useEffect(() => {
    if (visible.length < prevLen.current) setStick(true);
    prevLen.current = visible.length;
  }, [visible.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick) {
      programmaticUntil.current = Date.now() + 600;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [visible.length, stick]);

  const onScroll = () => {
    // Ignore scroll events caused by our own smooth auto-scroll.
    if (Date.now() < programmaticUntil.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setStick(nearBottom);
  };

  return (
    <section className="glass relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="m-0 flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-dim">
          <Radio size={13} className="text-accent" />
          Live agent activity
        </h2>
        <span className="font-mono text-[11px] text-faint">{visible.length} events</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="dash-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        data-testid="timeline"
      >
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="opacity-30">
              <LogoMark size={54} />
            </span>
            <div>
              <p className="m-0 font-display text-[15px] font-medium text-dim">
                Standing by for agent activity
              </p>
              <p className="mt-1.5 mb-0 text-[12.5px] text-faint">
                Press <kbd className="rounded border border-line bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px]">D</kbd>{" "}
                and play Day 1 to run the demo scenario
              </p>
            </div>
          </div>
        ) : (
          visible.map((event, i) => {
            const prev = visible[i - 1];
            const newDay = !prev || prev.day !== event.day;
            return (
              <div key={event.id} className="space-y-3">
                {newDay ? <DaySeparator day={event.day} at={event.at} /> : null}
                <EventCard event={event} isLatest={event.id === latestId} />
              </div>
            );
          })
        )}
      </div>

      {!stick ? (
        <button
          onClick={() => {
            const el = scrollRef.current;
            el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            setStick(true);
          }}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-accent/30 bg-abyss/90 px-3.5 py-1.5 text-[11px] font-medium text-accent shadow-lg backdrop-blur transition-colors hover:bg-accent/10"
        >
          <ArrowDown size={12} />
          Jump to latest
        </button>
      ) : null}
    </section>
  );
}
