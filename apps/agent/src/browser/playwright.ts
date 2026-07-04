import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { findRepoRoot } from "../env";

const WEB_BASE = process.env.WEB_BASE_URL ?? "http://localhost:3000";
const HEADLESS = process.env.BROWSER_HEADLESS !== "false";

let browser: Browser | null = null;

export function webBase(): string {
  return WEB_BASE;
}

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: HEADLESS });
  }
  return browser;
}

export async function newPortalPage(): Promise<Page> {
  const b = await getBrowser();
  return b.newPage({ viewport: { width: 1280, height: 800 } });
}

export async function screenshotPage(page: Page, caseId: string): Promise<string> {
  const dir = path.join(findRepoRoot(), "data", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${caseId}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
