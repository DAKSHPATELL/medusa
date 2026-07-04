/**
 * Visual verification for ClearBorder (dev tool, not part of the app).
 *
 * Prereq: `pnpm dev` running (web on :3000, agent on :8787).
 * Usage:  pnpm verify [portal|demo|all]
 *
 * - Screenshots the TradeGate portal (login → cases → detail → amend flow →
 *   correspondence/upload → cleared state) into verification/.
 * - Copies clean portal captures into apps/web/public/demo/ so the demo
 *   replayer's browser.screenshot events show real portal frames.
 * - Drives the live demo through Day 1 (incl. clicking Approve), Day 2, Day 3
 *   and screenshots the key beats.
 * - Re-seeds at the end so the demo starts pristine.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "verification");
const DEMO_ASSETS = path.join(ROOT, "apps", "web", "public", "demo");
const WEB = "http://localhost:3000";
const AGENT = "http://localhost:8787";
const USERNAME = "a.mercier";
const PASSWORD = "demo2026";

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(DEMO_ASSETS, { recursive: true });

function log(msg: string): void {
  console.log(`  • ${msg}`);
}

async function agentPost(pathname: string, body?: unknown): Promise<void> {
  const res = await fetch(`${AGENT}${pathname}`, {
    method: "POST",
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`POST ${pathname} → ${res.status}`);
}

async function shot(page: Page, name: string, demoAsset = false): Promise<void> {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  if (demoAsset) {
    fs.copyFileSync(file, path.join(DEMO_ASSETS, `${name}.png`));
  }
  log(`shot ${name}.png${demoAsset ? " (+demo asset)" : ""}`);
}

async function login(page: Page): Promise<void> {
  await page.goto(`${WEB}/portal/login`);
  await page.getByTestId("portal-username").fill(USERNAME);
  await page.getByTestId("portal-password").fill(PASSWORD);
  await page.getByTestId("portal-sign-in").click();
  await page.waitForURL("**/portal/cases");
}

async function verifyPortal(): Promise<void> {
  console.log("\nPortal:");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  await page.goto(`${WEB}/portal/login`);
  await page.waitForLoadState("networkidle");
  await shot(page, "portal-login");

  await page.getByTestId("portal-username").fill(USERNAME);
  await page.getByTestId("portal-password").fill(PASSWORD);
  await page.getByTestId("portal-sign-in").click();
  await page.waitForURL("**/portal/cases");
  await page.waitForLoadState("networkidle");
  await shot(page, "portal-cases");

  await page.getByTestId("open-case-FCBA-2026-04417").click();
  await page.waitForURL("**/portal/cases/dec-04417**");
  await page.waitForLoadState("networkidle");
  await shot(page, "portal-case-detail", true);

  // Amend flow
  await page.getByTestId("amend-declaration").click();
  await page.waitForURL("**/amend");
  await page.getByTestId("amend-declared-value").fill("2400.00");
  await shot(page, "portal-amend-form");
  await page.getByTestId("amend-continue").click();
  await page.waitForURL("**/amend/review");
  await page.waitForLoadState("networkidle");
  await shot(page, "portal-amend-review", true);

  await page.getByTestId("review-declare-truthful").check();
  await page.getByTestId("review-submit").click();
  await page.waitForSelector('[data-testid="confirm-submit"]');
  await shot(page, "portal-confirm-modal");
  await page.getByTestId("confirm-submit").click();
  await page.waitForURL("**/portal/cases/dec-04417?submitted=**");
  await page.waitForLoadState("networkidle");
  await shot(page, "portal-submitted", true);

  // Correspondence + upload
  await page.getByTestId("tab-correspondence").click();
  await page.waitForURL("**tab=correspondence**");
  await page.waitForLoadState("networkidle");
  await shot(page, "portal-correspondence", true);

  const tmpPdf = path.join(OUT, "VAT-REG-CHE-334219007.pdf");
  fs.writeFileSync(tmpPdf, "%PDF-1.4\n% ClearBorder demo certificate\n%%EOF\n");
  await page.getByTestId("upload-doc-type").selectOption("VAT registration certificate");
  await page.getByTestId("upload-file").setInputFiles(tmpPdf);
  await page
    .getByTestId("reply-body")
    .fill(
      "Please find attached the consignee's VAT registration certificate (CHE-334.219.007) as requested.",
    );
  await page.getByTestId("upload-submit").click();
  await page.waitForURL("**sent=1**");
  await page.waitForLoadState("networkidle");
  await shot(page, "portal-upload", true);

  // Cleared state (staged via demo helper), for the Day-3 asset
  await agentPost("/api/demo/portal-status", { ref: "FCBA-2026-04417", status: "CLEARED" });
  await page.goto(`${WEB}/portal/cases/dec-04417`);
  await page.waitForLoadState("networkidle");
  await shot(page, "portal-cleared", true);

  await browser.close();
}

async function verifyDemo(): Promise<void> {
  console.log("\nDemo:");
  await agentPost("/api/demo/reset");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

  await page.goto(WEB);
  await page.waitForLoadState("networkidle");
  await shot(page, "demo-idle");

  await agentPost("/api/demo/replay", { day: 1, speed: 3 });
  await page.waitForSelector('[data-testid="call-transcript"]', { timeout: 60_000 });
  await page.waitForTimeout(3500);
  await shot(page, "demo-day1-call");

  await page.waitForSelector('[data-testid="approval-card"]', { timeout: 90_000 });
  await page.waitForTimeout(700);
  await shot(page, "demo-day1-approval");

  await page.getByTestId("approval-approve").click();
  await page.waitForTimeout(9000);
  await shot(page, "demo-day1-after-approval");

  await agentPost("/api/demo/replay", { day: 2, speed: 3 });
  await page.waitForSelector('[data-testid="memory-beat"]', { timeout: 60_000 });
  await page.waitForTimeout(4000);
  await shot(page, "demo-day2-memory");

  await agentPost("/api/demo/replay", { day: 3, speed: 3 });
  await page.waitForTimeout(8000);
  await shot(page, "demo-day3");

  await page.keyboard.press("d");
  await page.waitForSelector('[data-testid="dev-menu"]');
  await shot(page, "demo-dev-menu");

  await browser.close();
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "all";
  try {
    if (mode === "portal" || mode === "all") await verifyPortal();
    if (mode === "demo" || mode === "all") await verifyDemo();
  } finally {
    // Leave the world pristine for the next demo run.
    await agentPost("/api/demo/reset").catch(() => {});
    execSync("pnpm seed", { cwd: ROOT, stdio: "ignore" });
    console.log("\n  Re-seeded to pristine demo state.");
  }
  console.log(`\nDone. Screenshots in ${OUT}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
