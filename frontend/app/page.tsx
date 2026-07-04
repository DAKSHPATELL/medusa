"use client";

import { AlertCircle, Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApprovalPanel } from "@/components/approval-panel";
import { FileUpload } from "@/components/file-upload";
import {
  approveModification,
  fetchState,
  statusLabel,
  uploadInvoice,
  type StateSnapshot,
} from "@/lib/api";

const TERMINAL = new Set(["COMPLETED", "EXCEPTION_HOLD"]);

export default function SenderPage() {
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!environmentId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await fetchState(environmentId);
        if (!cancelled) {
          setSnapshot(data);
          if (TERMINAL.has(data.state)) cancelled = true;
        }
      } catch {
        if (!cancelled) setError("Lost connection to backend");
      }
    };

    void poll();
    const id = setInterval(() => {
      if (!cancelled) void poll();
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [environmentId]);

  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    setSnapshot(null);
    const res = await uploadInvoice(file);
    setEnvironmentId(res.environment_id);
    setSnapshot({
      environment_id: res.environment_id,
      state: res.state,
      waybill_id: res.extracted.waybill_id,
      declared_value: res.extracted.declared_value,
      currency: res.extracted.currency,
      execution_logs: [],
    });
  }, []);

  const handleApprove = useCallback(async () => {
    if (!environmentId) return;
    setApproving(true);
    setError(null);
    try {
      await approveModification(environmentId);
      setSnapshot(await fetchState(environmentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }, [environmentId]);

  const busy = Boolean(
    snapshot &&
      !TERMINAL.has(snapshot.state) &&
      snapshot.state !== "AWAITING_APPROVAL",
  );

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Package className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">ClearBorder</h1>
        <p className="mt-1 text-sm text-slate-500">Upload → Process → Verify</p>
      </header>

      {!environmentId && <FileUpload onUpload={handleUpload} />}

      {snapshot && (
        <section className="mt-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <p className="font-medium text-slate-800">{statusLabel(snapshot.state)}</p>
            {snapshot.waybill_id && (
              <p className="mt-0.5 text-slate-500">
                Ref <span className="font-mono">{snapshot.waybill_id}</span>
              </p>
            )}
          </div>

          <ApprovalPanel snapshot={snapshot} onApprove={handleApprove} approving={approving} />

          {snapshot.state === "EXCEPTION_HOLD" && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Exception hold</p>
                <p className="mt-1">{snapshot.exception_message ?? "Manual review required."}</p>
              </div>
            </div>
          )}

          {busy && (
            <p className="text-center text-xs text-slate-400">Polling state…</p>
          )}
        </section>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {environmentId && TERMINAL.has(snapshot?.state ?? "") && (
        <button
          type="button"
          className="mt-8 w-full text-sm text-slate-500 underline"
          onClick={() => {
            setEnvironmentId(null);
            setSnapshot(null);
            setError(null);
          }}
        >
          Send another invoice
        </button>
      )}
    </main>
  );
}
