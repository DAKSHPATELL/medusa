"""Pydantic schemas for API I/O."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ExtractedInvoice(BaseModel):
    waybill_id: str
    declared_value: float
    currency: str = "USD"
    hs_codes: list[str] = Field(default_factory=list)
    shipper_country: str = "CN"
    preferred_language: str = "en"


class UploadResponse(BaseModel):
    environment_id: str
    state: str
    extracted: ExtractedInvoice


class ExecutionLogEntry(BaseModel):
    at: str
    message: str


class StateSnapshot(BaseModel):
    environment_id: str
    state: str
    waybill_id: str | None = None
    declared_value: float | None = None
    currency: str | None = None
    hs_codes: list[str] = Field(default_factory=list)
    shipper_country: str | None = None
    preferred_language: str | None = None
    portal_original_value: float | None = None
    portal_new_value: float | None = None
    exception_message: str | None = None
    source_filename: str | None = None
    execution_logs: list[ExecutionLogEntry] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    diff: dict[str, Any] | None = None


class ApproveRequest(BaseModel):
    approved: bool = True


class ApproveResponse(BaseModel):
    environment_id: str
    state: str
    message: str
