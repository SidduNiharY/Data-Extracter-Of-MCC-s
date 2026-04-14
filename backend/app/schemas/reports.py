from __future__ import annotations
from typing import Optional
from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class ReportType(str, Enum):
    weekly = "weekly"
    monthly = "monthly"


class ReportStatus(str, Enum):
    generating = "generating"
    ready = "ready"
    failed = "failed"


# ── Report Section ──


class ReportSectionRead(BaseModel):
    id: UUID
    report_id: UUID
    source: str
    section_type: str
    data: dict
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Report ──


class ReportRead(BaseModel):
    id: UUID
    client_id: UUID
    report_type: str
    period_start: date
    period_end: date
    status: str
    error_message: Optional[str]
    generated_at: Optional[datetime]
    created_at: datetime
    sections: list[ReportSectionRead] = []

    model_config = {"from_attributes": True}


class ReportSummary(BaseModel):
    """Lightweight report info without sections (for list views)."""
    id: UUID
    client_id: UUID
    report_type: str
    period_start: date
    period_end: date
    status: str
    error_message: Optional[str]
    generated_at: Optional[datetime]
    created_at: datetime
    section_count: int = 0

    model_config = {"from_attributes": True}


# ── Request Bodies ──


class GenerateReportRequest(BaseModel):
    client_id: UUID
    report_type: ReportType = ReportType.weekly
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    year: Optional[int] = None
    month: Optional[int] = None
