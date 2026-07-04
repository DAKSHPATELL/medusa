# ClearBorder V2 — Production Specification

**Hackathon:** Google DeepMind Statement Four (Persistent Multi-Primitive Agents)  
**Build window:** 24h  
**Date:** July 5, 2026

---

## Overview

ClearBorder V2 is a minimalist **sender app** for customs document correction. No dashboards, no analytics — only a transactional **Upload → Process → Verify** flow with a human-in-the-loop gate before irreversible portal submission.

The agent fills the mock customs portal but **cannot** click the final submit button (`#gatekeeper-submit-btn`). A broker must review the diff and approve before submission.

---

## Stack

| Layer | Technology | Port |
| --- | --- | --- |
| Frontend | Next.js sender app | 3001 |
| Backend | FastAPI (Python) | 8000 |
| State store | SQLite + SQLAlchemy | — |
| Extract | Gemini 2.5 Flash (multimodal) | — |
| Execute | Gemini 3.5 Flash computer use + Playwright | — |
| Exception fallback | Gemini Live Translate stub | — |

**Environment:** `GEMINI_API_KEY` in `.env` (never commit).

---

## State Machine

```
PENDING_UPLOAD → EXTRACTED → PORTAL_SYNCING → AWAITING_APPROVAL → COMPLETED
                                              ↘ EXCEPTION_HOLD
```

| State | Meaning |
| --- | --- |
| `PENDING_UPLOAD` | Environment created, awaiting invoice |
| `EXTRACTED` | Gemini parsed invoice JSON; triggers portal sync |
| `PORTAL_SYNCING` | Playwright + computer use filling mock portal |
| `AWAITING_APPROVAL` | Draft saved; broker must approve diff |
| `COMPLETED` | Broker approved; ready for manual portal submit |
| `EXCEPTION_HOLD` | Sync or approval failure; Live translate stub available |

Persistent backbone: **`environment_id`** in SQLite. Agent rehydrates on backend restart.

---

## End-to-End Flow

1. **Upload** — Sender drags Commercial Invoice PDF/image onto the sender app.
2. **Extract** — `POST /api/upload` sends file to Gemini 2.5 Flash; returns JSON:
   - `waybill_id`, `declared_value`, `currency`, `hs_codes`, `shipper_country`, `preferred_language`
3. **Hydrate** — Backend writes `EnvironmentState` to SQLite keyed by `environment_id`.
4. **Portal sync** — Background task navigates to `http://localhost:8000/mock-customs/login`, logs in, searches waybill, updates declared value, checks freight-inclusive, saves draft.
5. **Halt** — Automation stops at `AWAITING_APPROVAL`. **`#gatekeeper-submit-btn` is never clicked.**
6. **Verify** — Frontend polls `GET /api/state/{environment_id}`, shows old vs new declared value diff, **Approve Document Modification** button → `POST /api/approve/{environment_id}`.
7. **Complete** — State → `COMPLETED`. Broker manually submits on mock portal.

---

## API

### `POST /api/upload`

Multipart form: `file` (PDF or image).

Response:

```json
{
  "environment_id": "env_…",
  "state": "EXTRACTED",
  "extracted": {
    "waybill_id": "WB-2026-448291",
    "declared_value": 2400.0,
    "currency": "USD",
    "hs_codes": ["8471.30"],
    "shipper_country": "CN",
    "preferred_language": "zh"
  }
}
```

### `GET /api/state/{environment_id}`

Full state snapshot including `execution_logs`, portal values, and approval diff.

### `POST /api/approve/{environment_id}`

Body (optional): `{ "approved": true }`. Transitions `AWAITING_APPROVAL` → `COMPLETED` after verifying declared value matches extraction.

---

## Mock Customs Portal

**URL:** `http://localhost:8000/mock-customs/login`  
**Credentials:** `broker.demo` / `clearborder2026`  
**Seed waybill:** `WB-2026-448291` (portal original declared value: `240.00`)

### DOM Selectors (automation contract)

| Purpose | Selector |
| --- | --- |
| Username | `#customs-user` |
| Password | `#customs-pass` |
| Login | `#login-submit` |
| Case search | `input[data-testid='portal-search']` |
| Declared value | `input[name='declared_value_field']` |
| Freight inclusive | `input#freight-inclusive-checkbox` |
| Save draft | `button.save-draft-action` |
| **BLOCKED (human only)** | `#gatekeeper-submit-btn` |

---

## Repo Structure

```
clearborder-root/
├── backend/                 # FastAPI, port 8000
├── frontend/                # Next.js sender app, port 3001
├── clearborder_v2_spec.json
├── CLEARBORDER_V2_SPEC.md
└── README.md
```

V1 monorepo (`apps/web`, `apps/agent`) coexists; V2 runs independently via README instructions.

---

## Tests

1. **Upload:** `curl -F file=@backend/fixtures/mock_invoice.pdf http://localhost:8000/api/upload`
2. **Hydration:** `verify_state_hydration('env_test_id')` — asserts SQLite row exists with expected fields after seed/test upload.

---

## Robustness Requirements

- Loop detection in computer use (max steps).
- Verify `declared_value` matches extraction before `COMPLETED`.
- Block `#gatekeeper-submit-btn` in all automation code paths.
- State persistence survives backend restart.
- Fallback to scripted Playwright when Gemini computer use fails.

---

## UI Constraints

- Mobile-responsive, `bg-slate-50`, Lucide icons.
- Loading copy: "File Processing…" → "Syncing with Customs Portal…" → "Awaiting Broker Sign-off".
- **No** charts, dashboards, or analytics.
