import * as alawmulaw from "alawmulaw";
import { Modality } from "@google/genai";
import type { WebSocket } from "ws";
import type { EventHub } from "../hub";
import { getGemini, geminiModels } from "../gemini/client";
import {
  buildStreamWssUrl,
  getTwilioConfig,
  isTwilioConfigured,
  type TwilioConfig,
} from "./twilio-config";
import { voiceSessions, type VoiceSessionContext, type VoiceCompletePayload } from "./session";

/** Linear resampler with carry-over state to avoid boundary clicks between frames. */
class LinearResampler {
  private readonly step: number;
  private prevSample = 0;
  private frac = 0;

  constructor(inputRate: number, outputRate: number) {
    this.step = inputRate / outputRate;
  }

  process(input: Int16Array): Int16Array {
    if (input.length === 0) return new Int16Array(0);
    const out: number[] = [];
    let idx = 0;
    let prev = this.prevSample;

    while (idx < input.length) {
      const next = input[idx]!;
      while (this.frac < 1) {
        out.push(Math.round(prev + this.frac * (next - prev)));
        this.frac += this.step;
      }
      this.frac -= 1;
      prev = next;
      idx++;
    }

    this.prevSample = input[input.length - 1]!;
    return Int16Array.from(out);
  }
}

const INBOUND_SYSTEM_INSTRUCTION = [
  "You are ClearBorder, a licensed customs brokerage AI agent on a live inbound phone call.",
  "The caller is a shipper, importer, or freight broker with a parcel held at customs.",
  "Your job: resolve valuation holds and declaration mismatches so the shipment can clear.",
  "Start by asking for the waybill or tracking number, then the invoice number if needed.",
  "Clarify whether the declared customs value matches the commercial invoice total; ask what the correct amount is.",
  "If the shipper explains a data-entry error (e.g. decimal point), confirm the corrected value before ending.",
  "Speak in a calm, professional broker tone — concise sentences suited to phone conversation.",
  "Support English, Mandarin Chinese (中文), and Turkish (Türkçe): match the caller's language or offer brief translation.",
].join(" ");

type GeminiLiveSession = {
  close: () => void;
  sendRealtimeInput: (input: { audio: { data: string; mimeType: string } }) => void;
  sendClientContent: (content: {
    turns: Array<{ role: string; parts: Array<{ text: string }> }>;
    turnComplete: boolean;
  }) => void;
};

interface TwilioStartPayload {
  streamSid: string;
  callSid: string;
  customParameters?: Record<string, string>;
}

interface TranscriptLine {
  speaker: "agent" | "shipper";
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
}

/** Manages one Twilio Media Stream ↔ Gemini Live session. */
export class TwilioGeminiBridge {
  private streamSid: string | null = null;
  private callSid: string | null = null;
  private callId: string | null = null;
  private ctx: VoiceSessionContext | undefined;
  private geminiSession: GeminiLiveSession | null = null;
  private geminiReady = false;
  private closed = false;
  private startedAt = Date.now();
  private transcripts: TranscriptLine[] = [];
  private agentPartial = "";
  private shipperPartial = "";
  private upResampler = new LinearResampler(8000, 16000);
  private downResampler = new LinearResampler(24000, 8000);
  private outboundMulaw: number[] = [];
  private readonly model: string;

  constructor(
    private ws: WebSocket,
    private hub: EventHub,
  ) {
    this.model = geminiModels().LIVE_MODEL;
  }

  handleMessage(raw: string | Buffer): void {
    let msg: {
      event?: string;
      start?: TwilioStartPayload;
      media?: { payload?: string; track?: string };
      streamSid?: string;
    };
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
    } catch {
      console.warn("[twilio] invalid JSON frame");
      return;
    }

