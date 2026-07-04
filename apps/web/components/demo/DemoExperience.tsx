"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgentStream, useDerived } from "@/lib/demo/useAgentStream";
import { agentHttpBase } from "@/lib/demo/agent-api";
import { ApprovalModal } from "./ApprovalModal";
import { DevMenu } from "./DevMenu";
import { IntakeForm } from "./IntakeForm";
import { IntroHero } from "./IntroHero";
import { LiveVoiceBridge } from "./LiveVoiceBridge";
import { StoryFeed } from "./StoryFeed";
import { StoryHeader } from "./StoryHeader";

export function DemoExperience() {
  const state = useAgentStream();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<"browser" | "twilio" | "mock" | null>(null);

  useEffect(() => {
    fetch(`${agentHttpBase()}/health`)
      .then((r) => r.json())
      .then((h) => setVoiceMode(h?.modes?.voice ?? "mock"))
      .catch(() => setVoiceMode("mock"));
  }, []);

  useEffect(() => {
    if (!caseId && state.demo?.activeCaseId) {
      setCaseId(state.demo.activeCaseId);
    }
  }, [state.demo?.activeCaseId, caseId]);

  const selectedCase = useMemo(
    () => state.cases.find((c) => c.id === caseId) ?? null,
    [state.cases, caseId],
  );
  const shipper = useMemo(
    () => state.shippers.find((s) => s.id === selectedCase?.shipperId) ?? null,
    [state.shippers, selectedCase],
  );
  const derived = useDerived(state, caseId);
  const hasLiveEvents = derived.caseEvents.some((e) => e.receivedAt > 0);

  return (
    <div className="demo-bg flex min-h-screen flex-col font-sans text-mist">
      <StoryHeader selectedCase={selectedCase} shipper={shipper} connected={state.connected} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {!hasLiveEvents && derived.caseEvents.length === 0 ? (
          <>
            <IntroHero />
            <IntakeForm onSubmitted={(id) => setCaseId(id)} />
          </>
        ) : (
          <StoryFeed events={derived.caseEvents} call={derived.call} />
        )}
      </main>

      <ApprovalModal approval={derived.pendingApproval} />

      <LiveVoiceBridge call={derived.call} voiceMode={voiceMode} />

      {!state.connected && state.everConnected ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center">
          <span className="rounded-full border border-ev-danger/40 bg-abyss/90 px-4 py-1.5 text-[11.5px] font-medium text-ev-danger backdrop-blur">
            Agent link lost — reconnecting…
          </span>
        </div>
      ) : null}

      <DevMenu currentDay={state.demo?.day ?? 1} connected={state.connected} />
    </div>
  );
}
