import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { MemoryRecord } from "@clearborder/shared";
import { embedText, getGemini, summarize } from "../gemini/client";
import { listMemoriesForCase } from "../db";
import type { EventHub } from "../hub";

/**
 * Hand-rolled episodic + semantic memory with optional Gemini embeddings.
 */
export class MemoryEngine {
  constructor(
    private db: Database.Database,
    private hub: EventHub,
  ) {
    this.ensureEmbeddingColumn();
  }

  private ensureEmbeddingColumn(): void {
    const cols = this.db.prepare("PRAGMA table_info(memories)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "embedding")) {
      this.db.exec("ALTER TABLE memories ADD COLUMN embedding TEXT");
    }
  }

  write(
    input: Omit<MemoryRecord, "id" | "createdAt"> & { id?: string },
    opts: { caseId?: string; day?: number; at?: string },
  ): MemoryRecord {
    const record: MemoryRecord = {
      id: input.id ?? randomUUID(),
      caseId: input.caseId ?? opts.caseId ?? null,
      shipperId: input.shipperId ?? null,
      type: input.type,
      content: input.content,
      source: input.source,
      createdAt: opts.at ?? new Date().toISOString(),
      lastRecalledAt: null,
    };
    this.db
      .prepare(
        `INSERT OR REPLACE INTO memories (id, case_id, shipper_id, type, content, source, created_at, last_recalled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.caseId ?? null,
        record.shipperId ?? null,
        record.type,
        record.content,
        record.source,
        record.createdAt,
        null,
      );
    void this.storeEmbedding(record.id, record.content);
    this.hub.emit(
      { type: "memory.write", caseId: opts.caseId, record },
      { day: opts.day, at: opts.at },
    );
    return record;
  }

  private async storeEmbedding(id: string, content: string): Promise<void> {
    const vec = await embedText(content);
    if (!vec) return;
    this.db.prepare("UPDATE memories SET embedding = ? WHERE id = ?").run(
      JSON.stringify(vec),
      id,
    );
  }

  recallTop(
    caseId: string,
    shipperId: string,
    query: string,
    why: string,
    limit = 3,
    opts: { day?: number; at?: string } = {},
  ): MemoryRecord[] {
    const candidates = listMemoriesForCase(this.db, caseId, shipperId);
    const queryVec = null as number[] | null; // sync path — async recall uses recallAsync

    let ranked = candidates;
    if (queryVec) {
      ranked = candidates
        .map((m) => ({ m, score: this.cosine(queryVec, this.getEmbedding(m.id)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.m);
    } else {
      ranked = candidates.slice(0, limit);
    }

    for (const record of ranked) {
      this.hub.emit({ type: "memory.read", caseId, record, why }, opts);
    }
    return ranked;
  }

  async recallAsync(
    caseId: string,
    shipperId: string,
    query: string,
    why: string,
    limit = 3,
    opts: { day?: number; at?: string } = {},
  ): Promise<MemoryRecord[]> {
    const candidates = listMemoriesForCase(this.db, caseId, shipperId);
    const queryVec = await embedText(query);
    let ranked: MemoryRecord[];
    if (queryVec && getGemini()) {
      ranked = candidates
        .map((m) => ({ m, score: this.cosine(queryVec, this.getEmbedding(m.id)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.m);
    } else {
      ranked = candidates.slice(0, limit);
    }
    for (const record of ranked) {
      this.hub.emit({ type: "memory.read", caseId, record, why }, opts);
    }
    return ranked;
  }

  async buildWakeRecap(caseId: string, shipperId: string): Promise<string> {
    const episodic = listMemoriesForCase(this.db, caseId, shipperId).filter(
      (m) => m.type === "episodic",
    );
    const bullets = episodic
      .slice(0, 5)
      .map((m) => `• ${m.content}`)
      .join("\n");
    const fallback = bullets
      ? `Resuming case work. Last actions:\n${bullets}`
      : "Resuming case work from where I left off.";
    if (!getGemini()) return fallback;
    const summary = await summarize(
      bullets || "No prior episodic memories.",
      "Write a 2-sentence first-person recap for a customs broker agent waking up to continue a case. Be concise.",
    );
    return summary ?? fallback;
  }

  async consolidateShipperPattern(
    shipperId: string,
    content: string,
    source: string,
    opts: { caseId?: string; day?: number },
  ): Promise<void> {
    this.write(
      { type: "semantic", shipperId, content, source },
      { caseId: opts.caseId, day: opts.day },
    );
    const row = this.db.prepare("SELECT learned_patterns FROM shippers WHERE id = ?").get(shipperId) as
      | { learned_patterns: string }
      | undefined;
    if (!row) return;
    const patterns = JSON.parse(row.learned_patterns) as Array<{
      id: string;
      text: string;
      confidence: number;
      createdAt: string;
    }>;
    patterns.push({
      id: randomUUID(),
      text: content,
      confidence: 0.85,
      createdAt: new Date().toISOString(),
    });
    this.db
      .prepare("UPDATE shippers SET learned_patterns = ? WHERE id = ?")
      .run(JSON.stringify(patterns), shipperId);
  }

  private getEmbedding(id: string): number[] {
    const row = this.db.prepare("SELECT embedding FROM memories WHERE id = ?").get(id) as
      | { embedding: string | null }
      | undefined;
    if (!row?.embedding) return [];
    try {
      return JSON.parse(row.embedding) as number[];
    } catch {
      return [];
    }
  }

  private cosine(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      na += a[i]! * a[i]!;
      nb += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom ? dot / denom : 0;
  }
}