    switch (msg.event) {
      case "connected":
        break;
      case "start":
        if (msg.start) void this.onStart(msg.start);
        break;
      case "media":
        if (msg.media?.payload && msg.media.track !== "outbound") {
          this.onInboundMedia(msg.media.payload);
        }
        break;
      case "stop":
        void this.onStop();
        break;
      default:
        break;
    }
  }

  cleanup(): void {
    void this.onStop();
  }

  private async onStart(start: TwilioStartPayload): Promise<void> {
    this.streamSid = start.streamSid;
    this.callSid = start.callSid;
    this.callId = start.customParameters?.callId ?? start.callSid;
    this.ctx = voiceSessions.getContext(this.callId);

    if (this.ctx) {
      this.hub.emit(
        {
          type: "agent.thought",
          caseId: this.ctx.caseId,
          text: "Gemini Live connected — customs clarification call active.",
        },
        { day: this.ctx.day },
      );
    } else {
      console.log(`[twilio] inbound call ${start.callSid} (no orchestrator session)`);
    }

    const ai = getGemini();
    if (!ai) {
      console.error("[twilio] GEMINI_API_KEY missing — cannot bridge call");
      this.ws.close();
      return;
    }

    const systemInstruction = this.ctx
      ? this.buildOutboundSystemInstruction(this.ctx)
      : INBOUND_SYSTEM_INSTRUCTION;

    const ctx = this.ctx;

    try {
      this.geminiSession = (await ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            this.geminiReady = true;
            if (ctx) {
              this.geminiSession?.sendClientContent({
                turns: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `Begin the customs call. Ask ${ctx.shipperName} to confirm invoice ${ctx.invoiceNumber} total ${ctx.currency} ${ctx.invoiceValue.toFixed(2)} versus declared ${ctx.declaredValue.toFixed(2)}.`,
                      },
                    ],
                  },
                ],
                turnComplete: true,
              });
            } else {
              this.geminiSession?.sendClientContent({
                turns: [
                  {
                    role: "user",
                    parts: [{ text: "Greet the caller and ask how you can help with their customs declaration." }],
                  },
                ],
                turnComplete: true,
              });
            }
          },
          onmessage: (message) => this.onGeminiMessage(message),
          onerror: (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[twilio] Gemini Live error: ${msg.slice(0, 120)}`);
          },
          onclose: () => {
            this.geminiSession = null;
            this.geminiReady = false;
          },
        },
      })) as GeminiLiveSession;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[twilio] Gemini Live connect failed: ${msg.slice(0, 160)}`);
      this.ws.close();
    }
  }

  private onInboundMedia(base64Mulaw: string): void {
    if (!this.geminiReady || !this.geminiSession) return;
    const mulawBytes = Buffer.from(base64Mulaw, "base64");
    const pcm8k = alawmulaw.mulaw.decode(mulawBytes);
    const pcm16k = this.upResampler.process(pcm8k);
    if (pcm16k.length === 0) return;

    const bytes = Buffer.from(pcm16k.buffer, pcm16k.byteOffset, pcm16k.byteLength);
    this.geminiSession.sendRealtimeInput({
      audio: { data: bytes.toString("base64"), mimeType: "audio/pcm;rate=16000" },
    });
  }

  private onGeminiMessage(message: {
    serverContent?: {
      interrupted?: boolean;
      inputTranscription?: { text?: string };
      outputTranscription?: { text?: string };
      modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
      turnComplete?: boolean;
    };
  }): void {
    const sc = message.serverContent;
    if (!sc) return;

    if (sc.interrupted && this.streamSid) {
      this.outboundMulaw = [];
      this.ws.send(JSON.stringify({ event: "clear", streamSid: this.streamSid }));
    }

    if (sc.inputTranscription?.text) {
      this.shipperPartial += sc.inputTranscription.text;
      this.emitTranscript(true, "shipper", this.shipperPartial);
    }
    if (sc.outputTranscription?.text) {
      this.agentPartial += sc.outputTranscription.text;
      this.emitTranscript(true, "agent", this.agentPartial);
    }

    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      const mime = part.inlineData?.mimeType ?? "";
      if (data && mime.includes("audio")) {
        this.enqueueGeminiAudio(data);
      }
    }

    if (sc.turnComplete) {
      if (this.agentPartial.trim()) {
        this.finalizeTranscript("agent", this.agentPartial.trim());
        this.agentPartial = "";
      }
      if (this.shipperPartial.trim()) {
        this.finalizeTranscript("shipper", this.shipperPartial.trim());
        this.shipperPartial = "";
      }
    }
  }

  private enqueueGeminiAudio(base64Pcm: string): void {
    if (!this.streamSid) return;
    const buf = Buffer.from(base64Pcm, "base64");
    const pcm24k = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
    const pcm8k = this.downResampler.process(pcm24k);
    if (pcm8k.length === 0) return;
    const encoded = alawmulaw.mulaw.encode(pcm8k);
    for (let i = 0; i < encoded.length; i++) this.outboundMulaw.push(encoded[i]!);
    this.flushOutboundAudio();
  }

  /** Twilio expects ~20 ms μ-law frames (160 bytes at 8 kHz). */
  private flushOutboundAudio(): void {
    if (!this.streamSid) return;
    const frameSize = 160;
    while (this.outboundMulaw.length >= frameSize) {
      const frame = this.outboundMulaw.splice(0, frameSize);
      const payload = Buffer.from(frame).toString("base64");
      this.ws.send(
        JSON.stringify({
          event: "media",
          streamSid: this.streamSid,
          media: { payload },
        }),
      );
    }
  }

  private emitTranscript(partial: boolean, speaker: "agent" | "shipper", text: string): void {
    if (!this.ctx || !this.callId) return;
    const sourceLang = speaker === "agent" ? "en" : this.ctx.shipperLanguageCode;
    const targetLang = speaker === "agent" ? this.ctx.shipperLanguageCode : "en";
    this.hub.emit(
      {
        type: partial ? "call.transcript_partial" : "call.transcript_final",
        caseId: this.ctx.caseId,
        callId: this.callId,
        speaker,
        sourceLang,
        targetLang,
        sourceText: text,
        translatedText: text,
      },
      { day: this.ctx.day },
    );
  }

  private finalizeTranscript(speaker: "agent" | "shipper", text: string): void {
    const sourceLang = speaker === "agent" ? "en" : this.ctx?.shipperLanguageCode ?? "zh-CN";
    const targetLang = speaker === "agent" ? this.ctx?.shipperLanguageCode ?? "zh-CN" : "en";
    const line: TranscriptLine = {
      speaker,
      sourceLang,
      targetLang,
      sourceText: text,
      translatedText: text,
    };
    this.transcripts.push(line);
    if (this.ctx && this.callId) {
      this.hub.emit(
        {
          type: "call.transcript_final",
          caseId: this.ctx.caseId,
          callId: this.callId,
          speaker,
          sourceLang,
          targetLang,
          sourceText: text,
          translatedText: text,
        },
        { day: this.ctx.day },
      );
    }
  }

  private buildOutboundSystemInstruction(ctx: VoiceSessionContext): string {
    const gap = Math.abs(ctx.invoiceValue - ctx.declaredValue);
    return [
      "You are ClearBorder, a licensed customs brokerage AI agent on an outbound phone call.",
      `Case context — shipper: ${ctx.shipperName} (${ctx.shipperLang}, ${ctx.shipperLanguageCode}), phone ${ctx.phone}.`,
      `Waybill/tracking: ${ctx.trackingNumber}. Invoice ${ctx.invoiceNumber}.`,
      `Customs declared value: ${ctx.currency} ${ctx.declaredValue.toFixed(2)}. Commercial invoice total: ${ctx.currency} ${ctx.invoiceValue.toFixed(2)} (gap ${ctx.currency} ${gap.toFixed(2)}).`,
      "The shipment is on a customs valuation hold until the declared value matches the invoice.",
      "Ask the shipper to confirm the correct invoice total and whether the declared amount was a data-entry error.",
      "Record their answer clearly; if they confirm the invoice total, acknowledge before ending.",
      "Speak in a calm, professional broker tone — concise sentences for phone conversation.",
      "Support English, Mandarin Chinese (中文), and Turkish (Türkçe): prefer the shipper's language with brief translation as needed.",
    ].join(" ");
  }

  private async onStop(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    try {
      this.geminiSession?.close();
    } catch {
      /* ignore */
    }
    this.geminiSession = null;

    const durationSec = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
    const confirmedValue = this.ctx?.invoiceValue ?? 0;
    const transcriptSummary = this.transcripts
      .map((t) => `${t.speaker}: ${t.sourceText}`)
      .join(" · ")
      .slice(0, 400);
    const summary =
      this.transcripts.length > 0
        ? `Customs call (${durationSec}s, ${this.transcripts.length} turns)${this.ctx ? ` re ${this.ctx.trackingNumber}` : ""}. ${transcriptSummary}`
        : `Phone call ended (${durationSec}s).`;

    if (this.ctx && this.callId) {
      const payload: VoiceCompletePayload = {
        summary,
        confirmedValue,
        transcripts: this.transcripts,
      };
      voiceSessions.complete(this.callId, payload);
    }

    console.log(`[twilio] stream ended callSid=${this.callSid ?? "?"} duration=${durationSec}s`);
  }
}

