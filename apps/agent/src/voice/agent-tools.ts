import { Type } from "@google/genai";
import type Database from "better-sqlite3";
import type { EventHub } from "../hub";
import type { MemoryEngine } from "../orchestrator/memory";
import { getCase, listMemoriesForCase } from "../db";
import { loadCaseContext } from "../intake";

/** Per-call state accumulated via tool invocations during Gemini Live. */
export interface VoiceAgentState {
  caseId?: string;
  shipperId?: string;
  shipperName?: string;
  shipperLanguageCode?: string;
  confirmedValue?: number;
  currency?: string;
  holdReason?: string;
  documentsAvailable?: boolean;
  clarificationNotes?: string;
  schedulePortalFill: boolean;
  lookupSummary?: string;
}

export function createVoiceAgentState(): VoiceAgentState {
  return { schedulePortalFill: false };
}

export interface LookupCaseResult {
  found: boolean;
  caseId?: string;
  reference?: string;
  trackingNumber?: string;
  declaredValue?: number;
  invoiceValue?: number;
  invoiceNumber?: string;
  currency?: string;
  status?: string;
  shipperName?: string;
  shipperPhone?: string;
  holdReason?: string;
  message: string;
}

export interface CaseHistoryEntry {
  at: string;
  /** Who/what this entry came from — an officer, the broker, the system, or this voice agent. */
  actor: string;
  /** Short label for what happened, e.g. "Amendment submitted", "Caller confirmed value". */
  action: string;
  detail: string;
}

export interface CaseHistoryResult {
  found: boolean;
  caseId?: string;
  entries: CaseHistoryEntry[];
  message: string;
}

export const VOICE_AGENT_TOOL_DECLARATIONS = [
  {
    functionDeclarations: [
      {
        name: "lookup_case",
        description:
          "Search the ClearBorder case database by tracking number, waybill, invoice number, or case reference (e.g. CB-2481). Use when the caller mentions a parcel identifier you do not already have.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: "Tracking/waybill number, invoice number, or case reference to search",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "record_clarification",
        description:
          "Store what the caller confirmed about the customs hold — correct declared/invoice value, hold reason, and document availability. Call once the shipper confirms the correct values.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            confirmedValue: {
              type: Type.NUMBER,
              description: "The correct customs/invoice value the caller confirmed (numeric, e.g. 2400.00)",
            },
            currency: {
              type: Type.STRING,
              description: "Currency code, e.g. USD, EUR, CHF",
            },
            holdReason: {
              type: Type.STRING,
              description: "Why the parcel is held, e.g. declared value vs invoice mismatch, missing docs",
            },
            documentsAvailable: {
              type: Type.BOOLEAN,
              description: "Whether the caller has or will provide supporting documents (invoice, packing list)",
            },
            notes: {
              type: Type.STRING,
              description: "Brief summary of what the caller said",
            },
          },
          required: ["confirmedValue"],
        },
      },
      {
        name: "get_case_history",
        description:
          "Look up the real, logged timeline of everything that has happened on the current case so far — customs audit trail (holds, flags, document requests, amendments) and this agent's own prior actions/calls. Use this whenever the caller asks a 'why' question about a past action (e.g. 'why did you change the currency', 'why do you need this document', 'what did we agree last time') so you answer from the actual record instead of guessing. Requires a case to already be identified (via lookup_case or an outbound call context).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            question: {
              type: Type.STRING,
              description: "What the caller is asking about, in their words, e.g. 'why did you change the currency'",
            },
          },
          required: [],
        },
      },
      {
        name: "schedule_portal_amendment",
        description:
          "Queue the case for TradeGate portal amendment after the call ends, using the confirmed values from record_clarification. Call when the caller agrees on the correct value and next steps.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "One-sentence summary of what was agreed on the call",
            },
          },
          required: ["summary"],
        },
      },
    ],
  },
];

