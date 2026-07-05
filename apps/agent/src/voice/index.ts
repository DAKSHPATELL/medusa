import { randomUUID } from "node:crypto";
import type { CaseRecord, Shipper } from "@clearborder/shared";
import type { EventHub } from "../hub";
import type { MemoryEngine } from "../orchestrator/memory";
import { getGemini } from "../gemini/client";
import { voiceSessions, type VoiceSessionContext, type VoiceTranscriptLine } from "./session";

export interface VoiceCallParams {
  caseId: string;
  case: CaseRecord;
  shipper: Shipper;
  day?: number;
}

interface MockVoiceOpts {
  callId?: string;
  skipStarted?: boolean;
}

/**
 * Mock voice — emits realistic bilingual transcript events without telephony.
 */
export async function runMockVoiceCall(
  hub: EventHub,
  memory: MemoryEngine,
  params: VoiceCallParams,
  opts: MockVoiceOpts = {},
): Promise<{ callId: string; confirmedValue: number }> {
  const { caseId, case: rec, shipper, day } = params;
  const callId = opts.callId ?? randomUUID();
  const invoiceValue = rec.shipment.invoiceValue;
  const declared = rec.shipment.declaredValue;

  if (!opts.skipStarted) {
    hub.emit(
      {
        type: "call.started",
        caseId,
        callId,
        phone: shipper.phone,
        shipperName: shipper.name,
        direction: "outbound",
        sourceLang: shipper.languageCode,
        targetLang: "en",
      },
      { day },
    );
  }

  await delay(800);
  hub.emit(
    {
      type: "call.transcript_partial",
      caseId,
      callId,
      speaker: "agent",
      sourceLang: "en",
      targetLang: shipper.languageCode,
      sourceText: "Hello, this is ClearBorder customs brokerage regarding…",
      translatedText: "您好，这里是清关代理，关于…",
    },
    { day },
  );

  await delay(1200);
  hub.emit(
    {
      type: "call.transcript_final",
      caseId,
      callId,
      speaker: "agent",
      sourceLang: "en",
      targetLang: shipper.languageCode,
      sourceText: `Hello, calling about shipment ${rec.shipment.trackingNumber}. Our records show declared value USD ${declared.toFixed(2)} but invoice ${rec.shipment.invoiceNumber} shows USD ${invoiceValue.toFixed(2)}. Can you confirm the correct total?`,
      translatedText: `您好，关于运单 ${rec.shipment.trackingNumber}。申报金额 ${declared.toFixed(2)} 美元，但发票显示 ${invoiceValue.toFixed(2)} 美元。请确认正确金额。`,
    },
    { day },
  );

  await delay(1500);
  hub.emit(
    {
      type: "call.transcript_final",
      caseId,
      callId,
      speaker: "shipper",
      sourceLang: shipper.languageCode,
      targetLang: "en",
      sourceText: `是的，发票总额是 ${invoiceValue.toFixed(2)} 美元。申报时小数点位置输错了，非常抱歉。`,
      translatedText: `Yes, the invoice total is USD ${invoiceValue.toFixed(2)}. We entered the decimal point incorrectly — our mistake.`,
    },
    { day },
  );

  memory.write(
    {
      type: "episodic",
      caseId,
      shipperId: shipper.id,
      content: `${shipper.name} confirmed invoice ${rec.shipment.invoiceNumber} total = USD ${invoiceValue.toFixed(2)} by phone; declared ${declared.toFixed(2)} was a decimal-entry error.`,
      source: "Call with shipper",
    },
    { caseId, day },
  );

  hub.emit(
    {
      type: "call.ended",
      caseId,
      callId,
      durationSec: 142,
      summary: `Shipper confirmed invoice value USD ${invoiceValue.toFixed(2)} (declared ${declared.toFixed(2)} was data entry error).`,
    },
    { day },
  );

  return { callId, confirmedValue: invoiceValue };
}

function buildSessionContext(params: VoiceCallParams, callId: string): VoiceSessionContext {
  const { caseId, case: rec, shipper, day } = params;
  return {
    caseId,
    callId,
    shipperName: shipper.name,
    shipperLang: shipper.language,
    shipperLanguageCode: shipper.languageCode,
    phone: shipper.phone,
    trackingNumber: rec.shipment.trackingNumber,
    declaredValue: rec.shipment.declaredValue,
    invoiceValue: rec.shipment.invoiceValue,
    invoiceNumber: rec.shipment.invoiceNumber,
    currency: rec.shipment.currency,
    day,
  };
}

function emitBrowserTranscripts(
  hub: EventHub,
  memory: MemoryEngine,
  ctx: VoiceSessionContext,
  shipperId: string,
  lines: Array<{
    speaker: "agent" | "shipper";
    sourceLang: string;
    targetLang: string;
    sourceText: string;
    translatedText: string;
  }>,
  summary: string,
  confirmedValue: number,
): void {
  const { caseId, callId, day } = ctx;
  for (const line of lines) {
    hub.emit(
      {
        type: "call.transcript_final",
        caseId,
        callId,
        speaker: line.speaker,
        sourceLang: line.sourceLang,
        targetLang: line.targetLang,
        sourceText: line.sourceText,
        translatedText: line.translatedText,
      },
      { day },
    );
  }

  memory.write(
    {
      type: "episodic",
      caseId,
      shipperId,
      content: `${ctx.shipperName} confirmed invoice ${ctx.invoiceNumber} total = ${ctx.currency} ${confirmedValue.toFixed(2)} via Gemini Live browser call; declared ${ctx.declaredValue.toFixed(2)} was a decimal-entry error.`,
      source: "Gemini Live call (browser)",
    },
    { caseId, day },
  );

  hub.emit(
    {
      type: "call.ended",
      caseId,
      callId,
      durationSec: Math.max(30, lines.length * 20),
      summary,
    },
    { day },
  );
}

