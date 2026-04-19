"""add_mcc_id_to_clients

Revision ID: f4b6e2d019a1
Revises: e3a9c1f08b27
Create Date: 2026-04-19 12:00:00.000000

Adds an `mcc_id` column to the `clients` table so the system can manage
clients spread across multiple Google Ads MCC (manager) accounts.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f4b6e2d019a1"
down_revision: Union[str, None] = "e3a9c1f08b27"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("mcc_id", sa.String(length=20), nullable=True))
    op.create_index("idx_clients_mcc_id", "clients", ["mcc_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_clients_mcc_id", table_name="clients")
    op.drop_column("clients", "mcc_id")
