import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import type { Tool } from "@google/genai";
import type { EventHub } from "../hub";
import type { MemoryEngine } from "../orchestrator/memory";
import { createLiveEphemeralToken, geminiModels } from "../gemini/client";
import { loadCaseContext } from "../intake";
import {
  VoiceAgentTools,
  VOICE_AGENT_TOOL_DECLARATIONS,
  BASE_VOICE_AGENT_INSTRUCTION,
  createVoiceAgentState,
  type VoiceAgentState,
} from "../voice/agent-tools";
import { HERO_CASE_ID } from "../seed";

/**
 * Dev-only harness for manually talking to the Gemini Live voice agent in a
 * browser tab and exercising its tools (esp. get_case_history) end to end,
 * without needing Twilio or going through the orchestrator's call-scheduling
 * flow. Fully isolated from voice/session.ts, twilio-bridge.ts, and
 * LiveVoiceBridge.tsx — nothing here is shared state with those.
 *
 * Models the real two-conversation shape: the SENDER call already happened
 * (read-only bilingual transcript, no audio) and the person live on this
 * harness is the BROKER calling in afterwards for clarification in English.
 */

interface SenderCallLine {
  speaker: "agent" | "shipper";
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
}

function buildBrokerSystemInstruction(ctx: {
  caseId: string;
  shipperName: string;
  trackingNumber: string;
  currency: string;
  declaredValue: number;
  invoiceValue: number;
  invoiceNumber: string;
}): string {
  return [
    BASE_VOICE_AGENT_INSTRUCTION,
    `This is a call with the BROKER who oversees case ${ctx.caseId} — not the shipper. ` +
      "The shipper call already happened separately; you are not placing that call now.",
    `Case: shipper ${ctx.shipperName}, tracking ${ctx.trackingNumber}. Declared ${ctx.currency} ${ctx.declaredValue.toFixed(2)} ` +
      `vs invoice ${ctx.invoiceNumber} ${ctx.currency} ${ctx.invoiceValue.toFixed(2)}.`,
    "Open by greeting the broker and briefly summarizing the hold and what you've resolved so far, then invite their questions.",
    "The broker may question past actions — yours or customs' (e.g. 'why did you change the currency'). " +
      "Always call get_case_history and answer from the real logged record; never guess.",
    "Always speak English with the broker, regardless of what language you used on the earlier shipper call.",
  ].join(" ");
}

/** Read-only reconstruction of the sender call for the broker to review before going live — no DB writes, no audio. */
function buildSenderCallTranscript(rec: {
  shipment: {
    trackingNumber: string;
    declaredValue: number;
    invoiceValue: number;
    invoiceNumber: string;
    currency: string;
  };
}, shipper: { name: string; language: string; language_code: string }): SenderCallLine[] {
  const { trackingNumber, declaredValue, invoiceValue, invoiceNumber, currency } = rec.shipment;
  const declared = declaredValue.toFixed(2);
  const invoice = invoiceValue.toFixed(2);
  return [
    {
      speaker: "agent",
      sourceLang: "en",
      targetLang: shipper.language_code,
      sourceText: `Hello, calling about shipment ${trackingNumber}. Our records show declared value ${currency} ${declared} but invoice ${invoiceNumber} shows ${currency} ${invoice}. Can you confirm the correct total?`,
      translatedText: `您好，关于运单 ${trackingNumber}。申报金额 ${declared} ${currency}，但发票显示 ${invoice} ${currency}。请确认正确金额。`,
    },
    {
      speaker: "shipper",
      sourceLang: shipper.language_code,
      targetLang: "en",
      sourceText: `是的，发票总额是 ${invoice} ${currency}。申报时小数点位置输错了，非常抱歉。`,
      translatedText: `Yes, the invoice total is ${currency} ${invoice}. We entered the decimal point incorrectly — our mistake.`,
    },
    {
      speaker: "agent",
      sourceLang: "en",
      targetLang: shipper.language_code,
      sourceText: `Understood — that's the mismatch customs flagged. I'll correct the declared value to ${currency} ${invoice} and submit the amendment now.`,
      translatedText: `明白了，问题就在这里。我现在把申报金额改为 ${invoice} ${currency}，并提交更正。`,
    },
  ];
}