export const BASE_VOICE_AGENT_INSTRUCTION = [
  "You are ClearBorder, an autonomous licensed customs clearance agent on a live phone call.",
  "Your job is to resolve parcel holds: identify the shipment, clarify the hold reason, confirm correct values with the caller, and agree on next steps.",
  "Workflow: (1) identify parcel via tracking/waybill if unknown — use lookup_case; (2) explain the discrepancy or hold; (3) ask the caller to confirm the correct invoice/declared value; (4) use record_clarification when they confirm; (5) use schedule_portal_amendment when ready to amend the declaration.",
  "If the caller questions or asks about a past action — yours or customs' — e.g. 'why did you change the currency', 'why do you need this document', 'what did we agree last time': call get_case_history and answer from the specific logged entry it returns (who did it, when, and why). Do not guess or invent what happened. If get_case_history reports nothing logged, say plainly that no such action has been taken yet rather than making one up.",
  "Always summarize what you learned and what you will do next before ending the call.",
  "Speak in a calm, professional broker tone — concise sentences suited to phone conversation.",
  "Support English, Mandarin Chinese (中文), and Turkish (Türkçe): match the caller's language.",
].join(" ");

export function buildInboundSystemInstruction(): string {
  return [
    BASE_VOICE_AGENT_INSTRUCTION,
    "This is an INBOUND call — the caller dialed ClearBorder. Greet them, introduce yourself as the ClearBorder customs agent, and ask how you can help with their held parcel.",
    "If you do not know the tracking number yet, ask for the waybill or tracking number, then call lookup_case.",
  ].join(" ");
}

export function buildOutboundSystemInstruction(ctx: {
  shipperName: string;
  shipperLang: string;
  shipperLanguageCode: string;
  phone: string;
  trackingNumber: string;
  declaredValue: number;
  invoiceValue: number;
  invoiceNumber: string;
  currency: string;
}): string {
  const gap = Math.abs(ctx.invoiceValue - ctx.declaredValue);
  return [
    BASE_VOICE_AGENT_INSTRUCTION,
    "This is an OUTBOUND call — you initiated contact with the shipper about a known case.",
    `Case context — shipper: ${ctx.shipperName} (${ctx.shipperLang}, ${ctx.shipperLanguageCode}), phone ${ctx.phone}.`,
    `Waybill/tracking: ${ctx.trackingNumber}. Invoice ${ctx.invoiceNumber}.`,
    `Customs declared value: ${ctx.currency} ${ctx.declaredValue.toFixed(2)}. Commercial invoice total: ${ctx.currency} ${ctx.invoiceValue.toFixed(2)} (gap ${ctx.currency} ${gap.toFixed(2)}).`,
    "The shipment is on a customs valuation hold until the declared value matches the invoice.",
    "Open by explaining the discrepancy and ask the shipper to confirm the correct invoice total.",
    "When they confirm, call record_clarification then schedule_portal_amendment.",
  ].join(" ");
}

export class VoiceAgentTools {
  constructor(
    private db: Database.Database,
    private hub: EventHub,
    private memory: MemoryEngine,
    private opts: { day?: number; callId?: string },
  ) {}

  lookupCase(query: string): LookupCaseResult {
    const q = query.trim();
    if (!q) {
      return { found: false, message: "No search query provided." };
    }

    const like = `%${q}%`;
    const row = this.db
      .prepare(
        `SELECT c.*, s.name AS shipper_name, s.phone AS shipper_phone, s.language_code AS shipper_language_code
         FROM cases c
         JOIN shippers s ON s.id = c.shipper_id
         WHERE c.reference LIKE ? OR c.declaration_ref LIKE ?
            OR json_extract(c.shipment, '$.trackingNumber') LIKE ?
            OR json_extract(c.shipment, '$.invoiceNumber') LIKE ?
         ORDER BY c.updated_at DESC LIMIT 1`,
      )
      .get(like, like, like, like) as
      | (Record<string, unknown> & {
          id: string;
          reference: string;
          status: string;
          shipper_id: string;
          held_reason: string | null;
          shipment: string;
          shipper_name: string;
          shipper_phone: string;
          shipper_language_code: string;
        })
      | undefined;

    if (!row) {
      return {
        found: false,
        message: `No case found for "${q}". Ask the caller to double-check the tracking or waybill number.`,
      };
    }

    const rec = getCase(this.db, row.id);
    if (!rec) {
      return { found: false, message: `Case record missing for "${q}".` };
    }
    const holdReason =
      rec.heldReason ??
      (Math.abs(rec.shipment.declaredValue - rec.shipment.invoiceValue) > 0.01
        ? `Declared ${rec.shipment.currency} ${rec.shipment.declaredValue.toFixed(2)} vs invoice ${rec.shipment.currency} ${rec.shipment.invoiceValue.toFixed(2)}`
        : "Customs hold");

    return {
      found: true,
      caseId: rec.id,
      reference: rec.reference,
      trackingNumber: rec.shipment.trackingNumber,
      declaredValue: rec.shipment.declaredValue,
      invoiceValue: rec.shipment.invoiceValue,
      invoiceNumber: rec.shipment.invoiceNumber,
      currency: rec.shipment.currency,
      status: rec.status,
      shipperName: row.shipper_name,
      shipperPhone: row.shipper_phone,
      holdReason,
      message: `Found case ${rec.reference}: tracking ${rec.shipment.trackingNumber}, declared ${rec.shipment.currency} ${rec.shipment.declaredValue.toFixed(2)}, invoice ${rec.shipment.currency} ${rec.shipment.invoiceValue.toFixed(2)}, status ${rec.status}, shipper ${row.shipper_name}.`,
    };
  }

