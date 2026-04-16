# System Architecture Overview

This document outlines the high-level system architecture for the data aggregation and reporting platform. The system is designed using a microservices-like approach, separating concerns into distinct layers: Frontend, Backend API, Data Connectors, and Background Processing/Scheduling.

## 🚀 Technology Stack

*   **Frontend:** Next.js (React) - Provides the user interface and client-side logic.
*   **Backend API:** Python (FastAPI) - Handles API routing, request validation, and orchestrates data flow.
*   **Database:** PostgreSQL (via SQLAlchemy/Alembic) - Persistent storage for client metadata, connection details, raw data, and generated reports.
*   **Background Tasks:** Celery/Background Tasks (Implied) - Used for long-running processes like data pulling and report generation.

## 🌐 Architectural Diagram (Conceptual Flow)

