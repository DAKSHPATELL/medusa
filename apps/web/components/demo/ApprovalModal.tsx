"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShieldAlert } from "lucide-react";
import type { AgentEventOf } from "@clearborder/shared";
import { agentPost } from "@/lib/demo/agent-api";

export function ApprovalModal({
  approval,
}: {
  approval: AgentEventOf<"approval.requested"> | null;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    if (!approval || busy) return;
    setBusy(decision);
    try {
      await agentPost("/api/approval", {
        approvalId: approval.approvalId,
        decision,
        decidedBy: "operator",
      });
    } finally {
      setTimeout(() => setBusy(null), 4000);
    }
  };

  return (
    <AnimatePresence>
      {approval ? (
        <motion.div
          key={approval.approvalId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 p-6 backdrop-blur-md"
          data-testid="approval-modal"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-ev-approval/35 bg-[#0d0f14]/95 shadow-[0_0_80px_-12px_rgba(251,191,36,0.4)]"
            data-testid="approval-card"
          >
            <div className="flex items-center gap-2.5 border-b border-ev-approval/20 bg-ev-approval/[0.08] px-5 py-3.5">
              <ShieldAlert size={18} className="text-ev-approval" />
              <span className="font-display text-[12px] font-bold uppercase tracking-[0.2em] text-ev-approval">
                Your approval is needed
              </span>
            </div>

            <div className="px-5 py-5">
              <p className="m-0 text-[15px] leading-relaxed text-mist">{approval.summary}</p>

              <div className="mt-4 overflow-hidden rounded-lg border border-line">
                {approval.diff.map((d, i) => (
                  <div
                    key={d.field}
                    className={`grid grid-cols-[1fr_auto_24px_auto] items-center gap-3 px-3.5 py-2.5 ${
                      i > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <span className="text-[12px] font-medium text-dim">{d.label ?? d.field}</span>
                    <span className="text-right font-mono text-[12.5px] text-ev-danger/90 line-through">
                      {d.before}
                    </span>
                    <span className="text-center text-[12px] text-faint">→</span>
                    <span className="text-right font-mono text-[13px] font-semibold text-ev-call">
                      {d.after}
                    </span>
                  </div>
                ))}
              </div>

              {approval.risk ? (
                <p className="mt-3 mb-0 text-[12.5px] leading-relaxed text-ev-approval/80">
                  ⚠ {approval.risk}
                </p>
              ) : null}

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => decide("approve")}
                  disabled={busy !== null}
                  data-testid="approval-approve"
                  className="flex-1 cursor-pointer rounded-xl border border-ev-call/40 bg-ev-call/15 px-4 py-3 text-[14px] font-semibold text-ev-call transition-all hover:bg-ev-call/25 disabled:cursor-wait disabled:opacity-50"
                >
                  {busy === "approve" ? "Approving…" : "Approve & submit"}
                </button>
                <button
                  onClick={() => decide("reject")}
                  disabled={busy !== null}
                  data-testid="approval-reject"
                  className="cursor-pointer rounded-xl border border-line bg-white/[0.04] px-4 py-3 text-[14px] font-medium text-dim transition-colors hover:border-ev-danger/40 hover:text-ev-danger disabled:cursor-wait disabled:opacity-50"
                >
                  {busy === "reject" ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
