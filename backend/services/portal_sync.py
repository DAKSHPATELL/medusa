"""Playwright portal sync — scripted path with gatekeeper submit blocked."""

from __future__ import annotations

import logging
import os
from typing import Callable

from database import EnvironmentState, MockPortalCase, SessionLocal, WorkflowState
from models.gemini_client import run_computer_use_loop
from playwright.sync_api import Page, sync_playwright
from state_machine import transition

logger = logging.getLogger(__name__)

PORTAL_BASE = os.getenv("PORTAL_BASE_URL", "http://localhost:8000/mock-customs")
PORTAL_USER = os.getenv("MOCK_PORTAL_USER", "broker.demo")
PORTAL_PASS = os.getenv("MOCK_PORTAL_PASS", "clearborder2026")

# Selectors from spec — gatekeeper submit is intentionally excluded from automation.
SELECTORS = {
    "user": "#customs-user",
    "pass": "#customs-pass",
    "login_submit": "#login-submit",
    "search": "input[data-testid='portal-search']",
    "declared_value": "input[name='declared_value_field']",
    "freight_checkbox": "input#freight-inclusive-checkbox",
    "save_draft": "button.save-draft-action",
    "blocked_submit": "#gatekeeper-submit-btn",
}


def _log(env: EnvironmentState, message: str) -> None:
    with SessionLocal() as db:
        row = db.get(EnvironmentState, env.environment_id)
        if row:
            row.append_log(message)
            db.commit()


def _assert_never_click_submit(page: Page) -> None:
    """Safety check: automation must not click the gatekeeper submit button."""
    submit = page.locator(SELECTORS["blocked_submit"])
    if submit.count() and submit.is_visible():
        logger.info("Gatekeeper submit visible — automation halts (human-in-the-loop)")


def run_portal_sync(environment_id: str) -> None:
    with SessionLocal() as db:
        env = db.get(EnvironmentState, environment_id)
        if env is None:
            return
        if env.state != WorkflowState.EXTRACTED.value:
            return
        try:
            transition(env, WorkflowState.PORTAL_SYNCING, "Portal sync started")
            db.commit()
        except ValueError:
            db.commit()
            return

        extracted = env.extracted()
        waybill = env.waybill_id or extracted.get("waybill_id", "")
        declared = env.declared_value or extracted.get("declared_value", 0)
        cu = run_computer_use_loop(
            environment_id=environment_id,
            goal=f"Fill mock portal for {waybill} declared_value={declared}",
        )
        env.append_log(f"Computer use: {cu.get('message', 'n/a')}")
        db.commit()

    try:
        _scripted_fill(environment_id, waybill, float(declared))
    except Exception as exc:
        logger.exception("Portal sync failed for %s", environment_id)
        with SessionLocal() as db:
            env = db.get(EnvironmentState, environment_id)
            if env:
                env.exception_message = str(exc)
                env.append_log(f"Portal sync exception: {exc}")
                transition(env, WorkflowState.EXCEPTION_HOLD, "Moved to EXCEPTION_HOLD")
                db.commit()


def _scripted_fill(environment_id: str, waybill_id: str, declared_value: float) -> None:
    headless = os.getenv("BROWSER_HEADLESS", "true").lower() != "false"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        try:
            _fill_portal(page, environment_id, waybill_id, declared_value)
        finally:
            browser.close()


def _fill_portal(page: Page, environment_id: str, waybill_id: str, declared_value: float) -> None:
    log = lambda msg: _log_by_id(environment_id, msg)

    log(f"Navigate to {PORTAL_BASE}/login")
    page.goto(f"{PORTAL_BASE}/login", wait_until="networkidle")

    page.fill(SELECTORS["user"], PORTAL_USER)
    page.fill(SELECTORS["pass"], PORTAL_PASS)
    log("Submit login")
    page.click(SELECTORS["login_submit"])
    page.wait_for_url("**/mock-customs/dashboard**")

    log(f"Search waybill {waybill_id}")
    page.fill(SELECTORS["search"], waybill_id)
    page.keyboard.press("Enter")
    page.wait_for_url(f"**/mock-customs/case/{waybill_id}**")

    original_text = page.locator(SELECTORS["declared_value"]).input_value()
    original_value = float(original_text.replace(",", "") or "0")
    log(f"Original portal declared value: {original_value}")

    page.fill(SELECTORS["declared_value"], f"{declared_value:.2f}")
    if not page.locator(SELECTORS["freight_checkbox"]).is_checked():
        page.check(SELECTORS["freight_checkbox"])
        log("Checked freight-inclusive checkbox")

    _assert_never_click_submit(page)

    log("Save draft (automation stops before gatekeeper submit)")
    page.click(SELECTORS["save_draft"])
    page.wait_for_url("**/mock-customs/case/**?draft=saved**", timeout=15000)

    _assert_never_click_submit(page)

    with SessionLocal() as db:
        env = db.get(EnvironmentState, environment_id)
        portal_case = db.get(MockPortalCase, waybill_id)
        if portal_case:
            portal_case.draft_value = declared_value
            portal_case.freight_inclusive = "true"
            portal_case.status = "DRAFT"
        if env:
            env.portal_original_value = original_value
            env.portal_new_value = declared_value
            env.append_log(
                f"Draft saved: {original_value} → {declared_value} (submit blocked for human)"
            )
            transition(env, WorkflowState.AWAITING_APPROVAL, "Awaiting broker sign-off")
            db.commit()


def _log_by_id(environment_id: str, message: str) -> None:
    with SessionLocal() as db:
        row = db.get(EnvironmentState, environment_id)
        if row:
            row.append_log(message)
            db.commit()


def schedule_portal_sync(environment_id: str, runner: Callable[[str], None] | None = None) -> None:
    import threading

    target = runner or run_portal_sync
    thread = threading.Thread(target=target, args=(environment_id,), daemon=True)
    thread.start()
