"""SQLAlchemy models and session for ClearBorder V2 persistent state."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

from sqlalchemy import DateTime, Float, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "clearborder_v2.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class WorkflowState(str, Enum):
    PENDING_UPLOAD = "PENDING_UPLOAD"
    EXTRACTED = "EXTRACTED"
    PORTAL_SYNCING = "PORTAL_SYNCING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    COMPLETED = "COMPLETED"
    EXCEPTION_HOLD = "EXCEPTION_HOLD"


class EnvironmentState(Base):
    __tablename__ = "environment_states"

    environment_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    state: Mapped[str] = mapped_column(String(32), default=WorkflowState.PENDING_UPLOAD.value)
    waybill_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    declared_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    hs_codes_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipper_country: Mapped[str | None] = mapped_column(String(8), nullable=True)
    preferred_language: Mapped[str | None] = mapped_column(String(8), nullable=True)
    extracted_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    portal_original_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    portal_new_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    execution_logs_json: Mapped[str] = mapped_column(Text, default="[]")
    exception_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_filename: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def append_log(self, message: str) -> None:
        logs = json.loads(self.execution_logs_json or "[]")
        logs.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "message": message,
            }
        )
        self.execution_logs_json = json.dumps(logs)

    def hs_codes(self) -> list[str]:
        if not self.hs_codes_json:
            return []
        return json.loads(self.hs_codes_json)

    def set_hs_codes(self, codes: list[str]) -> None:
        self.hs_codes_json = json.dumps(codes)

    def extracted(self) -> dict[str, Any]:
        if not self.extracted_json:
            return {}
        return json.loads(self.extracted_json)

    def set_extracted(self, data: dict[str, Any]) -> None:
        self.extracted_json = json.dumps(data)


class MockPortalCase(Base):
    """Seed data for the mock customs portal."""

    __tablename__ = "mock_portal_cases"

    waybill_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    declared_value: Mapped[float] = mapped_column(Float, default=240.0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    hs_codes_json: Mapped[str] = mapped_column(Text, default='["8471.30"]')
    shipper_country: Mapped[str] = mapped_column(String(8), default="CN")
    freight_inclusive: Mapped[str] = mapped_column(String(8), default="false")
    draft_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="HELD")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_mock_portal(db)


def seed_mock_portal(db: Session) -> None:
    existing = db.get(MockPortalCase, "WB-2026-448291")
    if existing:
        return
    db.add(
        MockPortalCase(
            waybill_id="WB-2026-448291",
            declared_value=240.0,
            currency="USD",
            hs_codes_json='["8471.30"]',
            shipper_country="CN",
            freight_inclusive="false",
            status="HELD",
        )
    )
    db.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_state_hydration(environment_id: str) -> dict[str, Any]:
    """Test helper: assert environment row exists with required hydrated fields."""
    with SessionLocal() as db:
        row = db.get(EnvironmentState, environment_id)
        if row is None:
            return {"ok": False, "error": f"environment {environment_id} not found"}

        required = [
            "waybill_id",
            "declared_value",
            "currency",
            "shipper_country",
            "preferred_language",
        ]
        missing = [f for f in required if getattr(row, f) is None]
        if missing:
            return {"ok": False, "error": f"missing fields: {missing}", "state": row.state}

        return {
            "ok": True,
            "environment_id": row.environment_id,
            "state": row.state,
            "waybill_id": row.waybill_id,
            "declared_value": row.declared_value,
            "currency": row.currency,
            "hs_codes": row.hs_codes(),
            "shipper_country": row.shipper_country,
            "preferred_language": row.preferred_language,
            "execution_log_count": len(json.loads(row.execution_logs_json or "[]")),
        }
