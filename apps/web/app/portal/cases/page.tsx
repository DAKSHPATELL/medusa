import Link from "next/link";
import { DECLARATION_STATUSES, DECLARATION_STATUS_LABEL } from "@clearborder/shared";
import { StatusTag } from "@/components/portal/StatusTag";
import { requireUser } from "@/lib/portal/auth";
import { listDeclarations } from "@/lib/portal/queries";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireUser();
  const { status = "ALL", q = "" } = await searchParams;
  const declarations = listDeclarations({ status, query: q });
  const total = listDeclarations().length;

  return (
    <div>
      <nav className="text-[13.5px] mb-4 text-gov-muted" aria-label="Breadcrumb">
        <Link href="/portal/cases" className="gov-link">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span>Declarations</span>
      </nav>

      <h1 className="text-[32px] font-bold leading-tight mb-1">Customs declarations</h1>
      <p className="text-gov-muted mb-6 text-[15.5px]">
        Import declarations lodged through your broker account. Declarations on hold
        require action before the goods can be released.
      </p>

      <form
        method="GET"
        className="gov-panel p-4 mb-6 flex flex-wrap items-end gap-4"
        aria-label="Filter declarations"
      >
        <div className="w-[240px]">
          <label className="gov-label text-[14.5px]" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="gov-select"
            data-testid="filter-status"
          >
            <option value="ALL">All statuses</option>
            {DECLARATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DECLARATION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="gov-label text-[14.5px]" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Reference, importer or exporter"
            className="gov-input"
            data-testid="filter-search"
          />
        </div>
        <button type="submit" className="gov-btn-secondary" data-testid="filter-apply">
          Apply filters
        </button>
      </form>

      <div className="gov-panel overflow-x-auto">
        <table className="gov-table" data-testid="declarations-table">
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Importer</th>
              <th scope="col">Exporter</th>
              <th scope="col">Origin</th>
              <th scope="col">Arrived</th>
              <th scope="col" className="text-right">
                Declared value
              </th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {declarations.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-gov-muted py-8 text-center">
                  No declarations match the selected filters.
                </td>
              </tr>
            ) : (
              declarations.map((d) => (
                <tr key={d.id} data-testid={`case-row-${d.ref}`}>
                  <td>
                    <Link href={`/portal/cases/${d.id}`} className="gov-link font-semibold whitespace-nowrap">
                      {d.ref}
                    </Link>
                  </td>
                  <td>{d.importerName}</td>
                  <td>{d.exporterName}</td>
                  <td className="whitespace-nowrap">{d.originCountry}</td>
                  <td className="whitespace-nowrap">{formatDate(d.arrivedAt)}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(d.declaredValue, d.currency)}
                  </td>
                  <td>
                    <StatusTag status={d.status} />
                  </td>
                  <td>
                    <Link
                      href={`/portal/cases/${d.id}`}
                      className="gov-link whitespace-nowrap"
                      data-testid={`open-case-${d.ref}`}
                    >
                      View<span className="sr-only"> declaration {d.ref}</span>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[13.5px] text-gov-muted mt-3">
        Showing {declarations.length} of {total} declarations linked to your broker account.
      </p>
    </div>
  );
}
