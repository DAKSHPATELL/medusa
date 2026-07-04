"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Package, Send } from "lucide-react";
import { agentPost } from "@/lib/demo/agent-api";

interface IntakeFormProps {
  onSubmitted?: (caseId: string) => void;
}

export function IntakeForm({ onSubmitted }: IntakeFormProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      importerPassportId: String(fd.get("passportId") ?? ""),
      importerName: String(fd.get("importerName") ?? ""),
      importerVat: String(fd.get("importerVat") ?? "") || undefined,
      shipmentReference: String(fd.get("shipmentRef") ?? ""),
      declaredValue: Number(fd.get("declaredValue")),
      invoiceValue: Number(fd.get("invoiceValue")),
      currency: String(fd.get("currency") ?? "USD"),
      originCountry: String(fd.get("originCountry") ?? "China"),
      originCountryCode: String(fd.get("originCode") ?? "CN"),
      shipperName: String(fd.get("shipperName") ?? ""),
      shipperPhone: String(fd.get("shipperPhone") ?? ""),
      shipperLanguageCode: String(fd.get("shipperLang") ?? "zh-CN"),
      trackingNumber: String(fd.get("trackingNumber") ?? "") || undefined,
      invoiceNumber: String(fd.get("invoiceNumber") ?? "") || undefined,
      description: String(fd.get("description") ?? "") || undefined,
    };
    try {
      const res = await agentPost("/api/cases/intake", body);
      const data = (await res.json()) as { caseId?: string; reference?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuccess(`Case ${data.reference} — agent is working`);
      onSubmitted?.(data.caseId ?? "");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Intake failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="intake-open"
        className="mx-auto mt-8 flex cursor-pointer items-center gap-2 rounded-xl border border-accent/35 bg-accent/10 px-5 py-3 text-[14px] font-medium text-accent transition-colors hover:bg-accent/18"
      >
        <Package size={16} />
        Submit a real case
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-8 w-full max-w-lg rounded-2xl border border-line bg-[#0d0f14]/90 p-6 text-left shadow-xl"
      data-testid="intake-form"
    >
      <h2 className="m-0 font-display text-lg font-semibold text-mist">New customs case</h2>
      <p className="mt-2 mb-5 text-[13px] text-dim">
        Passport and shipment details a broker needs — the agent will call the shipper, fill
        TradeGate, and pause for your approval.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-faint">Importer passport ID</span>
            <input
              name="passportId"
              required
              placeholder="P12345678"
              className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[14px] text-mist outline-none focus:border-accent/50"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-faint">Importer name</span>
            <input
              name="importerName"
              required
              placeholder="Alpenrose Electronics GmbH"
              className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[14px] text-mist outline-none focus:border-accent/50"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-faint">Shipment reference</span>
          <input
            name="shipmentRef"
            required
            placeholder="RX448291023CN"
            className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[14px] text-mist outline-none focus:border-accent/50"
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="block col-span-1">
            <span className="text-[11px] uppercase tracking-wider text-faint">Declared value</span>
            <input
              name="declaredValue"
              type="number"
              step="0.01"
              required
              defaultValue="240"
              className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 font-mono text-[14px] text-mist outline-none focus:border-accent/50"
            />
          </label>
          <label className="block col-span-1">
            <span className="text-[11px] uppercase tracking-wider text-faint">Invoice value</span>
            <input
              name="invoiceValue"
              type="number"
              step="0.01"
              required
              defaultValue="2400"
              className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 font-mono text-[14px] text-mist outline-none focus:border-accent/50"
            />
          </label>
          <label className="block col-span-1">
            <span className="text-[11px] uppercase tracking-wider text-faint">Currency</span>
            <select
              name="currency"
              defaultValue="USD"
              className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[14px] text-mist outline-none"
            >
              <option>USD</option>
              <option>EUR</option>
              <option>CHF</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-faint">Shipper name</span>
            <input
              name="shipperName"
              required
              defaultValue="Shenzhen Bright Electronics Co."
              className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[14px] text-mist outline-none focus:border-accent/50"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-faint">Shipper phone</span>
            <input
              name="shipperPhone"
              required
              defaultValue="+86 755 0000 0000"
              className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[14px] text-mist outline-none focus:border-accent/50"
            />
          </label>
        </div>

        <input type="hidden" name="originCountry" value="China" />
        <input type="hidden" name="originCode" value="CN" />
        <input type="hidden" name="shipperLang" value="zh-CN" />

        {error ? <p className="m-0 text-[13px] text-ev-danger">{error}</p> : null}
        {success ? <p className="m-0 text-[13px] text-ev-call">{success}</p> : null}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            data-testid="intake-submit"
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/15 py-3 text-[14px] font-semibold text-accent disabled:opacity-50"
          >
            <Send size={15} />
            {busy ? "Starting agent…" : "Start agent"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-xl border border-line px-4 py-3 text-[14px] text-dim hover:text-mist"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}
