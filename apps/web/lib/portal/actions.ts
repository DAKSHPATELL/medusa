"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, repoRoot } from "@/lib/db";
import { SESSION_COOKIE, requireUser } from "./auth";
import { findPortalUser, getAmendmentDraft, getDeclaration } from "./queries";

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = findPortalUser(username, password);
  if (!user) {
    redirect("/portal/login?error=1");
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, user.username, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/portal/cases");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/portal/login");
}

// ── Amendment flow ───────────────────────────────────────────────────────────

export async function saveAmendmentDraft(formData: FormData): Promise<void> {
  await requireUser();
  const declarationId = String(formData.get("declarationId") ?? "");
  const declaration = getDeclaration(declarationId);
  if (!declaration) redirect("/portal/cases");

  const draft = {
    declaredValue: Number(formData.get("declaredValue") ?? declaration.declaredValue),
    currency: String(formData.get("currency") ?? declaration.currency),
    hsCode: String(formData.get("hsCode") ?? declaration.hsCode),
    invoiceNumber: String(formData.get("invoiceNumber") ?? declaration.invoiceNumber),
    incoterms: String(formData.get("incoterms") ?? declaration.incoterms),
  };

  db()
    .prepare(
      `INSERT INTO amendment_drafts (declaration_id, payload, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(declaration_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at`,
    )
    .run(declaration.id, JSON.stringify(draft), new Date().toISOString());

  redirect(`/portal/cases/${declaration.id}/amend/review`);
}

export async function applyAmendment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const declarationId = String(formData.get("declarationId") ?? "");
  const declaration = getDeclaration(declarationId);
  if (!declaration) redirect("/portal/cases");
  const draft = getAmendmentDraft(declaration.id);
  if (!draft) redirect(`/portal/cases/${declaration.id}`);

  const now = new Date().toISOString();
  const seqRow = db()
    .prepare(
      "SELECT COUNT(*) AS n FROM audit_log WHERE declaration_id = ? AND action = 'Amendment submitted'",
    )
    .get(declaration.id) as { n: number };
  const amendmentRef = `AMD-${declaration.ref.slice(-5)}-${String(seqRow.n + 1).padStart(2, "0")}`;

  const changes: string[] = [];
  const fields = [
    ["declared_value", "Declared value", declaration.declaredValue, draft.declaredValue],
    ["currency", "Currency", declaration.currency, draft.currency],
    ["hs_code", "HS code", declaration.hsCode, draft.hsCode],
    ["invoice_number", "Invoice number", declaration.invoiceNumber, draft.invoiceNumber],
    ["incoterms", "Incoterms", declaration.incoterms, draft.incoterms],
  ] as const;
  for (const [, label, before, after] of fields) {
    if (String(before) !== String(after)) {
      changes.push(`${label}: ${String(before)} → ${String(after)}`);
    }
  }

  const apply = db().transaction(() => {
    db()
      .prepare(
        `UPDATE declarations
         SET declared_value = ?, currency = ?, hs_code = ?, invoice_number = ?, incoterms = ?,
             status = 'AMENDMENT_REVIEW', updated_at = ?
         WHERE id = ?`,
      )
      .run(
        draft.declaredValue,
        draft.currency,
        draft.hsCode,
        draft.invoiceNumber,
        draft.incoterms,
        now,
        declaration.id,
      );
    db()
      .prepare(
        "INSERT INTO audit_log (id, declaration_id, at, actor, action, detail) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        `aud-${randomUUID().slice(0, 8)}`,
        declaration.id,
        now,
        `${user.displayName} (${user.brokerFirm})`,
        "Amendment submitted",
        `${amendmentRef} — ${changes.length > 0 ? changes.join("; ") : "No field changes"}. Truthfulness declaration accepted.`,
      );
    db()
      .prepare(
        "INSERT INTO correspondence (id, declaration_id, sender, sender_name, subject, body, sent_at, attachment_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        `corr-${randomUUID().slice(0, 8)}`,
        declaration.id,
        "system",
        "TradeGate",
        `Amendment ${amendmentRef} received`,
        `Amendment ${amendmentRef} to declaration ${declaration.ref} has been received and queued for review by the assigned officer. You will be notified of the outcome in this correspondence thread.`,
        now,
        null,
      );
    db().prepare("DELETE FROM amendment_drafts WHERE declaration_id = ?").run(declaration.id);
  });
  apply();

  revalidatePath(`/portal/cases/${declaration.id}`);
  redirect(`/portal/cases/${declaration.id}?submitted=${amendmentRef}`);
}

// ── Correspondence reply + document upload ───────────────────────────────────

export async function sendReplyWithUpload(formData: FormData): Promise<void> {
  const user = await requireUser();
  const declarationId = String(formData.get("declarationId") ?? "");
  const declaration = getDeclaration(declarationId);
  if (!declaration) redirect("/portal/cases");

  const body = String(formData.get("body") ?? "").trim();
  const docType = String(formData.get("docType") ?? "Supporting document");
  const file = formData.get("file");
  const now = new Date().toISOString();

  let attachmentName: string | null = null;
  if (file instanceof File && file.size > 0) {
    attachmentName = file.name;
    const uploadsDir = path.join(repoRoot(), "data", "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(
      path.join(uploadsDir, `${declaration.id}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`),
      buffer,
    );
    db()
      .prepare(
        "INSERT INTO declaration_documents (id, declaration_id, name, doc_type, size_bytes, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        `doc-${randomUUID().slice(0, 8)}`,
        declaration.id,
        file.name,
        docType,
        file.size,
        user.brokerFirm,
        now,
      );
    db()
      .prepare(
        "INSERT INTO audit_log (id, declaration_id, at, actor, action, detail) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        `aud-${randomUUID().slice(0, 8)}`,
        declaration.id,
        now,
        `${user.displayName} (${user.brokerFirm})`,
        "Document uploaded",
        `${file.name} (${docType})`,
      );
  }

  if (body || attachmentName) {
    db()
      .prepare(
        "INSERT INTO correspondence (id, declaration_id, sender, sender_name, subject, body, sent_at, attachment_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        `corr-${randomUUID().slice(0, 8)}`,
        declaration.id,
        "broker",
        `${user.displayName} — ${user.brokerFirm}`,
        `Re: declaration ${declaration.ref}`,
        body ||
          `Please find the requested document attached (${docType}: ${attachmentName ?? "n/a"}).`,
        now,
        attachmentName,
      );
  }

  revalidatePath(`/portal/cases/${declaration.id}`);
  redirect(`/portal/cases/${declaration.id}?tab=correspondence&sent=1`);
}
