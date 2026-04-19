"""add_dashboard

Revision ID: 981b47a4aeb6
Revises: f4b6e2d019a1
Create Date: 2026-04-19 17:34:49.581159

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '981b47a4aeb6'
down_revision: Union[str, None] = 'f4b6e2d019a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'dashboard_thresholds',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('metric_name', sa.String(length=50), nullable=False),
        sa.Column('red_below', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('green_above', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('metric_name'),
    )
    op.add_column('clients', sa.Column('priority', sa.Integer(), nullable=True))

    # Seed default global thresholds
    op.execute("""
        INSERT INTO dashboard_thresholds (id, metric_name, red_below, green_above)
        VALUES
          (gen_random_uuid(), 'roas',        2.0,  4.0),
          (gen_random_uuid(), 'cpc',         NULL, 1.0),
          (gen_random_uuid(), 'rc_ratio',    2.0,  5.0),
          (gen_random_uuid(), 'orders',      10,   100),
          (gen_random_uuid(), 'revenue',     1000, 10000),
          (gen_random_uuid(), 'impressions', NULL, NULL),
          (gen_random_uuid(), 'clicks',      NULL, NULL),
          (gen_random_uuid(), 'cost',        NULL, NULL)
        ON CONFLICT (metric_name) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_column('clients', 'priority')
    op.drop_table('dashboard_thresholds')
