import Link from "next/link";
import { notFound } from "next/navigation";
import { saveAmendmentDraft } from "@/lib/portal/actions";
import { requireUser } from "@/lib/portal/auth";
import { getAmendmentDraft, getDeclaration } from "@/lib/portal/queries";

export const dynamic = "force-dynamic";

export default async function AmendPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const declaration = getDeclaration(id);
  if (!declaration) notFound();
  const draft = getAmendmentDraft(declaration.id);

  const initial = {
    declaredValue: draft?.declaredValue ?? declaration.declaredValue,
    currency: draft?.currency ?? declaration.currency,
    hsCode: draft?.hsCode ?? declaration.hsCode,
    invoiceNumber: draft?.invoiceNumber ?? declaration.invoiceNumber,
    incoterms: draft?.incoterms ?? declaration.incoterms,
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <nav className="text-[13.5px] mb-4 text-gov-muted" aria-label="Breadcrumb">
        <Link href="/portal/cases" className="gov-link">
          Declarations
        </Link>
        <span className="mx-2">›</span>
        <Link href={`/portal/cases/${declaration.id}`} className="gov-link">
          {declaration.ref}
        </Link>
        <span className="mx-2">›</span>
        <span>Amend</span>
      </nav>

      <h1 className="text-[30px] font-bold leading-tight mb-2">Amend declaration</h1>
      <p className="text-gov-muted text-[15px] mb-6">
        {declaration.ref} · {declaration.exporterName} → {declaration.importerName}
      </p>

      <div className="gov-notice mb-6 text-[14.5px]">
        Amend only the particulars that are incorrect. You will be able to review all
        changes before anything is submitted to the Authority.
      </div>

      <div className="gov-panel p-6">
        <form action={saveAmendmentDraft} className="space-y-6">
          <input type="hidden" name="declarationId" value={declaration.id} />

          <div>
            <label className="gov-label" htmlFor="declaredValue">
              Declared customs value
            </label>
            <span className="gov-hint">
              Transaction value of the goods as shown on the commercial invoice
            </span>
            <div className="flex gap-3">
              <input
                id="declaredValue"
                name="declaredValue"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={initial.declaredValue.toFixed(2)}
                className="gov-input tabular-nums"
                data-testid="amend-declared-value"
              />
              <select
                name="currency"
                aria-label="Currency"
                defaultValue={initial.currency}
                className="gov-select w-[120px]"
                data-testid="amend-currency"
              >
                <option>USD</option>
                <option>EUR</option>
                <option>CHF</option>
                <option>GBP</option>
                <option>CNY</option>
              </select>
            </div>
          </div>

          <div>
            <label className="gov-label" htmlFor="hsCode">
              Commodity (HS) code
            </label>
            <input
              id="hsCode"
              name="hsCode"
              type="text"
              required
              defaultValue={initial.hsCode}
              className="gov-input tabular-nums"
              data-testid="amend-hs-code"
            />
          </div>

          <div>
            <label className="gov-label" htmlFor="invoiceNumber">
              Invoice number
            </label>
            <input
              id="invoiceNumber"
              name="invoiceNumber"
              type="text"
              required
              defaultValue={initial.invoiceNumber}
              className="gov-input"
              data-testid="amend-invoice-number"
            />
          </div>

          <div>
            <label className="gov-label" htmlFor="incoterms">
              Incoterms
            </label>
            <select
              id="incoterms"
              name="incoterms"
              defaultValue={initial.incoterms}
              className="gov-select w-[200px]"
              data-testid="amend-incoterms"
            >
              <option>EXW</option>
              <option>FOB</option>
              <option>CIF</option>
              <option>CIP</option>
              <option>CPT</option>
              <option>DAP</option>
              <option>DDP</option>
            </select>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="submit" className="gov-btn" data-testid="amend-continue">
              Continue to review
            </button>
            <Link href={`/portal/cases/${declaration.id}`} className="gov-link text-[15px]">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
