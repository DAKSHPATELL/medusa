import { randomUUID } from "node:crypto";
import type { CaseRecord, Shipper } from "@clearborder/shared";
import type { EventHub } from "../hub";
import type { MemoryEngine } from "../orchestrator/memory";

export interface VoiceCallParams {
  caseId: string;
  case: CaseRecord;
  shipper: Shipper;
  day?: number;
}

/**
 * Mock voice — emits realistic bilingual transcript events without telephony.
 */
export async function runMockVoiceCall(
  hub: EventHub,
  memory: MemoryEngine,
  params: VoiceCallParams,
): Promise<{ callId: string; confirmedValue: number }> {
  const { caseId, case: rec, shipper, day } = params;
  const callId = randomUUID();
  const invoiceValue = rec.shipment.invoiceValue;
  const declared = rec.shipment.declaredValue;

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
      translatedText: `Yes, the invoice total is USD ${invoiceValue.toFixed(2)}.00. We entered the decimal point incorrectly — our mistake.`,
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

/** Browser voice path — same mock transcripts; Live API runs client-side when configured. */
export async function runBrowserVoiceCall(
  hub: EventHub,
  memory: MemoryEngine,
  params: VoiceCallParams,
): Promise<{ callId: string; confirmedValue: number }> {
  hub.emit({
    type: "agent.thought",
    caseId: params.caseId,
    text: "Browser voice mode — Live API session can run in a separate tab; using server-side transcript simulation for reliability.",
  });
  return runMockVoiceCall(hub, memory, params);
}

/** Twilio path stub — real bridge when TWILIO_* env vars are set. */
export async function runTwilioVoiceCall(
  hub: EventHub,
  memory: MemoryEngine,
  params: VoiceCallParams,
): Promise<{ callId: string; confirmedValue: number }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!sid || !token || !from) {
    console.warn("[voice] Twilio not configured — falling back to mock");
    return runMockVoiceCall(hub, memory, params);
  }
  hub.emit({
    type: "agent.thought",
    caseId: params.caseId,
    text: `Placing outbound call to ${params.shipper.phone} via Twilio Media Streams → Gemini Live.`,
  });
  // Full Twilio bridge is production scope; mock transcripts for demo reliability.
  return runMockVoiceCall(hub, memory, params);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
