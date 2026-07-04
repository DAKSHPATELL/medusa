import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  AgentEvent,
  CaseRecord,
  MemoryRecord,
  Shipper,
} from "@clearborder/shared";
import { findRepoRoot } from "./env";

export function dbPath(): string {
  const dir = path.join(findRepoRoot(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "clearborder.db");
}

export function openDb(): Database.Database {
  const db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shippers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  language TEXT NOT NULL,
  language_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  learned_patterns TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  declaration_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  day_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  shipper_id TEXT NOT NULL REFERENCES shippers(id),
  held_reason TEXT,
  consignee TEXT NOT NULL,
  shipment TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  shipper_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('episodic','semantic','procedural')),
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_recalled_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  case_id TEXT,
  day INTEGER NOT NULL,
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  payload TEXT NOT NULL
);

-- ── TradeGate portal domain ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portal_users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  display_name TEXT NOT NULL,
  broker_firm TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS declarations (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  case_ref TEXT NOT NULL,
  importer_name TEXT NOT NULL,
  importer_vat TEXT,
  exporter_name TEXT NOT NULL,
  origin_country TEXT NOT NULL,
  origin_country_code TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  declared_value REAL NOT NULL,
  currency TEXT NOT NULL,
  hs_code TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  incoterms TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  status TEXT NOT NULL,
  discrepancy_note TEXT,
  arrived_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS declaration_documents (
  id TEXT PRIMARY KEY,
  declaration_id TEXT NOT NULL REFERENCES declarations(id),
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS correspondence (
  id TEXT PRIMARY KEY,
  declaration_id TEXT NOT NULL REFERENCES declarations(id),
  sender TEXT NOT NULL CHECK (sender IN ('officer','broker','system')),
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  attachment_name TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  declaration_id TEXT NOT NULL REFERENCES declarations(id),
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS amendment_drafts (
  declaration_id TEXT PRIMARY KEY REFERENCES declarations(id),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function ensureSchema(db: Database.Database): void {
  db.exec(SCHEMA);
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

interface CaseRow {
  id: string;
  reference: string;
  declaration_ref: string;
  status: string;
  day_count: number;
  created_at: string;
  updated_at: string;
  shipper_id: string;
  held_reason: string | null;
  consignee: string;
  shipment: string;
}

export function caseFromRow(row: CaseRow): CaseRecord {
  return {
    id: row.id,
    reference: row.reference,
    declarationRef: row.declaration_ref,
    status: row.status as CaseRecord["status"],
    dayCount: row.day_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shipperId: row.shipper_id,
    heldReason: row.held_reason ?? undefined,
    consignee: JSON.parse(row.consignee),
    shipment: JSON.parse(row.shipment),
  };
}

interface ShipperRow {
  id: string;
  name: string;
  city: string;
  country: string;
  country_code: string;
  language: string;
  language_code: string;
  phone: string;
  learned_patterns: string;
}

export function shipperFromRow(row: ShipperRow): Shipper {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    countryCode: row.country_code,
    language: row.language,
    languageCode: row.language_code,
    phone: row.phone,
    learnedPatterns: JSON.parse(row.learned_patterns),
  };
}

interface MemoryRow {
  id: string;
  case_id: string | null;
  shipper_id: string | null;
  type: string;
  content: string;
  source: string;
  created_at: string;
  last_recalled_at: string | null;
}

export function memoryFromRow(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    shipperId: row.shipper_id,
    type: row.type as MemoryRecord["type"],
    content: row.content,
    source: row.source,
    createdAt: row.created_at,
    lastRecalledAt: row.last_recalled_at,
  };
}

export function listCases(db: Database.Database): CaseRecord[] {
  const rows = db
    .prepare("SELECT * FROM cases ORDER BY created_at DESC")
    .all() as CaseRow[];
  return rows.map(caseFromRow);
}

export function listShippers(db: Database.Database): Shipper[] {
  const rows = db.prepare("SELECT * FROM shippers").all() as ShipperRow[];
  return rows.map(shipperFromRow);
}

export function getMemory(db: Database.Database, id: string): MemoryRecord | undefined {
  const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as
    | MemoryRow
    | undefined;
  return row ? memoryFromRow(row) : undefined;
}

export function listEvents(db: Database.Database, limit = 500): AgentEvent[] {
  const rows = db
    .prepare(
      "SELECT seq, payload FROM agent_events ORDER BY seq DESC LIMIT ?",
    )
    .all(limit) as Array<{ seq: number; payload: string }>;
  return rows
    .reverse()
    .map((r) => ({ ...(JSON.parse(r.payload) as AgentEvent), seq: r.seq }));
}

export function kvGet(db: Database.Database, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function kvSet(db: Database.Database, key: string, value: string): void {
  db.prepare(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}
