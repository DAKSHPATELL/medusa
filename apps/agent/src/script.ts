import type Database from "better-sqlite3";
import type { AgentEventInput, MemoryRecord, Speaker } from "@clearborder/shared";
import { getMemory } from "./db";
import { HERO_CASE_ID, HERO_SHIPPER_ID } from "./seed";

/**
 * The scripted demo scenario for the hero case CB-2481, split into three
 * day-segments. This feeds the dashboard until the real agent workstreams
 * (Gemini Live + Twilio, browser automation, memory engine) replace it —
 * they will emit the exact same AgentEvent shapes.
 */

export interface ScriptStep {
  /** Milliseconds to wait before emitting (scaled by replay speed). */
  wait: number;
  input: AgentEventInput | ((db: Database.Database) => AgentEventInput);
  /** Pause the replayer after this event until an approval decision arrives. */
  pauseForApproval?: boolean;
  /** Extra DB mutation applied when the event fires. */
  apply?: (db: Database.Database) => void;
}

/** Wall-clock base per demo day (synthetic clock). */
export const DAY_BASE: Record<number, string> = {
  1: "2026-07-02T14:02:00+02:00",
  2: "2026-07-03T08:58:00+02:00",
  3: "2026-07-04T09:01:00+02:00",
};

export const DAY_DATES: Record<number, string> = {
  1: "2026-07-02",
  2: "2026-07-03",
  3: "2026-07-04",
};

const CASE = HERO_CASE_ID;
const CALL_D1 = "call-d1-2481";
const APPROVAL_D1 = "apr-d1-2481";

// ─── Memory records referenced by the script ─────────────────────────────────
// Seeded records are looked up in the DB first (live recall timestamps);
// these inline copies are the fallback so any day can replay standalone.

const MEM: Record<string, MemoryRecord> = {
  "mem-order-history": {
    id: "mem-order-history",
    shipperId: HERO_SHIPPER_ID,
    type: "semantic",
    content:
      "Alpenrose Electronics orders from Shenzhen Bright Electronics roughly monthly; typical commercial invoice total is USD 1,800–3,200 (12-month import ledger).",
    source: "Import ledger — Alpenrose account",
    createdAt: "2026-04-14T11:22:00+02:00",
  },
  "mem-sop-valuation": {
    id: "mem-sop-valuation",
    type: "procedural",
    content:
      "FCBA valuation holds: confirm the intended invoice total with the shipper by phone before amending; never resubmit without documentary confirmation.",
    source: "Broker SOP library",
    createdAt: "2026-02-03T09:00:00+02:00",
  },
  "mem-vat-cert": {
    id: "mem-vat-cert",
    caseId: "CB-2103",
    type: "semantic",
    content:
      "Alpenrose Electronics GmbH VAT registration certificate (CHE-334.219.007) is archived in the document vault — collected during case CB-2103 (March 2026).",
    source: "Case CB-2103 archive",
    createdAt: "2026-03-09T15:47:00+02:00",
  },
  "mem-d1-call": {
    id: "mem-d1-call",
    caseId: CASE,
    shipperId: HERO_SHIPPER_ID,
    type: "episodic",
    content:
      "Shenzhen Bright confirmed invoice INV-SBE-88671 total = USD 2,400.00 by phone; declared 240.00 was a decimal-entry error on their side. Stamped invoice to be emailed for the record.",
    source: "Call with shipper — Day 1",
    createdAt: "2026-07-02T14:05:00+02:00",
  },
  "mem-d1-amend": {
    id: "mem-d1-amend",
    caseId: CASE,
    type: "episodic",
    content:
      "Amendment AMD-04417-01 submitted on TradeGate with operator approval: declared value corrected to USD 2,400.00. Awaiting FCBA review.",
    source: "TradeGate portal session — Day 1",
    createdAt: "2026-07-02T14:07:00+02:00",
  },
  "mem-d2-upload": {
    id: "mem-d2-upload",
    caseId: CASE,
    type: "episodic",
    content:
      "Uploaded Alpenrose VAT registration certificate (CHE-334.219.007) to FCBA case FCBA-2026-04417 in response to the officer's fiscal representation request.",
    source: "TradeGate portal session — Day 2",
    createdAt: "2026-07-03T09:04:00+02:00",
  },
  "mem-shipper-pattern": {
    id: "mem-shipper-pattern",
    shipperId: HERO_SHIPPER_ID,
    type: "semantic",
    content:
      "Shipper pattern — Shenzhen Bright Electronics: prone to decimal-point errors in declared values. On any future valuation hold for this shipper, verify the invoice total by phone immediately before anything else.",
    source: "Learned from case CB-2481",
    createdAt: "2026-07-04T09:03:00+02:00",
  },
};

