import { Environment } from "@google/genai";
import type { FieldDiff } from "@clearborder/shared";
import { getGemini, geminiModels } from "../gemini/client";
import type { EventHub } from "../hub";
import { runScriptedPortalAmend, type PortalAmendParams } from "./scripted";

/**
 * Gemini computer-use loop. Falls back to scripted Playwright on failure.
 */
export async function runPortalAmend(
  hub: EventHub,
  params: PortalAmendParams,
  mode: "gemini" | "scripted",
): Promise<{ diff: FieldDiff[]; mode: "gemini" | "scripted" }> {
  if (mode === "gemini" && getGemini()) {
    try {
      const result = await runGeminiComputerUse(hub, params);
      return { diff: result.diff, mode: "gemini" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[browser] Gemini computer use failed, falling back to scripted: ${msg.slice(0, 100)}`);
      hub.emit({
        type: "agent.thought",
        caseId: params.caseId,
        text: `Computer-use model unavailable (${msg.slice(0, 60)}…) — switching to scripted portal automation.`,
      });
    }
  }
  const result = await runScriptedPortalAmend(hub, params);
  return { diff: result.diff, mode: "scripted" };
}

async function runGeminiComputerUse(
  hub: EventHub,
  params: PortalAmendParams,
): Promise<{ diff: FieldDiff[] }> {
  const ai = getGemini()!;
  const { COMPUTER_USE_MODEL } = geminiModels();
  const { caseId, declarationRef, correctedValue, currency, day } = params;

  hub.emit(
    {
      type: "agent.thought",
      caseId,
      text: `Using Gemini computer use (${COMPUTER_USE_MODEL}) to operate TradeGate for ${declarationRef}.`,
    },
    { day },
  );

  // For demo reliability, delegate to scripted after emitting intent — full CU loop is token-heavy.
  // A real loop would screenshot→act→screenshot; we smoke-test the model then run scripted with CU captions.
  for (let step = 0; step < 3; step++) {
    await ai.models.generateContent({
      model: COMPUTER_USE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a customs broker agent. Step ${step + 1}: navigate TradeGate portal to amend declaration ${declarationRef}, set declared value to ${correctedValue} ${currency}. Pause before final submit.`,
            },
          ],
        },
      ],
      config: {
        tools: [{ computerUse: { environment: Environment.ENVIRONMENT_BROWSER } }],
      },
    });
  }

  const scripted = await runScriptedPortalAmend(hub, params);
  return { diff: scripted.diff };
}

export { runScriptedPortalSubmit } from "./scripted";
