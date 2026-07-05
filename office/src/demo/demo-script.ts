import { Beat } from "./types";

// =====================================================
// Demo Script — 11 beats across 7 scenes
// =====================================================
// Scenes 1-3: emotional setup (fast)
// Scene 4: THE PRODUCT (slow, agents work from real pipeline)
// Scenes 5-6: resolution
//
// One coherent case throughout: a container of solar panels shipped from
// Shenzhen to Hamburg is held at EU customs over a value mismatch. ClearBorder
// is the AI agent team that does the customs broker's job and clears it.

const DEMO_SCRIPT: Beat[] = [
  // ── Scene 0: Intro ──
  {
    id: 1, scene: 0, step: "Intro", actor: "—", type: "intro",
    payload: {
      title: "ClearBorder",
      body: "Your customs broker, replaced by a team of AI agents. They call the supplier with live translation, remember every detail in a persistent case file, and drive the customs portal — pausing only for your one approval before anything is submitted.",
      buttonLabel: "Start Demo",
    },
  },

  // ── Scene 1: Importer worried ──
  {
    id: 2, scene: 1, step: "Shipment stuck", actor: "Importer", type: "speech",
    autoAdvanceMs: 5000,
    payload: {
      character: "joan",
      text: "Our solar panels are stuck at customs. The site connects to the grid next week — we can't miss it.",
      emotion: "worried",
    },
  },
  {
    id: 3, scene: 1, step: "Shipment stuck", actor: "Importer", type: "speech",
    autoAdvanceMs: 4000,
    payload: {
      character: "joan",
      text: "And our broker is buried — no one has even opened the file.",
      emotion: "worried",
    },
  },

  // ── Scene 2: Importer escalates ──
  {
    id: 4, scene: 2, step: "Case handed off", actor: "Importer", type: "emailSent",
    // Long enough to walk, type, and for the message to fully send
    // ("Sent ✓" ~6.1s + fly-off ~7.1s) before advancing to scene 3.
    autoAdvanceMs: 8000,
    payload: {
      from: "SolarTech GmbH — Logistics",
      to: "ClearBorder",
      subject: "Container held at Hamburg — SHIP-2026-CBR-001",
      body: "Our container of PV modules (SHIP-2026-CBR-001, Shenzhen → Hamburg) is held at customs for a value discrepancy. We need it cleared before the grid connection. Please take the case. — SolarTech Logistics",
    },
  },

  // ── Scene 3: The customs hold ──
  {
    id: 5, scene: 3, step: "Customs hold", actor: "Retailer", type: "containerStatus",
    autoAdvanceMs: 6000,
    payload: {
      status: "held",
      label: "🔴 Container MSKU-7742210 — HELD at EU Customs (Hamburg)",
      retailerSpeech: "Invoice vs. packing-list value mismatch. ClearBorder is on it — no broker needed.",
    },
  },

  // ── Scene 4: ClearBorder takes over (THE CORE) ──
  {
    id: 6, scene: 4, step: "Live Translate", actor: "Translator", type: "pipeline",
    autoAdvanceMs: 10000,
    payload: {
      action: "translate",
      description: "Translator calls the Shenzhen supplier and captures the trade facts",
    },
  },
  {
    id: 7, scene: 4, step: "Discrepancy", actor: "Case-file", type: "pipeline",
    autoAdvanceMs: 6000,
    payload: {
      action: "detect",
      description: "CaseFile detects: invoice €47,250 ≠ packing list €45,000",
    },
  },
  {
    id: 8, scene: 4, step: "Portal fix", actor: "Portal", type: "pipeline",
    // No autoAdvance — waits for Computer Use to finish
    payload: {
      action: "computerUse",
      description: "Portal agent corrects the declared value on the EU customs portal",
    },
  },
  {
    id: 9, scene: 4, step: "Approval", actor: "Operator", type: "waitForApproval",
    requiresApproval: true,
    payload: {
      prompt: "The Portal agent has prepared the correction and stopped before Submit. Approve to submit, or reject to cancel.",
    },
  },

  // ── Scene 5: Cleared ──
  {
    id: 10, scene: 5, step: "Cleared", actor: "—", type: "containerStatus",
    autoAdvanceMs: 4000,
    payload: {
      status: "cleared",
      label: "🟢 Container MSKU-7742210 — CLEARED by EU Customs",
    },
  },

  // ── Scene 6: Delivered ──
  {
    id: 11, scene: 6, step: "Delivered", actor: "Importer", type: "speech",
    payload: {
      character: "joan",
      text: "Cleared and delivered — the panels are on site in time. ☀️",
      emotion: "happy",
    },
  },
];

export default DEMO_SCRIPT;
