import type { DeclarationStatus } from "@clearborder/shared";
import { DECLARATION_STATUS_LABEL } from "@clearborder/shared";

const TAG_CLASS: Record<DeclarationStatus, string> = {
  HELD_VALUATION: "gov-tag gov-tag-red",
  AWAITING_DOCS: "gov-tag gov-tag-yellow",
  AMENDMENT_REVIEW: "gov-tag gov-tag-blue",
  PENDING_REVIEW: "gov-tag gov-tag-grey",
  CLEARED: "gov-tag gov-tag-green",
};

export function StatusTag({ status }: { status: DeclarationStatus }) {
  return <strong className={TAG_CLASS[status]}>{DECLARATION_STATUS_LABEL[status]}</strong>;
}