export function buildVoiceTwiml(opts: { callId?: string; caseId?: string } = {}): string {
  const cfg = getTwilioConfig();
  if (!cfg.publicAgentUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>ClearBorder agent is not configured. Set PUBLIC_AGENT_URL.</Say></Response>`;
  }
  const wssUrl = buildStreamWssUrl(cfg.publicAgentUrl);
  const params: string[] = [];
  if (opts.callId) params.push(`<Parameter name="callId" value="${escapeXml(opts.callId)}" />`);
  if (opts.caseId) params.push(`<Parameter name="caseId" value="${escapeXml(opts.caseId)}" />`);
  const paramBlock = params.length ? `\n      ${params.join("\n      ")}\n    ` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(wssUrl)}">${paramBlock}</Stream>
  </Connect>
</Response>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function initiateOutboundCall(opts: {
  to: string;
  callId: string;
  caseId: string;
}): Promise<{ callSid: string }> {
  const cfg = getTwilioConfig();
  if (!isTwilioConfigured() || !cfg.accountSid || !cfg.authToken || !cfg.phoneNumber || !cfg.publicAgentUrl) {
    throw new Error("Twilio not configured");
  }

  const twilio = (await import("twilio")).default;
  const client = twilio(cfg.accountSid, cfg.authToken);
  const voiceUrl = new URL(`${cfg.publicAgentUrl}/twilio/voice`);
  voiceUrl.searchParams.set("callId", opts.callId);
  voiceUrl.searchParams.set("caseId", opts.caseId);

  const call = await client.calls.create({
    to: opts.to,
    from: cfg.phoneNumber,
    url: voiceUrl.toString(),
  });

  console.log(`[twilio] outbound call initiated to ${opts.to.slice(0, 6)}… sid=${call.sid}`);
  return { callSid: call.sid };
}

export { isTwilioConfigured, getTwilioConfig, checkTwilioStatus } from "./twilio-config";
export type { TwilioConfig };
