import type Database from "better-sqlite3";
import type { Consignee, Shipment } from "@clearborder/shared";
import { ensureSchema, kvSet, openDb } from "./db";
import { loadRootEnv } from "./env";

/**
 * Seed the ClearBorder database: agent-domain cases/shippers/memories and the
 * TradeGate portal domain (declarations, documents, correspondence, audit).
 *
 * Day 1 of the demo story = 2026-07-02 · Day 2 = 2026-07-03 · Day 3 = 2026-07-04.
 */

export const PORTAL_CREDENTIALS = {
  username: "a.mercier",
  password: "demo2026",
  displayName: "Amélie Mercier",
  brokerFirm: "Helvex Customs Brokerage AG",
};

export const HERO_CASE_ID = "CB-2481";
export const HERO_DECLARATION_REF = "FCBA-2026-04417";
export const HERO_SHIPPER_ID = "shp-shenzhen-bright";

const D = {
  arrival: "2026-06-30T06:14:00+02:00",
  lodged: "2026-07-01T09:20:00+02:00",
  flagged: "2026-07-02T13:41:00+02:00",
  held: "2026-07-02T13:45:00+02:00",
  day2docRequest: "2026-07-03T08:47:00+02:00",
};

interface SeedOptions {
  /** Also wipe the agent event log (pnpm seed / full reset). */
  resetEvents?: boolean;
}

