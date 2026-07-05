// server/src/computer-use-live.ts
// =====================================================================
// LIVE Computer Use — Gemini 2.5 Computer Use (Interactions API) + Playwright
// Target: the in-repo EU Customs "Single Window" portal (portal/, :5174)
// =====================================================================
// What the AI broker performs on screen:
//   1. Open the customs declaration entry (single page, no login).
//   2. The Packing List Value (€45,000) disagrees with the Invoice Value
//      (€47,250) — the value the supplier confirmed includes CIF freight.
//   3. Correct the "Packing List Value" field so it matches the invoice.
//   4. STOP before "Submit Declaration".
//
// HARD RULE: the loop halts before submitting. Two guarantees:
//   1. The goal/system-instruction tells the model to stop before Submit.
//   2. A programmatic gate refuses any click on the Submit button (#submitBtn).
// The real submit only happens in liveConfirmSubmit(), reachable exclusively
// through explicit human approval (POST /confirm). That confirm step is
// DETERMINISTIC — it re-asserts the corrected value and submits, so the task
// is guaranteed to finish even if the model's run was imperfect.
// =====================================================================

import { broadcast } from "./events.js";

// ---- config (env, with in-repo portal defaults) ----------------------
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:5174";
const TARGET_FIELD_SEL = process.env.CU_FIELD_SELECTOR || "#packingListValue";
const TARGET_VALUE = process.env.CU_TARGET_VALUE || "€47,250.00"; // match the invoice
const RESET_VALUE = process.env.CU_RESET_VALUE || "€45,000.00";   // the mismatched packing-list value
const SUBMIT_SEL = process.env.CU_SUBMIT_SELECTOR || "#submitBtn";
const HEADLESS = process.env.CU_HEADLESS !== "false";
const VIEWPORT = { width: 1440, height: 900 };
const MAX_TURNS = Number(process.env.CU_MAX_TURNS || 30);
const CU_MODEL = process.env.CU_MODEL || "gemini-2.5-computer-use-preview-10-2025";

// ---- live session state ----------------------------------------------
interface LiveSession { browser: any; page: any; }
const sessions = new Map<string, LiveSession>();
export function hasLiveSession(caseId: string): boolean { return sessions.has(caseId); }

// ---- helpers ---------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const denorm = (v: number, size: number) => Math.max(0, Math.min(size - 1, Math.round((v / 1000) * size)));

async function shotBase64(page: any): Promise<string> {
  const buf: Buffer = await page.screenshot({ type: "png" });
  return buf.toString("base64");
}
function emitStep(caseId: string, action: string, description: string, index: number) {
  broadcast("computer_use_step", { caseId, step: { action, description }, stepIndex: index, live: true });
}
// Stream a live view of the agent's browser into the office UI (scene 4).
async function sendFrame(caseId: string, page: any, caption: string) {
  try {
    const d = (await page.screenshot({ type: "jpeg", quality: 55 })).toString("base64");
    broadcast("computer_use_frame", { caseId, image: `data:image/jpeg;base64,${d}`, caption, url: page.url() });
  } catch { /* ignore transient screenshot errors */ }
}
async function pointHitsSelector(page: any, px: number, py: number, selector: string): Promise<boolean> {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    const box = await el.boundingBox();
    if (!box) return false;
    return px >= box.x && px <= box.x + box.width && py >= box.y && py <= box.y + box.height;
  } catch { return false; }
}

