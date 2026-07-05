"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseRecord, DeclarationTimelineSnapshot } from "@clearborder/shared";
import {
  buildParcelTimeline,
  formatParcelStateForPrompt,
  getParcelStateNow,
} from "@clearborder/shared";
import type { ReceivedEvent } from "./useAgentStream";
import { agentHttpBase } from "./agent-api";
import { buildObservedTimelineEntries } from "./observedEvents";

function toAgentEvents(events: ReceivedEvent[]) {
  return events.map(({ receivedAt: _ignored, ...event }) => event);
}

/** Refetch declaration when portal automation or case status may have changed it. */
function declarationRefetchKey(selectedCaseId: string | undefined, caseEvents: ReceivedEvent[]): string {
  if (!selectedCaseId) return "";
  const relevant = caseEvents.filter(
    (e) =>
      e.caseId === selectedCaseId &&
      (e.type === "browser.action" ||
        e.type === "browser.screenshot" ||
        e.type === "case.status_changed"),
  );
  const last = relevant[relevant.length - 1];
  return last ? `${last.id}:${last.at}` : "none";
}

export function useObservedTimeline(
  selectedCase: CaseRecord | null,
  caseEvents: ReceivedEvent[],
) {
  const [declaration, setDeclaration] = useState<DeclarationTimelineSnapshot | null>(null);
  const [declarationLoading, setDeclarationLoading] = useState(false);
  const [declarationError, setDeclarationError] = useState<string | null>(null);
  const [agentReachable, setAgentReachable] = useState<boolean | null>(null);

  const refetchKey = declarationRefetchKey(selectedCase?.id, caseEvents);

  useEffect(() => {
    let cancelled = false;
    fetch(`${agentHttpBase()}/health`)
      .then((r) => {
        if (!cancelled) setAgentReachable(r.ok);
      })
      .catch(() => {
        if (!cancelled) setAgentReachable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        return response.json() as Promise<DeclarationTimelineSnapshot>;
      })
      .then((snapshot) => {
        if (!cancelled) {
          setDeclaration(snapshot);
          setAgentReachable(true);
        }
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
  }, [selectedCase?.id, refetchKey, selectedCase?.updatedAt]);

  const agentEvents = useMemo(() => toAgentEvents(caseEvents), [caseEvents]);

  const timeline = useMemo(() => {
    if (!selectedCase) return null;
    return buildParcelTimeline({
      case: selectedCase,
      events: agentEvents,
      declaration: declaration ?? undefined,
    });
  }, [selectedCase, agentEvents, declaration]);

  const currentAt = useMemo(() => {
    if (caseEvents.length > 0) return caseEvents[caseEvents.length - 1]!.at;
    return selectedCase?.updatedAt ?? selectedCase?.createdAt ?? new Date().toISOString();
  }, [caseEvents, selectedCase?.createdAt, selectedCase?.updatedAt]);

  const observedStateText = useMemo(() => {
    if (!selectedCase) return null;
    const state = timeline
      ? timeline.getStateAt(currentAt)
      : getParcelStateNow({ case: selectedCase, events: agentEvents, declaration: declaration ?? undefined });
    return formatParcelStateForPrompt(state, { observedOnly: true });
  }, [timeline, currentAt, selectedCase, agentEvents, declaration]);

  const entries = useMemo(
    () => buildObservedTimelineEntries(selectedCase, caseEvents, declaration),
    [selectedCase, caseEvents, declaration],
  );

  const lastBrowserAction = useMemo(() => {
    for (let i = caseEvents.length - 1; i >= 0; i--) {
      const e = caseEvents[i];
      if (e?.type === "browser.action" && (!selectedCase || e.caseId === selectedCase.id)) {
        return e;
      }
    }
    return null;
  }, [caseEvents, selectedCase?.id]);

  return {
    declaration,
    declarationLoading,
    declarationError,
    agentReachable,
    observedStateText,
    lastBrowserAction,
    entries,
    agentHttpBase: agentHttpBase(),
  };
}
