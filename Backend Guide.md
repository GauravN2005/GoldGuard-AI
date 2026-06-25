# GoldGuard AI Backend Development Specification

## Project Overview

Build a production-grade backend for GoldGuard AI, a Gold Loan Inspection & Fraud Prevention Platform used by banks and gold loan providers.

The frontend is already completed.

Your task is ONLY backend development and API integration.

DO NOT build frontend pages.

DO NOT redesign UI.

AI analysis modules will be implemented later and should be prepared as service placeholders.

---

# Tech Stack

## Backend

* FastAPI
* Python 3.12
* SQLAlchemy 2.0
* Alembic
* Pydantic v2

## Database

* PostgreSQL

## Authentication

* JWT Access Token
* JWT Refresh Token

## Background Jobs

* Celery
* Redis

## File Storage

* MinIO (S3 Compatible)

## Logging

* Structlog

## API Documentation

* Swagger
* OpenAPI

---

# Architecture

backend/

├── app/
│
├── api/
│ ├── auth/
│ ├── inspections/
│ ├── reports/
│ ├── branches/
│ ├── employees/
│ ├── notifications/
│ ├── customers/
│ ├── escalations/
│ ├── portfolio/
│ ├── analytics/
│ └── ai/
│
├── core/
│ ├── config.py
│ ├── security.py
│ ├── permissions.py
│ └── logger.py
│
├── models/
│
├── schemas/
│
├── services/
│
├── repositories/
│
├── tasks/
│
├── utils/
│
├── migrations/
│
└── main.py

---

# Roles

## Super Admin

Full Access

## Regional Manager

Access Multiple Branches

## Branch Manager

Access Own Branch

## Appraiser

Create Inspections

## Auditor

Read-only Access

---

# Authentication APIs

POST /auth/login

POST /auth/refresh

POST /auth/logout

GET /auth/me

PATCH /auth/change-password

---

# Branch APIs

GET /branches

GET /branches/{id}

POST /branches

PATCH /branches/{id}

DELETE /branches/{id}

---

# Employee APIs

GET /employees

GET /employees/{id}

POST /employees

PATCH /employees/{id}

DELETE /employees/{id}

GET /employees/leaderboard

---

# Customer APIs

GET /customers

GET /customers/{id}

POST /customers

PATCH /customers/{id}

GET /customers/{id}/inspections

GET /customers/{id}/loan-history

---

# Inspection APIs

POST /inspections

GET /inspections

GET /inspections/{id}

PATCH /inspections/{id}

DELETE /inspections/{id}

GET /inspections/{id}/replay

GET /inspections/{id}/audit-trail

GET /inspections/{id}/evidence

POST /inspections/{id}/submit

---

# Evidence Vault APIs

POST /inspections/{id}/images

POST /inspections/{id}/reflection

POST /inspections/{id}/touchstone

GET /inspections/{id}/files

DELETE /files/{id}

---

# Escalation APIs

GET /escalations

POST /escalations

PATCH /escalations/{id}

POST /escalations/{id}/approve

POST /escalations/{id}/reject

POST /escalations/{id}/close

---

# Reports APIs

GET /reports

GET /reports/{id}

POST /reports/generate

GET /reports/export

---

# Analytics APIs

GET /analytics/dashboard

GET /analytics/branches

GET /analytics/employees

GET /analytics/fraud-trends

GET /analytics/portfolio

---

# Notification APIs

GET /notifications

PATCH /notifications/{id}/read

PATCH /notifications/read-all

DELETE /notifications/{id}

---

# Audit Trail

Every action must create an audit log.

Examples:

Inspection Created

Image Uploaded

Report Generated

Escalation Created

Decision Approved

Settings Updated

---

# Offline Sync APIs

POST /sync/drafts

GET /sync/status

POST /sync/resolve

Support future offline-first mobile applications.

---

# AI Placeholder Services

Create interfaces only.

No implementation.

Services:

ComputerVisionService

DensityAnalysisService

ReflectionAnalysisService

TouchstoneAnalysisService

Expose:

POST /ai/analyze/{inspection_id}

Return mocked response structure.

---

# Security

Role Based Access Control

JWT Authentication

Password Hashing

Rate Limiting

Input Validation

Audit Logging

File Validation

---

# Deployment

Docker

Docker Compose

Nginx

PostgreSQL

Redis

MinIO

Celery Worker

Celery Beat

Environment Variables

Health Checks

Ready for AWS deployment.

Generate complete production-grade codebase.
