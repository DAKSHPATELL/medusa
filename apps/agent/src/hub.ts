import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  AgentEvent,
  AgentEventInput,
  AgentStatus,
  DemoState,
  ServerMessage,
  SnapshotState,
} from "@clearborder/shared";
import { kvGet, kvSet, listCases, listEvents, listShippers } from "./db";

type WsLike = { send: (data: string) => void; readyState: number };
type SseSink = { write: (chunk: string) => boolean };

const WS_OPEN = 1;

/**
 * EventHub — single funnel for AgentEvents. Assigns envelope fields, persists
 * to SQLite, applies side effects (case status, memory recall stamps, agent
 * status), and broadcasts to every WS + SSE subscriber.
 */
export class EventHub {
  private wsClients = new Set<WsLike>();
  private sseClients = new Set<SseSink>();

  constructor(private db: Database.Database) {}

  addWs(ws: WsLike): void {
    this.wsClients.add(ws);
    ws.send(JSON.stringify(this.helloMessage()));
  }

  removeWs(ws: WsLike): void {
    this.wsClients.delete(ws);
  }

  addSse(sink: SseSink): void {
    this.sseClients.add(sink);
    sink.write(`data: ${JSON.stringify(this.helloMessage())}\n\n`);
  }

  removeSse(sink: SseSink): void {
    this.sseClients.delete(sink);
  }

  helloMessage(): ServerMessage {
    return { kind: "hello", state: this.snapshot(), events: listEvents(this.db) };
  }

  snapshot(): SnapshotState {
    return {
      demo: this.demoState(),
      cases: listCases(this.db),
      shippers: listShippers(this.db),
    };
  }

  demoState(): DemoState {
    return {
      day: Number(kvGet(this.db, "demo_day") ?? "1"),
      agentStatus: (kvGet(this.db, "agent_status") ?? "idle") as AgentStatus,
      playing: kvGet(this.db, "playing") === "1",
      activeCaseId: kvGet(this.db, "active_case") ?? "",
      sleepUntil: kvGet(this.db, "sleep_until") || null,
    };
  }

  setPlaying(playing: boolean): void {
    kvSet(this.db, "playing", playing ? "1" : "0");
  }

  emit(input: AgentEventInput, opts: { at?: string; day?: number } = {}): AgentEvent {
    const at = opts.at ?? input.at ?? new Date().toISOString();
    const day = opts.day ?? input.day ?? Number(kvGet(this.db, "demo_day") ?? "1");
    const partial = { ...input, id: randomUUID(), at, day } as Omit<AgentEvent, "seq">;

    const info = this.db
      .prepare(
        "INSERT INTO agent_events (id, case_id, day, type, at, payload) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        partial.id,
        partial.caseId ?? null,
        day,
        partial.type,
        at,
        JSON.stringify(partial),
      );

    const event = { ...partial, seq: Number(info.lastInsertRowid) } as AgentEvent;
    this.applySideEffects(event);
    this.broadcast({ kind: "event", event });
    return event;
  }

  broadcast(msg: ServerMessage): void {
    const json = JSON.stringify(msg);
    for (const ws of this.wsClients) {
      if (ws.readyState === WS_OPEN) {
        try {
          ws.send(json);
        } catch {
          this.wsClients.delete(ws);
        }
      }
    }
    const sse = `data: ${json}\n\n`;
    for (const sink of this.sseClients) {
      try {
        sink.write(sse);
      } catch {
        this.sseClients.delete(sink);
      }
    }
  }

  broadcastState(): void {
    this.broadcast({ kind: "state", state: this.snapshot() });
  }

  broadcastReset(): void {
    this.broadcast({ kind: "reset", state: this.snapshot() } as ServerMessage);
    // Re-deliver whatever backlog survived the reset (e.g. earlier demo days).
    for (const event of listEvents(this.db)) {
      this.broadcast({ kind: "event", event });
    }
  }

  private applySideEffects(event: AgentEvent): void {
    const db = this.db;

    if (event.caseId) {
      db.prepare(
        "UPDATE cases SET day_count = MAX(day_count, ?), updated_at = ? WHERE id = ?",
      ).run(event.day, event.at, event.caseId);
    }

    switch (event.type) {
      case "case.status_changed":
        if (event.caseId) {
          db.prepare("UPDATE cases SET status = ?, updated_at = ? WHERE id = ?").run(
            event.to,
            event.at,
            event.caseId,
          );
        }
        break;
      case "memory.write": {
        const r = event.record;
        db.prepare(
          `INSERT OR REPLACE INTO memories (id, case_id, shipper_id, type, content, source, created_at, last_recalled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          r.id,
          r.caseId ?? null,
          r.shipperId ?? null,
          r.type,
          r.content,
          r.source,
          r.createdAt,
          r.lastRecalledAt ?? null,
        );
        break;
      }
      case "memory.read":
        db.prepare("UPDATE memories SET last_recalled_at = ? WHERE id = ?").run(
          event.at,
          event.record.id,
        );
        break;
      case "agent.sleep":
        kvSet(db, "agent_status", "sleeping");
        kvSet(db, "sleep_until", event.until);
        break;
      case "agent.wake":
        kvSet(db, "agent_status", "active");
        kvSet(db, "sleep_until", "");
        break;
      case "approval.requested":
        kvSet(db, "agent_status", "awaiting_approval");
        break;
      case "approval.granted":
      case "approval.rejected":
        kvSet(db, "agent_status", "active");
        break;
      default:
        break;
    }

    // Status-bearing events refresh the case list / demo chips on the dashboard.
    if (
      event.type === "case.status_changed" ||
      event.type === "agent.sleep" ||
      event.type === "agent.wake" ||
      event.type.startsWith("approval.")
    ) {
      this.broadcastState();
    }
  }
}
