"use client";

import { useMemo } from "react";
import { useAgentStream, useDerived } from "@/lib/demo/useAgentStream";
import { ObservedTimeline } from "./ObservedTimeline";

/** Resolve the case this view follows — always prefer demo.activeCaseId (sync, no stale local state). */
function resolveTimelineCaseId(state: ReturnType<typeof useAgentStream>): string | null {
  const active = state.demo?.activeCaseId;
  if (active) return active;
  if (state.cases.length === 1) return state.cases[0]!.id;
  return null;
}

export function TimelineExperience() {
  const state = useAgentStream();

  const selectedCaseId = useMemo(() => resolveTimelineCaseId(state), [state.demo?.activeCaseId, state.cases]);

  const selectedCase = useMemo(
    () => (selectedCaseId ? (state.cases.find((c) => c.id === selectedCaseId) ?? null) : null),
    [state.cases, selectedCaseId],
  );

  const derived = useDerived(state, selectedCaseId);

  return (
    <ObservedTimeline
      selectedCase={selectedCase}
      caseEvents={derived.caseEvents}
      connected={state.connected}
      everConnected={state.everConnected}
    />
  );
}
