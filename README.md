# ClearBorder

**The AI agent that gets packages out of customs.**

A package is stuck at the border: the shipper fat-fingered the declared value ($240.00 instead of $2,400.00). ClearBorder picks up the case, **calls the shipper in Mandarin** (translating live in both directions), **operates the customs portal like a human** — finds the case, corrects the error, and pauses for your approval before anything irreversible — then **goes to sleep and wakes up the next day** exactly where it left off, across as many days as the case takes. Along the way it builds **persistent memory**: episodic (what happened), semantic (what it knows), procedural (how things are done) — and learns shipper-specific patterns it applies to future cases.

Built for a Google DeepMind competition on agents with persistent memory over long-horizon tasks.

---

## Quickstart

```bash
pnpm install
pnpm seed     # create + populate data/clearborder.db (idempotent, resets demo state)
pnpm dev      # web on :3000, agent service on :8787
```

| Surface | URL | Notes |
| --- | --- | --- |
| **Mission Control** (the demo) | http://localhost:3000 | Press **`D`** → play **Day 1 / 2 / 3** |
| **TradeGate** (mock customs portal) | http://localhost:3000/portal/login | `a.mercier` / `demo2026` |
| Agent service health | http://localhost:8787/health | WS `/ws` · SSE `/events` |

No `.env` needed for the foundation demo. Copy `.env.example` → `.env` when wiring Gemini/Twilio (the seed stamps `SHIPPER_PHONE_NUMBER` onto the hero shipper record).

### Running the demo

1. Open the dashboard, press **`D`**, click **Day 1**. The agent discovers the valuation hold, calls the shipper (live zh↔en transcript in the right panel), amends the declaration on TradeGate, and stops at an **approval card** — click **Approve & submit**. The agent finishes the submission and goes to sleep.
2. Press **`D`** → **Day 2**: the agent wakes with a recap, finds the customs officer's new document request, recalls the needed certificate **from a case it handled in March**, uploads it, sleeps again.
3. Press **`D`** → **Day 3**: declaration cleared. The agent writes the learned pattern (*"this shipper misplaces decimals — call first"*) to the shipper's profile.

**Reset demo state** any time from the `D` menu, or `pnpm seed`.

---

## Monorepo

```
apps/
  web/      Next.js (App Router, TS strict, Tailwind v4)
            ├─ /            mission-control dashboard (dark, driven by the AgentEvent stream)
            └─ /portal      "TradeGate" — mock government customs portal (own visual identity)
  agent/    Fastify service: AgentEvent hub (WebSocket /ws + SSE /events), SQLite
            persistence, seed script, scripted demo replayer
packages/
  shared/   THE CONTRACT — AgentEvent union, Case/Shipper/MemoryRecord models,
            wire protocol, portal domain types + data-testid registry
data/       clearborder.db (SQLite, WAL) — created by seed, gitignored
scripts/    verify.ts — Playwright visual verification (pnpm verify, needs dev running)
```

Both apps open the **same SQLite file**, so portal amendments genuinely persist and the audit log grows — the state judges see is real.

## The AgentEvent contract (`packages/shared`)

Everything the dashboard renders arrives as one discriminated union over WS/SSE — future workstreams emit these instead of the replayer:

| Family | Types | Key payload |
| --- | --- | --- |
| Case | `case.status_changed` | `from` / `to` (`HELD_VALUATION`, `PENDING_APPROVAL`, `SLEEPING`, `RESOLVED`, …), `reason` |
| Reasoning | `agent.thought` | `text` |
| Calls | `call.started`, `call.transcript_partial/_final`, `call.ended` | `speaker`, `sourceLang`, `targetLang`, `sourceText`, `translatedText`, `durationSec`, `summary` |
| Browser | `browser.action`, `browser.screenshot` | `action` (click/type/navigate), `description`, `coordinates`, `targetTestId`, screenshot `ref` (path or base64) |
| Memory | `memory.read`, `memory.write` | full `MemoryRecord` (`episodic`/`semantic`/`procedural`) + `why` on reads |
| Approvals | `approval.requested/granted/rejected` | `summary`, `risk`, `diff[]` (before → after) |
| Long-horizon | `agent.sleep`, `agent.wake` | `until`, `recap` |

Envelope on every event: `id`, `seq` (ordering), `at` (ISO), `day` (drives the DAY separators), `caseId`.

### Agent service API

- `GET /api/state` — snapshot (cases, shippers, demo state, event backlog)
- `POST /api/approval` — `{ approvalId, decision: "approve" | "reject" }` (the dashboard's approval buttons post here)
- `POST /api/demo/replay` — `{ day?: 1|2|3, speed?: number }`
- `POST /api/demo/reset` — pristine re-seed
- Emitting events (for the orchestrator/call/browser workstreams): go through `EventHub.emit(AgentEventInput)` in `apps/agent/src/hub.ts` — it assigns the envelope, persists, applies side effects (case status, memory recall stamps, agent status) and broadcasts.

## TradeGate portal notes (for the browser-automation workstream)

- Big, high-contrast, stable controls; no animations. Key controls carry `data-testid` (registry in `packages/shared/src/portal.ts`, e.g. `amend-declared-value`, `review-submit`, `confirm-submit`).
- Amend flow: case → **Amend declaration** → edit → **Continue to review** → diff table → truthfulness checkbox → **Submit amendment** → confirmation modal. The modal is the human-in-the-loop moment.
- Correspondence tab has the Day-2 officer message (VAT certificate request) and the reply + document upload form.
- Login: `a.mercier` / `demo2026` (also printed by `pnpm seed`).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | web + agent concurrently |
| `pnpm seed` | reset + seed the database (prints portal credentials) |
| `pnpm typecheck` | strict TS across all packages |
| `pnpm build` | `next build` + typechecks |
| `pnpm verify [portal\|dashboard]` | Playwright screenshots into `verification/` (needs `pnpm dev` running; re-seeds when done) |

## What's deliberately stubbed (foundation scope)

- **No Gemini / Twilio** — the live-call workstream replaces the scripted transcript events.
- **No real browser automation / memory engine / orchestrator** — the **demo replayer** (`apps/agent/src/script.ts`) emits the full three-day hero story as real AgentEvents so the dashboard is demoable end-to-end today.
- The replayer updates agent-domain state (case status, memories, learned patterns) but does **not** operate the portal; portal state changes only through the portal UI itself.
- Portal "documents" store metadata (+ uploaded files under `data/uploads/`); PDFs aren't rendered.
- `apps/web/public/demo/*.png` are portal captures generated by `pnpm verify`, referenced by the replayer's `browser.screenshot` events.
