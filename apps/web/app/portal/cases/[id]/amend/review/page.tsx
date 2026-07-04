import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReviewSubmit } from "@/components/portal/ReviewSubmit";
import { requireUser } from "@/lib/portal/auth";
import { getAmendmentDraft, getDeclaration } from "@/lib/portal/queries";

export const dynamic = "force-dynamic";

function money(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default async function AmendReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const declaration = getDeclaration(id);
  if (!declaration) notFound();
  const draft = getAmendmentDraft(declaration.id);
  if (!draft) redirect(`/portal/cases/${declaration.id}/amend`);

  const rows = [
    {
      label: "Declared customs value",
      before: money(declaration.declaredValue, declaration.currency),
      after: money(draft.declaredValue, draft.currency),
      changed:
        declaration.declaredValue !== draft.declaredValue ||
        declaration.currency !== draft.currency,
    },
    {
      label: "Commodity (HS) code",
      before: declaration.hsCode,
      after: draft.hsCode,
      changed: declaration.hsCode !== draft.hsCode,
    },
    {
      label: "Invoice number",
      before: declaration.invoiceNumber,
      after: draft.invoiceNumber,
      changed: declaration.invoiceNumber !== draft.invoiceNumber,
    },
    {
      label: "Incoterms",
      before: declaration.incoterms,
      after: draft.incoterms,
      changed: declaration.incoterms !== draft.incoterms,
    },
  ];
  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <div className="mx-auto max-w-[720px]">
      <nav className="text-[13.5px] mb-4 text-gov-muted" aria-label="Breadcrumb">
        <Link href="/portal/cases" className="gov-link">
          Declarations
        </Link>
        <span className="mx-2">›</span>
        <Link href={`/portal/cases/${declaration.id}`} className="gov-link">
          {declaration.ref}
        </Link>
        <span className="mx-2">›</span>
        <Link href={`/portal/cases/${declaration.id}/amend`} className="gov-link">
          Amend
        </Link>
        <span className="mx-2">›</span>
        <span>Review</span>
      </nav>

      <h1 className="text-[30px] font-bold leading-tight mb-2">
        Check your amendment before submission
      </h1>
      <p className="text-gov-muted text-[15px] mb-6">
        Declaration {declaration.ref} · {changedCount} field{changedCount === 1 ? "" : "s"}{" "}
        will be amended. Values shown as currently on record vs. as amended.
      </p>

      <div className="gov-panel overflow-x-auto mb-6">
        <table className="gov-table" data-testid="review-diff-table">
          <thead>
            <tr>
              <th scope="col" className="w-[36%]">
                Field
              </th>
              <th scope="col">Current value</th>
              <th scope="col">Amended value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={row.changed ? "bg-[#fff8e1]" : undefined}>
                <td className="font-semibold">{row.label}</td>
                <td className={row.changed ? "line-through decoration-gov-red decoration-2 text-gov-muted tabular-nums" : "tabular-nums"}>
                  {row.before}
                </td>
                <td className="tabular-nums">
                  {row.changed ? (
                    <strong className="text-gov-green-dark">{row.after}</strong>
                  ) : (
                    <span className="text-gov-muted">No change</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="gov-notice mb-6 text-[14.5px]">
        Duties and import VAT will be reassessed on the amended particulars. The reassessment
        notice will be issued to the declarant account after officer review.
      </div>

      <ReviewSubmit declarationId={declaration.id} declarationRef={declaration.ref} />
    </div>
  );
}
