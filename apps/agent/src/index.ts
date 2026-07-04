import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import type {
  ApprovalDecisionRequest,
  HealthResponse,
  ReplayRequest,
} from "@clearborder/shared";
import { ensureSchema, openDb } from "./db";
import { loadRootEnv } from "./env";
import { EventHub } from "./hub";
import { Replayer } from "./replayer";
import { seedAll } from "./seed";

loadRootEnv();

const PORT = Number(process.env.AGENT_PORT ?? 8787);
const startedAt = Date.now();

const db = openDb();
ensureSchema(db);

// First boot on an empty database: seed automatically so `pnpm dev` just works.
const hasCases = (db.prepare("SELECT COUNT(*) n FROM cases").get() as { n: number }).n > 0;
if (!hasCases) {
  seedAll(db, { resetEvents: true });
  console.log("[agent] empty database — seeded demo data (run `pnpm seed` to reset any time)");
}

const hub = new EventHub(db);
const replayer = new Replayer(db, hub);

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
  };
});

// ── Live stream: WebSocket + SSE ───────────────────────────────────────────

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

// ── State & control API ────────────────────────────────────────────────────

app.get("/api/state", async () => hub.helloMessage());

app.post<{ Body: ApprovalDecisionRequest }>("/api/approval", async (request, reply) => {
  const body = request.body;
  if (!body?.approvalId || !["approve", "reject"].includes(body?.decision)) {
    return reply.status(400).send({ error: "approvalId and decision ('approve'|'reject') required" });
  }
  console.log(`[agent] approval ${body.decision}: ${body.approvalId} (by ${body.decidedBy ?? "operator"})`);
  const result = replayer.decide(body);
  return { ok: true, ...result };
});

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

// Dev helper for staging portal states during verification/demo prep.
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
  console.log(`[agent] health: /health · stream: /ws (WebSocket) & /events (SSE)`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