  /**
   * The real, chronological record for a case: customs audit trail (via its
   * linked declaration) merged with this agent's own case-tagged memories.
   * This is what answers "why did you change X" — never invent an answer,
   * look it up here.
   */
  getCaseHistory(caseId: string | undefined): CaseHistoryResult {
    if (!caseId) {
      return {
        found: false,
        entries: [],
        message: "No case identified yet on this call — use lookup_case first.",
      };
    }

    const rec = getCase(this.db, caseId);
    if (!rec) {
      return { found: false, entries: [], message: `No case on file for "${caseId}".` };
    }

    const entries: CaseHistoryEntry[] = [];

    const declaration = this.db
      .prepare(`SELECT id FROM declarations WHERE case_ref = ?`)
      .get(rec.reference) as { id: string } | undefined;

    if (declaration) {
      const auditRows = this.db
        .prepare(
          `SELECT at, actor, action, detail FROM audit_log WHERE declaration_id = ? ORDER BY at ASC LIMIT 30`,
        )
        .all(declaration.id) as Array<{
        at: string;
        actor: string;
        action: string;
        detail: string | null;
      }>;
      for (const row of auditRows) {
        entries.push({ at: row.at, actor: row.actor, action: row.action, detail: row.detail ?? "" });
      }
    }

    const memories = listMemoriesForCase(this.db, rec.id).filter((m) => m.caseId === rec.id);
    for (const mem of memories) {
      entries.push({
        at: mem.createdAt,
        actor: mem.source,
        action: mem.type === "procedural" ? "Agent action" : "Agent call record",
        detail: mem.content,
      });
    }

    entries.sort((a, b) => a.at.localeCompare(b.at));

    if (entries.length === 0) {
      return {
        found: true,
        caseId: rec.id,
        entries,
        message: `No actions are logged yet for case ${rec.reference} — nothing has been changed on this declaration so far.`,
      };
    }

    return {
      found: true,
      caseId: rec.id,
      entries,
      message: entries
        .map((e) => `[${e.at}] ${e.actor} — ${e.action}${e.detail ? `: ${e.detail}` : ""}`)
        .join("\n"),
    };
  }

