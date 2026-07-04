/**
 * TradeGate portal domain — the mock customs system the browser-automation
 * workstream operates against. Kept in shared so scripted fallbacks and
 * assertions can be typed.
 */

export const DECLARATION_STATUSES = [
  "PENDING_REVIEW",
  "HELD_VALUATION",
  "AWAITING_DOCS",
  "AMENDMENT_REVIEW",
  "CLEARED",
] as const;

export type DeclarationStatus = (typeof DECLARATION_STATUSES)[number];

export interface Declaration {
  id: string;
  /** Portal reference, e.g. "FCBA-2026-04417". */
  ref: string;
  /** ClearBorder case reference this maps to, e.g. "CB-2481". */
  caseRef: string;
  importerName: string;
  importerVat?: string | null;
  exporterName: string;
  originCountry: string;
  originCountryCode: string;
  destinationCountry: string;
  declaredValue: number;
  currency: string;
  hsCode: string;
  invoiceNumber: string;
  incoterms: string;
  weightKg: number;
  status: DeclarationStatus;
  /** Text of the discrepancy notice banner, if flagged. */
  discrepancyNote?: string | null;
  arrivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeclarationDocument {
  id: string;
  declarationId: string;
  name: string;
  docType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

export type CorrespondenceSender = "officer" | "broker" | "system";

export interface CorrespondenceMessage {
  id: string;
  declarationId: string;
  sender: CorrespondenceSender;
  senderName: string;
  subject: string;
  body: string;
  sentAt: string;
  attachmentName?: string | null;
}

export interface AuditEntry {
  id: string;
  declarationId: string;
  at: string;
  actor: string;
  action: string;
  detail?: string | null;
}

export interface PortalUser {
  username: string;
  displayName: string;
  brokerFirm: string;
}

// data-testid values used on key portal controls (scripted-fallback contract).
export const PORTAL_TEST_IDS = {
  loginUsername: "portal-username",
  loginPassword: "portal-password",
  loginSubmit: "portal-sign-in",
  caseRow: (ref: string) => `case-row-${ref}`,
  amendButton: "amend-declaration",
  amendDeclaredValue: "amend-declared-value",
  amendCurrency: "amend-currency",
  amendHsCode: "amend-hs-code",
  amendInvoiceNumber: "amend-invoice-number",
  amendIncoterms: "amend-incoterms",
  amendContinue: "amend-continue",
  reviewDeclarationCheckbox: "review-declare-truthful",
  reviewSubmit: "review-submit",
  confirmSubmit: "confirm-submit",
  confirmCancel: "confirm-cancel",
  tab: (tab: string) => `tab-${tab}`,
  uploadDocType: "upload-doc-type",
  uploadFile: "upload-file",
  replyBody: "reply-body",
  uploadSubmit: "upload-submit",
} as const;
