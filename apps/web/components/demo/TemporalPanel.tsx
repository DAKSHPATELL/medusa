"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock3, MapPin, PanelRightClose, PanelRightOpen, Route } from "lucide-react";
import type { CaseRecord } from "@clearborder/shared";
import {
  CASE_STATUS_LABEL,
  DECLARATION_STATUS_LABEL,
} from "@clearborder/shared";
import type { ReceivedEvent } from "@/lib/demo/useAgentStream";
import { dayDateLabel, shortTimeOf } from "@/lib/demo/format";
import {
  inferenceModeLabel,
  useParcelTimeline,
} from "@/lib/demo/useParcelTimeline";

const INFERENCE_STYLE = {
  observed: "text-ev-call border-ev-call/30 bg-ev-call/10",
  interpolated: "text-accent border-accent/30 bg-accent/10",
  extrapolated: "text-ev-approval border-ev-approval/30 bg-ev-approval/10",
} as const;

function confidenceTone(confidence: number): string {
  if (confidence >= 0.85) return "text-ev-call";
  if (confidence >= 0.55) return "text-accent";
  return "text-ev-approval";
}

export function TemporalPanel({
  selectedCase,
  caseEvents,
  demoDay,
  variant = "floating",
}: {
  selectedCase: CaseRecord | null;
  caseEvents: ReceivedEvent[];
  demoDay: number;
  /** floating = standalone toggle (internal debug only); embedded = nested in DevMenu */
  variant?: "floating" | "embedded";
}) {
  const [open, setOpen] = useState(variant === "embedded");
  const {
    parcelState,
    declarationLoading,
    declarationError,
    followStory,
    setFollowStory,
    selectedAt,
    setManualAt,
    storyAt,
    range,
    observationTimes,
  } = useParcelTimeline(selectedCase, caseEvents);

  const scrubMs = useMemo(() => {
    if (!range || !selectedAt) return range?.startMs ?? 0;
    return Date.parse(selectedAt);
  }, [range, selectedAt]);

  const clearanceLabel = useMemo(() => {
    if (!parcelState) return null;
    const parts = [
      parcelState.process.caseStatus
        ? CASE_STATUS_LABEL[parcelState.process.caseStatus]
        : null,
      parcelState.process.declarationStatus
        ? DECLARATION_STATUS_LABEL[parcelState.process.declarationStatus]
        : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : parcelState.process.label;
  }, [parcelState]);

  const panelOpen = variant === "embedded" ? true : open;

  return (
    <>
      {variant === "floating" ? (
        <button
          onClick={() => setOpen((value) => !value)}
          title="Parcel timeline (T)"
          data-testid="temporal-panel-toggle"
          className="fixed right-4 top-20 z-40 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line bg-abyss/80 text-faint backdrop-blur transition-colors hover:border-accent/40 hover:text-accent"
        >
          {open ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
        </button>
      ) : null}

      <AnimatePresence>
        {panelOpen ? (
          <motion.aside
            initial={variant === "embedded" ? false : { opacity: 0, x: 16 }}
            animate={variant === "embedded" ? undefined : { opacity: 1, x: 0 }}
            exit={variant === "embedded" ? undefined : { opacity: 0, x: 16 }}
            transition={{ duration: 0.16 }}
            className={
              variant === "embedded"
                ? "mt-3 flex max-h-[320px] flex-col overflow-hidden rounded-xl border border-line bg-white/[0.02]"
                : "fixed right-4 top-28 z-40 flex w-[300px] max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-line bg-[#0b0e14]/95 shadow-2xl backdrop-blur-xl"
            }
            data-testid="temporal-panel"
          >
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.24em] text-dim">
                  Parcel timeline
                </span>
                <span className="rounded-full border border-line bg-white/[0.03] px-2 py-0.5 font-mono text-[9.5px] text-faint">
                  Day {demoDay}
                </span>
              </div>
              {selectedCase ? (
                <p className="mt-1.5 mb-0 font-mono text-[10.5px] text-faint">
                  {selectedCase.reference} · {selectedCase.declarationRef}
                </p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!selectedCase ? (
                <EmptyState message="Select or start a case to inspect parcel state over time." />
              ) : declarationLoading && !parcelState ? (
                <EmptyState message="Building timeline from case and declaration data…" loading />
              ) : !parcelState ? (
                <EmptyState
                  message={
                    declarationError
                      ? `Timeline unavailable — ${declarationError}`
                      : "Not enough data to estimate parcel state yet."
                  }
                />
              ) : (
                <div className="space-y-4">
                  <section className="rounded-xl border border-line bg-white/[0.02] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
                        Time
                      </span>
                      <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-dim">
                        <input
                          type="checkbox"
                          checked={followStory}
                          onChange={(event) => {
                            const next = event.target.checked;
                            setFollowStory(next);
                            if (!next && storyAt) setManualAt(storyAt);
                          }}
                          className="accent-accent"
                          data-testid="temporal-follow-story"
                        />
                        Follow story
                      </label>
                    </div>

                    {selectedAt ? (
                      <p className="m-0 font-mono text-[11px] text-mist">
                        {dayDateLabel(selectedAt)} · {shortTimeOf(selectedAt)}
                      </p>
                    ) : null}

                    {range && !followStory ? (
                      <input
                        type="range"
                        min={range.startMs}
                        max={range.endMs}
                        step={60_000}
                        value={Math.min(Math.max(scrubMs, range.startMs), range.endMs)}
                        onChange={(event) => setManualAt(new Date(Number(event.target.value)).toISOString())}
                        className="mt-3 w-full accent-accent"
                        data-testid="temporal-scrubber"
                      />
                    ) : null}

                    {observationTimes.length > 0 ? (
                      <p className="mb-0 mt-2 text-[10px] leading-relaxed text-faint">
                        {observationTimes.length} observation
                        {observationTimes.length === 1 ? "" : "s"} in corridor model
                      </p>
                    ) : null}
                  </section>

                  <MetricBlock
                    icon={MapPin}
                    label="Location"
                    value={parcelState.location.place.label}
                    hint={`${parcelState.location.place.city}, ${parcelState.location.place.countryCode}`}
                  />

                  <MetricBlock
                    icon={Route}
                    label="Corridor progress"
                    value={`${Math.round(parcelState.location.corridorProgress * 100)}%`}
                    hint="Origin → customs → destination"
                  />

                  <MetricBlock
                    icon={Clock3}
                    label="Clearance"
                    value={clearanceLabel ?? parcelState.process.label}
                    hint={parcelState.process.label}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-line bg-white/[0.02] p-3">
                      <p className="m-0 text-[10px] font-medium uppercase tracking-wider text-faint">
                        Confidence
                      </p>
                      <p
                        className={`mt-1.5 mb-0 font-display text-[22px] font-bold leading-none ${confidenceTone(parcelState.confidence)}`}
                      >
                        {Math.round(parcelState.confidence * 100)}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-line bg-white/[0.02] p-3">
                      <p className="m-0 text-[10px] font-medium uppercase tracking-wider text-faint">
                        Inference
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${INFERENCE_STYLE[parcelState.inferenceMode]}`}
                      >
                        {inferenceModeLabel(parcelState.inferenceMode)}
                      </span>
                    </div>
                  </div>

                  {parcelState.uncertainty ? (
                    <p className="mb-0 text-[10.5px] leading-relaxed text-faint">
                      Uncertainty window: {shortTimeOf(parcelState.uncertainty.earliest)} –{" "}
                      {shortTimeOf(parcelState.uncertainty.latest)}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function EmptyState({ message, loading }: { message: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/[0.02] px-4 py-8 text-center">
      {loading ? (
        <span className="mx-auto mb-3 block h-4 w-4 animate-pulse rounded-full bg-accent/40" />
      ) : (
        <Clock3 size={18} className="mx-auto mb-3 text-faint" />
      )}
      <p className="m-0 text-[12.5px] leading-relaxed text-dim">{message}</p>
    </div>
  );
}

function MetricBlock({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-accent/80" />
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
          {label}
        </span>
      </div>
      <p className="mt-2 mb-0 text-[14px] font-medium leading-snug text-mist">{value}</p>
      {hint ? <p className="mb-0 mt-1 text-[10.5px] text-faint">{hint}</p> : null}
    </div>
  );
}
