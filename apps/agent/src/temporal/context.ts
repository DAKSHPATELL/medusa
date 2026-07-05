import type Database from "better-sqlite3";
import type { AgentEvent, DeclarationStatus, TemporalParcelState } from "@clearborder/shared";
import { getParcelStateNow } from "@clearborder/shared";
import { getCase } from "../db";

/** Declaration fields needed to anchor the customs facility in the corridor model. */
interface DeclarationSnapshot {
  status: DeclarationStatus;
  arrivedAt: string;
  updatedAt: string;
}

function getDeclarationSnapshot(
  db: Database.Database,
  declarationRef: string,
): DeclarationSnapshot | undefined {
  const row = db
    .prepare("SELECT status, arrived_at, updated_at FROM declarations WHERE ref = ?")
    .get(declarationRef) as
    | { status: string; arrived_at: string; updated_at: string }
    | undefined;
  if (!row) return undefined;
  return {
    status: row.status as DeclarationStatus,
    arrivedAt: row.arrived_at,
    updatedAt: row.updated_at,
  };
}

function listEventsForCase(db: Database.Database, caseId: string): AgentEvent[] {
  const rows = db
    .prepare(
      "SELECT payload FROM agent_events WHERE case_id = ? ORDER BY seq ASC",
    )
    .all(caseId) as Array<{ payload: string }>;
  return rows.map((r) => JSON.parse(r.payload) as AgentEvent);
}

/** Best estimate of parcel location and clearance stage at `now`. */
export function resolveParcelState(
  db: Database.Database,
  caseId: string,
  now: Date | string = new Date(),
): TemporalParcelState | undefined {
  const rec = getCase(db, caseId);
  if (!rec) return undefined;
  const declaration = getDeclarationSnapshot(db, rec.declarationRef);
  const events = listEventsForCase(db, caseId);
  return getParcelStateNow(
    { case: rec, events, declaration },
    now,
  );
}

/** Compact prose for voice system prompts and tool responses. */
export function formatParcelStateForPrompt(state: TemporalParcelState): string {
  const confidencePct = Math.round(state.confidence * 100);
  const parts = [
    `Parcel is at ${state.location.place.label} (${Math.round(state.location.corridorProgress * 100)}% along origin→customs→destination corridor).`,
    `Clearance stage: ${state.process.label}.`,
  ];
  if (state.process.declarationStatus) {
    parts.push(`Declaration status: ${state.process.declarationStatus}.`);
  }
  parts.push(
    `Temporal estimate confidence ${confidencePct}% (${state.inferenceMode}).`,
  );
  if (state.uncertainty) {
    parts.push(
      `Location uncertainty may extend until ${state.uncertainty.latest}.`,
    );
  }
  return parts.join(" ");
}

/** Resolve and format parcel cognition for a case — used before outbound calls. */
export function resolveParcelContext(
  db: Database.Database,
  caseId: string,
  now: Date | string = new Date(),
): string | undefined {
  const state = resolveParcelState(db, caseId, now);
  if (!state) return undefined;
  return formatParcelStateForPrompt(state);
}
