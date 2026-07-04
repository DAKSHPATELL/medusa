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
import { probeComputerUse, getGemini } from "./gemini/client";
import { EventHub } from "./hub";
import { Orchestrator } from "./orchestrator/index";
import { Replayer } from "./replayer";
import { seedAll } from "./seed";

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
