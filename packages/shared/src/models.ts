/**
 * Core domain models shared by the agent service, voice cognition, and the
 * internal demo observer — not exposed as a customer dashboard.
 */

// ─── Case ────────────────────────────────────────────────────────────────────

export const CASE_STATUSES = [
  "NEW",
  "HELD_VALUATION",
  "AWAITING_SHIPPER",
  "PENDING_APPROVAL",
  "AWAITING_DOCS",
  "SLEEPING",
  "RESOLVED",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export interface Consignee {
  name: string;
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2, e.g. "CH" */
  countryCode: string;
  vatNumber?: string;
}

export interface Shipment {
  description: string;
  quantity?: string;
  trackingNumber: string;
  carrier: string;
  originCity: string;
  originCountry: string;
  /** ISO 3166-1 alpha-2, e.g. "CN" */
  originCountryCode: string;
  /** Customs value as currently declared. */
  declaredValue: number;
  currency: string;
  /** Total on the commercial invoice (source of truth). */
  invoiceValue: number;
  invoiceNumber: string;
  hsCode: string;
  incoterms: string;
  weightKg?: number;
}

export interface CaseRecord {
  id: string;
  /** Human reference shown in voice lookup and demo UI, e.g. "CB-2481". */
  reference: string;
  /** Reference of the matching declaration in the customs portal, e.g. "FCBA-2026-04417". */
  declarationRef: string;
  status: CaseStatus;
  /** How many days the agent has been working this case (1-based). */
  dayCount: number;
  createdAt: string;
  updatedAt: string;
  shipperId: string;
  consignee: Consignee;
  shipment: Shipment;
  /** Short explanation of the current hold, if any. */
  heldReason?: string;
  /** Importer passport / ID for customs filing (intake cases). */
  importerPassportId?: string;
  /** Orchestrator state machine phase. */
  orchestratorPhase?: string;
  /** When the agent plans to wake (ISO), if sleeping. */
  sleepUntil?: string | null;
}

// ─── Shipper ─────────────────────────────────────────────────────────────────

export interface LearnedPattern {
  id: string;
  /** e.g. "Recurring decimal-point errors in declared values." */
  text: string;
  /** 0..1 */
  confidence: number;
  createdAt: string;
}

export interface Shipper {
  id: string;
  name: string;
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2, e.g. "CN" */
  countryCode: string;
  /** Human label, e.g. "Mandarin". */
  language: string;
  /** BCP-47, e.g. "zh-CN". */
  languageCode: string;
  phone: string;
  /** Patterns the agent has learned about this shipper over time. */
  learnedPatterns: LearnedPattern[];
}

// ─── Memory ──────────────────────────────────────────────────────────────────

export const MEMORY_TYPES = ["episodic", "semantic", "procedural"] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface MemoryRecord {
  id: string;
  caseId?: string | null;
  shipperId?: string | null;
  type: MemoryType;
  content: string;
  /** Where this memory came from, e.g. "Call with shipper, Day 1" or "Case CB-2103 archive". */
  source: string;
  createdAt: string;
  lastRecalledAt?: string | null;
}
