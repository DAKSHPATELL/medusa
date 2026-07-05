---
name: clearborder
description: Build ClearBorder, a B2B customs-clearance agent that chains Live Translate,
  a persistent CaseFile (load-bearing), and Gemini Computer Use, with a pixel-agents office shell.
  Load whenever building any ClearBorder component.
---

# ClearBorder build rules

## What we are building
ClearBorder replaces the human customs broker with a team of AI agents. When a shipment is held at
customs over a document discrepancy, the agents call the supplier (with live translation), remember
every detail in a persistent CaseFile, drive the customs portal to amend the declaration, and pause
for one human approval before submitting. Clearance takes days; the product's whole value is that state
survives session close and resumes each morning exactly where it stopped.

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
`pnpm dev` starts the server (:3001), portal (:5174), office (:5175), and console (:5173). The office
at :5175 plays the 7-scene story driven by real server events; the console at :5173 runs the same
pipeline manually (capture facts -> detect -> fix with agent -> approve -> close session -> resume).
Both must stay runnable with no API key (DEMO_MODE=true) and CASE_STORE=local.
