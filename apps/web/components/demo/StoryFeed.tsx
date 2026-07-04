"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import type { CallView } from "@/lib/demo/useAgentStream";
import type { ReceivedEvent } from "@/lib/demo/useAgentStream";
import { BrowserScene } from "./BrowserScene";
import { CallScene } from "./CallScene";
import { DayChapter, SleepBeat, WakeBeat } from "./ChapterBeat";
import { IntroHero } from "./IntroHero";
import { MemoryBeat } from "./MemoryBeat";
import { StoryBeat } from "./StoryBeat";

const SKIP_IN_FEED = new Set([
  "call.transcript_partial",
  "call.transcript_final",
  "call.ended",
  "approval.requested",
]);

function shouldRender(event: ReceivedEvent): boolean {
  if (SKIP_IN_FEED.has(event.type)) return false;
  if (event.type === "browser.screenshot") return true;
  if (event.type === "call.started") return true;
  if (event.type === "memory.read" || event.type === "memory.write") return true;
  if (event.type === "agent.sleep" || event.type === "agent.wake") return true;
  return (
    event.type === "agent.thought" ||
    event.type === "case.status_changed" ||
    event.type === "browser.action" ||
    event.type === "approval.granted" ||
    event.type === "approval.rejected"
  );
}

export function StoryFeed({
  events,
  call,
}: {
  events: ReceivedEvent[];
  call: CallView;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticUntil = useRef(0);
  const [stick, setStick] = useState(true);

  const feedEvents = useMemo(() => events.filter(shouldRender), [events]);
  const latestId = feedEvents.length > 0 ? feedEvents[feedEvents.length - 1]?.id : undefined;
  const callStartedId = useMemo(
    () => events.find((e) => e.type === "call.started")?.id,
    [events],
  );

  const prevLen = useRef(0);
  useEffect(() => {
    if (feedEvents.length < prevLen.current) setStick(true);
    prevLen.current = feedEvents.length;
  }, [feedEvents.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick) {
      programmaticUntil.current = Date.now() + 600;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [feedEvents.length, stick]);

  const onScroll = () => {
    if (Date.now() < programmaticUntil.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setStick(nearBottom);
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="demo-scroll space-y-8 pb-24"
        data-testid="story-feed"
      >
        {feedEvents.length === 0 ? <IntroHero /> : null}

        {feedEvents.map((event, i) => {
          const prev = feedEvents[i - 1];
          const newDay = !prev || prev.day !== event.day;

          return (
            <div key={event.id} className="space-y-8">
              {newDay ? <DayChapter day={event.day} at={event.at} /> : null}

              {event.type === "call.started" ? <CallScene call={call} /> : null}

              {event.type === "browser.screenshot" ? (
                <BrowserScene
                  shot={event}
                  action={
                    events
                      .filter((e) => e.type === "browser.action" && e.seq <= event.seq)
                      .slice(-1)[0] as Extract<ReceivedEvent, { type: "browser.action" }> | undefined ??
                    null
                  }
                />
              ) : null}

              {event.type === "memory.read" || event.type === "memory.write" ? (
                <MemoryBeat op={event} />
              ) : null}

              {event.type === "agent.sleep" ? <SleepBeat event={event} /> : null}
              {event.type === "agent.wake" ? (
                <WakeBeat event={event} isLatest={event.id === latestId} />
              ) : null}

              {event.type !== "call.started" &&
              event.type !== "browser.screenshot" &&
              event.type !== "memory.read" &&
              event.type !== "memory.write" &&
              event.type !== "agent.sleep" &&
              event.type !== "agent.wake" ? (
                <StoryBeat event={event} isLatest={event.id === latestId} />
              ) : null}
            </div>
          );
        })}

        {/* Keep call scene mounted after start event scrolls up */}
        {callStartedId && !feedEvents.some((e) => e.type === "call.started") && call.started ? (
          <CallScene call={call} />
        ) : null}
      </div>

      {!stick && feedEvents.length > 0 ? (
        <button
          onClick={() => {
            const el = scrollRef.current;
            el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            setStick(true);
          }}
          className="fixed bottom-20 left-1/2 z-20 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-accent/30 bg-abyss/90 px-3.5 py-1.5 text-[11px] font-medium text-accent shadow-lg backdrop-blur transition-colors hover:bg-accent/10"
        >
          <ArrowDown size={12} />
          Follow story
        </button>
      ) : null}
    </div>
  );
}
