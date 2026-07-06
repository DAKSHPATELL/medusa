# ClearBorder

**Your customs broker, replaced by a team of AI agents.**

When a shipment is held at customs over a paperwork discrepancy, clearing it is slow, manual broker
work that drags on for days. ClearBorder is an agent team that does that job: it **calls the supplier
with live two-way translation**, **remembers every detail in a persistent case file**, **drives the
customs portal like a human** to amend the declaration, and **pauses for one human approval** before
anything irreversible is submitted — then **closes for the day and resumes the next morning exactly
where it left off**.

Built for the RAISE Summit × Google DeepMind hackathon, **Statement Four — Persistent Multi-Primitive
Agents**: three Gemini primitives chained so each one fires *because* the previous one ran.



---

## The chain (this is the whole product)

```
  Live Translate            Persistent CaseFile           Computer Use              Human gate
 ┌───────────────┐         ┌────────────────────┐        ┌──────────────┐         ┌───────────┐
 │ Call the      │ a fact  │ Detect the         │ an open│ Amend the    │ halts   │ Approve → │
 │ supplier,     │────────▶│ discrepancy and    │───────▶│ customs      │────────▶│ submit    │
 │ capture facts │         │ REMEMBER it        │  issue │ portal       │ before  │ Reject →  │
 └───────────────┘         └────────────────────┘        └──────────────┘ Submit  │ no-op     │
                                     ▲                                             └───────────┘
                                     │  resume(environmentId)
                            ┌────────┴─────────┐
                            │ Close for the day│  ← state survives process death and
                            │ · wake next day  │    rehydrates on the next "day"
                            └──────────────────┘
```

The **persistent CaseFile is load-bearing**: the Computer Use step only happens because the CaseFile
flagged a specific discrepancy, and the whole case can be killed mid-flight and resumed the next day
from its `environmentId`. That resume-after-restart behaviour is proven by an automated test (below).

---

## The demo scenario

One coherent case runs through every surface:

- A container of **solar panels** ships **Shenzhen → Hamburg** (`SHIP-2026-CBR-001`).
- EU customs **holds** it: the **invoice value (€47,250)** and the **packing-list value (€45,000)**
  disagree.
- The Translator agent **calls the Chinese supplier**; the supplier confirms the invoice is correct —
  it includes CIF freight (€2,250). That fact lands in the CaseFile.
- The CaseFile **detects the mismatch**; the Portal agent **corrects the packing-list value to €47,250**
  on the customs portal and **stops before Submit**.
- A human **approves**, the correction is submitted, and the container clears.

No dashboards, no analytics screens. You watch the **agents do the work** in a pixel-art office.

---

## Architecture

One TypeScript monorepo, one backend, thin purpose-built frontends. All secrets live in the server.

| Package | Port | What it is |
|---|---|---|
| **`server/`** | 3001 | Fastify + WebSocket **event bus**. Owns the `CaseStore` (SQLite), Live Translate, the Computer Use loop, and the human-approval gate. The single source of truth. |
| **`portal/`** | 5174 | Mock **EU "Single Window" customs portal** — the website the Portal agent drives with Computer Use. |
| **`office/`** | 5175 | The **hero demo**: a pixel-art office where the Translator, Case-file, and Portal agents visibly work, driven by live server events (7 scenes). A game-like control room — *not* a dashboard. |
| **`console/`** | 5173 | An **operator surface** that runs the same pipeline manually: read the supplier message, capture facts, detect, fix with the agent, approve, close & resume. |
| **`admin/`** | 5176 | Back-office **order editor** for *Live Product Mode* — edit an order's values and the agent notices and reconciles the held case on its own. |
| **`packages/core`** | — | The `CaseFile` / `CaseStore` contract every part depends on. |

Every frontend talks to the server over the same WebSocket event stream
(`case_created`, `fact_captured`, `discrepancy_detected`, `computer_use_step`, `computer_use_frame`,
`needs_confirmation`, `correction_submitted`, `resumed`, `day_closed`, …) plus REST for commands.

---

## Quick start

Requirements: Node ≥ 20, `pnpm`. (For the live Computer Use path only: a Gemini API key and
`npx playwright install chromium`.)

```bash
pnpm install
cp .env.example .env      # runs fully offline as-is (no key needed)
pnpm dev                  # starts server + portal + office + console
```

Then open:

- **http://localhost:5175** — the office demo (press **Space** / click to advance the 7 scenes)
- **http://localhost:5173** — the operator console
- **http://localhost:5174** — the mock customs portal the agent drives

