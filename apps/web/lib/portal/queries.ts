import type {
  AuditEntry,
  CorrespondenceMessage,
  Declaration,
  DeclarationDocument,
  DeclarationStatus,
  PortalUser,
} from "@clearborder/shared";
import { db } from "@/lib/db";

interface DeclarationRow {
  id: string;
  ref: string;
  case_ref: string;
  importer_name: string;
  importer_vat: string | null;
  exporter_name: string;
  origin_country: string;
  origin_country_code: string;
  destination_country: string;
  declared_value: number;
  currency: string;
  hs_code: string;
  invoice_number: string;
  incoterms: string;
  weight_kg: number;
  status: string;
  discrepancy_note: string | null;
  arrived_at: string;
  created_at: string;
  updated_at: string;
}

function declarationFromRow(row: DeclarationRow): Declaration {
  return {
    id: row.id,
    ref: row.ref,
    caseRef: row.case_ref,
    importerName: row.importer_name,
    importerVat: row.importer_vat,
    exporterName: row.exporter_name,
    originCountry: row.origin_country,
    originCountryCode: row.origin_country_code,
    destinationCountry: row.destination_country,
    declaredValue: row.declared_value,
    currency: row.currency,
    hsCode: row.hs_code,
    invoiceNumber: row.invoice_number,
    incoterms: row.incoterms,
    weightKg: row.weight_kg,
    status: row.status as DeclarationStatus,
    discrepancyNote: row.discrepancy_note,
    arrivedAt: row.arrived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DeclarationFilters {
  status?: string;
  query?: string;
}

export function listDeclarations(filters: DeclarationFilters = {}): Declaration[] {
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (filters.status && filters.status !== "ALL") {
    clauses.push("status = @status");
    params.status = filters.status;
  }
  if (filters.query) {
    clauses.push("(ref LIKE @q OR importer_name LIKE @q OR exporter_name LIKE @q)");
    params.q = `%${filters.query}%`;
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db()
    .prepare(`SELECT * FROM declarations ${where} ORDER BY arrived_at DESC`)
    .all(params) as DeclarationRow[];
  return rows.map(declarationFromRow);
}

export function getDeclaration(id: string): Declaration | undefined {
  const row = db()
    .prepare("SELECT * FROM declarations WHERE id = ? OR ref = ?")
    .get(id, id) as DeclarationRow | undefined;
  return row ? declarationFromRow(row) : undefined;
}

export function listDocuments(declarationId: string): DeclarationDocument[] {
  const rows = db()
    .prepare(
      "SELECT id, declaration_id, name, doc_type, size_bytes, uploaded_by, uploaded_at FROM declaration_documents WHERE declaration_id = ? ORDER BY uploaded_at DESC",
    )
    .all(declarationId) as Array<{
    id: string;
    declaration_id: string;
    name: string;
    doc_type: string;
    size_bytes: number;
    uploaded_by: string;
    uploaded_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    declarationId: r.declaration_id,
    name: r.name,
    docType: r.doc_type,
    sizeBytes: r.size_bytes,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
  }));
}

export function listCorrespondence(declarationId: string): CorrespondenceMessage[] {
  const rows = db()
    .prepare(
      "SELECT * FROM correspondence WHERE declaration_id = ? ORDER BY sent_at DESC",
    )
    .all(declarationId) as Array<{
    id: string;
    declaration_id: string;
    sender: string;
    sender_name: string;
    subject: string;
    body: string;
    sent_at: string;
    attachment_name: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    declarationId: r.declaration_id,
    sender: r.sender as CorrespondenceMessage["sender"],
    senderName: r.sender_name,
    subject: r.subject,
    body: r.body,
    sentAt: r.sent_at,
    attachmentName: r.attachment_name,
  }));
}

export function listAudit(declarationId: string): AuditEntry[] {
  const rows = db()
    .prepare("SELECT * FROM audit_log WHERE declaration_id = ? ORDER BY at DESC")
    .all(declarationId) as Array<{
    id: string;
    declaration_id: string;
    at: string;
    actor: string;
    action: string;
    detail: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    declarationId: r.declaration_id,
    at: r.at,
    actor: r.actor,
    action: r.action,
    detail: r.detail,
  }));
}

export function findPortalUser(username: string, password: string): PortalUser | undefined {
  const row = db()
    .prepare(
      "SELECT username, display_name, broker_firm FROM portal_users WHERE username = ? AND password = ?",
    )
    .get(username.trim().toLowerCase(), password) as
    | { username: string; display_name: string; broker_firm: string }
    | undefined;
  return row
    ? { username: row.username, displayName: row.display_name, brokerFirm: row.broker_firm }
    : undefined;
}

export function getPortalUser(username: string): PortalUser | undefined {
  const row = db()
    .prepare("SELECT username, display_name, broker_firm FROM portal_users WHERE username = ?")
    .get(username) as
    | { username: string; display_name: string; broker_firm: string }
    | undefined;
  return row
    ? { username: row.username, displayName: row.display_name, brokerFirm: row.broker_firm }
    : undefined;
}

export interface AmendmentDraft {
  declaredValue: number;
  currency: string;
  hsCode: string;
  invoiceNumber: string;
  incoterms: string;
}

export function getAmendmentDraft(declarationId: string): AmendmentDraft | undefined {
  const row = db()
    .prepare("SELECT payload FROM amendment_drafts WHERE declaration_id = ?")
    .get(declarationId) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as AmendmentDraft) : undefined;
}
