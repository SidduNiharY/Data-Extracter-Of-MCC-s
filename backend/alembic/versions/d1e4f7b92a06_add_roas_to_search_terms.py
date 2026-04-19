"""add_roas_to_search_terms

Revision ID: d1e4f7b92a06
Revises: c7f3a2e91b05
Create Date: 2026-04-16
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = 'd1e4f7b92a06'
down_revision = 'c7f3a2e91b05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'google_ads_search_terms',
        sa.Column('roas', sa.Numeric(10, 4), nullable=True,
                  comment='Calculated: conv_value / spend. NULL for non-ecomm.')
    )


def downgrade() -> None:
    op.drop_column('google_ads_search_terms', 'roas')
