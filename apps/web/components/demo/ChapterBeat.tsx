import { Moon, Sunrise } from "lucide-react";
import type { ReceivedEvent } from "@/lib/demo/useAgentStream";
import { dayDateLabel, timeOf } from "@/lib/demo/format";
import { Typewriter } from "./Typewriter";

export function DayChapter({ day, at }: { day: number; at: string }) {
  return (
    <div className="flex items-center gap-4 py-6">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-line" />
      <span className="flex flex-col items-center gap-0.5 rounded-full border border-line bg-white/[0.035] px-5 py-2 shadow-[0_0_24px_rgba(62,224,255,0.07)]">
        <span className="font-display text-[13px] font-bold uppercase tracking-[0.28em] text-accent">
          Day {day}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-dim">
          {dayDateLabel(at)}
        </span>
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-line to-line" />
    </div>
  );
}

export function SleepBeat({ event }: { event: ReceivedEvent & { type: "agent.sleep" } }) {
  const fresh = event.receivedAt > 0 && Date.now() - event.receivedAt < 30_000;
  return (
    <section
      className={`rounded-2xl border border-ev-sleep/25 bg-gradient-to-r from-ev-sleep/[0.12] via-ev-sleep/[0.05] to-transparent px-5 py-4 ${fresh ? "animate-rise" : ""}`}
    >
      <div className="flex items-center gap-3">
        <Moon className="shrink-0 text-ev-sleep" size={20} />
        <div className="min-w-0">
          <p className="m-0 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-ev-sleep">
            Agent sleeping · wakes{" "}
            {new Date(event.until).toLocaleString("en-GB", {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Zurich",
            })}
          </p>
          {event.reason ? (
            <p className="mt-1 mb-0 text-[13.5px] leading-relaxed text-dim">{event.reason}</p>
          ) : null}
        </div>
        <span className="ml-auto shrink-0 font-mono text-[10.5px] text-faint">{timeOf(event.at)}</span>
      </div>
    </section>
  );
}

export function WakeBeat({
  event,
  isLatest,
}: {
  event: ReceivedEvent & { type: "agent.wake" };
  isLatest: boolean;
}) {
  const fresh = event.receivedAt > 0 && Date.now() - event.receivedAt < 30_000;
  return (
    <section
      className={`rounded-2xl border border-accent/25 bg-gradient-to-r from-accent/[0.1] via-accent/[0.04] to-transparent px-5 py-4 ${fresh ? "animate-rise" : ""}`}
    >
      <div className="flex items-start gap-3">
        <Sunrise className="mt-0.5 shrink-0 text-accent" size={20} />
        <div className="min-w-0">
          <p className="m-0 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Agent woke up · context restored
          </p>
          <p className="mt-2 mb-0 text-[15px] leading-relaxed text-mist">
            <Typewriter text={event.recap} active={fresh && isLatest} />
          </p>
        </div>
        <span className="ml-auto shrink-0 font-mono text-[10.5px] text-faint">{timeOf(event.at)}</span>
      </div>
    </section>
  );
}
