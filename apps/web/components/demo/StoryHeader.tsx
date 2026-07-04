"use client";

import type { CaseRecord, Shipper } from "@clearborder/shared";
import { CASE_STATUS_LABEL } from "@clearborder/shared";
import { ExternalLink } from "lucide-react";
import { flagEmoji } from "@/lib/demo/format";
import { Wordmark } from "./Logo";

export function StoryHeader({
  selectedCase,
  shipper,
  connected,
}: {
  selectedCase: CaseRecord | null;
  shipper: Shipper | null;
  connected: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-abyss/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
        <Wordmark />

        <div className="ml-auto flex items-center gap-3">
          {selectedCase ? (
            <div className="hidden text-right sm:block">
              <p className="m-0 font-mono text-[11px] text-faint">{selectedCase.reference}</p>
              <p className="m-0 text-[13px] font-medium text-mist">
                {shipper ? (
                  <>
                    {flagEmoji(shipper.countryCode)} {shipper.name}
                  </>
                ) : (
                  "Hero case"
                )}
              </p>
            </div>
          ) : null}

          {selectedCase ? (
            <span className="rounded-full border border-line bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] font-medium text-dim">
              {CASE_STATUS_LABEL[selectedCase.status]}
            </span>
          ) : null}

          <a
            href="/portal/login"
            target="_blank"
            className="hidden items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-dim transition-colors hover:border-accent/35 hover:text-mist sm:flex"
          >
            TradeGate
            <ExternalLink size={11} />
          </a>

          <span
            className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium ${
              connected
                ? "border-ev-call/30 bg-ev-call/10 text-ev-call"
                : "border-ev-danger/30 bg-ev-danger/10 text-ev-danger"
            }`}
            title={connected ? "Agent connected" : "Reconnecting to agent"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-ev-call" : "bg-ev-danger animate-pulse-dot"}`}
            />
            {connected ? "Live" : "…"}
          </span>
        </div>
      </div>
    </header>
  );
}
