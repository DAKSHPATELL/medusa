"use client";

import type { CaseRecord, CaseStatus, Shipper } from "@clearborder/shared";
import { CASE_STATUS_LABEL } from "@clearborder/shared";
import { flagEmoji } from "@/lib/dashboard/format";

const STATUS_CHIP: Record<CaseStatus, string> = {
  NEW: "text-dim border-line bg-white/[0.03]",
  HELD_VALUATION: "text-ev-danger border-ev-danger/30 bg-ev-danger/10",
  AWAITING_SHIPPER: "text-ev-approval border-ev-approval/30 bg-ev-approval/10",
  PENDING_APPROVAL: "text-ev-approval border-ev-approval/30 bg-ev-approval/10",
  AWAITING_DOCS: "text-ev-approval border-ev-approval/30 bg-ev-approval/10",
  SLEEPING: "text-ev-sleep border-ev-sleep/30 bg-ev-sleep/10",
  RESOLVED: "text-ev-call border-ev-call/30 bg-ev-call/10",
};

function needsAttention(c: CaseRecord): boolean {
  return c.status === "HELD_VALUATION" || c.status === "PENDING_APPROVAL";
}

export function CaseRail({
  cases,
  shippers,
  selectedId,
  onSelect,
  pinnedId,
}: {
  cases: CaseRecord[];
  shippers: Shipper[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pinnedId?: string | null;
}) {
  const shipperById = new Map(shippers.map((s) => [s.id, s]));
  const open = cases.filter((c) => c.status !== "RESOLVED").length;
  // Stable order: the demo's hero case stays pinned on top, rest by recency.
  const ordered = [...cases].sort((a, b) => {
    if (a.id === pinnedId) return -1;
    if (b.id === pinnedId) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <aside className="glass flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-dim">
          Case queue
        </h2>
        <span className="font-mono text-[11px] text-faint">
          <span className="text-mist">{open}</span> open · {cases.length} total
        </span>
      </div>

      <div className="dash-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {ordered.map((c) => {
          const shipper = shipperById.get(c.shipperId);
          const selected = c.id === selectedId;
          const attention = needsAttention(c);
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              data-testid={`queue-case-${c.reference}`}
              className={[
                "w-full cursor-pointer rounded-xl border p-3 text-left transition-colors duration-150",
                selected
                  ? "border-accent/40 bg-accent/[0.07]"
                  : "border-line bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.045]",
                attention ? "animate-attention" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[12.5px] font-semibold text-mist">
                  {c.reference}
                </span>
                <span className="flex items-center gap-1.5">
                  {attention ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-ev-danger animate-pulse-dot" />
                  ) : null}
                  <span className="rounded-md border border-line bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-medium text-dim">
                    D{c.dayCount}
                  </span>
                </span>
              </div>

              <p className="mt-1.5 mb-0 flex items-center gap-1.5 truncate text-[12.5px] text-dim">
                <span className="text-[14px] leading-none">
                  {shipper ? flagEmoji(shipper.countryCode) : "🌐"}
                </span>
                <span className="truncate">{shipper?.name ?? "Unknown shipper"}</span>
              </p>
              <p className="mt-0.5 mb-2 truncate text-[11.5px] text-faint">
                {c.shipment.description}
              </p>

              <span
                className={`inline-block rounded-full border px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide ${STATUS_CHIP[c.status]}`}
              >
                {CASE_STATUS_LABEL[c.status]}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
