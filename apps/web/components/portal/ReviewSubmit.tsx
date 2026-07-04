"use client";

import { useState } from "react";
import { applyAmendment } from "@/lib/portal/actions";

/**
 * Truthfulness declaration + final submit with confirmation modal — the exact
 * moment the ClearBorder agent pauses for human approval before acting.
 */
export function ReviewSubmit({
  declarationId,
  declarationRef,
}: {
  declarationId: string;
  declarationRef: string;
}) {
  const [accepted, setAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form action={applyAmendment} onSubmit={() => setSubmitting(true)}>
      <input type="hidden" name="declarationId" value={declarationId} />

      <div className="border-2 border-gov-border bg-gov-grey p-4 mb-6">
        <label className="flex items-start gap-3 cursor-pointer text-[15px] leading-snug">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-6 w-6 accent-gov-navy shrink-0"
            data-testid="review-declare-truthful"
          />
          <span>
            I declare that the amended information is, to the best of my knowledge, true and
            complete, and I understand that providing false information is an offence.
          </span>
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="gov-btn disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!accepted}
          onClick={() => setConfirming(true)}
          data-testid="review-submit"
        >
          Submit amendment
        </button>
        <a href={`/portal/cases/${declarationId}/amend`} className="gov-link text-[15px]">
          Go back and edit
        </a>
      </div>

      {confirming ? (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="bg-white max-w-[540px] w-full border-t-[6px] border-gov-navy shadow-2xl">
            <div className="p-7">
              <h2 id="confirm-title" className="text-[22px] font-bold mt-0 mb-3">
                Submit amendment to the Authority?
              </h2>
              <p className="text-[15px] leading-relaxed mb-3">
                The amendment to declaration <strong>{declarationRef}</strong>{" "}
                will be transmitted to the Federal Customs &amp; Border Authority for
                reassessment.
              </p>
              <p className="text-[15px] leading-relaxed mb-0 font-semibold">
                This action is final — submitted amendments cannot be retracted by the
                declarant.
              </p>
            </div>
            <div className="px-7 pb-7 flex items-center gap-4">
              <button
                type="submit"
                className="gov-btn disabled:opacity-60"
                disabled={submitting}
                data-testid="confirm-submit"
              >
                {submitting ? "Submitting…" : "Confirm & submit to FCBA"}
              </button>
              <button
                type="button"
                className="gov-btn-secondary"
                onClick={() => setConfirming(false)}
                data-testid="confirm-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