function memRead(id: string, why: string): ScriptStep["input"] {
  return (db) => ({
    type: "memory.read",
    caseId: CASE,
    record: getMemory(db, id) ?? MEM[id]!,
    why,
  });
}

function memWrite(id: string): ScriptStep["input"] {
  return () => ({ type: "memory.write", caseId: CASE, record: MEM[id]! });
}

/** Expand one utterance into a streaming partial + a final transcript event. */
function say(
  speaker: Speaker,
  sourceLang: string,
  sourceText: string,
  translatedText: string,
  finalWait = 1600,
): ScriptStep[] {
  const cut = (s: string, f: number) =>
    s.slice(0, Math.max(4, Math.round(s.length * f))) + " …";
  const base = {
    caseId: CASE,
    callId: CALL_D1,
    speaker,
    sourceLang,
    targetLang: sourceLang.startsWith("zh") ? "en" : "zh-CN",
  };
  return [
    {
      wait: 900,
      input: {
        type: "call.transcript_partial",
        ...base,
        sourceText: cut(sourceText, 0.45),
        translatedText: cut(translatedText, 0.4),
      },
    },
    {
      wait: finalWait,
      input: {
        type: "call.transcript_final",
        ...base,
        sourceText,
        translatedText,
      },
    },
  ];
}

// ─── DAY 1 — discover · call · amend · approval · sleep ──────────────────────