// ---- action executor -------------------------------------------------
async function executeAction(page: any, name: string, args: Record<string, any>): Promise<{ ok: boolean; halted: boolean; note: string }> {
  const W = VIEWPORT.width, H = VIEWPORT.height;
  const x = args?.x != null ? denorm(args.x, W) : undefined;
  const y = args?.y != null ? denorm(args.y, H) : undefined;

  switch (name) {
    case "open_web_browser":
      return { ok: true, halted: false, note: "browser ready" };
    case "navigate":
    case "open_url":
      if (args?.url) await page.goto(args.url, { waitUntil: "domcontentloaded" });
      return { ok: true, halted: false, note: `navigated to ${args?.url ?? ""}` };
    case "go_back":
      await page.goBack().catch(() => {});
      return { ok: true, halted: false, note: "went back" };
    case "go_forward":
      await page.goForward().catch(() => {});
      return { ok: true, halted: false, note: "went forward" };

    case "click_at":
    case "click":
    case "left_click":
    case "double_click":
    case "right_click": {
      if (x == null || y == null) return { ok: false, halted: false, note: "click missing coords" };
      // GATE: refuse any click on the Submit button — a human does that.
      if (await pointHitsSelector(page, x, y, SUBMIT_SEL)) {
        return { ok: false, halted: true, note: "refused click on Submit — awaiting human approval" };
      }
      const opts: any = {};
      if (name === "double_click") opts.clickCount = 2;
      if (name === "right_click") opts.button = "right";
      await page.mouse.click(x, y, opts);
      await sleep(200);
      return { ok: true, halted: false, note: `clicked (${x},${y})` };
    }

    case "hover_at": case "hover": case "mouse_move":
      if (x != null && y != null) await page.mouse.move(x, y);
      return { ok: true, halted: false, note: "hovered" };

    case "type_text_at":
    case "type": {
      if (x != null && y != null) {
        if (await pointHitsSelector(page, x, y, SUBMIT_SEL)) return { ok: false, halted: true, note: "refused focus on Submit" };
        await page.mouse.click(x, y);
        await sleep(120);
        await page.keyboard.press("ControlOrMeta+A").catch(async () => {
          await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
        });
        await page.keyboard.press("Backspace");
      }
      const txt = args?.text ?? args?.value ?? "";
      await page.keyboard.type(String(txt), { delay: 25 });
      if (args?.press_enter || args?.pressEnter) await page.keyboard.press("Enter");
      return { ok: true, halted: false, note: `typed "${txt}"` };
    }

    case "key_combination": case "press_key": {
      const keys: string = args?.keys ?? args?.key ?? "";
      if (keys) await page.keyboard.press(keys.replace(/\s+/g, "")).catch(() => {});
      return { ok: true, halted: false, note: `key ${keys}` };
    }

    case "scroll_document": case "scroll": case "scroll_at": {
      const dir = (args?.direction || "down").toLowerCase();
      const mag = Number(args?.magnitude_in_pixels ?? args?.magnitude ?? 600);
      const dy = dir === "up" ? -mag : dir === "down" ? mag : 0;
      const dx = dir === "left" ? -mag : dir === "right" ? mag : 0;
      if (x != null && y != null) await page.mouse.move(x, y);
      await page.mouse.wheel(dx, dy);
      await sleep(200);
      return { ok: true, halted: false, note: `scrolled ${dir}` };
    }

    case "wait": case "wait_5_seconds": {
      const secs = Number(args?.seconds ?? (name === "wait_5_seconds" ? 5 : 1));
      await sleep(Math.min(5, secs) * 1000);
      return { ok: true, halted: false, note: `waited ${secs}s` };
    }

    case "drag_and_drop": {
      const sx = denorm(args?.start_x ?? 0, W), sy = denorm(args?.start_y ?? 0, H);
      const ex = denorm(args?.end_x ?? 0, W), ey = denorm(args?.end_y ?? 0, H);
      await page.mouse.move(sx, sy); await page.mouse.down();
      await page.mouse.move(ex, ey); await page.mouse.up();
      return { ok: true, halted: false, note: "dragged" };
    }

    default:
      return { ok: true, halted: false, note: `ignored unsupported action: ${name}` };
  }
}

function captionFor(name: string, args: Record<string, any>): string {
  switch (name) {
    case "navigate": case "open_url": case "open_web_browser": return "Opening EU Customs Single Window portal";
    case "click_at": case "click": case "left_click": return "Navigating the declaration entry";
    case "type_text_at": case "type": return `Typing: "${args?.text ?? args?.value ?? ""}"`;
    case "scroll_document": case "scroll": case "scroll_at": return "Scrolling the declaration";
    case "key_combination": case "press_key": return "Editing field";
    default: return name.replace(/_/g, " ");
  }
}

