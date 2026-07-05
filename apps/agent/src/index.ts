import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import type {
  ApprovalDecisionRequest,
  CaseIntakeRequest,
  CaseIntakeResponse,
  CaseStatusResponse,
  HealthResponse,
  ReplayRequest,
} from "@clearborder/shared";
import { ensureSchema, getCase, kvSet, openDb } from "./db";
import { loadRootEnv } from "./env";
import { probeComputerUse, getGemini, createLiveEphemeralToken, geminiModels } from "./gemini/client";
import { EventHub } from "./hub";
import { Orchestrator } from "./orchestrator/index";
import { Replayer } from "./replayer";
import { seedAll } from "./seed";
import { voiceSessions } from "./voice/index";
import {
  createTwilioBridge,
  buildVoiceTwiml,
  checkTwilioStatus,
  initiateOutboundCall,
} from "./voice/twilio-bridge";
import { isTwilioPartiallyConfigured, printTwilioSetupInstructions } from "./voice/twilio-config";

loadRootEnv();

const PORT = Number(process.env.AGENT_PORT ?? 8787);
const startedAt = Date.now();

const db = openDb();
ensureSchema(db);

const hasCases = (db.prepare("SELECT COUNT(*) n FROM cases").get() as { n: number }).n > 0;
if (!hasCases) {
  seedAll(db, { resetEvents: true });
  console.log("[agent] empty database — seeded demo data (run `pnpm seed` to reset any time)");
}

const hub = new EventHub(db);
const replayer = new Replayer(db, hub);

let computerUseMode: "gemini" | "scripted" =
  process.env.COMPUTER_USE_MODE === "scripted" ? "scripted" : "gemini";
const voiceMode = (process.env.VOICE_MODE ?? "mock") as "browser" | "twilio" | "mock";

const orchestrator = new Orchestrator(db, hub, { computerUseMode, voiceMode });

// Startup: probe Gemini computer use
const geminiOk = !!getGemini();
if (geminiOk && computerUseMode === "gemini") {
  const cuOk = await probeComputerUse();
  if (!cuOk) {
    computerUseMode = "scripted";
    console.log("[agent] COMPUTER_USE_MODE auto-fallback → scripted (billing or model unavailable)");
  }
} else if (!geminiOk) {
  computerUseMode = "scripted";
  console.log("[agent] GEMINI_API_KEY not set — computer use → scripted, voice → mock");
}

if (voiceMode === "twilio" && !isTwilioPartiallyConfigured()) {
  printTwilioSetupInstructions();
} else if (voiceMode === "twilio" && isTwilioPartiallyConfigured() && !checkTwilioStatus(geminiOk).ok) {
  console.warn("[agent] VOICE_MODE=twilio but configuration incomplete — see GET /twilio/status");
}

const app = Fastify({ logger: false });

await app.register(cors, { origin: true });
await app.register(websocket);

app.get("/health", async (): Promise<HealthResponse> => {
  let dbState: HealthResponse["db"] = "connected";
  try {
    db.prepare("SELECT 1").get();
  } catch {
    dbState = "error";
  }
  return {
    ok: dbState === "connected",
    service: "clearborder-agent",
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    db: dbState,
    now: new Date().toISOString(),
    modes: {
      computerUse: computerUseMode,
      voice: voiceMode,
      geminiAvailable: geminiOk,
    },
  };
});

app.get("/ws", { websocket: true }, (socket) => {
  hub.addWs(socket);
  socket.on("close", () => hub.removeWs(socket));
  socket.on("error", () => hub.removeWs(socket));
});

app.get("/events", (request, reply) => {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  reply.raw.write(":ok\n\n");
  hub.addSse(reply.raw);
  const keepAlive = setInterval(() => reply.raw.write(":ka\n\n"), 15000);
  request.raw.on("close", () => {
    clearInterval(keepAlive);
    hub.removeSse(reply.raw);
  });
});

app.get("/api/state", async () => hub.helloMessage());

// ── Real agent: intake, case status, wake ───────────────────────────────────