export function registerVoiceTestRoutes(
  app: FastifyInstance,
  deps: { db: Database.Database; hub: EventHub; memory: MemoryEngine },
): void {
  const { db, hub, memory } = deps;
  const sessions = new Map<string, VoiceAgentState>();

  app.get<{ Querystring: { caseId?: string } }>(
    "/api/dev/voice-test/sender-call",
    async (request, reply) => {
      const caseId = request.query.caseId?.trim() || HERO_CASE_ID;
      const ctx = loadCaseContext(db, caseId);
      if (!ctx || !ctx.shipper) {
        return reply.status(404).send({ error: `No case+shipper found for "${caseId}"` });
      }
      return {
        caseId: ctx.case.id,
        shipperName: ctx.shipper.name,
        shipperLanguageCode: ctx.shipper.language_code,
        lines: buildSenderCallTranscript(ctx.case, ctx.shipper),
      };
    },
  );

  app.post<{ Body: { caseId?: string } }>("/api/dev/voice-test/start", async (request, reply) => {
    const caseId = request.body?.caseId?.trim() || HERO_CASE_ID;
    const ctx = loadCaseContext(db, caseId);
    if (!ctx || !ctx.shipper) {
      return reply.status(404).send({ error: `No case+shipper found for "${caseId}"` });
    }

    const outboundCtx = {
      shipperName: ctx.shipper.name,
      shipperLang: ctx.shipper.language,
      shipperLanguageCode: ctx.shipper.language_code,
      phone: ctx.shipper.phone,
      trackingNumber: ctx.case.shipment.trackingNumber,
      declaredValue: ctx.case.shipment.declaredValue,
      invoiceValue: ctx.case.shipment.invoiceValue,
      invoiceNumber: ctx.case.shipment.invoiceNumber,
      currency: ctx.case.shipment.currency,
    };

    // Broker-facing call, not the shipper-outbound framing the Twilio path
    // uses — the broker reviews the (already-happened) sender call as text,
    // then asks the agent to account for itself live, in English.
    const systemInstruction = buildBrokerSystemInstruction({ ...outboundCtx, caseId });
    const tools = VOICE_AGENT_TOOL_DECLARATIONS as unknown as Tool[];
    const token = await createLiveEphemeralToken(systemInstruction, tools);
    if (!token) {
      return reply
        .status(503)
        .send({ error: "Gemini Live token unavailable — check GEMINI_API_KEY and billing" });
    }

    const callId = randomUUID();
    const state = createVoiceAgentState();
    state.caseId = caseId;
    state.currency = outboundCtx.currency;
    state.shipperName = outboundCtx.shipperName;
    state.shipperLanguageCode = outboundCtx.shipperLanguageCode;
    sessions.set(callId, state);

    hub.emit({
      type: "agent.thought",
      caseId,
      text: `[dev voice test] session ${callId} started for ${outboundCtx.shipperName}.`,
    });

    const { LIVE_MODEL } = geminiModels();
    return {
      callId,
      token,
      model: LIVE_MODEL,
      tools,
      context: { ...outboundCtx, caseId },
    };
  });

  app.post<{
    Params: { callId: string };
    Body: { name: string; args?: Record<string, unknown> };
  }>("/api/dev/voice-test/:callId/tool-call", async (request, reply) => {
    const { callId } = request.params;
    const state = sessions.get(callId);
    if (!state) return reply.status(404).send({ error: "No dev voice-test session for this callId" });

    const { name, args } = request.body ?? { name: "" };
    if (!name) return reply.status(400).send({ error: "name required" });

    const tools = new VoiceAgentTools(db, hub, memory, { callId });
    const { response, state: nextState } = tools.executeToolCall(name, args ?? {}, state);
    sessions.set(callId, nextState);
    return response;
  });

  app.post<{ Params: { callId: string } }>("/api/dev/voice-test/:callId/end", async (request) => {
    sessions.delete(request.params.callId);
    return { ok: true };
  });
}
