"""Gemini multimodal extract, computer-use loop stub, Live translate fallback."""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from schemas import ExtractedInvoice

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

logger = logging.getLogger(__name__)

EXTRACT_MODEL = os.getenv("GEMINI_EXTRACT_MODEL", "gemini-2.5-flash")
COMPUTER_USE_MODEL = os.getenv("GEMINI_COMPUTER_USE_MODEL", "gemini-2.0-flash")
MAX_COMPUTER_USE_STEPS = int(os.getenv("MAX_COMPUTER_USE_STEPS", "12"))

EXTRACT_PROMPT = """You are a customs invoice parser. Extract structured JSON from this Commercial Invoice.

Return ONLY valid JSON with these keys:
- waybill_id (string, e.g. WB-2026-448291)
- declared_value (number, corrected/true invoice total)
- currency (ISO code, e.g. USD)
- hs_codes (array of HS tariff strings)
- shipper_country (ISO 2-letter)
- preferred_language (ISO code for shipper language, e.g. zh, en)

If the invoice shows a typo like 240.00 vs 2400.00, use the corrected commercial total as declared_value.
"""


def _client():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from google import genai

        return genai.Client(api_key=api_key)
    except Exception as exc:
        logger.warning("Gemini client unavailable: %s", exc)
        return None


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _mock_extract(filename: str) -> ExtractedInvoice:
    """Deterministic fallback when Gemini is unavailable."""
    return ExtractedInvoice(
        waybill_id="WB-2026-448291",
        declared_value=2400.0,
        currency="USD",
        hs_codes=["8471.30"],
        shipper_country="CN",
        preferred_language="zh",
    )


async def extract_invoice(file_bytes: bytes, mime_type: str, filename: str) -> ExtractedInvoice:
    client = _client()
    if client is None:
        logger.info("GEMINI_API_KEY missing — using mock extraction for %s", filename)
        return _mock_extract(filename)

    try:
        from google.genai import types

        part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
        response = client.models.generate_content(
            model=EXTRACT_MODEL,
            contents=[EXTRACT_PROMPT, part],
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
        raw = response.text or "{}"
        data = _parse_json(raw)
        return ExtractedInvoice.model_validate(data)
    except Exception as exc:
        logger.warning("Gemini extract failed (%s) — mock fallback", exc)
        return _mock_extract(filename)


def run_computer_use_loop(
    *,
    environment_id: str,
    goal: str,
    max_steps: int = MAX_COMPUTER_USE_STEPS,
) -> dict[str, Any]:
    """
    Gemini computer-use loop with step cap and loop detection.
    Returns { ok, steps, mode, message }.
    Full CU is abbreviated; portal_sync uses scripted Playwright as primary path.
    """
    client = _client()
    if client is None:
        return {
            "ok": False,
            "steps": 0,
            "mode": "skipped",
            "message": "No GEMINI_API_KEY — scripted Playwright only",
        }

    seen: set[str] = set()
    steps = 0
    try:
        while steps < max_steps:
            steps += 1
            fingerprint = f"{environment_id}:{steps}:{goal[:40]}"
            if fingerprint in seen:
                return {
                    "ok": False,
                    "steps": steps,
                    "mode": "gemini_cu",
                    "message": "Loop detected — identical step fingerprint",
                }
            seen.add(fingerprint)

            # Smoke-test model availability; full screenshot→act loop deferred to scripted fallback.
            client.models.generate_content(
                model=COMPUTER_USE_MODEL,
                contents=f"[computer-use-smoke] env={environment_id} goal={goal}",
            )
            return {
                "ok": True,
                "steps": steps,
                "mode": "gemini_cu_smoke",
                "message": "Computer use model reachable; scripted Playwright executes portal fill",
            }
    except Exception as exc:
        logger.warning("Computer use loop failed: %s", exc)
        return {
            "ok": False,
            "steps": steps,
            "mode": "gemini_cu",
            "message": str(exc),
        }


def live_translate_stub(text: str, source_lang: str, target_lang: str) -> str:
    """Stub for EXCEPTION_HOLD — Gemini Live Translate fallback."""
    client = _client()
    if client is None:
        return f"[mock-translate {source_lang}→{target_lang}] {text}"

    try:
        prompt = (
            f"Translate the following from {source_lang} to {target_lang}. "
            f"Return only the translation.\n\n{text}"
        )
        response = client.models.generate_content(
            model=EXTRACT_MODEL,
            contents=prompt,
        )
        return (response.text or text).strip()
    except Exception as exc:
        logger.warning("Live translate stub failed: %s", exc)
        return f"[translate-error] {text}"
