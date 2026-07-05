import * as alawmulaw from "alawmulaw";
import { Modality, type Tool } from "@google/genai";
import type Database from "better-sqlite3";
import type { WebSocket } from "ws";
import type { EventHub } from "../hub";
import type { MemoryEngine } from "../orchestrator/memory";
import { getGemini, geminiModels } from "../gemini/client";
import {
  VoiceAgentTools,
  VOICE_AGENT_TOOL_DECLARATIONS,
  buildInboundSystemInstruction,
  buildOutboundSystemInstruction,
  createVoiceAgentState,
  resolveConfirmedValue,
  type VoiceAgentState,
} from "./agent-tools";
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

type GeminiLiveSession = {
  close: () => void;
  sendRealtimeInput: (input: { audio: { data: string; mimeType: string } }) => void;
  sendClientContent: (content: {
    turns: Array<{ role: string; parts: Array<{ text: string }> }>;
    turnComplete: boolean;
  }) => void;
  sendToolResponse: (params: {
    functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }>;
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

export interface InboundVoiceCompleteResult {
  caseId?: string;
  confirmedValue: number;
  summary: string;
  schedulePortalFill: boolean;
  transcripts: TranscriptLine[];
}

export interface TwilioBridgeDeps {
  db: Database.Database;
  memory: MemoryEngine;
  onInboundComplete?: (result: InboundVoiceCompleteResult) => void;
}

/** Manages one Twilio Media Stream ↔ Gemini Live voice agent session. */
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
  private agentState: VoiceAgentState = createVoiceAgentState();
  private tools: VoiceAgentTools;
  private direction: "inbound" | "outbound" = "inbound";
  private readonly db: Database.Database;
  private readonly memory: MemoryEngine;
  private onInboundComplete?: (result: InboundVoiceCompleteResult) => void;

  constructor(
    private ws: WebSocket,
    private hub: EventHub,
    deps: TwilioBridgeDeps,
  ) {
    this.model = geminiModels().LIVE_MODEL;
    this.db = deps.db;
    this.memory = deps.memory;
    this.onInboundComplete = deps.onInboundComplete;
    this.tools = new VoiceAgentTools(deps.db, hub, deps.memory, {});
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

  private activeCaseId(): string | undefined {
    return this.ctx?.caseId ?? this.agentState.caseId;
  }

  private activeDay(): number | undefined {
    return this.ctx?.day;
  }

  private shipperLangCode(): string {
    return this.ctx?.shipperLanguageCode ?? this.agentState.shipperLanguageCode ?? "en";
  }

  private async onStart(start: TwilioStartPayload): Promise<void> {
    this.streamSid = start.streamSid;
    this.callSid = start.callSid;
    this.callId = start.customParameters?.callId ?? start.callSid;
    this.ctx = voiceSessions.getContext(this.callId);
    this.direction = this.ctx ? "outbound" : "inbound";

    this.tools = new VoiceAgentTools(this.db, this.hub, this.memory, {
      day: this.ctx?.day,
      callId: this.callId,
    });

    if (this.ctx) {
      this.agentState.caseId = this.ctx.caseId;
      this.agentState.currency = this.ctx.currency;
      this.agentState.shipperName = this.ctx.shipperName;
      this.agentState.shipperLanguageCode = this.ctx.shipperLanguageCode;
      this.hub.emit(
        {
          type: "agent.thought",
          caseId: this.ctx.caseId,
          text: "Gemini Live voice agent connected — outbound customs clarification call.",
        },
        { day: this.ctx.day },
      );
    } else {
      this.hub.emit({
        type: "call.started",
        caseId: undefined,
        callId: this.callId,
        phone: "inbound",
        shipperName: "Caller",
        direction: "inbound",
        sourceLang: "en",
        targetLang: "en",
      });
      this.hub.emit({
        type: "agent.thought",
        text: "Inbound PSTN call — Gemini Live customs agent active. Will identify parcel and resolve hold.",
      });
      console.log(`[twilio] inbound call ${start.callSid}`);
    }

    const ai = getGemini();
    if (!ai) {
      console.error("[twilio] GEMINI_API_KEY missing — cannot start voice agent");
      this.ws.close();
      return;
    }

    const systemInstruction = this.ctx
      ? buildOutboundSystemInstruction(this.ctx)
      : buildInboundSystemInstruction();

    const ctx = this.ctx;
    const callId = this.callId;

    try {
      this.geminiSession = (await ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
          tools: VOICE_AGENT_TOOL_DECLARATIONS as unknown as Tool[],
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
                        text: `Begin the outbound customs call to ${ctx.shipperName}. Explain the valuation hold on tracking ${ctx.trackingNumber} — declared ${ctx.currency} ${ctx.declaredValue.toFixed(2)} vs invoice ${ctx.invoiceNumber} ${ctx.currency} ${ctx.invoiceValue.toFixed(2)}. Ask them to confirm the correct total, then use record_clarification and schedule_portal_amendment.`,
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
                    parts: [
                      {
                        text: "Greet the inbound caller as ClearBorder customs agent. Ask how you can help with their held parcel, and request the waybill or tracking number if they have not given it yet.",
                      },
                    ],
                  },
                ],
                turnComplete: true,
              });
            }
            console.log(`[twilio] Gemini Live agent ready callId=${callId} model=${this.model}`);
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
    toolCall?: {
      functionCalls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>;
    };
    serverContent?: {
      interrupted?: boolean;
      inputTranscription?: { text?: string };
      outputTranscription?: { text?: string };
      modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
      turnComplete?: boolean;
    };
  }): void {
    if (message.toolCall?.functionCalls?.length) {
      this.handleToolCalls(message.toolCall.functionCalls);
    }

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

  private handleToolCalls(
    calls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>,
  ): void {
    if (!this.geminiSession) return;

    const functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }> =
      [];

    for (const fc of calls) {
      const name = fc.name ?? "unknown";
      const args = (fc.args ?? {}) as Record<string, unknown>;
      const { response, state } = this.tools.executeToolCall(name, args, this.agentState);
      this.agentState = state;

      functionResponses.push({
        id: fc.id ?? `fc-${Date.now()}`,
        name,
        response,
      });

      console.log(`[twilio] tool ${name} caseId=${this.activeCaseId() ?? "?"}`);
    }

    try {
      this.geminiSession.sendToolResponse({ functionResponses });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[twilio] sendToolResponse failed: ${msg.slice(0, 120)}`);
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
    const caseId = this.activeCaseId();
    if (!this.callId) return;
    const sourceLang = speaker === "agent" ? "en" : this.shipperLangCode();
    const targetLang = speaker === "agent" ? this.shipperLangCode() : "en";
    this.hub.emit(
      {
        type: partial ? "call.transcript_partial" : "call.transcript_final",
        caseId,
        callId: this.callId,
        speaker,
        sourceLang,
        targetLang,
        sourceText: text,
        translatedText: text,
      },
      { day: this.activeDay() },
    );
  }

  private finalizeTranscript(speaker: "agent" | "shipper", text: string): void {
    const sourceLang = speaker === "agent" ? "en" : this.shipperLangCode();
    const targetLang = speaker === "agent" ? this.shipperLangCode() : "en";
    const line: TranscriptLine = {
      speaker,
      sourceLang,
      targetLang,
      sourceText: text,
      translatedText: text,
    };
    this.transcripts.push(line);
    if (this.callId) {
      this.hub.emit(
        {
          type: "call.transcript_final",
          caseId: this.activeCaseId(),
          callId: this.callId,
          speaker,
          sourceLang,
          targetLang,
          sourceText: text,
          translatedText: text,
        },
        { day: this.activeDay() },
      );
    }
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
    const confirmedValue = resolveConfirmedValue(
      this.agentState,
      this.ctx?.invoiceValue,
    );
    const transcriptSummary = this.transcripts
      .map((t) => `${t.speaker}: ${t.sourceText}`)
      .join(" · ")
      .slice(0, 400);
    const summary =
      this.agentState.clarificationNotes ??
      (this.transcripts.length > 0
        ? `Customs call (${durationSec}s, ${this.transcripts.length} turns)${this.activeCaseId() ? ` re case ${this.activeCaseId()}` : ""}. ${transcriptSummary}`
        : `Phone call ended (${durationSec}s).`);

    const schedulePortalFill =
      this.agentState.schedulePortalFill &&
      this.agentState.caseId !== undefined &&
      confirmedValue > 0;

    if (this.ctx && this.callId) {
      const payload: VoiceCompletePayload = {
        summary,
        confirmedValue,
        transcripts: this.transcripts,
        schedulePortalFill,
        caseId: this.ctx.caseId,
        holdReason: this.agentState.holdReason,
      };
      voiceSessions.complete(this.callId, payload);
    } else if (this.direction === "inbound") {
      this.hub.emit({
        type: "call.ended",
        caseId: this.agentState.caseId,
        callId: this.callId ?? this.callSid ?? "inbound",
        durationSec,
        summary,
      });

      if (schedulePortalFill && this.agentState.caseId) {
        this.onInboundComplete?.({
          caseId: this.agentState.caseId,
          confirmedValue,
          summary,
          schedulePortalFill: true,
          transcripts: this.transcripts,
        });
      }
    }

    console.log(
      `[twilio] stream ended callSid=${this.callSid ?? "?"} duration=${durationSec}s confirmed=${confirmedValue} portal=${schedulePortalFill}`,
    );
  }
}

/** Factory that binds db/memory deps for the WebSocket handler. */
export function createTwilioBridge(
  ws: WebSocket,
  hub: EventHub,
  deps: TwilioBridgeDeps,
): TwilioGeminiBridge {
  return new TwilioGeminiBridge(ws, hub, deps);
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
