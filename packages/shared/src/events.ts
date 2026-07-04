import type { CaseStatus, MemoryRecord } from "./models";

/**
 * AgentEvent — the single stream that drives the mission-control dashboard.
 *
 * Every workstream (call/translation, browser automation, memory engine,
 * orchestrator) communicates with the UI exclusively by emitting these events
 * through the agent service hub (`POST` internally / WS + SSE outward).
 */

// ─── Common envelope ─────────────────────────────────────────────────────────

export interface AgentEventBase {
  /** Unique event id (uuid). Assigned by the hub. */
  id: string;
  /** Monotonic sequence number, assigned by the hub. Use for ordering. */
  seq: number;
  /** ISO timestamp. The demo replayer uses a synthetic clock per demo day. */
  at: string;
  /** Demo/case day this event belongs to (1-based). Drives the DAY separators. */
  day: number;
  /** Case this event relates to, if any. */
  caseId?: string;
}

// ─── Speakers & languages ────────────────────────────────────────────────────

export type Speaker = "agent" | "shipper";

export interface TranscriptFields {
  callId: string;
  speaker: Speaker;
  /** BCP-47 of what was actually said, e.g. "zh-CN". */
  sourceLang: string;
  /** BCP-47 of the live translation, e.g. "en". */
  targetLang: string;
  sourceText: string;
  translatedText: string;
}

// ─── Browser ─────────────────────────────────────────────────────────────────

export type BrowserActionKind = "click" | "type" | "navigate" | "scroll" | "press";

/** Reference to a screenshot: either a servable path/URL or inline base64. */
export type ScreenshotRef =
  | { kind: "path"; path: string }
  | { kind: "base64"; data: string; mimeType?: string };

// ─── Approvals ───────────────────────────────────────────────────────────────

export interface FieldDiff {
  field: string;
  /** Human label, e.g. "Declared value". */
  label?: string;
  before: string;
  after: string;
}

// ─── The discriminated union ─────────────────────────────────────────────────

export type AgentEventPayload =
  | {
      type: "case.status_changed";
      from: CaseStatus;
      to: CaseStatus;
      reason?: string;
    }
  | {
      type: "agent.thought";
      text: string;
    }
  | {
      type: "call.started";
      callId: string;
      phone: string;
      shipperName: string;
      direction: "outbound" | "inbound";
      /** Language the counterparty speaks, e.g. "zh-CN". */
      sourceLang: string;
      /** Language the operator reads, e.g. "en". */
      targetLang: string;
    }
  | ({ type: "call.transcript_partial" } & TranscriptFields)
  | ({ type: "call.transcript_final" } & TranscriptFields)
  | {
      type: "call.ended";
      callId: string;
      durationSec: number;
      summary?: string;
    }
  | {
      type: "browser.action";
      action: BrowserActionKind;
      /** Human caption, e.g. `Clicking "Amend declaration"`. */
      description: string;
      url?: string;
      coordinates?: { x: number; y: number };
      /** Text typed, for `type` actions. */
      text?: string;
      /** data-testid of the target control, when known (scripted fallback). */
      targetTestId?: string;
    }
  | {
      type: "browser.screenshot";
      ref: ScreenshotRef;
      caption?: string;
    }
  | {
      type: "memory.read";
      record: MemoryRecord;
      /** Why the agent recalled this, e.g. "Restoring case context after sleep". */
      why: string;
    }
  | {
      type: "memory.write";
      record: MemoryRecord;
    }
  | {
      type: "approval.requested";
      approvalId: string;
      /** One-sentence summary of the pending irreversible action. */
      summary: string;
      /** Optional extra risk note shown under the diff. */
      risk?: string;
      diff: FieldDiff[];
    }
  | {
      type: "approval.granted";
      approvalId: string;
      decidedBy?: string;
    }
  | {
      type: "approval.rejected";
      approvalId: string;
      decidedBy?: string;
      reason?: string;
    }
  | {
      type: "agent.sleep";
      /** ISO timestamp the agent intends to wake at. */
      until: string;
      reason?: string;
    }
  | {
      type: "agent.wake";
      /** The recap the agent gives itself (and the audience) on waking. */
      recap: string;
    };

export type AgentEvent = AgentEventBase & AgentEventPayload;

export type AgentEventType = AgentEvent["type"];

export type AgentEventOf<T extends AgentEventType> = Extract<AgentEvent, { type: T }>;

type DistributiveOmit<T, K extends keyof AgentEventBase> = T extends unknown
  ? Omit<T, K>
  : never;

/**
 * What emitters hand to the hub — the hub assigns id/seq/at/day.
 * `at` may be provided to override the synthetic clock.
 */
export type AgentEventInput = DistributiveOmit<AgentEvent, "id" | "seq"> extends infer U
  ? U extends { at: string; day: number }
    ? Omit<U, "at" | "day"> & { at?: string; day?: number }
    : never
  : never;

export function isCallEvent(
  e: AgentEvent,
): e is AgentEventOf<"call.started" | "call.transcript_partial" | "call.transcript_final" | "call.ended"> {
  return e.type.startsWith("call.");
}

export function isMemoryEvent(e: AgentEvent): e is AgentEventOf<"memory.read" | "memory.write"> {
  return e.type.startsWith("memory.");
}

export function isBrowserEvent(e: AgentEvent): e is AgentEventOf<"browser.action" | "browser.screenshot"> {
  return e.type.startsWith("browser.");
}