app.post<{ Body: CaseIntakeRequest }>("/api/cases/intake", async (request, reply) => {
  const body = request.body;
  if (
    !body?.importerPassportId ||
    !body?.importerName ||
    !body?.shipmentReference ||
    body?.declaredValue === undefined ||
    body?.invoiceValue === undefined
  ) {
    return reply.status(400).send({
      error: "importerPassportId, importerName, shipmentReference, declaredValue, invoiceValue required",
    });
  }
  console.log(`[agent] intake: ${body.importerName} / ${body.shipmentReference}`);
  const created = await orchestrator.startFromIntake(body);
  kvSet(db, "demo_day", "1");
  const res: CaseIntakeResponse = {
    ok: true,
    caseId: created.caseId,
    reference: created.reference,
    declarationRef: created.declarationRef,
    message: `Case ${created.reference} created — agent started`,
  };
  return res;
});

app.get<{ Params: { id: string } }>("/api/cases/:id", async (request, reply) => {
  const c = getCase(db, request.params.id);
  if (!c) return reply.status(404).send({ error: "Case not found" });
  const row = db.prepare("SELECT orchestrator_phase, sleep_until, pending_approval_id FROM cases WHERE id = ?").get(c.id) as
    | { orchestrator_phase: string; sleep_until: string | null; pending_approval_id: string | null }
    | undefined;
  const res: CaseStatusResponse = {
    case: c,
    phase: (row?.orchestrator_phase ?? "INTAKE") as CaseStatusResponse["phase"],
    sleepUntil: row?.sleep_until,
    pendingApprovalId: row?.pending_approval_id,
  };
  return res;
});

app.post<{ Params: { caseId: string } }>("/api/agent/wake/:caseId", async (request, reply) => {
  const { caseId } = request.params;
  const c = getCase(db, caseId);
  if (!c) return reply.status(404).send({ error: "Case not found" });
  console.log(`[agent] manual wake: ${caseId}`);
  await orchestrator.wakeCase(caseId);
  return { ok: true, caseId };
});

// ── Approval (orchestrator first, then replayer for demo) ───────────────────

app.post<{ Body: ApprovalDecisionRequest }>("/api/approval", async (request, reply) => {
  const body = request.body;
  if (!body?.approvalId || !["approve", "reject"].includes(body?.decision)) {
    return reply.status(400).send({ error: "approvalId and decision ('approve'|'reject') required" });
  }
  console.log(`[agent] approval ${body.decision}: ${body.approvalId}`);
  const orchResult = orchestrator.decide(body);
  if (orchResult.handled) {
    return { ok: true, resumed: orchResult.resumed, source: "orchestrator" };
  }
  const replayResult = replayer.decide(body);
  return { ok: true, ...replayResult, source: "replayer" };
});

// ── Demo replayer (scripted Day 1/2/3) ─────────────────────────────────────

app.post<{ Body: ReplayRequest }>("/api/demo/replay", async (request) => {
  const day = request.body?.day ?? hub.demoState().day;
  const speed = request.body?.speed ?? 1;
  console.log(`[agent] replaying day ${day} (speed ${speed}x)`);
  replayer.playDay(day, speed);
  return { ok: true, day, speed };
});

app.post("/api/demo/reset", async () => {
  console.log("[agent] demo reset");
  replayer.reset();
  return { ok: true };
});

app.post<{ Body: { ref: string; status: string } }>(
  "/api/demo/portal-status",
  async (request, reply) => {
    const { ref, status } = request.body ?? {};
    if (!ref || !status) return reply.status(400).send({ error: "ref and status required" });
    const info = db
      .prepare("UPDATE declarations SET status = ?, updated_at = ? WHERE ref = ?")
      .run(status, new Date().toISOString(), ref);
    return { ok: info.changes > 0 };
  },
);

// ── Browser Gemini Live voice bridge ─────────────────────────────────────────

app.post<{ Body: { callId: string } }>("/api/voice/live-token", async (request, reply) => {
  const { callId } = request.body ?? {};
  if (!callId) return reply.status(400).send({ error: "callId required" });
  const ctx = voiceSessions.getContext(callId);
  if (!ctx) return reply.status(404).send({ error: "No active voice session for this callId" });

  const systemInstruction = [
    "You are simulating a bilingual customs clearance phone call for a demo.",
    `ClearBorder agent (English) calls ${ctx.shipperName} (${ctx.shipperLang}) about shipment ${ctx.trackingNumber}.`,
    `Declared value: ${ctx.currency} ${ctx.declaredValue.toFixed(2)}. Invoice ${ctx.invoiceNumber}: ${ctx.currency} ${ctx.invoiceValue.toFixed(2)}.`,
    "First speak as the English-speaking customs agent asking the shipper to confirm the correct invoice total.",
    "Then respond as the Mandarin-speaking shipper admitting the decimal-point error and confirming the invoice total.",
    "Keep responses concise. Speak naturally for voice output.",
  ].join(" ");

  const token = await createLiveEphemeralToken(systemInstruction);
  if (!token) {
    return reply.status(503).send({ error: "Gemini Live token unavailable — check GEMINI_API_KEY and billing" });
  }

  const { LIVE_MODEL } = geminiModels();
  return {
    token,
    model: LIVE_MODEL,
    callId,
    context: ctx,
  };
});

