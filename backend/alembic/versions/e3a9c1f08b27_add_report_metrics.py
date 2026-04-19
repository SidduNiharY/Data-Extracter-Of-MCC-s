"""add_report_metrics

Revision ID: e3a9c1f08b27
Revises: d1e4f7b92a06
Create Date: 2026-04-16
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'e3a9c1f08b27'
down_revision = 'd1e4f7b92a06'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'report_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('report_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source', sa.String(30), nullable=False),
        sa.Column('metric_name', sa.String(50), nullable=False),
        sa.Column('current_value', sa.Numeric(18, 4), nullable=True),
        sa.Column('previous_value', sa.Numeric(18, 4), nullable=True),
        sa.Column('change_pct', sa.Numeric(10, 2), nullable=True),
        sa.Column('direction', sa.String(10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )

    # Unique constraint: one metric per report per source per metric_name
    op.create_unique_constraint(
        'uq_report_metric', 'report_metrics',
        ['report_id', 'source', 'metric_name'],
    )

    # Indexes for common query patterns
    op.create_index('idx_rm_client', 'report_metrics', ['client_id'])
    op.create_index('idx_rm_report', 'report_metrics', ['report_id'])
    op.create_index('idx_rm_source', 'report_metrics', ['source'])


def downgrade() -> None:
    op.drop_index('idx_rm_source', table_name='report_metrics')
    op.drop_index('idx_rm_report', table_name='report_metrics')
    op.drop_index('idx_rm_client', table_name='report_metrics')
    op.drop_constraint('uq_report_metric', 'report_metrics', type_='unique')
    op.drop_table('report_metrics')
