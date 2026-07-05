import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ApprovalDecisionRequest, OrchestratorPhase } from "@clearborder/shared";
import { kvSet } from "../db";
import { runPortalAmend, runScriptedPortalSubmit } from "../browser/computer-use";
import type { EventHub } from "../hub";
import { createCaseFromIntake, loadCaseContext, setCasePhase, type IntakeResult } from "../intake";
import type { CaseIntakeRequest } from "@clearborder/shared";
import { MemoryEngine } from "./memory";
import { runBrowserVoiceCall, runMockVoiceCall, runTwilioVoiceCall } from "../voice/index";

interface PendingGate {
  caseId: string;
  approvalId: string;
  resume: () => void;
}

/**
 * Real orchestrator — state machine per case with memory, voice, browser automation, sleep/wake.
 */
export class Orchestrator {
  private memory: MemoryEngine;
  private running = new Set<string>();
  private pending: PendingGate | null = null;
  private computerUseMode: "gemini" | "scripted";
  private voiceMode: "browser" | "twilio" | "mock";
  private wakeTimer: NodeJS.Timeout | null = null;
  /** Confirmed customs value from voice agent (caseId → value). */
  private voiceConfirmedValues = new Map<string, number>();

  constructor(
    private db: Database.Database,
    private hub: EventHub,
    opts: { computerUseMode: "gemini" | "scripted"; voiceMode: "browser" | "twilio" | "mock" },
  ) {
    this.memory = new MemoryEngine(db, hub);
    this.computerUseMode = opts.computerUseMode;
    this.voiceMode = opts.voiceMode;
    this.startWakeScheduler();
  }

  get modes() {
    return { computerUse: this.computerUseMode, voice: this.voiceMode };
  }

  getMemory(): MemoryEngine {
    return this.memory;
  }

  /** Resume PORTAL_FILL after an inbound PSTN call resolved a case. */
  resumeAfterInboundVoice(result: {
    caseId: string;
    confirmedValue: number;
    summary: string;
  }): void {
    this.voiceConfirmedValues.set(result.caseId, result.confirmedValue);
    setCasePhase(this.db, result.caseId, "PORTAL_FILL");
    this.hub.emit({
      type: "agent.thought",
      caseId: result.caseId,
      text: `Inbound call resolved — amending declaration to confirmed value ${result.confirmedValue.toFixed(2)}. ${result.summary}`,
    });
    void this.runCase(result.caseId);
  }

  /** Process intake and kick off the agent loop. */
  async startFromIntake(intake: CaseIntakeRequest): Promise<IntakeResult> {
    const created = createCaseFromIntake(this.db, intake);
    kvSet(this.db, "active_case", created.caseId);
    kvSet(this.db, "agent_status", "active");
    this.hub.broadcastState();
    void this.runCase(created.caseId);
    return created;
  }

  /** Resume a case from its persisted phase (wake or restart). */
  async resumeCase(caseId: string, fromWake = false): Promise<void> {
    if (this.running.has(caseId)) return;
    void this.runCase(caseId, fromWake);
  }

  decide(req: ApprovalDecisionRequest): { resumed: boolean; handled: boolean } {
    const pending = this.pending;
    if (!pending || pending.approvalId !== req.approvalId) {
      return { resumed: false, handled: false };
    }

    const decidedBy = req.decidedBy ?? "operator";

    if (req.decision === "approve") {
      this.hub.emit({
        type: "approval.granted",
        caseId: pending.caseId,
        approvalId: req.approvalId,
        decidedBy,
      });
      this.pending = null;
      pending.resume();
      return { resumed: true, handled: true };
    }

    this.hub.emit({
      type: "approval.rejected",
      caseId: pending.caseId,
      approvalId: req.approvalId,
      decidedBy,
      reason: req.reason,
    });
    setCasePhase(this.db, pending.caseId, "PORTAL_FILL");
    this.hub.emit({
      type: "agent.thought",
      caseId: pending.caseId,
      text: "Operator rejected the amendment — holding for manual review.",
    });
    this.pending = null;
    return { resumed: false, handled: true };
  }

