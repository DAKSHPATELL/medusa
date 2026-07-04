import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusTag } from "@/components/portal/StatusTag";
import { requireUser } from "@/lib/portal/auth";
import { sendReplyWithUpload } from "@/lib/portal/actions";
import {
  getDeclaration,
  listAudit,
  listCorrespondence,
  listDocuments,
} from "@/lib/portal/queries";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "declaration", label: "Declaration" },
  { key: "documents", label: "Documents" },
  { key: "correspondence", label: "Correspondence" },
  { key: "history", label: "History" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1000)} kB`;
}

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; submitted?: string; sent?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { tab: rawTab, submitted, sent } = await searchParams;
  const declaration = getDeclaration(id);
  if (!declaration) notFound();

  const tab: TabKey = (TABS.some((t) => t.key === rawTab) ? rawTab : "declaration") as TabKey;
  const documents = listDocuments(declaration.id);
  const messages = listCorrespondence(declaration.id);
  const audit = listAudit(declaration.id);
  const amendable = declaration.status === "HELD_VALUATION" || declaration.status === "AWAITING_DOCS";

  return (
    <div>
      <nav className="text-[13.5px] mb-4 text-gov-muted" aria-label="Breadcrumb">
        <Link href="/portal/cases" className="gov-link">
          Home
        </Link>
        <span className="mx-2">›</span>
        <Link href="/portal/cases" className="gov-link">
          Declarations
        </Link>
        <span className="mx-2">›</span>
        <span>{declaration.ref}</span>
      </nav>

      {submitted ? (
        <div
          className="mb-6 border border-gov-green bg-[#e9f5ee] border-l-[6px] p-4"
          role="status"
          data-testid="amendment-success"
        >
          <h2 className="font-bold text-[17px] text-gov-green-dark mb-0.5">
            Amendment {submitted} submitted
          </h2>
          <p className="m-0 text-[14.5px]">
            Your amendment has been transmitted to the Federal Customs &amp; Border Authority
            and is queued for officer review. Track progress in the History tab.
          </p>
        </div>
      ) : null}
      {sent ? (
        <div
          className="mb-6 border border-gov-green bg-[#e9f5ee] border-l-[6px] p-4"
          role="status"
          data-testid="reply-success"
        >
          <h2 className="font-bold text-[17px] text-gov-green-dark mb-0.5">Reply sent</h2>
          <p className="m-0 text-[14.5px]">
            Your reply and any attached documents have been filed to the case record.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-[13px] uppercase tracking-wide font-semibold text-gov-muted mb-1">
            Import declaration
          </p>
          <h1 className="text-[30px] font-bold leading-tight m-0">{declaration.ref}</h1>
          <p className="text-gov-muted text-[14.5px] mt-1 mb-0">
            {declaration.exporterName} → {declaration.importerName} · Arrived{" "}
            {formatDateTime(declaration.arrivedAt)}
          </p>
        </div>
        <div className="pt-1.5">
          <StatusTag status={declaration.status} />
        </div>
      </div>

      {declaration.discrepancyNote &&
      declaration.status !== "CLEARED" &&
      declaration.status !== "AMENDMENT_REVIEW" ? (
        <div className="gov-notice-warning my-5" role="alert" data-testid="discrepancy-notice">
          <h2 className="font-bold text-[16.5px] mb-1">
            {declaration.status === "HELD_VALUATION"
              ? "Notice: declared value inconsistent with commercial invoice"
              : "Notice: action required"}
          </h2>
          <p className="m-0 text-[14.5px] leading-relaxed">{declaration.discrepancyNote}</p>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="border-b-2 border-gov-border mt-6 mb-6 flex gap-1" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/portal/cases/${declaration.id}?tab=${t.key}`}
            data-testid={`tab-${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={
              tab === t.key
                ? "px-4 py-2.5 font-bold text-[15px] bg-white border-2 border-gov-border border-b-white -mb-[2px] no-underline text-gov-ink"
                : "px-4 py-2.5 font-semibold text-[15px] text-gov-blue underline hover:text-gov-blue-dark"
            }
          >
            {t.label}
            {t.key === "correspondence" && messages.length > 0 ? ` (${messages.length})` : ""}
          </Link>
        ))}
      </div>

      {tab === "declaration" ? (
        <section aria-label="Declaration details">
          <div className="gov-panel p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-[20px] font-bold m-0">Declared particulars</h2>
              {amendable ? (
                <Link
                  href={`/portal/cases/${declaration.id}/amend`}
                  className="gov-btn"
                  data-testid="amend-declaration"
                >
                  Amend declaration
                </Link>
              ) : null}
            </div>
            <dl className="m-0">
              <div className="gov-summary-row">
                <dt>Declared value</dt>
                <dd data-testid="field-declared-value" className="font-bold tabular-nums">
                  {formatMoney(declaration.declaredValue, declaration.currency)}
                </dd>
              </div>
              <div className="gov-summary-row">
                <dt>Currency</dt>
                <dd data-testid="field-currency">{declaration.currency}</dd>
              </div>
              <div className="gov-summary-row">
                <dt>Commodity (HS) code</dt>
                <dd data-testid="field-hs-code" className="tabular-nums">
                  {declaration.hsCode}
                </dd>
              </div>
              <div className="gov-summary-row">
                <dt>Invoice number</dt>
                <dd data-testid="field-invoice-number">{declaration.invoiceNumber}</dd>
              </div>
              <div className="gov-summary-row">
                <dt>Incoterms</dt>
                <dd data-testid="field-incoterms">{declaration.incoterms}</dd>
              </div>
              <div className="gov-summary-row">
                <dt>Gross weight</dt>
                <dd className="tabular-nums">{declaration.weightKg.toLocaleString()} kg</dd>
              </div>
              <div className="gov-summary-row">
                <dt>Importer (consignee)</dt>
                <dd>
                  {declaration.importerName}
                  {declaration.importerVat ? (
                    <span className="block text-gov-muted text-[13.5px]">
                      VAT {declaration.importerVat}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="gov-summary-row">
                <dt>Exporter (consignor)</dt>
                <dd>{declaration.exporterName}</dd>
              </div>
              <div className="gov-summary-row">
                <dt>Country of origin</dt>
                <dd>{declaration.originCountry}</dd>
              </div>
              <div className="gov-summary-row">
                <dt>Destination</dt>
                <dd>{declaration.destinationCountry}</dd>
              </div>
              <div className="gov-summary-row border-b-0">
                <dt>Linked case reference</dt>
                <dd className="tabular-nums">{declaration.caseRef}</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      {tab === "documents" ? (
        <section aria-label="Attached documents">
          <div className="gov-panel overflow-x-auto">
            <table className="gov-table">
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Type</th>
                  <th scope="col">Size</th>
                  <th scope="col">Uploaded by</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} data-testid={`document-row-${doc.id}`}>
                    <td>
                      <a href="#" className="gov-link font-semibold">
                        {doc.name}
                      </a>
                    </td>
                    <td>{doc.docType}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatBytes(doc.sizeBytes)}</td>
                    <td>{doc.uploadedBy}</td>
                    <td className="whitespace-nowrap">{formatDateTime(doc.uploadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13.5px] text-gov-muted mt-3">
            To add a document, use the upload form under the Correspondence tab.
          </p>
        </section>
      ) : null}

      {tab === "correspondence" ? (
        <section aria-label="Correspondence" className="space-y-6">
          <div className="space-y-4">
            {messages.map((msg) => (
              <article
                key={msg.id}
                data-testid={`correspondence-message-${msg.id}`}
                className={
                  msg.sender === "officer"
                    ? "gov-panel border-l-[6px] border-l-gov-navy p-5"
                    : msg.sender === "broker"
                      ? "gov-panel border-l-[6px] border-l-gov-green p-5"
                      : "gov-panel border-l-[6px] border-l-gov-border p-5"
                }
              >
                <header className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="font-bold text-[16px] m-0">{msg.subject}</h3>
                  <span className="text-[13px] text-gov-muted whitespace-nowrap">
                    {formatDateTime(msg.sentAt)}
                  </span>
                </header>
                <p className="text-[13.5px] text-gov-muted mt-0 mb-3">
                  From: <strong className="text-gov-ink">{msg.senderName}</strong>
                  {msg.sender === "officer" ? " · Federal Customs & Border Authority" : ""}
                </p>
                <div className="text-[14.5px] leading-relaxed whitespace-pre-line">{msg.body}</div>
                {msg.attachmentName ? (
                  <p className="mt-3 mb-0 text-[14px]">
                    📎{" "}
                    <a href="#" className="gov-link">
                      {msg.attachmentName}
                    </a>
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="gov-panel p-6" id="reply">
            <h2 className="text-[20px] font-bold mt-0 mb-1">Reply / upload document</h2>
            <p className="text-gov-muted text-[14px] mt-0 mb-5">
              Replies and documents are filed to the case record and visible to the assigned
              officer.
            </p>
            <form action={sendReplyWithUpload} className="space-y-5">
              <input type="hidden" name="declarationId" value={declaration.id} />
              <div>
                <label className="gov-label" htmlFor="body">
                  Message <span className="font-normal text-gov-muted">(optional)</span>
                </label>
                <textarea
                  id="body"
                  name="body"
                  className="gov-textarea"
                  data-testid="reply-body"
                  placeholder="Add context for the assigned officer…"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="gov-label" htmlFor="docType">
                    Document type
                  </label>
                  <select id="docType" name="docType" className="gov-select" data-testid="upload-doc-type">
                    <option>VAT registration certificate</option>
                    <option>Commercial invoice</option>
                    <option>Certificate of origin</option>
                    <option>Packing list</option>
                    <option>Transport document</option>
                    <option>Other supporting document</option>
                  </select>
                </div>
                <div>
                  <label className="gov-label" htmlFor="file">
                    File <span className="font-normal text-gov-muted">(PDF, max 10 MB)</span>
                  </label>
                  <input
                    id="file"
                    name="file"
                    type="file"
                    className="gov-input pt-2"
                    data-testid="upload-file"
                  />
                </div>
              </div>
              <button type="submit" className="gov-btn" data-testid="upload-submit">
                Send reply &amp; upload
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {tab === "history" ? (
        <section aria-label="History and audit log">
          <div className="gov-panel overflow-x-auto">
            <table className="gov-table" data-testid="audit-table">
              <thead>
                <tr>
                  <th scope="col">Date &amp; time</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap tabular-nums">{formatDateTime(entry.at)}</td>
                    <td className="whitespace-nowrap">{entry.actor}</td>
                    <td className="font-semibold whitespace-nowrap">{entry.action}</td>
                    <td className="text-gov-muted">{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
