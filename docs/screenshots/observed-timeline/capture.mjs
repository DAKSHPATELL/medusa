import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = "http://localhost:3000/timeline";

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log(file);
  return file;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });

  await page.waitForSelector('[data-testid="observed-timeline"]', { timeout: 15000 });
  await page.waitForTimeout(1200);

  const paths = [await shot(page, "01-observed-timeline.png")];

  const connected = await page.locator('[data-testid="timeline-connection"]').textContent();
  console.log("connection:", connected?.trim());

  await browser.close();
  console.log(JSON.stringify(paths, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
