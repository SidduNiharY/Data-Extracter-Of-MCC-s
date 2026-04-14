"""add reports tables

Revision ID: b2e3f8a91d04
Revises: 4fd1b6aa7c53
Create Date: 2026-04-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b2e3f8a91d04"
down_revision: Union[str, None] = "4fd1b6aa7c53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("report_type", sa.String(20), nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), server_default="generating"),
        sa.Column("error_message", sa.Text),
        sa.Column("generated_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "client_id", "report_type", "period_start",
            name="uq_report_client_type_period",
        ),
    )
    op.create_index("idx_reports_client", "reports", ["client_id"])
    op.create_index("idx_reports_type", "reports", ["report_type"])
    op.create_index("idx_reports_period", "reports", ["period_start"])
    op.create_index("idx_reports_status", "reports", ["status"])

    op.create_table(
        "report_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("section_type", sa.String(40), nullable=False),
        sa.Column("data", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("idx_report_sections_report", "report_sections", ["report_id"])
    op.create_index("idx_report_sections_source", "report_sections", ["source"])


def downgrade() -> None:
    op.drop_table("report_sections")
    op.drop_table("reports")
