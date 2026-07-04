"""ClearBorder V2 — FastAPI backend (port 8000)."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from database import (
    EnvironmentState,
    MockPortalCase,
    WorkflowState,
    get_db,
    init_db,
    verify_state_hydration,
)
from models.gemini_client import extract_invoice, live_translate_stub
from schemas import ApproveRequest, ApproveResponse, ExecutionLogEntry, StateSnapshot, UploadResponse
from services.portal_sync import schedule_portal_sync
from state_machine import transition

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clearborder.v2")

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

MOCK_PORTAL_USER = os.getenv("MOCK_PORTAL_USER", "broker.demo")
MOCK_PORTAL_PASS = os.getenv("MOCK_PORTAL_PASS", "clearborder2026")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    _seed_test_environment()
    logger.info("ClearBorder V2 backend ready on :8000")
    yield


app = FastAPI(title="ClearBorder V2", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _seed_test_environment() -> None:
    """Pre-hydrate env_test_id for verify_state_hydration test case."""
    from database import SessionLocal

    with SessionLocal() as db:
        if db.get(EnvironmentState, "env_test_id"):
            return
        row = EnvironmentState(
            environment_id="env_test_id",
            state=WorkflowState.EXTRACTED.value,
            waybill_id="WB-2026-448291",
            declared_value=2400.0,
            currency="USD",
            shipper_country="CN",
            preferred_language="zh",
            source_filename="mock_invoice.pdf",
        )
        row.set_hs_codes(["8471.30"])
        row.set_extracted(
            {
                "waybill_id": "WB-2026-448291",
                "declared_value": 2400.0,
                "currency": "USD",
                "hs_codes": ["8471.30"],
                "shipper_country": "CN",
                "preferred_language": "zh",
            }
        )
        row.append_log("Seeded test environment for hydration verification")
        db.add(row)
        db.commit()


def _to_snapshot(env: EnvironmentState) -> StateSnapshot:
    diff = None
    if env.portal_original_value is not None and env.portal_new_value is not None:
        diff = {
            "field": "declared_value",
            "before": env.portal_original_value,
            "after": env.portal_new_value,
            "currency": env.currency or "USD",
        }

    logs = json.loads(env.execution_logs_json or "[]")
    return StateSnapshot(
        environment_id=env.environment_id,
        state=env.state,
        waybill_id=env.waybill_id,
        declared_value=env.declared_value,
        currency=env.currency,
        hs_codes=env.hs_codes(),
        shipper_country=env.shipper_country,
        preferred_language=env.preferred_language,
        portal_original_value=env.portal_original_value,
        portal_new_value=env.portal_new_value,
        exception_message=env.exception_message,
        source_filename=env.source_filename,
        execution_logs=[ExecutionLogEntry(**entry) for entry in logs],
        created_at=env.created_at,
        updated_at=env.updated_at,
        diff=diff,
    )


@app.get("/health")
def health():
    return {"ok": True, "service": "clearborder-v2-backend", "gemini": bool(os.getenv("GEMINI_API_KEY"))}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_invoice(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    extracted = await extract_invoice(content, mime, file.filename or "invoice")

    environment_id = f"env_{uuid.uuid4().hex[:12]}"
    env = EnvironmentState(
        environment_id=environment_id,
        state=WorkflowState.PENDING_UPLOAD.value,
        source_filename=file.filename,
    )
    env.append_log(f"Upload received: {file.filename}")
    db.add(env)
    db.commit()

    env.waybill_id = extracted.waybill_id
    env.declared_value = extracted.declared_value
    env.currency = extracted.currency
    env.shipper_country = extracted.shipper_country
    env.preferred_language = extracted.preferred_language
    env.set_hs_codes(extracted.hs_codes)
    env.set_extracted(extracted.model_dump())
    transition(env, WorkflowState.EXTRACTED, "Gemini extraction complete")
    env.append_log(f"Extracted waybill {extracted.waybill_id} value {extracted.declared_value}")
    db.commit()

    schedule_portal_sync(environment_id)

    return UploadResponse(
        environment_id=environment_id,
        state=env.state,
        extracted=extracted,
    )


@app.get("/api/state/{environment_id}", response_model=StateSnapshot)
def get_state(environment_id: str, db: Session = Depends(get_db)):
    env = db.get(EnvironmentState, environment_id)
    if env is None:
        raise HTTPException(404, "Environment not found")
    return _to_snapshot(env)


@app.post("/api/approve/{environment_id}", response_model=ApproveResponse)
def approve_environment(
    environment_id: str,
    body: ApproveRequest | None = None,
    db: Session = Depends(get_db),
):
    env = db.get(EnvironmentState, environment_id)
    if env is None:
        raise HTTPException(404, "Environment not found")

    approved = body.approved if body else True
    if env.state != WorkflowState.AWAITING_APPROVAL.value:
        raise HTTPException(409, f"Cannot approve from state {env.state}")

    if not approved:
        env.exception_message = "Broker rejected modification"
        transition(env, WorkflowState.EXCEPTION_HOLD, "Broker rejected")
        db.commit()
        return ApproveResponse(
            environment_id=environment_id,
            state=env.state,
            message="Rejected — moved to EXCEPTION_HOLD",
        )

    if env.declared_value is None or env.portal_new_value is None:
        raise HTTPException(422, "Missing declared values for verification")

    if abs(env.declared_value - env.portal_new_value) > 0.01:
        env.exception_message = (
            f"Value mismatch: extracted {env.declared_value} vs portal {env.portal_new_value}"
        )
        transition(env, WorkflowState.EXCEPTION_HOLD, "Value verification failed")
        db.commit()
        raise HTTPException(
            422,
            env.exception_message,
        )

    transition(env, WorkflowState.COMPLETED, "Broker approved document modification")
    env.append_log("COMPLETED — broker may now submit on portal (#gatekeeper-submit-btn)")
    db.commit()

    return ApproveResponse(
        environment_id=environment_id,
        state=env.state,
        message="Approved. Broker can submit on mock portal.",
    )


@app.get("/api/verify/hydration/{environment_id}")
def api_verify_hydration(environment_id: str):
    return verify_state_hydration(environment_id)


# ── Mock customs portal ──────────────────────────────────────────────────────


@app.get("/mock-customs/login", response_class=HTMLResponse)
def mock_login_page(request: Request):
    return templates.TemplateResponse(request, "mock_login.html", {})


@app.post("/mock-customs/login")
async def mock_login_submit(
    username: str = Form(...),
    password: str = Form(...),
):
    if username != MOCK_PORTAL_USER or password != MOCK_PORTAL_PASS:
        raise HTTPException(401, "Invalid credentials")
    return RedirectResponse("/mock-customs/dashboard", status_code=303)


@app.get("/mock-customs/dashboard", response_class=HTMLResponse)
def mock_dashboard(request: Request, q: str | None = None, db: Session = Depends(get_db)):
    cases = db.query(MockPortalCase).all()
    if q:
        cases = [c for c in cases if q.lower() in c.waybill_id.lower()]
        if len(cases) == 1:
            return RedirectResponse(f"/mock-customs/case/{cases[0].waybill_id}", status_code=303)
    return templates.TemplateResponse(
        request,
        "mock_dashboard.html",
        {"cases": cases, "query": q or ""},
    )


@app.get("/mock-customs/search")
def mock_search(q: str = "", db: Session = Depends(get_db)):
    return RedirectResponse(f"/mock-customs/dashboard?q={q}", status_code=303)


@app.get("/mock-customs/case/{waybill_id}", response_class=HTMLResponse)
def mock_case_edit(waybill_id: str, request: Request, draft: str | None = None, db: Session = Depends(get_db)):
    case = db.get(MockPortalCase, waybill_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    return templates.TemplateResponse(
        request,
        "mock_case_edit.html",
        {"case": case, "draft_saved": draft == "saved"},
    )


@app.post("/mock-customs/case/{waybill_id}/save-draft")
async def mock_save_draft(
    waybill_id: str,
    declared_value_field: str = Form(...),
    freight_inclusive: str | None = Form(None),
    db: Session = Depends(get_db),
):
    case = db.get(MockPortalCase, waybill_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    try:
        case.draft_value = float(declared_value_field.replace(",", ""))
    except ValueError:
        raise HTTPException(400, "Invalid declared value")
    case.freight_inclusive = "true" if freight_inclusive else "false"
    case.status = "DRAFT"
    db.commit()
    return RedirectResponse(f"/mock-customs/case/{waybill_id}?draft=saved", status_code=303)


@app.post("/mock-customs/case/{waybill_id}/gatekeeper-submit")
def mock_gatekeeper_submit(waybill_id: str, db: Session = Depends(get_db)):
    """Human-only endpoint — not called by automation."""
    case = db.get(MockPortalCase, waybill_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    if case.draft_value is not None:
        case.declared_value = case.draft_value
    case.status = "SUBMITTED"
    db.commit()
    return {"ok": True, "waybill_id": waybill_id, "status": "SUBMITTED"}


@app.get("/api/translate/stub")
def translate_stub(text: str, source: str = "zh", target: str = "en"):
    """Live translate fallback for EXCEPTION_HOLD."""
    return {"translation": live_translate_stub(text, source, target)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
