import type { FieldDiff } from "@clearborder/shared";
import { PORTAL_TEST_IDS } from "@clearborder/shared";
import type { EventHub } from "../hub";
import { PORTAL_CREDENTIALS } from "../seed";
import { newPortalPage, screenshotPage, webBase } from "./playwright";

export interface PortalAmendParams {
  caseId: string;
  declarationId: string;
  declarationRef: string;
  correctedValue: number;
  currency: string;
  day?: number;
}

export interface PortalRunResult {
  diff: FieldDiff[];
  screenshotPath?: string;
  stoppedAtConfirm: boolean;
}

/**
 * Deterministic Playwright path using PORTAL_TEST_IDS — Plan B when Gemini computer use fails.
 */
export async function runScriptedPortalAmend(
  hub: EventHub,
  params: PortalAmendParams,
): Promise<PortalRunResult> {
  const { caseId, declarationId, declarationRef, correctedValue, currency, day } = params;
  const page = await newPortalPage();
  const emit = (description: string, action: "navigate" | "click" | "type", extra?: object) => {
    hub.emit(
      {
        type: "browser.action",
        caseId,
        action,
        description,
        url: page.url(),
        ...extra,
      },
      { day },
    );
  };

  try {
    emit("Opening TradeGate login", "navigate", { url: `${webBase()}/portal/login` });
    await page.goto(`${webBase()}/portal/login`);
    await page.getByTestId(PORTAL_TEST_IDS.loginUsername).fill(PORTAL_CREDENTIALS.username);
    await page.getByTestId(PORTAL_TEST_IDS.loginPassword).fill(PORTAL_CREDENTIALS.password);
    emit("Signing in as broker", "click", { targetTestId: PORTAL_TEST_IDS.loginSubmit });
    await page.getByTestId(PORTAL_TEST_IDS.loginSubmit).click();
    await page.waitForURL("**/portal/cases");

    emit(`Opening declaration ${declarationRef}`, "click", {
      targetTestId: `open-case-${declarationRef}`,
    });
    await page.getByTestId(`open-case-${declarationRef}`).click();
    await page.waitForURL(`**/portal/cases/${declarationId}**`);

    const shot1 = await screenshotPage(page, caseId);
    hub.emit(
      {
        type: "browser.screenshot",
        caseId,
        ref: { kind: "path", path: shot1 },
        caption: `Declaration ${declarationRef} — valuation hold`,
      },
      { day },
    );

    emit('Clicking "Amend declaration"', "click", { targetTestId: PORTAL_TEST_IDS.amendButton });
    await page.getByTestId(PORTAL_TEST_IDS.amendButton).click();
    await page.waitForURL("**/amend");

    const beforeVal = await page.getByTestId(PORTAL_TEST_IDS.amendDeclaredValue).inputValue();
    emit(`Correcting declared value to ${correctedValue}`, "type", {
      targetTestId: PORTAL_TEST_IDS.amendDeclaredValue,
      text: String(correctedValue),
    });
    await page.getByTestId(PORTAL_TEST_IDS.amendDeclaredValue).fill(String(correctedValue));
    await page.getByTestId(PORTAL_TEST_IDS.amendContinue).click();
    await page.waitForURL("**/amend/review");

    const shot2 = await screenshotPage(page, caseId);
    hub.emit(
      {
        type: "browser.screenshot",
        caseId,
        ref: { kind: "path", path: shot2 },
        caption: "Amendment review — awaiting operator approval before submit",
      },
      { day },
    );

    await page.getByTestId(PORTAL_TEST_IDS.reviewDeclarationCheckbox).check();
    emit("Preparing final submission — pausing for human approval", "click", {
      targetTestId: PORTAL_TEST_IDS.reviewSubmit,
    });
    await page.getByTestId(PORTAL_TEST_IDS.reviewSubmit).click();
    await page.waitForSelector(`[data-testid="${PORTAL_TEST_IDS.confirmSubmit}"]`);

    return {
      diff: [
        {
          field: "declaredValue",
          label: "Declared value",
          before: `${beforeVal} ${currency}`,
          after: `${correctedValue.toFixed(2)} ${currency}`,
        },
      ],
      screenshotPath: shot2,
      stoppedAtConfirm: true,
    };
  } finally {
    await page.close();
  }
}

/** Complete submission after operator approval. */
export async function runScriptedPortalSubmit(
  hub: EventHub,
  params: PortalAmendParams,
): Promise<void> {
  const { caseId, declarationId, declarationRef, correctedValue, day } = params;
  const page = await newPortalPage();
  try {
    await page.goto(`${webBase()}/portal/login`);
    await page.getByTestId(PORTAL_TEST_IDS.loginUsername).fill(PORTAL_CREDENTIALS.username);
    await page.getByTestId(PORTAL_TEST_IDS.loginPassword).fill(PORTAL_CREDENTIALS.password);
    await page.getByTestId(PORTAL_TEST_IDS.loginSubmit).click();
    await page.waitForURL("**/portal/cases");
    await page.getByTestId(`open-case-${declarationRef}`).click();
    await page.waitForURL(`**/portal/cases/${declarationId}**`);
    await page.getByTestId(PORTAL_TEST_IDS.amendButton).click();
    await page.waitForURL("**/amend");
    await page.getByTestId(PORTAL_TEST_IDS.amendDeclaredValue).fill(String(correctedValue));
    await page.getByTestId(PORTAL_TEST_IDS.amendContinue).click();
    await page.waitForURL("**/amend/review");
    await page.getByTestId(PORTAL_TEST_IDS.reviewDeclarationCheckbox).check();
    await page.getByTestId(PORTAL_TEST_IDS.reviewSubmit).click();
    await page.waitForSelector(`[data-testid="${PORTAL_TEST_IDS.confirmSubmit}"]`);
    hub.emit(
      {
        type: "browser.action",
        caseId,
        action: "click",
        description: "Submitting amendment with operator approval",
        targetTestId: PORTAL_TEST_IDS.confirmSubmit,
      },
      { day },
    );
    await page.getByTestId(PORTAL_TEST_IDS.confirmSubmit).click();
    await page.waitForURL(`**/portal/cases/${declarationId}?submitted=**`);
    const shot = await screenshotPage(page, caseId);
    hub.emit(
      {
        type: "browser.screenshot",
        caseId,
        ref: { kind: "path", path: shot },
        caption: "Amendment submitted to FCBA",
      },
      { day },
    );
  } finally {
    await page.close();
  }
}
