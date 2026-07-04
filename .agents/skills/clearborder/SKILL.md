---
name: clearborder
description: Build ClearBorder, a B2B customs-clearance agent that chains Live Translate,
  a persistent CaseFile (load-bearing), and Gemini Computer Use, with a pixel-agents office shell.
  Load whenever building any ClearBorder component.
---

# ClearBorder build rules

## What we are building
An autonomous customs-clearance agent for SME exporters/brokers. Clearance takes days; the product's
whole value is that state survives session close and resumes each morning exactly where it stopped.

## The chain (never break the order)
Live Translate (call) -> persistent CaseFile detects a discrepancy -> Computer Use amends the mock
portal -> human confirms -> session closes -> resume(environmentId) next day.

## Load-bearing primitive
The persistent CaseFile. Everything depends on the `CaseStore` interface. Default to `LocalCaseStore`
for demos; `InteractionsCaseStore` only if the preview API is confirmed stable. Persistence-survives-
restart is the definition of done for Phase 2.

## Hard rules
- Never contact any real government/customs system. The portal is a local mock.
- Computer Use must HALT before Submit and require explicit human approval.
- All secrets stay in `server/`. The console gets ephemeral tokens only.
- No legal/regulatory advice. Stay on coordination/clearance.
- Banned categories to avoid: mental health, basic RAG, Streamlit, dashboard-as-main-feature, hardware/drone.
  The office view is a game-like control room, not a dashboard.

## Demo golden path (keep runnable)
scripts/demo/golden-path runs Day 1 (call->discrepancy->correction->confirm->close) and Day 2
(resume->retrieve validated correction->submit) with recorded audio and CASE_STORE=local.
