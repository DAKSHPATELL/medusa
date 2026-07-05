import type {
  InferenceMode,
  ParcelCorridor,
  ProcessObservation,
  SpaceTimeAnchor,
  TemporalParcelState,
} from "./types";

/** Default half-life for confidence decay after the last observation (hours). */
export const DEFAULT_CONFIDENCE_HALF_LIFE_HOURS = 48;

export interface ParcelTimelineOptions {
  /** Hours until confidence halves when extrapolating. */
  confidenceHalfLifeHours?: number;
}

/**
 * A parcel's space-time path: known anchors plus timestamped process
 * observations. Answers "where is this shipment, and what clearance stage is
 * it in, at any instant T?"
 */
export class ParcelTimeline {
  readonly corridor: ParcelCorridor;
  readonly observations: ProcessObservation[];

  private readonly confidenceHalfLifeMs: number;

  constructor(
    corridor: ParcelCorridor,
    observations: ProcessObservation[],
    opts: ParcelTimelineOptions = {},
  ) {
    this.corridor = corridor;
    this.observations = [...observations].sort(
      (a, b) => Date.parse(a.at) - Date.parse(b.at),
    );
    const halfLifeHours = opts.confidenceHalfLifeHours ?? DEFAULT_CONFIDENCE_HALF_LIFE_HOURS;
    this.confidenceHalfLifeMs = halfLifeHours * 60 * 60 * 1000;
  }

  /** Best estimate of parcel state at instant `at`. */
  getStateAt(at: Date | string): TemporalParcelState {
    const t = typeof at === "string" ? Date.parse(at) : at.getTime();
    const iso = new Date(t).toISOString();

    const exactObs = this.findExactObservation(t);
    if (exactObs) {
      return this.buildState(iso, t, exactObs, 1, "observed", exactObs);
    }

    const { before, after } = this.bracketObservations(t);
    const processObs = before ?? after;
    const inferenceMode = this.inferenceMode(t, before, after);
    const confidence = this.confidenceAt(t, before, after, inferenceMode);
    const uncertainty =
      inferenceMode === "extrapolated" && before
        ? this.uncertaintyWindow(t, before)
        : undefined;

    const location = this.locateAt(t);
    const process = processObs
      ? {
          caseStatus: processObs.caseStatus,
          declarationStatus: processObs.declarationStatus,
          orchestratorPhase: processObs.orchestratorPhase,
          label: processObs.label,
        }
      : { label: "Unknown clearance stage" };

    return {
      at: iso,
      location,
      process,
      confidence,
      inferenceMode,
      uncertainty,
    };
  }

  /** All observation timestamps (ISO), sorted ascending. */
  observationTimes(): string[] {
    return this.observations.map((o) => o.at);
  }

  private buildState(
    iso: string,
    t: number,
    obs: ProcessObservation,
    confidence: number,
    inferenceMode: InferenceMode,
    processObs: ProcessObservation,
  ): TemporalParcelState {
    return {
      at: iso,
      location: this.locateAt(t),
      process: {
        caseStatus: processObs.caseStatus,
        declarationStatus: processObs.declarationStatus,
        orchestratorPhase: processObs.orchestratorPhase,
        label: processObs.label,
      },
      confidence,
      inferenceMode,
    };
  }

  private findExactObservation(t: number): ProcessObservation | undefined {
    return this.observations.find((o) => Math.abs(Date.parse(o.at) - t) < 500);
  }

  private bracketObservations(t: number): {
    before: ProcessObservation | undefined;
    after: ProcessObservation | undefined;
  } {
    let before: ProcessObservation | undefined;
    let after: ProcessObservation | undefined;
    for (const obs of this.observations) {
      const ot = Date.parse(obs.at);
      if (ot <= t) before = obs;
      else if (!after) {
        after = obs;
        break;
      }
    }
    return { before, after };
  }

  private inferenceMode(
    t: number,
    before: ProcessObservation | undefined,
    after: ProcessObservation | undefined,
  ): InferenceMode {
    if (before && after) return "interpolated";
    if (before && !after) return "extrapolated";
    if (!before && after) return "extrapolated";
    return "extrapolated";
  }

