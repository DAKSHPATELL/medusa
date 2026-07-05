// server/src/browser-drive.ts
// =====================================================================
// Deterministic portal driving WITH real screenshots — for DEMO mode.
// =====================================================================
// Drives the EU customs portal via Playwright (no Gemini key needed) and
// streams real browser screenshots as `computer_use_frame` events, so the UI
// can show the computer actually working in the background — even offline.
//
// In LIVE mode (server/src/computer-use-live.ts) Gemini Computer Use decides
// each action from screenshots; here the actions are fixed. Either way, the
// browser is real and the screenshots are real.
// Best-effort: returns false if Playwright or the portal is unavailable, so
// the caller can fall back to the pure event simulation.
// =====================================================================

import { broadcast } from "./events.js";

const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:5174";
const FIELD_SEL = process.env.CU_FIELD_SELECTOR || "#packingListValue";
const SUBMIT_SEL = process.env.CU_SUBMIT_SELECTOR || "#submitBtn";
const HEADLESS = process.env.CU_HEADLESS !== "false";

async function frame(caseId: string, page: any, caption: string) {
  try {
    const d = (await page.screenshot({ type: "jpeg", quality: 55 })).toString("base64");
    broadcast("computer_use_frame", { caseId, image: `data:image/jpeg;base64,${d}`, caption, url: page.url() });
  } catch { /* transient screenshot error — ignore */ }
}
function step(caseId: string, action: string, description: string, i: number) {
  broadcast("computer_use_step", { caseId, step: { action, description }, stepIndex: i });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Drive the demo correction on the real portal, streaming screenshots.
 * Returns true if it ran a real browser, false if it couldn't (caller falls
 * back to the pure setTimeout simulation).
 */
export async function driveDemoCorrection(pending: { caseId: string; to: string }): Promise<boolean> {
  let browser: any;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: HEADLESS });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    let i = 0;

    step(pending.caseId, "navigate", "Opening EU Customs Single Window portal", ++i);
    await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded" });
    await wait(500);
    await frame(pending.caseId, page, "Opening EU Customs Single Window portal");

    const field = page.locator(FIELD_SEL);
    await field.scrollIntoViewIfNeeded();
    step(pending.caseId, "click", "Locating field: Packing List Value", ++i);
    await field.click();
    await wait(450);
    await frame(pending.caseId, page, "Selecting the Packing List Value field");

    step(pending.caseId, "clear", "Clearing the mismatched value", ++i);
    await field.fill("");
    await wait(450);
    await frame(pending.caseId, page, "Cleared the mismatched value");

    step(pending.caseId, "type", `Typing corrected value: ${pending.to}`, ++i);
    await field.fill(pending.to);
    await wait(450);
    await frame(pending.caseId, page, `Typed corrected value ${pending.to}`);

    const submit = page.locator(SUBMIT_SEL);
    await submit.scrollIntoViewIfNeeded();
    step(pending.caseId, "halt", "Reached Submit — halting for human approval", ++i);
    await wait(450);
    await frame(pending.caseId, page, "Reached Submit — awaiting human approval");

    await browser.close();
    return true;
  } catch (e: any) {
    console.warn("[browser-drive] demo driving unavailable, using simulation:", e?.message ?? e);
    try { await browser?.close(); } catch { /* ignore */ }
    return false;
  }
}