  executeToolCall(
    name: string,
    args: Record<string, unknown>,
    state: VoiceAgentState,
  ): { response: Record<string, unknown>; state: VoiceAgentState } {
    const day = this.opts.day;

    switch (name) {
      case "lookup_case": {
        const query = String(args.query ?? "");
        const result = this.lookupCase(query);
        if (result.found && result.caseId) {
          state.caseId = result.caseId;
          state.currency = result.currency;
          state.shipperName = result.shipperName;
          state.holdReason = result.holdReason;
          state.lookupSummary = result.message;
          const ctx = loadCaseContext(this.db, result.caseId);
          if (ctx?.shipper) state.shipperId = ctx.shipper.id;
          if (ctx?.shipper?.language_code) state.shipperLanguageCode = ctx.shipper.language_code;
        }
        this.hub.emit(
          {
            type: "agent.thought",
            caseId: state.caseId,
            text: result.found
              ? `lookup_case("${query}") → ${result.message}`
              : `lookup_case("${query}") — no match; asking caller to verify tracking.`,
          },
          { day },
        );
        return { response: { result }, state };
      }

      case "record_clarification": {
        const confirmedValue = Number(args.confirmedValue);
        if (!Number.isFinite(confirmedValue)) {
          return {
            response: { error: "confirmedValue must be a number" },
            state,
          };
        }
        state.confirmedValue = confirmedValue;
        if (args.currency) state.currency = String(args.currency);
        if (args.holdReason) state.holdReason = String(args.holdReason);
        if (typeof args.documentsAvailable === "boolean") {
          state.documentsAvailable = args.documentsAvailable;
        }
        if (args.notes) state.clarificationNotes = String(args.notes);

        const content = [
          state.shipperName ?? "Caller",
          `confirmed correct value ${state.currency ?? "USD"} ${confirmedValue.toFixed(2)}`,
          state.holdReason ? `hold: ${state.holdReason}` : "",
          state.documentsAvailable !== undefined
            ? `documents ${state.documentsAvailable ? "available" : "pending"}`
            : "",
          state.clarificationNotes ?? "",
        ]
          .filter(Boolean)
          .join("; ");

        if (state.caseId) {
          this.memory.write(
            {
              type: "episodic",
              caseId: state.caseId,
              shipperId: state.shipperId ?? null,
              content,
              source: "Gemini Live voice call",
            },
            { caseId: state.caseId, day },
          );
        }

        this.hub.emit(
          {
            type: "agent.thought",
            caseId: state.caseId,
            text: `Caller confirmed ${state.currency ?? "USD"} ${confirmedValue.toFixed(2)}${state.clarificationNotes ? ` — ${state.clarificationNotes}` : ""}.`,
          },
          { day },
        );

        return {
          response: {
            recorded: true,
            confirmedValue,
            currency: state.currency ?? "USD",
            message: "Clarification recorded. Summarize back to the caller and call schedule_portal_amendment when ready.",
          },
          state,
        };
      }

      case "get_case_history": {
        const question = args.question ? String(args.question) : undefined;
        const result = this.getCaseHistory(state.caseId);

        this.hub.emit(
          {
            type: "agent.thought",
            caseId: state.caseId,
            text: question
              ? `get_case_history("${question}") → ${result.entries.length} logged entr${result.entries.length === 1 ? "y" : "ies"}`
              : `get_case_history() → ${result.entries.length} logged entr${result.entries.length === 1 ? "y" : "ies"}`,
          },
          { day },
        );

        return { response: { result }, state };
      }

      case "schedule_portal_amendment": {
        const summary = String(args.summary ?? "Portal amendment queued after voice call.");
        state.schedulePortalFill = true;
        state.clarificationNotes = summary;

        this.hub.emit(
          {
            type: "agent.thought",
            caseId: state.caseId,
            text: `Queued portal amendment: ${summary}`,
          },
          { day },
        );

        if (state.caseId && state.confirmedValue !== undefined) {
          this.memory.write(
            {
              type: "procedural",
              caseId: state.caseId,
              content: `After voice call: amend declaration to ${state.currency ?? "USD"} ${state.confirmedValue.toFixed(2)}. ${summary}`,
              source: "schedule_portal_amendment tool",
            },
            { caseId: state.caseId, day },
          );
        }

        return {
          response: {
            scheduled: true,
            caseId: state.caseId,
            confirmedValue: state.confirmedValue,
            message: "Portal amendment queued. Tell the caller you will amend the declaration and follow up if documents are needed.",
          },
          state,
        };
      }

      default:
        return { response: { error: `Unknown tool: ${name}` }, state };
    }
  }
}

/** Resolve confirmed value: tool state first, then case invoice as fallback. */
export function resolveConfirmedValue(
  state: VoiceAgentState,
  fallbackInvoiceValue?: number,
): number {
  if (state.confirmedValue !== undefined && Number.isFinite(state.confirmedValue)) {
    return state.confirmedValue;
  }
  if (fallbackInvoiceValue !== undefined) return fallbackInvoiceValue;
  return 0;
}
