"use client";

import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import type { StateSnapshot } from "@/lib/api";

interface ApprovalPanelProps {
  snapshot: StateSnapshot;
  onApprove: () => Promise<void>;
  approving: boolean;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function ApprovalPanel({ snapshot, onApprove, approving }: ApprovalPanelProps) {
  const diff = snapshot.diff;
  const currency = diff?.currency ?? snapshot.currency ?? "USD";

  if (snapshot.state === "COMPLETED") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <h2 className="font-semibold text-emerald-900">Document modification approved</h2>
            <p className="mt-1 text-sm text-emerald-800">
              Broker may now submit on the customs portal. Automation never clicked final submit.
            </p>
            <a
              href="http://localhost:8000/mock-customs/login"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 underline"
            >
              Open mock portal <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (snapshot.state !== "AWAITING_APPROVAL" || !diff) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-amber-600" />
        <h2 className="font-semibold text-slate-900">Verify declaration change</h2>
      </div>

      <p className="mb-4 text-sm text-slate-600">
        Waybill <span className="font-mono font-medium">{snapshot.waybill_id}</span> — review the
        corrected declared value before broker sign-off.
      </p>

      <div className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Portal (before)</p>
          <p className="mt-1 text-lg font-semibold text-slate-800 line-through decoration-red-400">
            {formatMoney(diff.before, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Invoice (after)</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">
            {formatMoney(diff.after, currency)}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={approving}
        onClick={() => void onApprove()}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
      >
        {approving ? "Approving…" : "Approve Document Modification"}
      </button>
    </div>
  );
}
