# Police Body-Camera Emergency Recording System

A backend + web Control Room for a smartphone-based police body-camera
system. A constable uses an Android phone as a body camera: pressing the
volume-up button twice starts an emergency recording (video + audio),
which is uploaded to the backend in continuous chunks rather than as one
finished file. The web Control Room monitors constables/devices in real
time — battery, location, recording status, alerts — and can send
authorized remote commands to a constable's phone.

The Flutter/Android mobile client is **not included in this repository**
— it is built separately by another developer against the API contract
documented in `docs/`.

```
CONSTABLE MOBILE APP (Flutter, not in this repo)
        |  HTTPS + WebSocket
        v
FASTAPI BACKEND  --  PostgreSQL/PostGIS
        |         --  File/chunk storage
        |         --  WebSocket gateway
        v
CONTROL ROOM WEB DASHBOARD (React)
```

## 1. Architecture

- **`backend/`** — FastAPI + SQLAlchemy + Alembic + PostgreSQL/PostGIS. Device registration/heartbeat/battery/location, chunked recording upload with out-of-order and missing-chunk handling, an alert system, remote-command lifecycle, authenticated WebSocket events, and role/station/constable authorization throughout.
- **`web_dashboard/`** — React 18 + Vite + Tailwind Control Room: live device monitoring, map, recordings (with a real chunk timeline, not a fake video stream), alerts, remote-command issuing with explicit confirmation, plus retained legacy incident/evidence pages.
- **`docs/`** — deployment guide, the full mobile API contract, a Flutter-specific handoff + quick reference, and a frozen OpenAPI snapshot.

## 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in a real JWT_SECRET_KEY -- see below
export DATABASE_URL='postgresql+psycopg://postgres:postgres_password@localhost:5432/police_db'
export JWT_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
alembic upgrade head
python scripts/seed_demo.py     # optional: creates demo accounts
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: `http://localhost:8000/docs` · OpenAPI JSON: `http://localhost:8000/openapi.json`

## 3. Frontend Setup

```bash
cd web_dashboard
cp .env.example .env   # VITE_API_URL should point at your running backend
npm install
npm run dev
```
Open `http://localhost:5173`.

## 4. Environment Variables

See `backend/.env.example` and `.env.example` (project root, for Docker
Compose) for the complete, source-verified list. The only one you
genuinely need to set yourself is `JWT_SECRET_KEY` — generate one with
`python3 -c "import secrets; print(secrets.token_urlsafe(64))"`. Full
details, including production security warnings, are in
`docs/DEPLOYMENT.md`.

## 5. Database Migration

```bash
cd backend
alembic upgrade head       # apply
alembic current             # confirm
alembic revision -m "..."   # create a new migration -- never edit an applied one
```
Current head: `6b1f4a9d3e72` (13 migrations).

## 6. Demo Login

Only present if you run `python scripts/seed_demo.py`. All demo accounts
share password `Demo@12345` (development only — never for production):

```
admin         9990001001
control_room  9990001002
station       9990001003
constable     9990001004
citizen       9990001005
```

## 7. API Documentation

- `docs/MOBILE_DEVICE_API.md` — the general mobile/API contract (device, recording, chunks, WebSocket, commands).
- `docs/openapi_snapshot_head_6b1f4a9d3e72.json` — a frozen, verified snapshot of the live OpenAPI schema.

## 8. Flutter API Handoff

- `docs/FLUTTER_API_HANDOFF.md` — the primary handoff document for the developer building the Android/Flutter client: base config (including Android emulator networking), every endpoint, every WebSocket event with real payloads, security guidance, offline/retry behavior (client vs. backend responsibility), and Android-specific implementation requirements.
- `docs/FLUTTER_API_QUICK_REFERENCE.md` — a compact endpoint table for quick lookup.

## 9. Docker Deployment

```bash
docker compose up --build
```
**Requires a Docker-capable environment.** See `docs/DEPLOYMENT.md` for exactly what was and wasn't verified in this development environment (which has no Docker daemon installed).

## 10. Testing

Backend:
```bash
cd backend
pytest                                             # SQLite/unit suite
TEST_DATABASE_URL=postgresql+psycopg://... pytest -m "postgres_integration or postgres_migration"
```
Frontend:
```bash
cd web_dashboard
npm test
npm run build
```

## 11. Known Limitations

- No browser was available in this development environment — manual UI testing was never performed; only automated frontend tests (Vitest + React Testing Library) and API-level verification.
- Docker Compose was never literally executed here (no Docker daemon) — each constituent service was independently verified as a standalone process instead.
- No background scheduler exists for device offline/stale detection — it's computed lazily whenever a device is observed (e.g. via the Control Room UI or a heartbeat call), not via a periodic job.
- `requirements.txt` lists `redis`/`firebase-admin` as dependencies, but neither is currently imported or used anywhere in the codebase.
