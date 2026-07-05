import type { TemporalParcelState } from "./types";

/** Compact prose for voice prompts and debug tooling — shared across agent and demo. */
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