export function day1(): ScriptStep[] {
  return [
    {
      wait: 700,
      input: {
        type: "case.status_changed",
        caseId: CASE,
        from: "NEW",
        to: "HELD_VALUATION",
        reason: "FCBA risk rule V-104 — declared value vs. invoice variance",
      },
    },
    {
      wait: 1700,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "Valuation hold on CB-2481. Declared value USD 240.00 against commercial invoice INV-SBE-88671 showing USD 2,400.00 — pulling the discrepancy notice from TradeGate.",
      },
    },
    {
      wait: 1800,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "navigate",
        description: "Opening declaration FCBA-2026-04417 on TradeGate",
        url: "http://localhost:3000/portal/cases/dec-04417",
        targetTestId: "case-row-FCBA-2026-04417",
      },
    },
    {
      wait: 1500,
      input: {
        type: "browser.screenshot",
        caseId: CASE,
        ref: { kind: "path", path: "/demo/portal-case-detail.png" },
        caption: "Discrepancy notice — declared value inconsistent with commercial invoice",
      },
    },
    {
      wait: 2100,
      input: memRead(
        "mem-order-history",
        "Checking the typical order size on this trade lane before assuming a typo",
      ),
    },
    {
      wait: 2100,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "USD 240 sits 10× below this lane's 12-month floor. Everything points to a decimal slip — but procedure says: confirm with the shipper before touching the declaration.",
      },
    },
    {
      wait: 1500,
      input: memRead(
        "mem-sop-valuation",
        "Valuation-hold SOP — confirm intended value with the shipper by phone first",
      ),
    },
    {
      wait: 1700,
      input: (db) => {
        const row = db
          .prepare("SELECT phone FROM shippers WHERE id = ?")
          .get(HERO_SHIPPER_ID) as { phone: string } | undefined;
        return {
          type: "call.started",
          caseId: CASE,
          callId: CALL_D1,
          phone: row?.phone ?? "+86 755 0000 0000",
          shipperName: "Shenzhen Bright Electronics Co.",
          direction: "outbound",
          sourceLang: "zh-CN",
          targetLang: "en",
        };
      },
    },
    ...say(
      "agent",
      "en",
      "Hello, this is ClearBorder calling on behalf of Alpenrose Electronics in Zürich, about shipment RX448291023CN currently held at Swiss customs.",
      "您好，我是 ClearBorder，代表苏黎世的 Alpenrose Electronics 致电，咨询目前被瑞士海关扣留的货件 RX448291023CN。",
      1900,
    ),
    ...say(
      "shipper",
      "zh-CN",
      "你好你好，请讲。是关于那批蓝牙模块吗？",
      "Hello, hello — go ahead. Is this about the Bluetooth module shipment?",
      1500,
    ),
    ...say(
      "agent",
      "en",
      "Yes. Could you confirm the total value on commercial invoice INV-SBE-88671?",
      "是的。请您确认商业发票 INV-SBE-88671 的总金额是多少？",
      1600,
    ),
    ...say(
      "shipper",
      "zh-CN",
      "我看一下……发票总额是两千四百美元，2400。",
      "Let me check… the invoice total is two thousand four hundred US dollars — 2,400.",
      1800,
    ),
    ...say(
      "agent",
      "en",
      "Thank you. The customs declaration currently shows 240.00 — it appears a digit was dropped.",
      "谢谢。海关申报单上目前写的是 240.00——看起来少了一位数字。",
      1700,
    ),
    ...say(
      "shipper",
      "zh-CN",
      "啊，抱歉！应该是我们录入的时候小数点打错了。正确金额是 2400 美元，没有问题。",
      "Ah, apologies! We must have misplaced the decimal during data entry. The correct amount is USD 2,400 — please go ahead.",
      2000,
    ),
    ...say(
      "agent",
      "en",
      "Understood — I will amend the declaration to USD 2,400.00. Please email the stamped invoice to docs@clearborder.ai for the record.",
      "明白——我会把申报金额更正为 2,400.00 美元。请将盖章发票发送至 docs@clearborder.ai 备案。",
      1900,
    ),
    ...say("shipper", "zh-CN", "好的，马上发。谢谢你们！", "Sure, sending it right away. Thank you!", 1300),
    {
      wait: 1500,
      input: {
        type: "call.ended",
        caseId: CASE,
        callId: CALL_D1,
        durationSec: 143,
        summary:
          "Shipper confirmed invoice total USD 2,400.00; declared 240.00 was a decimal-entry error. Amendment authorised; stamped invoice to follow by email.",
      },
    },
    { wait: 1500, input: memWrite("mem-d1-call") },
    {
      wait: 1900,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "Shipper confirmed USD 2,400.00. Amending the declaration on TradeGate now — I'll stage the change and hold at the final submit for your sign-off.",
      },
    },
    {
      wait: 1600,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "click",
        description: 'Clicking "Amend declaration"',
        coordinates: { x: 1004, y: 386 },
        targetTestId: "amend-declaration",
      },
    },
    {
      wait: 1500,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "type",
        description: "Correcting declared value → 2400.00",
        text: "2400.00",
        coordinates: { x: 512, y: 428 },
        targetTestId: "amend-declared-value",
      },
    },
    {
      wait: 1300,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "click",
        description: 'Clicking "Continue to review"',
        coordinates: { x: 402, y: 716 },
        targetTestId: "amend-continue",
      },
    },
    {
      wait: 1400,
      input: {
        type: "browser.screenshot",
        caseId: CASE,
        ref: { kind: "path", path: "/demo/portal-amend-review.png" },
        caption: "Amendment review — current vs. amended values",
      },
    },
    {
      wait: 1500,
      input: {
        type: "case.status_changed",
        caseId: CASE,
        from: "HELD_VALUATION",
        to: "PENDING_APPROVAL",
        reason: "Irreversible submission staged — operator approval required",
      },
    },
    {
      wait: 900,
      pauseForApproval: true,
      input: {
        type: "approval.requested",
        caseId: CASE,
        approvalId: APPROVAL_D1,
        summary:
          "Submit amendment AMD-04417-01 to the Federal Customs & Border Authority: declared value USD 240.00 → USD 2,400.00 on declaration FCBA-2026-04417.",
        risk: "Duties and import VAT will be reassessed on the corrected value. Submission is final and cannot be retracted by the broker.",
        diff: [
          {
            field: "declaredValue",
            label: "Declared value",
            before: "USD 240.00",
            after: "USD 2,400.00",
          },
          {
            field: "importVatEstimate",
            label: "Import VAT (est., 8.1%)",
            before: "USD 19.44",
            after: "USD 194.40",
          },
        ],
      },
    },
    // — replayer pauses here; continues on approval.granted —
    {
      wait: 900,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "click",
        description: "Ticking the truthfulness declaration",
        coordinates: { x: 296, y: 668 },
        targetTestId: "review-declare-truthful",
      },
    },
    {
      wait: 1100,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "click",
        description: 'Clicking "Submit amendment"',
        coordinates: { x: 420, y: 742 },
        targetTestId: "review-submit",
      },
    },
    {
      wait: 1000,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "click",
        description: 'Confirming — "Confirm & submit to FCBA"',
        coordinates: { x: 748, y: 574 },
        targetTestId: "confirm-submit",
      },
    },
    {
      wait: 1400,
      input: {
        type: "browser.screenshot",
        caseId: CASE,
        ref: { kind: "path", path: "/demo/portal-submitted.png" },
        caption: "Amendment AMD-04417-01 submitted — under review",
      },
    },
    { wait: 1500, input: memWrite("mem-d1-amend") },
    {
      wait: 1900,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "Amendment in. FCBA valuation reviews typically clear within one business day — nothing more I can do tonight. Setting a wake-up for tomorrow 09:00.",
      },
    },
    {
      wait: 1300,
      input: {
        type: "agent.sleep",
        caseId: CASE,
        until: "2026-07-03T09:00:00+02:00",
        reason: "Awaiting FCBA review of amendment AMD-04417-01",
      },
    },
    {
      wait: 800,
      input: {
        type: "case.status_changed",
        caseId: CASE,
        from: "PENDING_APPROVAL",
        to: "SLEEPING",
        reason: "Day 1 complete — amendment under review",
      },
    },
  ];
}