  /** Manual wake for demo (POST /api/agent/wake/:caseId). */
  async wakeCase(caseId: string): Promise<void> {
    const ctx = loadCaseContext(this.db, caseId);
    if (!ctx) throw new Error("Case not found");
    const day = ctx.case.dayCount + 1;
    this.db.prepare("UPDATE cases SET day_count = ?, orchestrator_phase = 'WAKE', sleep_until = NULL WHERE id = ?").run(
      day,
      caseId,
    );
    kvSet(this.db, "demo_day", String(Math.min(3, day)));
    kvSet(this.db, "active_case", caseId);

    const recap = await this.memory.buildWakeRecap(caseId, ctx.case.shipperId);
    this.hub.emit({ type: "agent.wake", caseId, recap }, { day });
    await this.memory.recallAsync(
      caseId,
      ctx.case.shipperId,
      "customs case context shipper patterns",
      "Restoring context after sleep",
      3,
      { day },
    );
    setCasePhase(this.db, caseId, "RESOLVED");
    this.hub.emit(
      {
        type: "case.status_changed",
        caseId,
        from: ctx.case.status,
        to: "RESOLVED",
        reason: "Declaration cleared after amendment review",
      },
      { day },
    );
    this.hub.emit(
      {
        type: "agent.thought",
        caseId,
        text: "Customs confirmed clearance. Case resolved — learned pattern saved for future shipments from this shipper.",
      },
      { day },
    );
    await this.memory.consolidateShipperPattern(
      ctx.case.shipperId,
      `${ctx.shipper?.name ?? "Shipper"}: verify invoice totals by phone on valuation holds before amending.`,
      `Learned from case ${ctx.case.reference}`,
      { caseId, day },
    );
    this.hub.broadcastState();
  }

  private async runCase(caseId: string, fromWake = false): Promise<void> {
    if (this.running.has(caseId)) return;
    this.running.add(caseId);
    kvSet(this.db, "active_case", caseId);
    kvSet(this.db, "agent_status", "active");

    try {
      const ctx = loadCaseContext(this.db, caseId);
      if (!ctx?.shipper || !ctx.declarationId) {
        console.error(`[orchestrator] missing context for ${caseId}`);
        return;
      }

      const { case: rec, shipper } = ctx;
      const day = rec.dayCount;
      let phase = (rec.orchestratorPhase ?? "INTAKE") as OrchestratorPhase;

      if (fromWake || phase === "WAKE") {
        await this.wakeCase(caseId);
        return;
      }

      if (phase === "SLEEPING") {
        const until = rec.sleepUntil;
        if (until && Date.parse(until) > Date.now()) {
          this.hub.emit({
            type: "agent.thought",
            caseId,
            text: `Still sleeping until ${until}. Use wake endpoint or wait for scheduler.`,
          });
          return;
        }
        await this.wakeCase(caseId);
        return;
      }

      // ── INTAKE ──
      if (phase === "INTAKE") {
        setCasePhase(this.db, caseId, "INTAKE");
        this.hub.emit(
          {
            type: "agent.thought",
            caseId,
            text: `New case ${rec.reference} — importer passport ${rec.importerPassportId ?? "on file"}. Declaration ${rec.declarationRef} on TradeGate.`,
          },
          { day },
        );
        await this.memory.recallAsync(
          caseId,
          rec.shipperId,
          "valuation hold procedure shipper invoice",
          "Loading broker SOP and shipper history",
          3,
          { day },
        );

        const needsCall =
          Math.abs(rec.shipment.declaredValue - rec.shipment.invoiceValue) > 0.01;
        if (needsCall) {
          this.hub.emit(
            {
              type: "case.status_changed",
              caseId,
              from: rec.status,
              to: "AWAITING_SHIPPER",
              reason: "Declared value vs invoice mismatch — calling shipper",
            },
            { day },
          );
          phase = "CALLING_SHIPPER";
          setCasePhase(this.db, caseId, "CALLING_SHIPPER");
        } else {
          phase = "PORTAL_FILL";
          setCasePhase(this.db, caseId, "PORTAL_FILL");
        }
      }

      // ── CALLING_SHIPPER ──
      if (phase === "CALLING_SHIPPER") {
        const shipperRow = {
          id: shipper.id,
          name: shipper.name,
          city: shipper.city,
          country: shipper.country,
          countryCode: shipper.country_code,
          language: shipper.language,
          languageCode: shipper.language_code,
          phone: shipper.phone,
          learnedPatterns: JSON.parse(shipper.learned_patterns),
        };
        const voiceFn =
          this.voiceMode === "twilio"
            ? runTwilioVoiceCall
            : this.voiceMode === "browser"
              ? runBrowserVoiceCall
              : runMockVoiceCall;
        const voiceResult = await voiceFn(this.hub, this.memory, {
          caseId,
          case: rec,
          shipper: shipperRow,
          day,
        });
        if (voiceResult.confirmedValue > 0) {
          this.voiceConfirmedValues.set(caseId, voiceResult.confirmedValue);
        }
        phase = "PORTAL_FILL";
        setCasePhase(this.db, caseId, "PORTAL_FILL");
      }

      // ── PORTAL_FILL ──
      if (phase === "PORTAL_FILL") {
        const correctedValue =
          this.voiceConfirmedValues.get(caseId) ?? rec.shipment.invoiceValue;
        this.hub.emit(
          {
            type: "agent.thought",
            caseId,
            text: `Opening TradeGate to amend declaration ${rec.declarationRef} — correcting declared value to ${rec.shipment.currency} ${correctedValue.toFixed(2)} (confirmed on call).`,
          },
          { day },
        );
        const { diff } = await runPortalAmend(
          this.hub,
          {
            caseId,
            declarationId: ctx.declarationId,
            declarationRef: rec.declarationRef,
            correctedValue,
            currency: rec.shipment.currency,
            day,
          },
          this.computerUseMode,
        );

        const approvalId = `apr-${caseId}-${Date.now()}`;
        setCasePhase(this.db, caseId, "AWAITING_APPROVAL", { pendingApprovalId: approvalId });
        this.hub.emit(
          {
            type: "case.status_changed",
            caseId,
            from: "AWAITING_SHIPPER",
            to: "PENDING_APPROVAL",
            reason: "Amendment ready — awaiting operator approval before submit",
          },
          { day },
        );

        await this.waitForApproval(caseId, approvalId, diff, async () => {
          await runScriptedPortalSubmit(this.hub, {
            caseId,
            declarationId: ctx.declarationId!,
            declarationRef: rec.declarationRef,
            correctedValue,
            currency: rec.shipment.currency,
            day,
          });
          this.memory.write(
            {
              type: "episodic",
              caseId,
              content: `Amendment submitted on TradeGate with operator approval: declared value corrected to ${rec.shipment.currency} ${correctedValue.toFixed(2)}.`,
              source: "TradeGate portal session",
            },
            { caseId, day },
          );
          this.voiceConfirmedValues.delete(caseId);
          await this.goToSleep(caseId, day);
        });
      }
    } catch (err) {
      console.error(`[orchestrator] case ${caseId} error:`, err);
      this.hub.emit({
        type: "agent.thought",
        caseId,
        text: `Encountered an error: ${err instanceof Error ? err.message : String(err)}. Check agent logs.`,
      });
    } finally {
      this.running.delete(caseId);
    }
  }

