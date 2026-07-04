import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { CaseIntakeRequest, Consignee, OrchestratorPhase, Shipment } from "@clearborder/shared";
import { getCase } from "./db";

let caseCounter = 2500;

export function nextCaseReference(db: Database.Database): string {
  const maxRow = db
    .prepare("SELECT reference FROM cases ORDER BY reference DESC LIMIT 1")
    .get() as { reference: string } | undefined;
  if (maxRow?.reference?.startsWith("CB-")) {
    const n = parseInt(maxRow.reference.slice(3), 10);
    if (!Number.isNaN(n)) caseCounter = Math.max(caseCounter, n + 1);
  }
  return `CB-${caseCounter++}`;
}

export function nextDeclarationRef(db: Database.Database): string {
  const year = new Date().getFullYear();
  const count = (db.prepare("SELECT COUNT(*) n FROM declarations").get() as { n: number }).n;
  return `FCBA-${year}-${String(4417 + count).padStart(5, "0")}`;
}

export interface IntakeResult {
  caseId: string;
  reference: string;
  declarationRef: string;
  declarationId: string;
  shipperId: string;
}

/** Create case + portal declaration from intake form. */
export function createCaseFromIntake(
  db: Database.Database,
  intake: CaseIntakeRequest,
): IntakeResult {
  const now = new Date().toISOString();
  const reference = nextCaseReference(db);
  const caseId = reference;
  const declarationRef = nextDeclarationRef(db);
  const declarationId = `dec-${declarationRef.slice(-5).replace("-", "")}`;
  const shipperId = `shp-${intake.shipperName.toLowerCase().replace(/\W+/g, "-").slice(0, 24)}-${Date.now().toString(36)}`;

  const langCode = intake.shipperLanguageCode ?? "zh-CN";
  const langLabel =
    langCode.startsWith("zh") ? "Mandarin" : langCode.startsWith("tr") ? "Turkish" : "English";

  db.prepare(
    `INSERT INTO shippers (id, name, city, country, country_code, language, language_code, phone, learned_patterns)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]')`,
  ).run(
    shipperId,
    intake.shipperName,
    intake.originCountry,
    intake.originCountry,
    intake.originCountryCode,
    langLabel,
    langCode,
    intake.shipperPhone,
  );

  const consignee: Consignee = {
    name: intake.importerName,
    city: "Zürich",
    country: "Switzerland",
    countryCode: "CH",
    vatNumber: intake.importerVat,
  };

  const shipment: Shipment = {
    description: intake.description ?? "Imported goods",
    trackingNumber: intake.trackingNumber ?? intake.shipmentReference,
    carrier: "International Post",
    originCity: intake.originCountry,
    originCountry: intake.originCountry,
    originCountryCode: intake.originCountryCode,
    declaredValue: intake.declaredValue,
    currency: intake.currency,
    invoiceValue: intake.invoiceValue,
    invoiceNumber: intake.invoiceNumber ?? `INV-${intake.shipmentReference}`,
    hsCode: intake.hsCode ?? "8517.62.00",
    incoterms: "DAP",
    weightKg: intake.weightKg ?? 10,
  };

  const hasDiscrepancy = Math.abs(intake.declaredValue - intake.invoiceValue) > 0.01;
  const heldReason = hasDiscrepancy
    ? `Declared value ${intake.currency} ${intake.declaredValue.toFixed(2)} inconsistent with invoice (${intake.currency} ${intake.invoiceValue.toFixed(2)}).`
    : undefined;

  db.prepare(
    `INSERT INTO cases (id, reference, declaration_ref, status, day_count, created_at, updated_at, shipper_id, held_reason, consignee, shipment, importer_passport_id, orchestrator_phase, sleep_until, pending_approval_id)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'INTAKE', NULL, NULL)`,
  ).run(
    caseId,
    reference,
    declarationRef,
    hasDiscrepancy ? "HELD_VALUATION" : "NEW",
    now,
    now,
    shipperId,
    heldReason ?? null,
    JSON.stringify(consignee),
    JSON.stringify(shipment),
    intake.importerPassportId,
  );

  db.prepare(
    `INSERT INTO declarations (id, ref, case_ref, importer_name, importer_vat, exporter_name, origin_country, origin_country_code, destination_country,
      declared_value, currency, hs_code, invoice_number, incoterms, weight_kg, status, discrepancy_note, arrived_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Switzerland', ?, ?, ?, ?, 'DAP', ?, ?, ?, ?, ?, ?)`,
  ).run(
    declarationId,
    declarationRef,
    reference,
    intake.importerName,
    intake.importerVat ?? null,
    intake.exporterName ?? intake.shipperName,
    intake.originCountry,
    intake.originCountryCode,
    intake.declaredValue,
    intake.currency,
    intake.hsCode ?? "8517.62.00",
    shipment.invoiceNumber,
    intake.weightKg ?? 10,
    hasDiscrepancy ? "HELD_VALUATION" : "PENDING_REVIEW",
    hasDiscrepancy ? heldReason : null,
    now,
    now,
    now,
  );

  db.prepare(
    `INSERT INTO audit_log (id, declaration_id, at, actor, action, detail) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    declarationId,
    now,
    "System",
    "Declaration lodged",
    `Electronic declaration submitted via ClearBorder intake (passport ${intake.importerPassportId}).`,
  );

  return { caseId, reference, declarationRef, declarationId, shipperId };
}

export function setCasePhase(
  db: Database.Database,
  caseId: string,
  phase: OrchestratorPhase,
  extra?: { sleepUntil?: string; pendingApprovalId?: string },
): void {
  db.prepare(
    `UPDATE cases SET orchestrator_phase = ?, sleep_until = COALESCE(?, sleep_until), pending_approval_id = COALESCE(?, pending_approval_id), updated_at = ? WHERE id = ?`,
  ).run(
    phase,
    extra?.sleepUntil ?? null,
    extra?.pendingApprovalId ?? null,
    new Date().toISOString(),
    caseId,
  );
}

export function getDeclarationId(db: Database.Database, declarationRef: string): string | undefined {
  const row = db.prepare("SELECT id FROM declarations WHERE ref = ?").get(declarationRef) as
    | { id: string }
    | undefined;
  return row?.id;
}

export function loadCaseContext(db: Database.Database, caseId: string) {
  const c = getCase(db, caseId);
  if (!c) return null;
  const shipper = db.prepare("SELECT * FROM shippers WHERE id = ?").get(c.shipperId) as
    | {
        id: string;
        name: string;
        phone: string;
        language_code: string;
        language: string;
        city: string;
        country: string;
        country_code: string;
        learned_patterns: string;
      }
    | undefined;
  const declId = getDeclarationId(db, c.declarationRef);
  return { case: c, shipper, declarationId: declId };
}
