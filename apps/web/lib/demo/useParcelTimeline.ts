"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentEvent, CaseRecord, DeclarationStatus } from "@clearborder/shared";
import {
  buildParcelTimeline,
  type InferenceMode,
  type TemporalParcelState,
} from "@clearborder/shared";
import type { ReceivedEvent } from "./useAgentStream";
import { agentHttpBase } from "./agent-api";

export interface DeclarationSnapshot {
  status: DeclarationStatus;
  arrivedAt: string;
  updatedAt: string;
}

function toAgentEvents(events: ReceivedEvent[]): AgentEvent[] {
  return events.map(({ receivedAt: _ignored, ...event }) => event);
}

export function useParcelTimeline(
  selectedCase: CaseRecord | null,
  caseEvents: ReceivedEvent[],
) {
  const [declaration, setDeclaration] = useState<DeclarationSnapshot | null>(null);
  const [declarationLoading, setDeclarationLoading] = useState(false);
  const [declarationError, setDeclarationError] = useState<string | null>(null);
  const [followStory, setFollowStory] = useState(true);
  const [manualAt, setManualAt] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCase) {
      setDeclaration(null);
      setDeclarationError(null);
      setDeclarationLoading(false);
      return;
    }

    let cancelled = false;
    setDeclarationLoading(true);
    setDeclarationError(null);

    fetch(`${agentHttpBase()}/api/cases/${selectedCase.id}/declaration`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 404 ? "No declaration linked" : "Fetch failed");
        }
        return response.json() as Promise<DeclarationSnapshot>;
      })
      .then((snapshot) => {
        if (!cancelled) setDeclaration(snapshot);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDeclaration(null);
          setDeclarationError(error instanceof Error ? error.message : "Fetch failed");
        }
      })
      .finally(() => {
        if (!cancelled) setDeclarationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCase?.id]);

  const agentEvents = useMemo(() => toAgentEvents(caseEvents), [caseEvents]);

  const timeline = useMemo(() => {
    if (!selectedCase) return null;
    return buildParcelTimeline({
      case: selectedCase,
      events: agentEvents,
      declaration: declaration ?? undefined,
    });
  }, [selectedCase, agentEvents, declaration]);

  const storyAt = useMemo(() => {
    if (caseEvents.length === 0) return selectedCase?.updatedAt ?? selectedCase?.createdAt ?? null;
    return caseEvents[caseEvents.length - 1]?.at ?? null;
  }, [caseEvents, selectedCase?.createdAt, selectedCase?.updatedAt]);

  const range = useMemo(() => {
    if (!selectedCase) return null;
    const startMs = Date.parse(selectedCase.createdAt);
    const endCandidates = [
      Date.parse(selectedCase.updatedAt),
      ...caseEvents.map((event) => Date.parse(event.at)),
    ];
    const endMs = Math.max(...endCandidates.filter((value) => Number.isFinite(value)));
    return {
      startMs,
      endMs: Number.isFinite(endMs) ? endMs : startMs,
      startIso: selectedCase.createdAt,
      endIso: new Date(Number.isFinite(endMs) ? endMs : startMs).toISOString(),
    };
  }, [selectedCase, caseEvents]);

  const selectedAt = followStory ? storyAt : manualAt ?? storyAt ?? selectedCase?.createdAt ?? null;

  const parcelState: TemporalParcelState | null = useMemo(() => {
    if (!timeline || !selectedAt) return null;
    return timeline.getStateAt(selectedAt);
  }, [timeline, selectedAt]);

  const observationTimes = useMemo(() => timeline?.observationTimes() ?? [], [timeline]);

  return {
    timeline,
    parcelState,
    declaration,
    declarationLoading,
    declarationError,
    followStory,
    setFollowStory,
    selectedAt,
    manualAt,
    setManualAt,
    storyAt,
    range,
    observationTimes,
  };
}

export function inferenceModeLabel(mode: InferenceMode): string {
  switch (mode) {
    case "observed":
      return "Observed";
    case "interpolated":
      return "Interpolated";
    case "extrapolated":
      return "Extrapolated";
  }
}
