const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface ExtractedInvoice {
  waybill_id: string;
  declared_value: number;
  currency: string;
  hs_codes: string[];
  shipper_country: string;
  preferred_language: string;
}

export interface ExecutionLogEntry {
  at: string;
  message: string;
}

export interface StateSnapshot {
  environment_id: string;
  state: string;
  waybill_id?: string;
  declared_value?: number;
  currency?: string;
  hs_codes?: string[];
  shipper_country?: string;
  preferred_language?: string;
  portal_original_value?: number;
  portal_new_value?: number;
  exception_message?: string;
  source_filename?: string;
  execution_logs: ExecutionLogEntry[];
  diff?: {
    field: string;
    before: number;
    after: number;
    currency: string;
  };
}

export interface UploadResponse {
  environment_id: string;
  state: string;
  extracted: ExtractedInvoice;
}

export async function uploadInvoice(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }
  return res.json();
}

export async function fetchState(environmentId: string): Promise<StateSnapshot> {
  const res = await fetch(`${BASE}/api/state/${environmentId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch state");
  return res.json();
}

export async function approveModification(environmentId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/approve/${environmentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Approval failed");
  }
}

export function statusLabel(state: string): string {
  switch (state) {
    case "PENDING_UPLOAD":
      return "Awaiting upload…";
    case "EXTRACTED":
      return "File Processing…";
    case "PORTAL_SYNCING":
      return "Syncing with Customs Portal…";
    case "AWAITING_APPROVAL":
      return "Awaiting Broker Sign-off";
    case "COMPLETED":
      return "Approved — broker may submit on portal";
    case "EXCEPTION_HOLD":
      return "Exception — manual review required";
    default:
      return state;
  }
}