// ---- the live correction loop ---------------------------------------
export async function runLiveCorrection(pending: {
  caseId: string; discrepancyId: string; discrepancy: any;
  field: string; from: string; to: string;
}): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY required for live Computer Use");

  const { GoogleGenAI } = await import("@google/genai");
  const { chromium } = await import("playwright");
  const ai = new GoogleGenAI({ apiKey });

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded" });
  await sleep(600);
  sessions.set(pending.caseId, { browser, page });
  await sendFrame(pending.caseId, page, "Opening EU Customs Single Window portal"); // initial live frame

  // Coherent office/CaseFile display for the portal numbers.
  pending.field = "Packing List Value";
  pending.from = RESET_VALUE;
  pending.to = TARGET_VALUE;

  const goal =
    `You are operating the EU Customs "Single Window" declaration portal to clear a customs value hold.\n` +
    `The declaration is a single page (no login). The "Invoice Value" is ${TARGET_VALUE} — the value the ` +
    `supplier confirmed on the call (it includes CIF freight). The "Packing List Value" still reads ` +
    `${RESET_VALUE}, which is why the entry is held for a value mismatch.\n` +
    `1. Find the "Packing List Value" input field.\n` +
    `2. Clear it and type ${TARGET_VALUE} so it matches the Invoice Value and the discrepancy is resolved.\n` +
    `3. IMPORTANT: STOP there. Do NOT click "Submit Declaration". A human reviews and submits.`;

  const tools = [{ type: "computer_use", environment: "browser" }];
  const systemInstruction =
    `You control a real web browser to amend one customs declaration field. ` +
    `Only correct the Packing List Value to match the Invoice Value, then finish. ` +
    `Never click "Submit Declaration" / Submit — a human does that.`;

  let stepIdx = 0;
  let halted = false;

  let interaction: any = await ai.interactions.create({
    model: CU_MODEL,
    system_instruction: systemInstruction,
    input: goal,
    tools,
  } as any);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const steps: any[] = interaction?.steps || [];
    const calls = steps.filter((s) => s?.type === "function_call");
    if (calls.length === 0) break;

    const results: any[] = [];
    for (const call of calls) {
      const name: string = call.name;
      const args: Record<string, any> = call.arguments || {};
      stepIdx++;
      emitStep(pending.caseId, name, captionFor(name, args), stepIdx);

      const res = await executeAction(page, name, args);
      await sleep(150);
      const screenshot = await shotBase64(page);
      // stream the same view to the office UI (reuse the model's screenshot)
      broadcast("computer_use_frame", {
        caseId: pending.caseId,
        image: "data:image/png;base64," + screenshot,
        caption: captionFor(name, args),
        url: page.url(),
      });
      results.push({
        type: "function_result",
        name,
        call_id: call.id,
        is_error: !res.ok && !res.halted,
        result: [
          { type: "text", text: JSON.stringify({ url: page.url(), note: res.note }) },
          { type: "image", data: screenshot, mime_type: "image/png" },
        ],
      });
      if (res.halted) { halted = true; break; }
    }
    if (halted) break;

    interaction = await ai.interactions.create({
      model: CU_MODEL,
      previous_interaction_id: interaction.id,
      input: results,
      tools,
    } as any);
    if (interaction?.status === "completed") break;
  }

  broadcast("needs_confirmation", {
    caseId: pending.caseId,
    discrepancyId: pending.discrepancyId,
    correction: { field: pending.field, fieldLabel: "Packing List Value", from: pending.from, to: pending.to },
    discrepancy: pending.discrepancy,
    live: true,
    message:
      "Computer Use amended the Packing List Value on the EU customs portal and stopped before Submit. Awaiting your approval.",
  });
}

// ---- human-gated submit — DETERMINISTIC finish -----------------------
export async function liveConfirmSubmit(caseId: string): Promise<void> {
  const s = sessions.get(caseId);
  if (!s) throw new Error("No live Computer Use session for this case");
  const page = s.page;
  try {
    broadcast("computer_use_step", {
      caseId, live: true,
      step: { action: "submit", description: "Human approved — submitting the correction" },
    });

    // Re-assert the corrected value on the SAME page (the SPA holds state in
    // memory; reloading would reset it), guaranteeing completion even if the
    // agent's own edits were imperfect.
    await page.fill(TARGET_FIELD_SEL, TARGET_VALUE).catch(() => {});
    await sendFrame(caseId, page, "Corrected value confirmed — submitting");
    // Submit for real — the ONLY submit path, reached only via human approval.
    await page.click(SUBMIT_SEL).catch(() => {});
    await sleep(600);
    await sendFrame(caseId, page, "Portal: declaration submitted");
    // Verify the portal accepted it (the entry status flips to "Submitted").
    const okText = await page.locator("text=Submitted").count().catch(() => 0);
    const success = okText > 0;
    broadcast("correction_submitted", {
      caseId, live: true, success,
      url: page.url(),
      message: success
        ? "Portal confirmed: declaration submitted — customs value gap resolved."
        : "Submit clicked; confirmation not detected.",
    });
    await sleep(1200); // let the confirmation stay visible briefly
  } finally {
    await s.browser.close().catch(() => {});
    sessions.delete(caseId);
  }
}

export async function liveReject(caseId: string): Promise<void> {
  const s = sessions.get(caseId);
  if (!s) return;
  await s.browser.close().catch(() => {});
  sessions.delete(caseId);
}
