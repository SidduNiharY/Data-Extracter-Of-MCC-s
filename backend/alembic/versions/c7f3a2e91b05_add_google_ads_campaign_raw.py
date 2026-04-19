"""add_google_ads_campaign_raw

Revision ID: c7f3a2e91b05
Revises: b2e3f8a91d04
Create Date: 2026-04-15

Adds the google_ads_campaign_raw table.

Purpose
-------
- Stores raw Google Ads campaign-level data uploaded via CSV (UI export)
  or ingested via API pull, one row per (client_id, report_date, campaign_name).
- Different MCC accounts are separated by client_id (foreign key → clients.id).
- Separate from google_ads_campaign (API-pull processed data) so raw exports
  are never mixed with API-normalised data.
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'c7f3a2e91b05'
down_revision = '5ce9ec6d8035'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'google_ads_campaign_raw',

        sa.Column('id',
                  postgresql.UUID(as_uuid=True),
                  primary_key=True,
                  server_default=sa.text('gen_random_uuid()'),
                  nullable=False),

        # ── Client / MCC identity ─────────────────────────────────────────
        sa.Column('client_id',
                  postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  nullable=False,
                  comment='Links to the MCC sub-account. Each MCC has its own rows.'),

        sa.Column('pull_job_id',
                  postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('pull_jobs.id', ondelete='SET NULL'),
                  nullable=True,
                  comment='NULL for CSV uploads; set when ingested via API pull job.'),

        sa.Column('ingestion_source',
                  sa.VARCHAR(10),
                  nullable=False,
                  server_default='csv',
                  comment='csv | api'),

        # ── Identity dimensions ───────────────────────────────────────────
        sa.Column('report_date',   sa.Date,        nullable=False),
        sa.Column('campaign_name', sa.String(255),  nullable=True),
        sa.Column('currency',      sa.String(10),   nullable=True,
                  server_default='AUD'),

        # ── Volume metrics ────────────────────────────────────────────────
        sa.Column('impressions', sa.BigInteger, nullable=True),
        sa.Column('clicks',      sa.BigInteger, nullable=True),

        # ── Cost metrics (stored in actual currency, NOT micros) ──────────
        sa.Column('spend',               sa.Numeric(14, 4), nullable=True),
        sa.Column('avg_cpc',             sa.Numeric(10, 4), nullable=True),
        sa.Column('cost_per_conversion', sa.Numeric(14, 4), nullable=True),

        # ── Rate metrics (0–100 percentage) ──────────────────────────────
        sa.Column('ctr',              sa.Numeric(8, 4), nullable=True),
        sa.Column('conversion_rate',  sa.Numeric(8, 4), nullable=True),
        sa.Column('impression_share', sa.Numeric(8, 4), nullable=True),

        # ── Conversion metrics ────────────────────────────────────────────
        sa.Column('conversions',      sa.Numeric(10, 2), nullable=True),
        sa.Column('conversion_value', sa.Numeric(14, 4), nullable=True),
        sa.Column('roas',             sa.Numeric(10, 4), nullable=True),
        sa.Column('avg_order_value',  sa.Numeric(14, 4), nullable=True),

        # ── Audit ─────────────────────────────────────────────────────────
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )

    # Unique constraint — one row per MCC client per day per campaign
    op.create_unique_constraint(
        'uq_gads_raw_client_date_campaign',
        'google_ads_campaign_raw',
        ['client_id', 'report_date', 'campaign_name'],
    )

    # Indexes for common query patterns
    op.create_index(
        'idx_gads_raw_client_date',
        'google_ads_campaign_raw',
        ['client_id', 'report_date'],
    )
    op.create_index(
        'idx_gads_raw_client_campaign',
        'google_ads_campaign_raw',
        ['client_id', 'campaign_name'],
    )
    op.create_index(
        'idx_gads_raw_ingestion_source',
        'google_ads_campaign_raw',
        ['ingestion_source'],
    )


def downgrade() -> None:
    op.drop_index('idx_gads_raw_ingestion_source', table_name='google_ads_campaign_raw')
    op.drop_index('idx_gads_raw_client_campaign',  table_name='google_ads_campaign_raw')
    op.drop_index('idx_gads_raw_client_date',      table_name='google_ads_campaign_raw')
    op.drop_constraint('uq_gads_raw_client_date_campaign', 'google_ads_campaign_raw')
    op.drop_table('google_ads_campaign_raw')
