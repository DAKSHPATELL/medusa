/**
 * Agent-side parcel cognition — resolves {@link TemporalParcelState} from SQLite.
 *
 * Domain logic lives in `@clearborder/shared/temporal` (`buildParcelTimeline`,
 * `formatParcelStateForPrompt`). This module is the persistence adapter only.
 */
import type Database from "better-sqlite3";
import type { AgentEvent, DeclarationTimelineSnapshot, TemporalParcelState } from "@clearborder/shared";
import { formatParcelStateForPrompt, getParcelStateNow } from "@clearborder/shared";
import { getCase } from "../db";

function getDeclarationSnapshot(
  db: Database.Database,
  declarationRef: string,
): DeclarationTimelineSnapshot | undefined {
  const row = db
    .prepare("SELECT status, arrived_at, updated_at FROM declarations WHERE ref = ?")
    .get(declarationRef) as
    | { status: string; arrived_at: string; updated_at: string }
    | undefined;
  if (!row) return undefined;
  return {
    status: row.status as DeclarationTimelineSnapshot["status"],
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
  return getParcelStateNow({ case: rec, events, declaration }, now);
}

export { formatParcelStateForPrompt };

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
