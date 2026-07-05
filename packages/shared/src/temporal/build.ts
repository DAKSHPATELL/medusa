import type { AgentEvent } from "../events";
import { CASE_STATUS_LABEL, DECLARATION_STATUS_LABEL } from "../labels";
import type { CaseRecord, Consignee, Shipment } from "../models";
import type { Declaration, DeclarationStatus } from "../portal";
import type { OrchestratorPhase } from "../protocol";
import { ParcelTimeline } from "./timeline";
import type { GeoPlace, ParcelCorridor, ProcessObservation, SpaceTimeAnchor } from "./types";

/** Declaration fields needed to anchor customs facility timing in the corridor model. */
export type DeclarationTimelineSnapshot = Pick<
  Declaration,
  "status" | "arrivedAt" | "updatedAt"
>;

export interface BuildTimelineInput {
  case: CaseRecord;
  /** Agent event stream — status changes refine the process timeline. */
  events?: AgentEvent[];
  /** Portal declaration — arrival time anchors the customs facility. */
  declaration?: DeclarationTimelineSnapshot;
  /** Customs facility override (defaults to FCBA Basel for CH consignees). */
  customsPlace?: GeoPlace;
}

/** Swiss FCBA border clearance — matches TradeGate demo geography. */
export const DEFAULT_CUSTOMS_PLACE: GeoPlace = {
  label: "Basel — FCBA customs",
  city: "Basel",
  countryCode: "CH",
};

/**
 * Build a {@link ParcelTimeline} from ClearBorder domain records.
 *
 * Observations are assembled from case status, declaration status, and
 * `case.status_changed` agent events. Physical anchors are inferred from
 * shipment origin/consignee plus declaration `arrivedAt`.
 */
export function buildParcelTimeline(input: BuildTimelineInput): ParcelTimeline {
  const corridor = buildCorridor(input);
  const observations = collectObservations(input);
  return new ParcelTimeline(corridor, observations);
}

function buildCorridor(input: BuildTimelineInput): ParcelCorridor {
  const { case: rec, declaration } = input;
  const shipment = rec.shipment;
  const consignee = rec.consignee;

  const originDepart = estimateOriginDeparture(rec, declaration?.arrivedAt);
  const origin: SpaceTimeAnchor = {
    id: "origin",
    kind: "origin",
    place: {
      label: `${shipment.originCity} · shipper`,
      city: shipment.originCity,
      countryCode: shipment.originCountryCode,
    },
    enteredAt: originDepart,
    departedAt: originDepart,
    enteredAtObserved: false,
  };

  const customsPlace = input.customsPlace ?? defaultCustomsFor(consignee);
  const customsArrivedAt = declaration?.arrivedAt;
  const customs: SpaceTimeAnchor = {
    id: "customs",
    kind: "customs",
    place: customsPlace,
    enteredAt: customsArrivedAt ?? rec.createdAt,
    enteredAtObserved: Boolean(customsArrivedAt),
    departedAt: clearanceDeparture(rec, declaration?.status),
  };

  const destination: SpaceTimeAnchor = {
    id: "destination",
    kind: "destination",
    place: {
      label: `${consignee.city} · consignee`,
      city: consignee.city,
      countryCode: consignee.countryCode,
    },
    enteredAt: deliveryArrival(rec, declaration?.status),
    enteredAtObserved: false,
  };

  return { anchors: [origin, customs, destination], origin, customs, destination };
}

function defaultCustomsFor(consignee: Consignee): GeoPlace {
  if (consignee.countryCode === "CH") return DEFAULT_CUSTOMS_PLACE;
  return {
    label: `${consignee.country} customs`,
    city: consignee.city,
    countryCode: consignee.countryCode,
  };
}

/** Rough back-calculation: international transit before customs arrival. */
function estimateOriginDeparture(rec: CaseRecord, arrivedAt?: string): string | undefined {
  if (!arrivedAt) return undefined;
  const transitMs = defaultTransitMs(rec.shipment);
  return new Date(Date.parse(arrivedAt) - transitMs).toISOString();
}

function defaultTransitMs(shipment: Shipment): number {
  // Same continent / adjacent: 2d; intercontinental: 5d (demo-scale heuristic).
  const intercontinental = shipment.originCountryCode !== "CH";
  return (intercontinental ? 5 : 2) * 24 * 60 * 60 * 1000;
}

function clearanceDeparture(
  rec: CaseRecord,
  declarationStatus?: DeclarationStatus,
): string | undefined {
  if (rec.status === "RESOLVED" || declarationStatus === "CLEARED") {
    return rec.updatedAt;
  }
  return undefined;
}

function deliveryArrival(
  rec: CaseRecord,
  declarationStatus?: DeclarationStatus,
): string | undefined {
  if (rec.status !== "RESOLVED" && declarationStatus !== "CLEARED") return undefined;
  // Last-mile after clearance — 24h heuristic.
  return new Date(Date.parse(rec.updatedAt) + 24 * 60 * 60 * 1000).toISOString();
}

function collectObservations(input: BuildTimelineInput): ProcessObservation[] {
  const { case: rec, events = [], declaration } = input;
  const obs: ProcessObservation[] = [];

  obs.push({
    at: rec.createdAt,
    caseStatus: "NEW",
    declarationStatus: declaration?.status,
    label: "Case opened",
    source: "case.createdAt",
  });

  for (const event of events) {
    if (event.type !== "case.status_changed" || event.caseId !== rec.id) continue;
    obs.push({
      at: event.at,
      caseStatus: event.to,
      label: CASE_STATUS_LABEL[event.to] ?? event.to,
      source: `agent:${event.type}`,
    });
  }

  if (declaration?.arrivedAt) {
    obs.push({
      at: declaration.arrivedAt,
      declarationStatus: declaration.status,
      label: "Arrived at customs",
      source: "declaration.arrivedAt",
    });
  }

  if (rec.status !== "NEW") {
    obs.push({
      at: rec.updatedAt,
      caseStatus: rec.status,
      declarationStatus: declaration?.status,
      orchestratorPhase: rec.orchestratorPhase as OrchestratorPhase | undefined,
      label: CASE_STATUS_LABEL[rec.status],
      source: "case.updatedAt",
    });
  }

  if (declaration?.status && declaration.updatedAt) {
    obs.push({
      at: declaration.updatedAt,
      declarationStatus: declaration.status,
      label: DECLARATION_STATUS_LABEL[declaration.status],
      source: "declaration.updatedAt",
    });
  }

  return dedupeObservations(obs);
}

function dedupeObservations(obs: ProcessObservation[]): ProcessObservation[] {
  const byTime = new Map<number, ProcessObservation>();
  for (const o of obs) {
    const t = Date.parse(o.at);
    const existing = byTime.get(t);
    if (!existing) {
      byTime.set(t, o);
      continue;
    }
    byTime.set(t, mergeObs(existing, o));
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, o]) => o);
}

function mergeObs(a: ProcessObservation, b: ProcessObservation): ProcessObservation {
  return {
    at: a.at,
    caseStatus: b.caseStatus ?? a.caseStatus,
    declarationStatus: b.declarationStatus ?? a.declarationStatus,
    orchestratorPhase: b.orchestratorPhase ?? a.orchestratorPhase,
    label: b.label || a.label,
    source: `${a.source}+${b.source}`,
  };
}

/** Convenience: snapshot at "now" (or a provided clock). */
export function getParcelStateNow(
  input: BuildTimelineInput,
  now: Date | string = new Date(),
): ReturnType<ParcelTimeline["getStateAt"]> {
  return buildParcelTimeline(input).getStateAt(now);
}