### Two run modes

- **Demo mode (default, `DEMO_MODE=true`, no API key).** The Live Translate call and the portal steps
  are deterministic and scripted — fully offline, safe for a recorded video. Every event, the CaseFile,
  and the approval gate are real.
- **Live mode (`GEMINI_API_KEY` set, `DEMO_MODE=false`, `COMPUTER_USE_MODE=live`).** Real Gemini
  Computer Use (`gemini-2.5-computer-use-preview-*`) drives the portal in a headless browser and streams
  live screenshots into the office. It is **physically gated**: the loop refuses to click Submit; only a
  human `POST /confirm` submits.

### Run the live demo (real Gemini Computer Use)

```bash
# 1. one-time: install the browser the agent drives
npx playwright install chromium

# 2. put a real key in .env
echo "GEMINI_API_KEY=sk-...your-key..." >> .env

# 3. start the live stack (server in live mode + portal + office)
pnpm demo:live
```

Then open **http://localhost:5175** and press **Space** to walk through the story. At Scene 4 the
Portal agent launches a real headless Chromium, logs into the EU portal at :5174, corrects the value,
and **streams its live screen into the office** — and stops at the approval gate. Click **Approve** to
let it submit. If the key or model is unavailable, it falls back to the scripted path automatically, so
the demo never hard-fails. (Models are Gemini previews — re-verify `CU_MODEL` in `.env` before a run.)

### Watch the agent drive the portal (no key needed)

To *see* the browser automation clicking the real portal without a Gemini key:

```bash
pnpm dev:portal                       # serve the customs portal on :5174
HEADLESS=false OUT=/tmp/cb-drive node scripts/watch-agent-drive-portal.mjs
```

A real Chromium window opens, navigates the EU portal, clicks the *Packing List Value* field, types
the corrected €47,250.00, and **stops at Submit**. This runs the same Playwright engine the Computer
Use agent uses — in full live mode Gemini decides each action from screenshots; here the actions are
fixed so you can watch the mechanics. (Screenshots land in `OUT` if set.)

### Live Product Mode (persistence, made visible)

Beyond the pitch demo, the server runs a **memory-session worker**: it resumes each registered case on
an interval (and on instant triggers), diffs the linked order's version, and reconciles *only on a real
change* — an idempotent resume→diff→act loop. Run the admin editor (`pnpm dev:admin`, :5176), change an
order value, and watch the agent notice and re-open the case on its own. This is the "an agent that
forgets is useless" thesis as a running product, not a script.

---

## The persistence proof

The Statement-Four claim — "it resumes exactly where it stopped" — is a test, not a promise:

```bash
pnpm test        # server: 13 tests, incl. the cold-restart suite
```

`server/src/case-store/restart-test.ts` writes a full case, **closes the database (simulating process
death)**, opens a brand-new store on the same file, calls `resume(environmentId)`, and asserts every
field survived byte-for-byte and the "day" counter advanced.

---

## Safety

- The portal is a **local mock**. ClearBorder never touches a real government system.
- Computer Use **must halt before Submit**; the final submission happens only on explicit human
  approval (`POST /api/cases/:id/confirm`) — enforced in code, not just by prompt.
- All API keys stay in the server; browser surfaces receive short-lived ephemeral tokens only.

---

## Project structure

```
clearborder/
├── server/            # Fastify + WS backend — CaseStore, Live Translate, Computer Use, gate
│   └── src/
│       ├── index.ts               # HTTP + WebSocket routes
│       ├── events.ts              # the broadcast event bus
│       ├── case-store/            # SQLite CaseStore (+ cold-restart test)
│       ├── live-translate.ts      # Gemini Live Translate (scripted demo fallback)
│       ├── computer-use.ts        # correction engine + human-approval gate
│       └── computer-use-live.ts   # real Gemini Computer Use → the portal
├── portal/            # mock EU "Single Window" customs portal (Computer Use target)
├── office/            # pixel-art office demo (the hero visual)
├── console/           # operator surface
├── admin/             # back-office order editor (Live Product Mode trigger)
├── packages/core/     # CaseFile / CaseStore contract
└── archive/           # preserved-for-reference code, not part of the build
```

Design notes for the original 24-hour build live in
[`ClearBorder-implementation-plan.md`](ClearBorder-implementation-plan.md) and
[`ClearBorder-demo-mode-plan.md`](ClearBorder-demo-mode-plan.md).
