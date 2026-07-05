import type { CaseStatus } from "../models";
import type { DeclarationStatus } from "../portal";
import type { OrchestratorPhase } from "../protocol";

/**
 * Time-geography anchor — a place the parcel must occupy for a span of time.
 *
 * Inspired by Hägerstrand's space-time anchors: the shipment life path is
 * constrained to pass through origin → customs → destination; it cannot
 * occupy two anchors simultaneously (indivisibility) and movement costs time
 * (capability constraint).
 */
export type AnchorKind = "origin" | "transit" | "customs" | "destination";

export interface GeoPlace {
  label: string;
  city: string;
  countryCode: string;
}

export interface SpaceTimeAnchor {
  id: string;
  kind: AnchorKind;
  place: GeoPlace;
  /** ISO — parcel entered this anchor (observed or inferred). */
  enteredAt?: string;
  /** ISO — parcel departed (undefined while still inside or not yet arrived). */
  departedAt?: string;
}

/** A discrete, timestamped constraint on clearance process state. */
export interface ProcessObservation {
  at: string;
  caseStatus?: CaseStatus;
  declarationStatus?: DeclarationStatus;
  orchestratorPhase?: OrchestratorPhase;
  /** Human caption, e.g. "Valuation hold flagged". */
  label: string;
  source: string;
}

export type InferenceMode = "observed" | "interpolated" | "extrapolated";

/** Best estimate of parcel state at a single instant. */
export interface TemporalParcelState {
  at: string;
  location: {
    place: GeoPlace;
    anchorId: string;
    /** 0..1 progress along the corridor between origin and destination. */
    corridorProgress: number;
  };
  process: {
    caseStatus?: CaseStatus;
    declarationStatus?: DeclarationStatus;
    orchestratorPhase?: OrchestratorPhase;
    label: string;
  };
  /** 0..1 — 1.0 only at exact observation times. */
  confidence: number;
  inferenceMode: InferenceMode;
  /** Widening time window when extrapolating beyond last observation. */
  uncertainty?: { earliest: string; latest: string };
}

export interface ParcelCorridor {
  anchors: SpaceTimeAnchor[];
  /** Total ordered path from origin to destination. */
  origin: SpaceTimeAnchor;
  customs: SpaceTimeAnchor;
  destination: SpaceTimeAnchor;
}
