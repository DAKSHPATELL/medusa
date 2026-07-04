import type { CaseStatus, MemoryType } from "./models";
import type { DeclarationStatus } from "./portal";

/** Dashboard-facing labels for case statuses. */
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  NEW: "New",
  HELD_VALUATION: "Held · Valuation",
  AWAITING_SHIPPER: "Awaiting shipper",
  PENDING_APPROVAL: "Pending approval",
  AWAITING_DOCS: "Awaiting documents",
  SLEEPING: "Sleeping",
  RESOLVED: "Resolved",
};

/** Official portal-facing labels for declaration statuses. */
export const DECLARATION_STATUS_LABEL: Record<DeclarationStatus, string> = {
  PENDING_REVIEW: "Pending review",
  HELD_VALUATION: "Held — Valuation query",
  AWAITING_DOCS: "Awaiting documents",
  AMENDMENT_REVIEW: "Amendment under review",
  CLEARED: "Cleared",
};

export const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  episodic: "Episodic",
  semantic: "Semantic",
  procedural: "Procedural",
};