// ─── DAY 2 — wake · customs asks for a document · cross-case recall · sleep ──

export function day2(): ScriptStep[] {
  return [
    {
      wait: 900,
      input: {
        type: "agent.wake",
        caseId: CASE,
        recap:
          "Day 2 on CB-2481. Where I left off: valuation hold traced to a decimal slip — Shenzhen Bright confirmed USD 2,400.00 by phone; amendment AMD-04417-01 submitted with your approval at 14:07. First task: check FCBA's response.",
      },
    },
    {
      wait: 1700,
      input: memRead("mem-d1-call", "Restoring yesterday's context — what the shipper confirmed"),
    },
    {
      wait: 1800,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "navigate",
        description: "Opening correspondence for FCBA-2026-04417",
        url: "http://localhost:3000/portal/cases/dec-04417?tab=correspondence",
        targetTestId: "tab-correspondence",
      },
    },
    {
      wait: 1400,
      input: {
        type: "browser.screenshot",
        caseId: CASE,
        ref: { kind: "path", path: "/demo/portal-correspondence.png" },
        caption: "New message from M. Brunner — Valuation Section",
      },
    },
    {
      wait: 2200,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "The value amendment was accepted for review — but the officer now requires Alpenrose's VAT registration certificate for a fiscal representation check. Deadline: 5 business days.",
      },
    },
    {
      wait: 1300,
      input: {
        type: "case.status_changed",
        caseId: CASE,
        from: "SLEEPING",
        to: "AWAITING_DOCS",
        reason: "FCBA requests VAT registration certificate (fiscal representation check)",
      },
    },
    {
      wait: 1900,
      input: memRead(
        "mem-vat-cert",
        "Do we already hold this document? Searching the vault across past cases",
      ),
    },
    {
      wait: 2100,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "Found it — Alpenrose's VAT certificate was archived during case CB-2103 back in March. No need to disturb the client; uploading straight to the case file.",
      },
    },
    {
      wait: 1500,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "click",
        description: "Opening the reply & document upload form",
        coordinates: { x: 356, y: 302 },
        targetTestId: "tab-correspondence",
      },
    },
    {
      wait: 1400,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "type",
        description: "Attaching VAT-REG-CHE-334219007.pdf · type: VAT registration certificate",
        text: "VAT-REG-CHE-334219007.pdf",
        coordinates: { x: 420, y: 655 },
        targetTestId: "upload-file",
      },
    },
    {
      wait: 1300,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "click",
        description: 'Clicking "Send reply & upload"',
        coordinates: { x: 436, y: 748 },
        targetTestId: "upload-submit",
      },
    },
    {
      wait: 1400,
      input: {
        type: "browser.screenshot",
        caseId: CASE,
        ref: { kind: "path", path: "/demo/portal-upload.png" },
        caption: "Certificate filed to case FCBA-2026-04417",
      },
    },
    { wait: 1400, input: memWrite("mem-d2-upload") },
    {
      wait: 1900,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "Requested document delivered the same morning it was asked for. Awaiting officer review — wake-up set for tomorrow 09:00.",
      },
    },
    {
      wait: 1200,
      input: {
        type: "agent.sleep",
        caseId: CASE,
        until: "2026-07-04T09:00:00+02:00",
        reason: "Awaiting officer review of the submitted certificate",
      },
    },
    {
      wait: 800,
      input: {
        type: "case.status_changed",
        caseId: CASE,
        from: "AWAITING_DOCS",
        to: "SLEEPING",
        reason: "Day 2 complete — certificate under review",
      },
    },
  ];
}

