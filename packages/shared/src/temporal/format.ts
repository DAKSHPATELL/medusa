import type { TemporalParcelState } from "./types";

export interface FormatParcelStateOptions {
  /**
   * When true (default), voice/call prompts omit inferred location, corridor %,
   * and dead-reckoned in-transit positions — only confirmed clearance facts.
   */
  observedOnly?: boolean;
}

/** Compact prose for voice prompts and debug tooling — shared across agent and demo. */
export function formatParcelStateForPrompt(
  state: TemporalParcelState,
  opts: FormatParcelStateOptions = {},
): string {
  const observedOnly = opts.observedOnly ?? true;
  if (!observedOnly) return formatDiagnosticState(state);
  return formatObservedVoiceState(state);
}

/** Full estimate for demo UI / debug — includes corridor % and inference metadata. */
function formatDiagnosticState(state: TemporalParcelState): string {
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

/** Call-safe: clearance facts from observations; location only when anchor entry was observed. */
function formatObservedVoiceState(state: TemporalParcelState): string {
  const parts: string[] = [];

  if (state.process.label && state.process.label !== "Unknown clearance stage") {
    parts.push(`Clearance stage: ${state.process.label}.`);
  }
  if (state.process.declarationStatus) {
    parts.push(`Declaration status: ${state.process.declarationStatus}.`);
  }
  if (state.process.caseStatus) {
    parts.push(`Case status: ${state.process.caseStatus}.`);
  }

  const cleared =
    state.process.declarationStatus === "CLEARED" ||
    state.process.caseStatus === "RESOLVED";

  if (cleared) {
    parts.push("Declaration cleared — do not speculate on current carrier location.");
  } else if (state.location.observed && state.location.anchorId === "customs") {
    parts.push(`Confirmed at ${state.location.place.label}.`);
  } else {
    parts.push(
      "Physical shipment location is not confirmed — do not state where the parcel is; use clearance and declaration status only.",
    );
  }

  return parts.join(" ");
}
