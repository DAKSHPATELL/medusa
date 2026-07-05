export interface VoiceSessionContext {
  caseId: string;
  callId: string;
  shipperName: string;
  shipperLang: string;
  shipperLanguageCode: string;
  phone: string;
  trackingNumber: string;
  declaredValue: number;
  invoiceValue: number;
  invoiceNumber: string;
  currency: string;
  day?: number;
}

export interface VoiceTranscriptLine {
  speaker: "agent" | "shipper";
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
}

export interface VoiceCompletePayload {
  summary: string;
  confirmedValue: number;
  transcripts: VoiceTranscriptLine[];
  /** When true, orchestrator should resume PORTAL_FILL with confirmedValue. */
  schedulePortalFill?: boolean;
  caseId?: string;
  holdReason?: string;
}

interface PendingSession {
  ctx: VoiceSessionContext;
  resolve: (payload: VoiceCompletePayload) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

/** Coordinates browser-side Gemini Live sessions with the orchestrator. */
class VoiceSessionManager {
  private pending = new Map<string, PendingSession>();

  register(ctx: VoiceSessionContext, timeoutMs: number): Promise<VoiceCompletePayload> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(ctx.callId);
        reject(new Error("browser voice session timed out"));
      }, timeoutMs);
      this.pending.set(ctx.callId, { ctx, resolve, reject, timeout });
    });
  }

  getContext(callId: string): VoiceSessionContext | undefined {
    return this.pending.get(callId)?.ctx;
  }

  complete(callId: string, payload: VoiceCompletePayload): boolean {
    const session = this.pending.get(callId);
    if (!session) return false;
    clearTimeout(session.timeout);
    this.pending.delete(callId);
    session.resolve(payload);
    return true;
  }

  cancel(callId: string): void {
    const session = this.pending.get(callId);
    if (!session) return;
    clearTimeout(session.timeout);
    this.pending.delete(callId);
    session.reject(new Error("voice session cancelled"));
  }
}

export const voiceSessions = new VoiceSessionManager();