  private waitForApproval(
    caseId: string,
    approvalId: string,
    diff: import("@clearborder/shared").FieldDiff[],
    onApprove: () => Promise<void>,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.hub.emit({
        type: "approval.requested",
        caseId,
        approvalId,
        summary: `Submit amendment to FCBA: declared value correction on case ${caseId}.`,
        risk: "Irreversible submission to the Federal Customs & Border Authority.",
        diff,
      });
      this.pending = {
        caseId,
        approvalId,
        resume: () => {
          void onApprove().then(resolve);
        },
      };
    });
  }

  private async goToSleep(caseId: string, day: number): Promise<void> {
    const compressionMs = Number(process.env.DEMO_TIME_COMPRESSION ?? 30_000);
    const until = new Date(Date.now() + compressionMs).toISOString();
    setCasePhase(this.db, caseId, "SLEEPING", { sleepUntil: until });
    this.hub.emit(
      {
        type: "case.status_changed",
        caseId,
        from: "PENDING_APPROVAL",
        to: "SLEEPING",
        reason: "Amendment submitted — awaiting customs review",
      },
      { day },
    );
    this.hub.emit(
      {
        type: "agent.sleep",
        caseId,
        until,
        reason: "Customs review typically takes until the next business day",
      },
      { day },
    );
    this.hub.broadcastState();
  }

  private startWakeScheduler(): void {
    const tick = () => {
      const rows = this.db
        .prepare(
          `SELECT id FROM cases WHERE orchestrator_phase = 'SLEEPING' AND sleep_until IS NOT NULL AND sleep_until <= ?`,
        )
        .all(new Date().toISOString()) as Array<{ id: string }>;
      for (const row of rows) {
        void this.wakeCase(row.id);
      }
    };
    this.wakeTimer = setInterval(tick, 5000);
    tick();
  }

  destroy(): void {
    if (this.wakeTimer) clearInterval(this.wakeTimer);
  }
}