  private confidenceAt(
    t: number,
    before: ProcessObservation | undefined,
    after: ProcessObservation | undefined,
    mode: InferenceMode,
  ): number {
    const floor = 0.12;

    if (mode === "interpolated" && before && after) {
      const span = Date.parse(after.at) - Date.parse(before.at);
      if (span <= 0) return 0.85;
      const frac = (t - Date.parse(before.at)) / span;
      // Highest confidence mid-way between two known states.
      const midBias = 1 - Math.abs(frac - 0.5) * 0.4;
      return Math.max(floor, 0.55 + midBias * 0.35);
    }

    const anchor = before ?? after;
    if (!anchor) return floor;

    const dt = Math.abs(t - Date.parse(anchor.at));
    const decay = Math.exp(-dt / this.confidenceHalfLifeMs);
    return Math.max(floor, decay);
  }

  private uncertaintyWindow(t: number, lastObs: ProcessObservation): {
    earliest: string;
    latest: string;
  } {
    const dt = t - Date.parse(lastObs.at);
    const spreadMs = Math.max(dt * 2, 4 * 60 * 60 * 1000);
    return {
      earliest: new Date(t).toISOString(),
      latest: new Date(t + spreadMs).toISOString(),
    };
  }

  /**
   * Physical location along the corridor at time T.
   *
   * Uses anchor enter/depart times as hard constraints; between anchors,
   * linear dead-reckoning along the path (capability-constrained motion).
   */
  private locateAt(t: number): TemporalParcelState["location"] {
    const { origin, customs, destination } = this.corridor;
    const anchors = [origin, customs, destination];

    // Before first known anchor entry — still at origin.
    const originEnter = origin.enteredAt ? Date.parse(origin.enteredAt) : undefined;
    if (originEnter !== undefined && t < originEnter) {
      return this.atAnchor(origin, 0, false);
    }

    // After destination entry — delivered.
    const destEnter = destination.enteredAt ? Date.parse(destination.enteredAt) : undefined;
    if (destEnter !== undefined && t >= destEnter) {
      return this.atAnchor(destination, 1, destination.enteredAtObserved === true);
    }

    // Inside a fixed anchor (customs dwell is the common case).
    for (const anchor of anchors) {
      const inside = this.isInsideAnchor(t, anchor);
      if (inside) {
        return this.atAnchor(
          anchor,
          this.corridorProgressForAnchor(anchor),
          anchor.enteredAtObserved === true,
        );
      }
    }

    // In transit between consecutive anchors.
    for (let i = 0; i < anchors.length - 1; i++) {
      const from = anchors[i]!;
      const to = anchors[i + 1]!;
      const leg = this.transitLeg(t, from, to);
      if (leg) return leg;
    }

    // Fallback: customs if we have arrival, else origin.
    if (customs.enteredAt && (!customs.departedAt || t < Date.parse(customs.departedAt))) {
      return this.atAnchor(customs, 0.55, customs.enteredAtObserved === true);
    }
    return this.atAnchor(origin, 0, false);
  }

  private isInsideAnchor(t: number, anchor: SpaceTimeAnchor): boolean {
    const enter = anchor.enteredAt ? Date.parse(anchor.enteredAt) : undefined;
    const depart = anchor.departedAt ? Date.parse(anchor.departedAt) : undefined;
    if (enter === undefined) return false;
    if (t >= enter && (depart === undefined || t < depart)) return true;
    return false;
  }

  private transitLeg(
    t: number,
    from: SpaceTimeAnchor,
    to: SpaceTimeAnchor,
  ): TemporalParcelState["location"] | undefined {
    const depart = from.departedAt ? Date.parse(from.departedAt) : undefined;
    const arrive = to.enteredAt ? Date.parse(to.enteredAt) : undefined;
    if (depart === undefined || arrive === undefined) return undefined;
    if (t < depart || t >= arrive) return undefined;

    const frac = (t - depart) / (arrive - depart);
    const fromProgress = this.corridorProgressForAnchor(from);
    const toProgress = this.corridorProgressForAnchor(to);
    const progress = fromProgress + frac * (toProgress - fromProgress);

    return {
      place: {
        label: `In transit · ${from.place.city} → ${to.place.city}`,
        city: from.place.city,
        countryCode: from.place.countryCode,
      },
      anchorId: "transit",
      corridorProgress: progress,
      observed: false,
    };
  }

  private corridorProgressForAnchor(anchor: SpaceTimeAnchor): number {
    if (anchor.kind === "origin") return 0;
    if (anchor.kind === "customs") return 0.55;
    if (anchor.kind === "destination") return 1;
    return 0.5;
  }

  private atAnchor(
    anchor: SpaceTimeAnchor,
    corridorProgress: number,
    observed: boolean,
  ): TemporalParcelState["location"] {
    return {
      place: anchor.place,
      anchorId: anchor.id,
      corridorProgress,
      observed,
    };
  }
}
