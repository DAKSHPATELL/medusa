import type { AgentEvent } from "./events";
import type { CaseRecord, Shipper } from "./models";

/**
 * Wire protocol between the agent service (apps/agent) and the dashboard
 * (apps/web). Delivered over WebSocket (`/ws`) and SSE (`/events`).
 */

export type AgentStatus = "idle" | "active" | "sleeping" | "awaiting_approval";

export interface DemoState {
  /** Current demo day (1..3). */
  day: number;
  agentStatus: AgentStatus;
  /** True while the replayer is actively emitting events. */
  playing: boolean;
  /** The case the demo scenario centres on. */
  activeCaseId: string;
  /** If the agent is asleep: when it plans to wake. */
  sleepUntil?: string | null;
}

export interface SnapshotState {
  demo: DemoState;
  cases: CaseRecord[];
  shippers: Shipper[];
}

export type ServerMessage =
  /** First message after connecting: full snapshot + event backlog. */
  | { kind: "hello"; state: SnapshotState; events: AgentEvent[] }
  /** A single new event. */
  | { kind: "event"; event: AgentEvent }
  /** Snapshot refresh (status/case changes, day jumps, resets). */
  | { kind: "state"; state: SnapshotState }
  /** Everything was reset (dashboard should clear its timeline). */
  | { kind: "reset"; state: SnapshotState };

// ─── HTTP API shapes (agent service) ─────────────────────────────────────────

export interface ApprovalDecisionRequest {
  approvalId: string;
  decision: "approve" | "reject";
  /** Who decided — shown in the audit trail. Defaults to "operator". */
  decidedBy?: string;
  reason?: string;
}

export interface ReplayRequest {
  /** Which demo day segment to play (1..3). Defaults to current day. */
  day?: number;
  /** Speed multiplier: 2 = twice as fast. Defaults to 1. */
  speed?: number;
}

export interface HealthResponse {
  ok: boolean;
  service: "clearborder-agent";
  uptimeSec: number;
  db: "connected" | "error";
  now: string;
  /** Which automation modes are active (set at agent startup). */
  modes?: {
    computerUse: "gemini" | "scripted";
    voice: "browser" | "twilio" | "mock";
    geminiAvailable: boolean;
  };
}

// ─── Case intake & orchestrator ──────────────────────────────────────────────

export const ORCHESTRATOR_PHASES = [
  "INTAKE",
  "CALLING_SHIPPER",
  "PORTAL_FILL",
  "AWAITING_APPROVAL",
  "SLEEPING",
  "WAKE",
  "RESOLVED",
] as const;

export type OrchestratorPhase = (typeof ORCHESTRATOR_PHASES)[number];

export interface CaseIntakeRequest {
  /** Importer passport / national ID number for customs filing. */
  importerPassportId: string;
  importerName: string;
  importerVat?: string;
  /** Shipment / tracking reference supplied by the client. */
  shipmentReference: string;
  declaredValue: number;
  /** Commercial invoice total (source of truth). */
  invoiceValue: number;
  currency: string;
  originCountry: string;
  /** ISO 3166-1 alpha-2, e.g. "CN" */
  originCountryCode: string;
  shipperName: string;
  shipperPhone: string;
  shipperLanguageCode?: string;
  exporterName?: string;
  hsCode?: string;
  invoiceNumber?: string;
  trackingNumber?: string;
  description?: string;
  weightKg?: number;
}

export interface CaseIntakeResponse {
  ok: boolean;
  caseId: string;
  reference: string;
  declarationRef: string;
  message: string;
}

export interface CaseStatusResponse {
  case: import("./models").CaseRecord;
  phase: OrchestratorPhase;
  sleepUntil?: string | null;
  pendingApprovalId?: string | null;
}
