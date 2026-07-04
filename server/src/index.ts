// server/src/index.ts
// ClearBorder API server — Fastify + WebSocket event bus
// All secrets stay here. Console/portal get ephemeral tokens only.

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { LocalCaseStore } from "./case-store/local.ts";
import type { CaseFile } from "@clearborder/core";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const CASE_STORE = process.env.CASE_STORE ?? "local";

// --- CaseStore factory ---
function createCaseStore() {
  if (CASE_STORE === "local") {
    return new LocalCaseStore("clearborder.db");
  }
  // Future: InteractionsCaseStore
  throw new Error(`Unknown CASE_STORE: ${CASE_STORE}. Use "local".`);
}

const caseStore = createCaseStore();

// --- Fastify setup ---
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

// --- WebSocket event bus ---
const wsClients = new Set<import("ws").WebSocket>();

app.register(async function wsRoutes(fastify) {
  fastify.get("/ws", { websocket: true }, (socket, _req) => {
    wsClients.add(socket);
    socket.on("close", () => wsClients.delete(socket));
  });
});

function broadcast(event: string, data: unknown) {
  const msg = JSON.stringify({ event, data, at: new Date().toISOString() });
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// --- REST routes ---

// Health check
app.get("/health", async () => ({ status: "ok", store: CASE_STORE }));

// Create a new case
app.post<{ Body: Partial<CaseFile> }>("/api/cases", async (req, reply) => {
  const caseFile = await caseStore.create(req.body);
  broadcast("case_created", { caseId: caseFile.caseId });
  return reply.code(201).send(caseFile);
});

// Get a case by ID
app.get<{ Params: { caseId: string } }>("/api/cases/:caseId", async (req, reply) => {
  const cf = await caseStore.get(req.params.caseId);
  if (!cf) return reply.code(404).send({ error: "Case not found" });
  return cf;
});

// Resume a case by environmentId
app.post<{ Body: { environmentId: string } }>("/api/cases/resume", async (req, reply) => {
  const cf = await caseStore.resume(req.body.environmentId);
  if (!cf) return reply.code(404).send({ error: "No case found for that environmentId" });
  broadcast("resumed", { caseId: cf.caseId, day: cf.day });
  return cf;
});

// Append data to a case
app.patch<{ Params: { caseId: string }; Body: Partial<CaseFile> }>(
  "/api/cases/:caseId",
  async (req, reply) => {
    try {
      const cf = await caseStore.append(req.params.caseId, req.body);
      broadcast("case_updated", { caseId: cf.caseId });
      return cf;
    } catch (e: any) {
      return reply.code(404).send({ error: e.message });
    }
  }
);

// Detect discrepancies for a case
app.post<{ Params: { caseId: string } }>(
  "/api/cases/:caseId/discrepancies",
  async (req, reply) => {
    try {
      const discrepancies = await caseStore.detectDiscrepancies(req.params.caseId);
      if (discrepancies.length > 0) {
        broadcast("discrepancy_detected", {
          caseId: req.params.caseId,
          discrepancies,
        });
      }
      return { discrepancies };
    } catch (e: any) {
      return reply.code(404).send({ error: e.message });
    }
  }
);

// --- Start ---
try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 ClearBorder server running on http://localhost:${PORT}`);
  console.log(`   CaseStore: ${CASE_STORE}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