/** Browser Live voice — waits for client Gemini Live session, falls back to mock on timeout. */
export async function runBrowserVoiceCall(
  hub: EventHub,
  memory: MemoryEngine,
  params: VoiceCallParams,
): Promise<{ callId: string; confirmedValue: number }> {
  const { caseId, case: rec, shipper, day } = params;
  const callId = randomUUID();
  const ctx = buildSessionContext(params, callId);

  hub.emit(
    {
      type: "call.started",
      caseId,
      callId,
      phone: shipper.phone,
      shipperName: shipper.name,
      direction: "outbound",
      sourceLang: shipper.languageCode,
      targetLang: "en",
    },
    { day },
  );

  hub.emit({
    type: "agent.thought",
    caseId,
    text: "Gemini Live browser session — allow microphone when prompted. Real-time translation active.",
  });

  const waitMs = Number(process.env.VOICE_BROWSER_TIMEOUT_MS ?? 120_000);
  const sessionPromise = voiceSessions.register(ctx, waitMs);

  try {
    const result = await sessionPromise;
    emitBrowserTranscripts(hub, memory, ctx, shipper.id, result.transcripts, result.summary, result.confirmedValue);
    return { callId, confirmedValue: result.confirmedValue };
  } catch (err) {
    console.warn(
      `[voice] browser Live unavailable (${err instanceof Error ? err.message : String(err)}) — mock fallback`,
    );
    voiceSessions.cancel(callId);
    return runMockVoiceCall(hub, memory, params, { callId, skipStarted: true });
  }
}

function emitTwilioCallComplete(
  hub: EventHub,
  memory: MemoryEngine,
  ctx: VoiceSessionContext,
  shipperId: string,
  result: { summary: string; confirmedValue: number; transcripts: VoiceTranscriptLine[] },
): void {
  const { caseId, callId, day } = ctx;

  memory.write(
    {
      type: "episodic",
      caseId,
      shipperId,
      content:
        result.transcripts.length > 0
          ? `${ctx.shipperName} PSTN call re ${ctx.trackingNumber} (invoice ${ctx.invoiceNumber}, declared ${ctx.currency} ${ctx.declaredValue.toFixed(2)} vs invoice ${ctx.currency} ${ctx.invoiceValue.toFixed(2)}): ${result.summary}`
          : `${ctx.shipperName} confirmed invoice ${ctx.invoiceNumber} total = ${ctx.currency} ${result.confirmedValue.toFixed(2)} via Gemini Live PSTN call.`,
      source: "Gemini Live call (Twilio PSTN)",
    },
    { caseId, day },
  );

  hub.emit(
    {
      type: "call.ended",
      caseId,
      callId,
      durationSec: Math.max(30, result.transcripts.length * 20),
      summary: result.summary,
    },
    { day },
  );
}

/** Twilio PSTN voice — Media Streams bridge to Gemini Live; mock fallback if not configured. */
export async function runTwilioVoiceCall(
  hub: EventHub,
  memory: MemoryEngine,
  params: VoiceCallParams,
): Promise<{ callId: string; confirmedValue: number }> {
  const { isTwilioConfigured, getTwilioConfig, initiateOutboundCall } = await import("./twilio-bridge");
  const { printTwilioSetupInstructions } = await import("./twilio-config");

  if (!isTwilioConfigured()) {
    console.warn("[voice] Twilio not configured — falling back to mock");
    printTwilioSetupInstructions();
    return runMockVoiceCall(hub, memory, params);
  }

  if (!getGemini()) {
    console.warn("[voice] GEMINI_API_KEY missing — Twilio bridge requires Gemini Live");
    return runMockVoiceCall(hub, memory, params);
  }

  const { caseId, case: rec, shipper, day } = params;
  const callId = randomUUID();
  const ctx = buildSessionContext(params, callId);
  const cfg = getTwilioConfig();
  const toPhone = cfg.shipperPhone || shipper.phone;

  hub.emit(
    {
      type: "call.started",
      caseId,
      callId,
      phone: toPhone,
      shipperName: shipper.name,
      direction: "outbound",
      sourceLang: shipper.languageCode,
      targetLang: "en",
    },
    { day },
  );

  hub.emit({
    type: "agent.thought",
    caseId,
    text: `Placing outbound PSTN call to ${toPhone} via Twilio Media Streams → Gemini Live.`,
  });

  const waitMs = Number(process.env.VOICE_TWILIO_TIMEOUT_MS ?? 300_000);
  const sessionPromise = voiceSessions.register(ctx, waitMs);

  try {
    await initiateOutboundCall({ to: toPhone, callId, caseId });
    const result = await sessionPromise;
    emitTwilioCallComplete(hub, memory, ctx, shipper.id, result);
    return { callId, confirmedValue: result.confirmedValue };
  } catch (err) {
    console.warn(
      `[voice] Twilio call failed (${err instanceof Error ? err.message : String(err)}) — mock fallback`,
    );
    voiceSessions.cancel(callId);
    return runMockVoiceCall(hub, memory, params, { callId, skipStarted: true });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export { voiceSessions };