// ─── DAY 3 — wake · cleared · learn the shipper pattern ──────────────────────

export function day3(): ScriptStep[] {
  return [
    {
      wait: 900,
      input: {
        type: "agent.wake",
        caseId: CASE,
        recap:
          "Day 3 on CB-2481. Recap: Day 1 — decimal error confirmed with the shipper, declared value amended to USD 2,400.00 with your approval. Day 2 — FCBA's fiscal check answered with the VAT certificate from our CB-2103 archive. Today: expecting the clearance decision.",
      },
    },
    {
      wait: 1800,
      input: {
        type: "browser.action",
        caseId: CASE,
        action: "navigate",
        description: "Checking declaration status on TradeGate",
        url: "http://localhost:3000/portal/cases/dec-04417",
      },
    },
    {
      wait: 1400,
      input: {
        type: "browser.screenshot",
        caseId: CASE,
        ref: { kind: "path", path: "/demo/portal-cleared.png" },
        caption: "Status: CLEARED — release authorised to carrier",
      },
    },
    {
      wait: 1600,
      input: {
        type: "case.status_changed",
        caseId: CASE,
        from: "SLEEPING",
        to: "RESOLVED",
        reason: "FCBA cleared the declaration; release authorised to Swiss Post",
      },
    },
    {
      wait: 2100,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "CB-2481 cleared — three days, one phone call, zero client escalations. Before archiving: this shipper's first decimal slip on our record. Worth remembering.",
      },
    },
    {
      wait: 1700,
      input: memWrite("mem-shipper-pattern"),
      apply: (db) => {
        const row = db
          .prepare("SELECT learned_patterns FROM shippers WHERE id = ?")
          .get(HERO_SHIPPER_ID) as { learned_patterns: string } | undefined;
        const patterns = row ? (JSON.parse(row.learned_patterns) as unknown[]) : [];
        const exists = patterns.some(
          (p) => (p as { id?: string }).id === "lp-shenzhen-decimal",
        );
        if (!exists) {
          patterns.push({
            id: "lp-shenzhen-decimal",
            text: "Prone to decimal-point errors in declared values — verify invoice totals by phone immediately on valuation holds.",
            confidence: 0.74,
            createdAt: "2026-07-04T09:03:00+02:00",
          });
          db.prepare("UPDATE shippers SET learned_patterns = ? WHERE id = ?").run(
            JSON.stringify(patterns),
            HERO_SHIPPER_ID,
          );
        }
      },
    },
    {
      wait: 2100,
      input: {
        type: "agent.thought",
        caseId: CASE,
        text: "Pattern saved to Shenzhen Bright's profile. Next valuation hold from this shipper, I start with the phone call — projected same-day clearance.",
      },
    },
  ];
}

export function scriptForDay(day: number): ScriptStep[] {
  if (day === 1) return day1();
  if (day === 2) return day2();
  return day3();
}
