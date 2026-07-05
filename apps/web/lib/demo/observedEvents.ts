import type { AgentEvent, CaseRecord, DeclarationTimelineSnapshot } from "@clearborder/shared";
import {
  CASE_STATUS_LABEL,
  DECLARATION_STATUS_LABEL,
} from "@clearborder/shared";
import type { ReceivedEvent } from "./useAgentStream";
import { durationLabel } from "./format";

/** Agent events treated as observed facts for the live timeline (no thoughts/transcripts). */
export const OBSERVED_AGENT_EVENT_TYPES = new Set<AgentEvent["type"]>([
  "case.status_changed",
  "browser.action",
  "browser.screenshot",
  "approval.granted",
  "approval.rejected",
  "call.started",
  "call.ended",
  "agent.wake",
  "agent.sleep",
]);

export interface ObservedTimelineEntry {
  id: string;
  at: string;
  source: "agent" | "declaration" | "case";
  type: string;
  summary: string;
  detail?: string;
  /** True when the event arrived over WebSocket after initial hello. */
  live: boolean;
}

export function formatObservedAgentEvent(event: AgentEvent): { summary: string; detail?: string } {
  switch (event.type) {
    case "case.status_changed":
      return {
        summary: `Case status → ${CASE_STATUS_LABEL[event.to] ?? event.to}`,
        detail: event.reason,
      };
    case "browser.action":
      return {
        summary: event.description,
        detail: event.url,
      };
    case "browser.screenshot":
      return {
        summary: event.caption ?? "Portal screenshot captured",
      };
    case "approval.granted":
      return { summary: "Approval granted" };
    case "approval.rejected":
      return {
        summary: "Approval rejected",
        detail: event.reason,
      };
    case "call.started":
      return {
        summary: `${event.direction === "outbound" ? "Outbound" : "Inbound"} call started`,
        detail: `${event.shipperName} · ${event.phone}`,
      };
    case "call.ended":
      return {
        summary: "Call ended",
        detail: event.summary ?? `Duration ${durationLabel(event.durationSec)}`,
      };
    case "agent.wake":
      return {
        summary: "Agent woke",
        detail: event.recap,
      };
    case "agent.sleep":
      return {
        summary: "Agent sleeping",
        detail: event.reason,
      };
    default:
      return { summary: event.type };
  }
}

export function buildObservedTimelineEntries(
  selectedCase: CaseRecord | null,
  caseEvents: ReceivedEvent[],
  declaration: DeclarationTimelineSnapshot | null,
): ObservedTimelineEntry[] {
  if (!selectedCase) return [];

  const entries: ObservedTimelineEntry[] = [
    {
      id: `case-opened-${selectedCase.id}`,
      at: selectedCase.createdAt,
      source: "case",
      type: "case.opened",
      summary: "Case opened",
      detail: selectedCase.reference,
      live: false,
    },
  ];

  for (const event of caseEvents) {
    if (event.caseId && event.caseId !== selectedCase.id) continue;
    if (!OBSERVED_AGENT_EVENT_TYPES.has(event.type)) continue;

    const { summary, detail } = formatObservedAgentEvent(event);
    entries.push({
      id: event.id,
      at: event.at,
      source: "agent",
      type: event.type,
      summary,
      detail,
      live: event.receivedAt > 0,
    });
  }

  if (declaration?.arrivedAt) {
    entries.push({
      id: `declaration-arrived-${selectedCase.id}`,
      at: declaration.arrivedAt,
      source: "declaration",
      type: "declaration.arrived",
      summary: "Arrived at customs (declaration)",
      live: false,
    });
  }

  if (declaration?.status && declaration.updatedAt) {
    entries.push({
      id: `declaration-status-${declaration.updatedAt}-${declaration.status}`,
      at: declaration.updatedAt,
      source: "declaration",
      type: "declaration.status",
      summary: `Declaration → ${DECLARATION_STATUS_LABEL[declaration.status] ?? declaration.status}`,
      live: false,
    });
  }

  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
}
