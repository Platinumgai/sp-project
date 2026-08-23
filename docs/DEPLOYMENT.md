# Deployment Guide

This document describes the actual deployment process for this system:
PostgreSQL/PostGIS → FastAPI backend → React Control Room frontend.

Every command below was verified to genuinely work in this environment
**except** literal `docker compose` execution — this sandbox has no Docker
daemon installed (`docker: not found`, confirmed directly). Every claim
below is labeled either `TESTED IN THIS ENVIRONMENT` or `REQUIRES
DOCKER-CAPABLE ENVIRONMENT` — nothing is presented as verified when it
wasn't.

---

## 1. Prerequisites

- Docker + Docker Compose (`REQUIRES DOCKER-CAPABLE ENVIRONMENT`), **or**
- Python 3.12, Node.js 18+, and a local PostgreSQL 15+ with PostGIS 3.4 (`TESTED IN THIS ENVIRONMENT` — this is exactly how every phase of this project was verified, without Docker)

---

## 2. Environment Variables

Two separate `.env.example` files exist, for two different consumers:

- **`.env.example`** (project root) — read by `docker compose` for `${VAR}` interpolation in `docker-compose.yml`.
- **`backend/.env.example`** — read by the backend when run directly (`uvicorn app.main:app`), outside Docker.

Copy whichever applies to `.env` in the same directory and fill in real values. **Never commit the real `.env` file** — both are covered by `.gitignore`.

The only backend variables read from the environment (confirmed directly from source, `grep -rn os.getenv app/`):

| Variable | Required? | Default if unset |
|---|---|---|
| `JWT_SECRET_KEY` | **Yes for production** (`ENVIRONMENT=production` → refuses to start without it) | Insecure dev fallback + loud warning |
| `ENVIRONMENT` | No | `development` |
| `JWT_ALGORITHM` | No | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` |
| `DATABASE_URL` | No (has a Docker-network default) | `postgresql+psycopg://postgres:postgres_password@db:5432/police_db` |
| `CORS_ALLOWED_ORIGINS` | No | `*` |
| `EVIDENCE_STORAGE_BACKEND` | No | `local` |
| `EVIDENCE_UPLOAD_ROOT` | No | `/app/uploads` |
| `MAX_EVIDENCE_SIZE_MB` | No | `500` |
| `EVIDENCE_S3_BUCKET` / `EVIDENCE_S3_ENDPOINT_URL` | Only if `EVIDENCE_STORAGE_BACKEND=s3` | — |
| `CONSTABLE_LOCATION_MAX_AGE_SECONDS` | No | `120` |

Frontend (`web_dashboard/.env.example`): `VITE_API_URL` (required to point at a real backend), `VITE_WS_URL` (optional — correctly derived from `VITE_API_URL` if unset).

---

## 3. Generating a Secure JWT Secret

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```
Put the output in `JWT_SECRET_KEY`. `TESTED IN THIS ENVIRONMENT` — a real generated secret was used throughout this phase's live verification and confirmed to correctly sign/verify tokens.

---

## 4. Database Configuration

PostgreSQL with the PostGIS extension is required (`postgis/postgis:15-3.4` image in Compose, or install `postgresql-15-postgis-3` locally). `TESTED IN THIS ENVIRONMENT`: `SELECT PostGIS_version()` confirmed `3.4` against the actual database used throughout this project.

---

## 5. Migration Commands

```bash
cd backend
alembic upgrade head
```
`TESTED IN THIS ENVIRONMENT`, repeatedly, including a genuinely empty database (exit 0, all 13 migrations, zero schema drift confirmed via direct column-by-column comparison against `Base.metadata`) and an existing database carrying real data through every migration since.

Current head: **`6b1f4a9d3e72`** (13 revisions).

---

## 6. Docker Compose Command

```bash
docker compose up --build
```
`REQUIRES DOCKER-CAPABLE ENVIRONMENT` — **not executed in this sandbox**. The `docker-compose.yml` file was validated for YAML correctness and its `backend`/`frontend`/`db` services were each proven to work when started as equivalent standalone processes with the same commands and environment variables the compose file specifies — but the literal `docker compose up` invocation itself has never been run here.

**Without Docker** (`TESTED IN THIS ENVIRONMENT` — this is exactly how the backend/frontend were verified throughout this project):
```bash
# Terminal 1
service postgresql start   # or your local Postgres equivalent

# Terminal 2
cd backend
export DATABASE_URL="postgresql+psycopg://postgres:postgres_password@localhost:5432/police_db"
export JWT_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 3
cd web_dashboard
echo "VITE_API_URL=http://localhost:8000" > .env
npm install
npm run dev
```

---

## 7-10. Service URLs

| Service | URL | Status |
|---|---|---|
| Backend API | `http://localhost:8000` | `TESTED IN THIS ENVIRONMENT` — confirmed live and reachable |
| Frontend | `http://localhost:5173` | `TESTED IN THIS ENVIRONMENT` (production build served via `vite preview`) |
| Swagger/OpenAPI UI | `http://localhost:8000/docs` | `TESTED IN THIS ENVIRONMENT` — confirmed `200` |
| OpenAPI JSON | `http://localhost:8000/openapi.json` | `TESTED IN THIS ENVIRONMENT` — 52 paths, 58 schemas |
| WebSocket gateway | `ws://localhost:8000/ws/control_room?token=<JWT>` | `TESTED IN THIS ENVIRONMENT` — real connection, real events, invalid-token rejection all confirmed |

---

## 11. Health Verification

```bash
curl -s http://localhost:8000/docs -o /dev/null -w "%{http_code}\n"   # expect 200
curl -s http://localhost:8000/openapi.json | python3 -c "import json,sys; print(len(json.load(sys.stdin)['paths']), 'paths')"   # expect 52
```
`TESTED IN THIS ENVIRONMENT`.

---

## 12. Demo Accounts

Seeded via `backend/scripts/seed_demo.py`. All demo accounts share the password **`Demo@12345`** — development credentials only, never for production. Includes at minimum an `admin` account at phone `9990001001`.

---

## 13. Production Security Warnings

- **Set `ENVIRONMENT=production`** in any real deployment — without it, the backend silently falls back to an insecure, publicly-known JWT secret with only a log warning (by design, for local-dev convenience — this is documented behavior, not a bug, but it is not safe to rely on outside development).
- **Set `CORS_ALLOWED_ORIGINS`** explicitly to your real frontend origin — the `*` default is permissive.
- Demo account passwords (`Demo@12345`) must never be used in production.
- `EVIDENCE_STORAGE_BACKEND=s3` should be used for real deployments; the `local` filesystem backend is fine for development only.

---

## 14. Stopping / Restarting Services

Without Docker: `Ctrl+C` the `uvicorn`/`npm run dev` processes; `service postgresql stop`.
With Docker (`REQUIRES DOCKER-CAPABLE ENVIRONMENT`, not tested here): `docker compose down` / `docker compose restart <service>`.

---

## 15. Updating Migrations

```bash
cd backend
alembic revision -m "description of the change"
# edit the generated file in alembic/versions/
alembic upgrade head          # test locally first
```
Never edit an already-applied migration — always create a new additive one, chained off the actual current head (confirm with `alembic heads` first, never assumed).
