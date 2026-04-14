from __future__ import annotations
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SuperMatrix"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/supermatrix"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/supermatrix"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    CREDENTIALS_ENCRYPTION_KEY: str = "change-me-in-production"

    # Google Ads (MCC level)
    GOOGLE_ADS_DEVELOPER_TOKEN: str = ""
    GOOGLE_ADS_CLIENT_ID: str = ""
    GOOGLE_ADS_CLIENT_SECRET: str = ""
    GOOGLE_ADS_REFRESH_TOKEN: str = ""
    GOOGLE_ADS_MCC_ID: str = ""

    # Meta Ads
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_ACCESS_TOKEN: str = ""

    # Shopify (Partner/Custom App)
    SHOPIFY_APP_CLIENT_ID: str = ""
    SHOPIFY_APP_CLIENT_SECRET: str = ""
    SHOPIFY_PARTNER_ID: str = ""
    SHOPIFY_PARTNER_TOKEN: str = ""
    SHOPIFY_ACCESS_TOKEN: str = ""

    # Google Analytics 4 (Service Account JSON string)
    GA4_SERVICE_ACCOUNT_JSON: str = ""

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
