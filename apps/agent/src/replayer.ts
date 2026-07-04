import type Database from "better-sqlite3";
import type { ApprovalDecisionRequest } from "@clearborder/shared";
import { kvSet } from "./db";
import type { EventHub } from "./hub";
import { DAY_BASE, scriptForDay, type ScriptStep } from "./script";
import { applyDay1Outcomes, applyDay2Outcomes, seedAll } from "./seed";

interface PendingApproval {
  approvalId: string;
  resume: () => void;
}

/**
 * Replayer — plays a scripted day-segment of the hero scenario through the
 * hub with theatrical pacing, pausing at approval gates. Events are stamped
 * with a synthetic per-day clock so the timeline reads like a real workday.
 */
export class Replayer {
  private timer: NodeJS.Timeout | null = null;
  private pending: PendingApproval | null = null;
  private run = 0; // generation token: bumping it cancels any in-flight schedule
  private clockMs = 0;

  constructor(
    private db: Database.Database,
    private hub: EventHub,
  ) {}

  get isPlaying(): boolean {
    return this.timer !== null || this.pending !== null;
  }

  /** Jump to / (re)play a demo day. Restores DB state so any day can start clean. */
  playDay(day: number, speed = 1): void {
    const d = Math.min(3, Math.max(1, Math.round(day)));
    this.stop();
    const runId = ++this.run;

    // Rebuild world state up to the morning of `d`, keep earlier days' events.
    this.db.prepare("DELETE FROM agent_events WHERE day >= ?").run(d);
    seedAll(this.db);
    if (d >= 2) applyDay1Outcomes(this.db);
    if (d >= 3) applyDay2Outcomes(this.db);

    kvSet(this.db, "demo_day", String(d));
    kvSet(this.db, "agent_status", "active");
    kvSet(this.db, "sleep_until", "");
    this.hub.setPlaying(true);
    this.hub.broadcastReset();

    const steps = scriptForDay(d);
    this.clockMs = Date.parse(DAY_BASE[d] ?? new Date().toISOString());
    const clampedSpeed = Math.min(10, Math.max(0.25, speed));
    this.schedule(runId, d, steps, 0, clampedSpeed);
  }

  /** Full reset: pristine seed, empty timeline, back to Day 1. */
  reset(): void {
    this.stop();
    seedAll(this.db, { resetEvents: true });
    this.hub.setPlaying(false);
    this.hub.broadcastReset();
  }

  decide(req: ApprovalDecisionRequest): { resumed: boolean } {
    const decidedBy = req.decidedBy ?? "operator";
    const day = Number(this.db.prepare("SELECT value FROM kv WHERE key='demo_day'").pluck().get() ?? 1);

    if (req.decision === "approve") {
      this.hub.emit(
        {
          type: "approval.granted",
          caseId: "CB-2481",
          approvalId: req.approvalId,
          decidedBy,
        },
        { at: this.nextAt(600), day },
      );
      const pending = this.pending;
      this.pending = null;
      if (pending && pending.approvalId === req.approvalId) {
        pending.resume();
        return { resumed: true };
      }
      return { resumed: false };
    }

    this.hub.emit(
      {
        type: "approval.rejected",
        caseId: "CB-2481",
        approvalId: req.approvalId,
        decidedBy,
        reason: req.reason,
      },
      { at: this.nextAt(600), day },
    );
    this.hub.emit(
      {
        type: "agent.thought",
        caseId: "CB-2481",
        text: "Understood — holding the amendment. I'll keep the case flagged for manual review and take no further action on the portal.",
      },
      { at: this.nextAt(1200), day },
    );
    this.pending = null;
    this.hub.setPlaying(false);
    this.hub.broadcastState();
    return { resumed: false };
  }

  private stop(): void {
    this.run++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  private nextAt(advanceMs: number): string {
    this.clockMs += advanceMs;
    return new Date(this.clockMs).toISOString();
  }

  private schedule(
    runId: number,
    day: number,
    steps: ScriptStep[],
    index: number,
    speed: number,
  ): void {
    if (runId !== this.run) return;
    const step = steps[index];
    if (!step) {
      this.timer = null;
      this.hub.setPlaying(false);
      this.hub.broadcastState();
      return;
    }

    this.timer = setTimeout(() => {
      if (runId !== this.run) return;
      this.timer = null;

      const input = typeof step.input === "function" ? step.input(this.db) : step.input;
      const at = this.nextAt(step.wait + 400); // synthetic clock ticks a little slower than real playback
      const event = this.hub.emit(input, { at, day });
      step.apply?.(this.db);

      if (step.pauseForApproval && event.type === "approval.requested") {
        this.pending = {
          approvalId: event.approvalId,
          resume: () => this.schedule(runId, day, steps, index + 1, speed),
        };
        this.hub.broadcastState();
        return;
      }
      this.schedule(runId, day, steps, index + 1, speed);
    }, step.wait / speed);
  }
}
