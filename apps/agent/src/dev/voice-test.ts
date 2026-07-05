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
  buildOutboundSystemInstruction,
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
 */
export function registerVoiceTestRoutes(
  app: FastifyInstance,
  deps: { db: Database.Database; hub: EventHub; memory: MemoryEngine },
): void {
  const { db, hub, memory } = deps;
  const sessions = new Map<string, VoiceAgentState>();

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

    const systemInstruction = buildOutboundSystemInstruction(outboundCtx);
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
