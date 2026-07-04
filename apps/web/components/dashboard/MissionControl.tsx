"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgentStream, useDerived } from "@/lib/dashboard/useAgentStream";
import { ApprovalCard } from "./ApprovalCard";
import { CaseRail } from "./CaseRail";
import { DevMenu } from "./DevMenu";
import { RightPanels } from "./RightPanels";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";

export function MissionControl() {
  const state = useAgentStream();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Default focus: the demo's hero case once state arrives.
  useEffect(() => {
    if (!selectedCaseId && state.demo?.activeCaseId) {
      setSelectedCaseId(state.demo.activeCaseId);
    }
  }, [state.demo?.activeCaseId, selectedCaseId]);

  const selectedCase = useMemo(
    () => state.cases.find((c) => c.id === selectedCaseId) ?? null,
    [state.cases, selectedCaseId],
  );
  const shipper = useMemo(
    () => state.shippers.find((s) => s.id === selectedCase?.shipperId) ?? null,
    [state.shippers, selectedCase],
  );
  const derived = useDerived(state, selectedCaseId);

  return (
    <div className="mission-bg flex h-screen min-w-[1024px] flex-col overflow-hidden font-sans text-mist">
      <TopBar
        demo={state.demo}
        selectedCase={selectedCase}
        shipper={shipper}
        connected={state.connected}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[272px_minmax(0,1fr)_392px] gap-3 px-3 pb-3">
        <CaseRail
          cases={state.cases}
          shippers={state.shippers}
          selectedId={selectedCaseId}
          onSelect={setSelectedCaseId}
          pinnedId={state.demo?.activeCaseId}
        />

        <div className="relative flex min-h-0 flex-col">
          <Timeline events={derived.caseEvents} />
          <ApprovalCard approval={derived.pendingApproval} />
        </div>

        <RightPanels state={state} selectedCaseId={selectedCaseId} />
      </div>

      {!state.connected && state.everConnected ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
          <span className="mt-2 rounded-full border border-ev-danger/40 bg-abyss/90 px-4 py-1.5 text-[11.5px] font-medium text-ev-danger backdrop-blur">
            Agent link lost — reconnecting…
          </span>
        </div>
      ) : null}

      <DevMenu currentDay={state.demo?.day ?? 1} connected={state.connected} />
    </div>
  );
}
