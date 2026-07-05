// scripts/watch-agent-drive-portal.mjs
// =====================================================================
// Watch the agent drive the real customs portal in a real browser.
// =====================================================================
// This runs the SAME browser-automation the Computer Use agent performs
// (Playwright — the engine server/src/computer-use-live.ts uses). In full
// LIVE mode, Gemini Computer Use looks at screenshots and decides each of
// these actions itself; here we run them deterministically so you can watch
// the browser being driven on a real website without an API key.
//
//   HEADLESS=false  → opens a visible Chromium window you can watch live
//   OUT=<dir>       → also saves a screenshot after each action
//
// Usage (from repo root, with the portal running on :5174):
//   HEADLESS=false OUT=/tmp/cb-drive NODE_PATH=server/node_modules \
//     node scripts/watch-agent-drive-portal.mjs
// =====================================================================

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
// Playwright lives in the server package; resolve it from there.
const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../server/"));
const { chromium } = require("playwright");

const PORTAL = process.env.PORTAL_URL || "http://localhost:5174";
const OUT = process.env.OUT || null;
const HEADLESS = process.env.HEADLESS !== "false";
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` }); };
const log = (m) => console.log(`[agent] ${m}`);

const browser = await chromium.launch({ headless: HEADLESS });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 980 } })).newPage();

log(`navigate → ${PORTAL}`);
await page.goto(PORTAL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await shot(page, "step1-open");

const field = page.locator("#packingListValue");
await field.scrollIntoViewIfNeeded();
log('click the "Packing List Value" field (currently €45,000 — mismatched)');
await field.click();
await field.fill("");
await page.waitForTimeout(400);
await shot(page, "step2-cleared");

log("type the corrected value the supplier confirmed: €47,250.00");
await field.fill("€47,250.00");
await page.waitForTimeout(400);
await shot(page, "step3-typed");

// THE GATE: reach Submit, but never click it — a human must approve.
const submit = page.locator("#submitBtn");
await submit.scrollIntoViewIfNeeded();
log("reached the Submit button — HALTING. A human clicks Submit, never the agent.");
await page.waitForTimeout(400);
await shot(page, "step4-halt-before-submit");

log("done — declared value corrected, stopped before Submit.");
if (HEADLESS) await browser.close();
else { log("leaving the window open so you can watch — close it when done."); }