export function seedAll(db: Database.Database, opts: SeedOptions = {}): void {
  ensureSchema(db);
  db.pragma("foreign_keys = OFF");

  const wipe = db.transaction(() => {
    const tables = [
      "amendment_drafts",
      "audit_log",
      "correspondence",
      "declaration_documents",
      "declarations",
      "portal_users",
      "memories",
      "cases",
      "shippers",
      "kv",
    ];
    if (opts.resetEvents) tables.push("agent_events");
    for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
    if (opts.resetEvents) {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'agent_events'").run();
    }
  });
  wipe();

  const insertShipper = db.prepare(`
    INSERT INTO shippers (id, name, city, country, country_code, language, language_code, phone, learned_patterns)
    VALUES (@id, @name, @city, @country, @country_code, @language, @language_code, @phone, @learned_patterns)
  `);

  // Real number comes from .env (SHIPPER_PHONE_NUMBER) — used by the Twilio workstream.
  const shipperPhone =
    process.env.SHIPPER_PHONE_NUMBER && process.env.SHIPPER_PHONE_NUMBER.trim() !== ""
      ? process.env.SHIPPER_PHONE_NUMBER.trim()
      : "+86 755 0000 0000";

  insertShipper.run({
    id: HERO_SHIPPER_ID,
    name: "Shenzhen Bright Electronics Co.",
    city: "Shenzhen",
    country: "China",
    country_code: "CN",
    language: "Mandarin",
    language_code: "zh-CN",
    phone: shipperPhone,
    learned_patterns: "[]", // ← the agent will learn its first pattern live, on Day 3
  });
  insertShipper.run({
    id: "shp-osaka-precision",
    name: "Osaka Precision Tools K.K.",
    city: "Osaka",
    country: "Japan",
    country_code: "JP",
    language: "Japanese",
    language_code: "ja-JP",
    phone: "+81 6 4400 0000",
    learned_patterns: JSON.stringify([
      {
        id: "lp-osaka-1",
        text: "Frequently omits the certificate of origin on first submission; request it proactively at lodgement.",
        confidence: 0.82,
        createdAt: "2026-05-18T10:12:00+02:00",
      },
    ]),
  });
  insertShipper.run({
    id: "shp-guangzhou-textile",
    name: "Guangzhou Textile Export Ltd.",
    city: "Guangzhou",
    country: "China",
    country_code: "CN",
    language: "Cantonese",
    language_code: "yue-CN",
    phone: "+86 20 8100 0000",
    learned_patterns: JSON.stringify([
      {
        id: "lp-gz-1",
        text: "Responds fastest on the 2nd call attempt, mornings China time (UTC+8).",
        confidence: 0.71,
        createdAt: "2026-06-11T08:40:00+02:00",
      },
    ]),
  });
  insertShipper.run({
    id: "shp-mumbai-pharma",
    name: "Mumbai Pharma Supplies Pvt. Ltd.",
    city: "Mumbai",
    country: "India",
    country_code: "IN",
    language: "Hindi / English",
    language_code: "hi-IN",
    phone: "+91 22 6100 0000",
    learned_patterns: "[]",
  });

  const insertCase = db.prepare(`
    INSERT INTO cases (id, reference, declaration_ref, status, day_count, created_at, updated_at, shipper_id, held_reason, consignee, shipment)
    VALUES (@id, @reference, @declaration_ref, @status, @day_count, @created_at, @updated_at, @shipper_id, @held_reason, @consignee, @shipment)
  `);

  const heroConsignee: Consignee = {
    name: "Alpenrose Electronics GmbH",
    city: "Zürich",
    country: "Switzerland",
    countryCode: "CH",
    vatNumber: "CHE-334.219.007",
  };
  const heroShipment: Shipment = {
    description: "BT-500 Bluetooth audio modules",
    quantity: "500 units",
    trackingNumber: "RX448291023CN",
    carrier: "Swiss Post",
    originCity: "Shenzhen",
    originCountry: "China",
    originCountryCode: "CN",
    declaredValue: 240.0,
    currency: "USD",
    invoiceValue: 2400.0,
    invoiceNumber: "INV-SBE-88671",
    hsCode: "8517.62.00",
    incoterms: "DAP",
    weightKg: 42.5,
  };

  insertCase.run({
    id: HERO_CASE_ID,
    reference: HERO_CASE_ID,
    declaration_ref: HERO_DECLARATION_REF,
    status: "HELD_VALUATION",
    day_count: 1,
    created_at: D.held,
    updated_at: D.held,
    shipper_id: HERO_SHIPPER_ID,
    held_reason:
      "Declared value USD 240.00 inconsistent with commercial invoice INV-SBE-88671 (USD 2,400.00).",
    consignee: JSON.stringify(heroConsignee),
    shipment: JSON.stringify(heroShipment),
  });

  insertCase.run({
    id: "CB-2478",
    reference: "CB-2478",
    declaration_ref: "FCBA-2026-04391",
    status: "AWAITING_DOCS",
    day_count: 2,
    created_at: "2026-07-01T10:05:00+02:00",
    updated_at: "2026-07-03T09:15:00+02:00",
    shipper_id: "shp-osaka-precision",
    held_reason: "Certificate of origin missing — preferential tariff claim unsupported.",
    consignee: JSON.stringify({
      name: "Bergwerk Tools AG",
      city: "Basel",
      country: "Switzerland",
      countryCode: "CH",
      vatNumber: "CHE-198.442.310",
    } satisfies Consignee),
    shipment: JSON.stringify({
      description: "CNC carbide end mills",
      quantity: "1,200 units",
      trackingNumber: "EJ204551188JP",
      carrier: "DHL Express",
      originCity: "Osaka",
      originCountry: "Japan",
      originCountryCode: "JP",
      declaredValue: 8450.0,
      currency: "USD",
      invoiceValue: 8450.0,
      invoiceNumber: "OPT-2026-0651",
      hsCode: "8207.70.10",
      incoterms: "CIP",
      weightKg: 128.0,
    } satisfies Shipment),
  });

  insertCase.run({
    id: "CB-2465",
    reference: "CB-2465",
    declaration_ref: "FCBA-2026-04102",
    status: "RESOLVED",
    day_count: 4,
    created_at: "2026-06-24T08:30:00+02:00",
    updated_at: "2026-06-27T16:42:00+02:00",
    shipper_id: "shp-guangzhou-textile",
    held_reason: null,
    consignee: JSON.stringify({
      name: "Weber Home Trading SA",
      city: "Geneva",
      country: "Switzerland",
      countryCode: "CH",
      vatNumber: "CHE-240.881.554",
    } satisfies Consignee),
    shipment: JSON.stringify({
      description: "Woven cotton upholstery fabric",
      quantity: "840 m",
      trackingNumber: "CV771203945CN",
      carrier: "Cainiao / Swiss Post",
      originCity: "Guangzhou",
      originCountry: "China",
      originCountryCode: "CN",
      declaredValue: 5120.0,
      currency: "USD",
      invoiceValue: 5120.0,
      invoiceNumber: "GTE-INV-3312",
      hsCode: "5208.32.00",
      incoterms: "FOB",
      weightKg: 310.0,
    } satisfies Shipment),
  });

  insertCase.run({
    id: "CB-2492",
    reference: "CB-2492",
    declaration_ref: "FCBA-2026-04455",
    status: "NEW",
    day_count: 1,
    created_at: "2026-07-04T07:55:00+02:00",
    updated_at: "2026-07-04T07:55:00+02:00",
    shipper_id: "shp-mumbai-pharma",
    held_reason: null,
    consignee: JSON.stringify({
      name: "Helvetia Health Logistics AG",
      city: "Bern",
      country: "Switzerland",
      countryCode: "CH",
      vatNumber: "CHE-402.117.889",
    } satisfies Consignee),
    shipment: JSON.stringify({
      description: "Empty gelatin capsules, size 0",
      quantity: "48 cartons",
      trackingNumber: "AWB-098-44821130",
      carrier: "Swiss WorldCargo",
      originCity: "Mumbai",
      originCountry: "India",
      originCountryCode: "IN",
      declaredValue: 3980.0,
      currency: "USD",
      invoiceValue: 3980.0,
      invoiceNumber: "MPS-EXP-7702",
      hsCode: "9602.00.10",
      incoterms: "CPT",
      weightKg: 96.4,
    } satisfies Shipment),
  });

  // ── Long-term memories the agent already holds (recalled during the demo) ──

  const insertMemory = db.prepare(`
    INSERT INTO memories (id, case_id, shipper_id, type, content, source, created_at, last_recalled_at)
    VALUES (@id, @case_id, @shipper_id, @type, @content, @source, @created_at, @last_recalled_at)
  `);

  insertMemory.run({
    id: "mem-order-history",
    case_id: null,
    shipper_id: HERO_SHIPPER_ID,
    type: "semantic",
    content:
      "Alpenrose Electronics orders from Shenzhen Bright Electronics roughly monthly; typical commercial invoice total is USD 1,800–3,200 (12-month import ledger).",
    source: "Import ledger — Alpenrose account",
    created_at: "2026-04-14T11:22:00+02:00",
    last_recalled_at: null,
  });
  insertMemory.run({
    id: "mem-sop-valuation",
    case_id: null,
    shipper_id: null,
    type: "procedural",
    content:
      "FCBA valuation holds: confirm the intended invoice total with the shipper by phone before amending; never resubmit without documentary confirmation.",
    source: "Broker SOP library",
    created_at: "2026-02-03T09:00:00+02:00",
    last_recalled_at: "2026-06-12T10:30:00+02:00",
  });
  insertMemory.run({
    id: "mem-vat-cert",
    case_id: "CB-2103",
    shipper_id: null,
    type: "semantic",
    content:
      "Alpenrose Electronics GmbH VAT registration certificate (CHE-334.219.007) is archived in the document vault — collected during case CB-2103 (March 2026).",
    source: "Case CB-2103 archive",
    created_at: "2026-03-09T15:47:00+02:00",
    last_recalled_at: null,
  });
  insertMemory.run({
    id: "mem-portal-procedure",
    case_id: null,
    shipper_id: null,
    type: "procedural",
    content:
      "TradeGate amendments: open the case → 'Amend declaration' → review diff → tick the truthfulness declaration → submit. Final submission is irreversible for brokers.",
    source: "Learned operating TradeGate (Feb 2026)",
    created_at: "2026-02-19T13:10:00+02:00",
    last_recalled_at: "2026-05-30T09:05:00+02:00",
  });

  // ── TradeGate portal ────────────────────────────────────────────────────────

  db.prepare(
    `INSERT INTO portal_users (username, password, display_name, broker_firm) VALUES (?, ?, ?, ?)`,
  ).run(
    PORTAL_CREDENTIALS.username,
    PORTAL_CREDENTIALS.password,
    PORTAL_CREDENTIALS.displayName,
    PORTAL_CREDENTIALS.brokerFirm,
  );

  const insertDeclaration = db.prepare(`
    INSERT INTO declarations (id, ref, case_ref, importer_name, importer_vat, exporter_name, origin_country, origin_country_code, destination_country,
      declared_value, currency, hs_code, invoice_number, incoterms, weight_kg, status, discrepancy_note, arrived_at, created_at, updated_at)
    VALUES (@id, @ref, @case_ref, @importer_name, @importer_vat, @exporter_name, @origin_country, @origin_country_code, @destination_country,
      @declared_value, @currency, @hs_code, @invoice_number, @incoterms, @weight_kg, @status, @discrepancy_note, @arrived_at, @created_at, @updated_at)
  `);

  insertDeclaration.run({
    id: "dec-04417",
    ref: HERO_DECLARATION_REF,
    case_ref: HERO_CASE_ID,
    importer_name: "Alpenrose Electronics GmbH",
    importer_vat: "CHE-334.219.007",
    exporter_name: "Shenzhen Bright Electronics Co.",
    origin_country: "China",
    origin_country_code: "CN",
    destination_country: "Switzerland",
    declared_value: 240.0,
    currency: "USD",
    hs_code: "8517.62.00",
    invoice_number: "INV-SBE-88671",
    incoterms: "DAP",
    weight_kg: 42.5,
    status: "HELD_VALUATION",
    discrepancy_note:
      "Declared customs value (USD 240.00) is materially inconsistent with the total shown on the attached commercial invoice INV-SBE-88671 (USD 2,400.00). Amend the declaration or provide written justification within 5 business days. Failure to respond may result in reassessment and administrative penalties under Art. 118 CustA.",
    arrived_at: D.arrival,
    created_at: D.lodged,
    updated_at: D.held,
  });

  insertDeclaration.run({
    id: "dec-04391",
    ref: "FCBA-2026-04391",
    case_ref: "CB-2478",
    importer_name: "Bergwerk Tools AG",
    importer_vat: "CHE-198.442.310",
    exporter_name: "Osaka Precision Tools K.K.",
    origin_country: "Japan",
    origin_country_code: "JP",
    destination_country: "Switzerland",
    declared_value: 8450.0,
    currency: "USD",
    hs_code: "8207.70.10",
    invoice_number: "OPT-2026-0651",
    incoterms: "CIP",
    weight_kg: 128.0,
    status: "AWAITING_DOCS",
    discrepancy_note:
      "Preferential origin claimed (JP–CH EPA) but no certificate of origin is on file. Provide Form JP-EPA/CO or the claim will be disallowed.",
    arrived_at: "2026-07-01T05:48:00+02:00",
    created_at: "2026-07-01T10:05:00+02:00",
    updated_at: "2026-07-03T09:15:00+02:00",
  });

  insertDeclaration.run({
    id: "dec-04102",
    ref: "FCBA-2026-04102",
    case_ref: "CB-2465",
    importer_name: "Weber Home Trading SA",
    importer_vat: "CHE-240.881.554",
    exporter_name: "Guangzhou Textile Export Ltd.",
    origin_country: "China",
    origin_country_code: "CN",
    destination_country: "Switzerland",
    declared_value: 5120.0,
    currency: "USD",
    hs_code: "5208.32.00",
    invoice_number: "GTE-INV-3312",
    incoterms: "FOB",
    weight_kg: 310.0,
    status: "CLEARED",
    discrepancy_note: null,
    arrived_at: "2026-06-24T04:12:00+02:00",
    created_at: "2026-06-24T08:30:00+02:00",
    updated_at: "2026-06-27T16:42:00+02:00",
  });

  insertDeclaration.run({
    id: "dec-04455",
    ref: "FCBA-2026-04455",
    case_ref: "CB-2492",
    importer_name: "Helvetia Health Logistics AG",
    importer_vat: "CHE-402.117.889",
    exporter_name: "Mumbai Pharma Supplies Pvt. Ltd.",
    origin_country: "India",
    origin_country_code: "IN",
    destination_country: "Switzerland",
    declared_value: 3980.0,
    currency: "USD",
    hs_code: "9602.00.10",
    invoice_number: "MPS-EXP-7702",
    incoterms: "CPT",
    weight_kg: 96.4,
    status: "PENDING_REVIEW",
    discrepancy_note: null,
    arrived_at: "2026-07-04T05:20:00+02:00",
    created_at: "2026-07-04T07:55:00+02:00",
    updated_at: "2026-07-04T07:55:00+02:00",
  });

  const insertDoc = db.prepare(`
    INSERT INTO declaration_documents (id, declaration_id, name, doc_type, size_bytes, uploaded_by, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertDoc.run("doc-1", "dec-04417", "INV-SBE-88671.pdf", "Commercial invoice", 218_442, "Helvex Customs Brokerage AG", D.lodged);
  insertDoc.run("doc-2", "dec-04417", "PL-88671.pdf", "Packing list", 96_130, "Helvex Customs Brokerage AG", D.lodged);
  insertDoc.run("doc-3", "dec-04417", "AWB-RX448291023CN.pdf", "Air waybill", 142_775, "Swiss Post (carrier feed)", D.arrival);
  insertDoc.run("doc-4", "dec-04391", "OPT-2026-0651-invoice.pdf", "Commercial invoice", 187_020, "Helvex Customs Brokerage AG", "2026-07-01T10:05:00+02:00");
  insertDoc.run("doc-5", "dec-04102", "GTE-INV-3312.pdf", "Commercial invoice", 201_337, "Helvex Customs Brokerage AG", "2026-06-24T08:30:00+02:00");
  insertDoc.run("doc-6", "dec-04102", "CO-Form-A-3312.pdf", "Certificate of origin", 88_412, "Helvex Customs Brokerage AG", "2026-06-25T11:02:00+02:00");
  insertDoc.run("doc-7", "dec-04455", "MPS-EXP-7702-invoice.pdf", "Commercial invoice", 176_204, "Helvex Customs Brokerage AG", "2026-07-04T07:55:00+02:00");

  const insertCorr = db.prepare(`
    INSERT INTO correspondence (id, declaration_id, sender, sender_name, subject, body, sent_at, attachment_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCorr.run(
    "corr-1",
    "dec-04417",
    "system",
    "TradeGate Risk Assessment",
    "Declaration held — valuation query raised",
    "Automated risk assessment has placed declaration FCBA-2026-04417 on hold. Reason: declared customs value materially inconsistent with supporting commercial invoice. A customs officer has been assigned. Refer to the discrepancy notice on the declaration for required actions and deadlines.",
    D.flagged,
    null,
  );
  insertCorr.run(
    "corr-2",
    "dec-04417",
    "officer",
    "M. Brunner — Valuation Section",
    "Valuation query: declaration FCBA-2026-04417",
    "Dear declarant,\n\nIn reviewing consignment RX448291023CN we note the declared customs value of USD 240.00 against commercial invoice INV-SBE-88671 showing USD 2,400.00. Please amend the declaration to reflect the correct transaction value, or provide written justification for the declared amount, within 5 business days of this notice.\n\nKind regards,\nM. Brunner\nValuation Section, Federal Customs & Border Authority",
    D.held,
    null,
  );
  insertCorr.run(
    "corr-3",
    "dec-04417",
    "officer",
    "M. Brunner — Valuation Section",
    "Additional document required: VAT registration certificate",
    "Dear declarant,\n\nIn the course of processing declaration FCBA-2026-04417, a fiscal representation check requires the consignee's VAT registration certificate (UID confirmation, Form VAT-REG-CH or equivalent) for Alpenrose Electronics GmbH (CHE-334.219.007). Please upload the document to the case file within 5 business days.\n\nKind regards,\nM. Brunner\nValuation Section, Federal Customs & Border Authority",
    D.day2docRequest,
    null,
  );
  insertCorr.run(
    "corr-4",
    "dec-04391",
    "officer",
    "S. Keller — Origin & Preferences",
    "Certificate of origin required (JP–CH EPA claim)",
    "Dear declarant,\n\nPreferential tariff treatment has been claimed for declaration FCBA-2026-04391 under the Japan–Switzerland EPA, but no certificate of origin is on file. Please provide Form JP-EPA/CO within 10 business days, failing which duties will be assessed at the standard rate.\n\nKind regards,\nS. Keller\nOrigin & Preferences, Federal Customs & Border Authority",
    "2026-07-03T09:15:00+02:00",
    null,
  );

  const insertAudit = db.prepare(`
    INSERT INTO audit_log (id, declaration_id, at, actor, action, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run("aud-1", "dec-04417", D.arrival, "System", "Consignment arrival scan", "Arrived at Zürich-Mülligen international mail centre (Swiss Post feed).");
  insertAudit.run("aud-2", "dec-04417", D.lodged, "Helvex Customs Brokerage AG", "Declaration lodged", "Electronic declaration submitted via TradeGate broker channel.");
  insertAudit.run("aud-3", "dec-04417", D.flagged, "System", "Risk assessment flag", "Rule V-104: declared value vs. invoice total variance exceeds threshold.");
  insertAudit.run("aud-4", "dec-04417", D.held, "M. Brunner (Valuation Section)", "Hold placed — valuation query", "Declaration suspended pending amendment or justification.");
  insertAudit.run("aud-5", "dec-04417", D.day2docRequest, "M. Brunner (Valuation Section)", "Document request issued", "VAT registration certificate requested for fiscal representation check.");
  insertAudit.run("aud-6", "dec-04102", "2026-06-27T16:42:00+02:00", "System", "Declaration cleared", "Release authorised to carrier. Assessment notice issued.");
  insertAudit.run("aud-7", "dec-04455", "2026-07-04T07:55:00+02:00", "Helvex Customs Brokerage AG", "Declaration lodged", "Electronic declaration submitted via TradeGate broker channel.");
  insertAudit.run("aud-8", "dec-04391", "2026-07-03T09:15:00+02:00", "S. Keller (Origin & Preferences)", "Document request issued", "Certificate of origin required for preferential claim.");

  // ── Demo runtime state ──────────────────────────────────────────────────────
  kvSet(db, "demo_day", "1");
  kvSet(db, "agent_status", "idle");
  kvSet(db, "active_case", HERO_CASE_ID);
  kvSet(db, "sleep_until", "");

  db.pragma("foreign_keys = ON");
}

/** Mutations representing the outcome of Day 1, so Day 2/3 can be replayed standalone. */
export function applyDay1Outcomes(db: Database.Database): void {
  db.prepare(
    "UPDATE cases SET status = 'SLEEPING', updated_at = ? WHERE id = ?",
  ).run("2026-07-02T14:07:00+02:00", HERO_CASE_ID);
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO memories (id, case_id, shipper_id, type, content, source, created_at, last_recalled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  upsert.run(
    "mem-d1-call",
    HERO_CASE_ID,
    HERO_SHIPPER_ID,
    "episodic",
    "Shenzhen Bright confirmed invoice INV-SBE-88671 total = USD 2,400.00 by phone; declared 240.00 was a decimal-entry error on their side. Stamped invoice to be emailed for the record.",
    "Call with shipper — Day 1",
    "2026-07-02T14:05:00+02:00",
    null,
  );
  upsert.run(
    "mem-d1-amend",
    HERO_CASE_ID,
    null,
    "episodic",
    "Amendment AMD-04417-01 submitted on TradeGate with operator approval: declared value corrected to USD 2,400.00. Awaiting FCBA review.",
    "TradeGate portal session — Day 1",
    "2026-07-02T14:07:00+02:00",
    null,
  );
  kvSet(db, "demo_day", "1");
  kvSet(db, "agent_status", "sleeping");
  kvSet(db, "sleep_until", "2026-07-03T09:00:00+02:00");
}

/** Mutations representing the outcome of Day 2. */
export function applyDay2Outcomes(db: Database.Database): void {
  db.prepare(
    "UPDATE cases SET status = 'SLEEPING', day_count = 2, updated_at = ? WHERE id = ?",
  ).run("2026-07-03T09:04:00+02:00", HERO_CASE_ID);
  db.prepare("UPDATE memories SET last_recalled_at = ? WHERE id = 'mem-vat-cert'").run(
    "2026-07-03T09:02:00+02:00",
  );
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO memories (id, case_id, shipper_id, type, content, source, created_at, last_recalled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  upsert.run(
    "mem-d2-upload",
    HERO_CASE_ID,
    null,
    "episodic",
    "Uploaded Alpenrose VAT registration certificate (CHE-334.219.007) to FCBA case FCBA-2026-04417 in response to the officer's fiscal representation request.",
    "TradeGate portal session — Day 2",
    "2026-07-03T09:04:00+02:00",
    null,
  );
  kvSet(db, "demo_day", "2");
  kvSet(db, "agent_status", "sleeping");
  kvSet(db, "sleep_until", "2026-07-04T09:00:00+02:00");
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

const isCli = process.argv[1]?.endsWith("seed.ts") ?? false;

if (isCli) {
  loadRootEnv();
  const db = openDb();
  seedAll(db, { resetEvents: true });

  const c = {
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    reset: "\x1b[0m",
  };
  const caseCount = (db.prepare("SELECT COUNT(*) n FROM cases").get() as { n: number }).n;
  const declCount = (db.prepare("SELECT COUNT(*) n FROM declarations").get() as { n: number }).n;
  const memCount = (db.prepare("SELECT COUNT(*) n FROM memories").get() as { n: number }).n;

  console.log("");
  console.log(`${c.bold}${c.cyan}  ClearBorder — database seeded${c.reset}`);
  console.log(`${c.dim}  ────────────────────────────────────────────────${c.reset}`);
  console.log(`  Cases          ${c.bold}${caseCount}${c.reset}  (hero: ${c.yellow}${HERO_CASE_ID}${c.reset} — Held · Valuation, declared $240.00 vs invoice $2,400.00)`);
  console.log(`  Declarations   ${c.bold}${declCount}${c.reset}  (portal: ${HERO_DECLARATION_REF})`);
  console.log(`  Memories       ${c.bold}${memCount}${c.reset}  (incl. VAT cert from case CB-2103 — recalled on Day 2)`);
  console.log("");
  console.log(`${c.bold}  TradeGate portal login${c.reset}  ${c.dim}http://localhost:3000/portal/login${c.reset}`);
  console.log(`    username  ${c.green}${PORTAL_CREDENTIALS.username}${c.reset}`);
  console.log(`    password  ${c.green}${PORTAL_CREDENTIALS.password}${c.reset}`);
  console.log("");
  console.log(`${c.dim}  Dashboard http://localhost:3000 · press "D" for demo controls · pnpm dev to run${c.reset}`);
  console.log("");
  db.close();
}