app.post<{
  Body: {
    speaker: "agent" | "shipper";
    sourceLang: string;
    targetLang: string;
    sourceText: string;
    translatedText: string;
    partial?: boolean;
  };
  Params: { callId: string };
}>("/api/voice/:callId/transcript", async (request, reply) => {
  const ctx = voiceSessions.getContext(request.params.callId);
  if (!ctx) return reply.status(404).send({ error: "Voice session not found" });

  const body = request.body;
  if (!body?.sourceText) return reply.status(400).send({ error: "sourceText required" });

  hub.emit(
    {
      type: body.partial ? "call.transcript_partial" : "call.transcript_final",
      caseId: ctx.caseId,
      callId: request.params.callId,
      speaker: body.speaker ?? "agent",
      sourceLang: body.sourceLang,
      targetLang: body.targetLang,
      sourceText: body.sourceText,
      translatedText: body.translatedText ?? body.sourceText,
    },
    { day: ctx.day },
  );
  return { ok: true };
});

app.post<{
  Body: {
    summary: string;
    confirmedValue: number;
    transcripts: Array<{
      speaker: "agent" | "shipper";
      sourceLang: string;
      targetLang: string;
      sourceText: string;
      translatedText: string;
    }>;
  };
  Params: { callId: string };
}>("/api/voice/:callId/complete", async (request, reply) => {
  const { callId } = request.params;
  const body = request.body;
  if (!body?.summary || body.confirmedValue === undefined) {
    return reply.status(400).send({ error: "summary and confirmedValue required" });
  }
  const ok = voiceSessions.complete(callId, {
    summary: body.summary,
    confirmedValue: body.confirmedValue,
    transcripts: body.transcripts ?? [],
  });
  if (!ok) return reply.status(404).send({ error: "Voice session not found or already completed" });
  console.log(`[voice] browser Live complete: ${callId}`);
  return { ok: true };
});

// ── Twilio PSTN ↔ Gemini Live bridge ─────────────────────────────────────────

app.post<{ Querystring: { callId?: string; caseId?: string } }>("/twilio/voice", async (request, reply) => {
  const { callId, caseId } = request.query ?? {};
  reply.type("text/xml");
  return buildVoiceTwiml({ callId, caseId });
});

app.get("/twilio/stream", { websocket: true }, (socket) => {
  const bridge = createTwilioBridge(socket, hub, {
    db,
    memory: orchestrator.getMemory(),
    onInboundComplete: (result) => {
      if (result.caseId) orchestrator.resumeAfterInboundVoice(result as { caseId: string; confirmedValue: number; summary: string });
    },
  });
  socket.on("message", (raw) => bridge.handleMessage(raw as string | Buffer));
  socket.on("close", () => bridge.cleanup());
  socket.on("error", () => bridge.cleanup());
});

app.post<{ Body: { to?: string; callId?: string; caseId?: string } }>(
  "/twilio/outbound",
  async (request, reply) => {
    const to = request.body?.to?.trim() || process.env.SHIPPER_PHONE_NUMBER?.trim();
    const { callId, caseId } = request.body ?? {};
    if (!to) return reply.status(400).send({ error: "to or SHIPPER_PHONE_NUMBER required" });
    if (!callId || !caseId) {
      return reply.status(400).send({ error: "callId and caseId required" });
    }
    try {
      const result = await initiateOutboundCall({ to, callId, caseId });
      return { ok: true, callSid: result.callSid };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(503).send({ error: msg });
    }
  },
);

app.get("/twilio/status", async () => checkTwilioStatus(geminiOk));

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[agent] ClearBorder agent service → http://localhost:${PORT}`);
  console.log(
    `[agent] modes: computer=${computerUseMode} voice=${voiceMode} gemini=${geminiOk ? "yes" : "no"}`,
  );
  console.log(`[agent] health: /health · intake: POST /api/cases/intake · wake: POST /api/agent/wake/:id`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
