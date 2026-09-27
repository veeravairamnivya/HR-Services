# TalentBridge HR — Recruitment Workspace

An end-to-end application for an HR consultancy's recruitment team: clients, open positions,
a spreadsheet-style candidate tracker per position, interview rounds, daily recruiter
attendance, dashboards and Excel reports.

| Layer    | Stack |
|----------|-------|
| Backend  | Python 3.11, FastAPI, SQLAlchemy 2, Pydantic 2, JWT auth, openpyxl (SQLite by default, PostgreSQL ready) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, SWR, Recharts, lucide icons |

## Features

**Dashboard** — greeting with today's target progress, 8 KPI cards (active clients, open positions/seats,
active pipeline, candidates added, interviews today/week, offers & joiners this month, team present),
6-month hiring trend, pipeline funnel, "where candidates are now" by stage, upcoming interviews, live
activity feed, priority positions and a recruiter leaderboard. Toggle **Whole team / My numbers**.

**Clients** — client cards with contact details, fee %, payment terms and live counts (open roles, seats,
candidates, joined). Client page lists all its positions and exports all its candidates to Excel.

**Open Positions** — card or table view with filters (status, client, priority, "assigned to me"),
experience/budget ranges, openings vs filled, pipeline colour bar and assigned recruiters.

**Candidate sheet (click any position)** — the recruiter's daily tool:
- Excel-like grid: click a cell to edit, **Enter** saves, **Tab** moves to the next cell, sticky header and name column.
- Bottom green row adds a new candidate — type and press **Enter**, focus returns for the next one.
- Duplicate warning when the phone/email already exists in *any* position.
- Colour-coded stage dropdown per row, stage filter chips with counts, search, "my candidates".
- Bulk select → move many candidates to a stage.
- **Board view** (kanban) with drag & drop between stages.
- Excel **export**, Excel/CSV **import** (with template download).
- Candidate profile drawer: full details, **interview rounds**, and a timeline of every stage change.

**Pipeline stages**: Sourced → Screening → Shortlisted → Interview Scheduled → Round 1 Selected →
Round 2 Selected → Round 3 Selected → HR Discussion → Offer Released → Offer Accepted → Joined,
plus On Hold / Rejected / Dropped. Automation:
- Scheduling an interview moves the candidate to *Interview Scheduled*.
- Marking Round N **Selected** moves them to *Round N Selected*; **Rejected** → *Rejected*.
- Every change is recorded with who/when/note, which powers reports.

**Interviews** — 7-day calendar across all positions, filter by result or my candidates.

**Attendance** — the first sign-in (or app open) each day marks the recruiter present, and **late** after the
configured office start time. Check-out with a work summary. Recruiters see their own calendar; managers see
"who's in" and a period summary (present/late/absent/hours) with Excel export.

**Reports** (all exportable to Excel) — recruiter performance vs daily targets, client summary, position
stage matrix, daily team report (attendance + output + work summary), week-over-week trend cards.

**Roles**
| Role | Can do |
|------|--------|
| Admin | Everything, including team accounts and deleting clients/positions |
| Manager | Create/edit clients and positions, assign recruiters, edit any candidate, team reports |
| Recruiter | View everything, add candidates to any open position, edit candidates they own or on positions assigned to them |

## Quick start (local)

**Easiest: one-click start.** Install [Python 3.11+](https://www.python.org/downloads/) and
[Node.js 20+](https://nodejs.org/), download this repository, then:

- **Windows:** double-click `start-windows.bat`
- **macOS / Linux:** run `./start-mac-linux.sh`

The script installs everything on the first run (a few minutes), starts both servers and opens
**http://localhost:3100** in your browser. To stop, close the two server windows (Windows) or press Ctrl+C.

**Or start each part manually:**

**1. Backend** (http://localhost:8100, API docs at http://localhost:8100/api/docs)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                   # optional
uvicorn app.main:app --reload --port 8100
```

On first start the database is created and seeded with an admin account plus demo data
(6 clients, 12 positions, ~110 candidates, interviews and 30 days of attendance).
Set `HR_SEED_DEMO_DATA=false` for a clean start with only the admin account.

**2. Frontend** (http://localhost:3100)

```bash
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` to the backend (`BACKEND_URL`, default `http://localhost:8100`).

**Demo logins**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@talentbridge.com | Admin@123 |
| Manager | manager@talentbridge.com | Recruit@123 |
| Recruiter | priya@talentbridge.com (also karthik@, sneha@, farhan@) | Recruit@123 |

Change the admin password (user menu → Change password) and set `HR_SECRET_KEY` before real use.

## Docker (PostgreSQL)

```bash
HR_SECRET_KEY=$(openssl rand -hex 32) docker compose up --build
```

Opens on http://localhost:3100 with PostgreSQL, the API and the web app.

## Configuration (backend, `HR_` prefix)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HR_DATABASE_URL` | `sqlite:///./hr_services.db` | e.g. `postgresql+psycopg://user:pass@host:5432/db` |
| `HR_SECRET_KEY` | insecure default | JWT signing key — **set this in production** |
| `HR_ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | Session length (12 h, so recruiters sign in daily) |
| `HR_TIMEZONE` | `Asia/Kolkata` | Business timezone for attendance days and reports |
| `HR_OFFICE_START_TIME` | `09:45` | Sign-ins after this are marked late |
| `HR_CORS_ORIGINS` | `["http://localhost:3100"]` | Only needed if the browser calls the API directly |
| `HR_SEED_DEMO_DATA` | `true` | Load demo data into an empty database |

## Tests

```bash
cd backend && pytest                                                          # SQLite
TEST_DATABASE_URL=postgresql+psycopg://user@localhost/hr_test pytest          # PostgreSQL
cd ../frontend && npm run typecheck && npm run build
```

## Project layout

```
backend/app
  main.py            FastAPI app, routers, startup (create tables + seed)
  models.py          Users, Clients, Positions, Candidates, InterviewRounds, StageHistory, Attendance
  pipeline.py        Stage definitions (single source of truth for the pipeline)
  schemas.py         Request/response models and validation
  routers/           auth, users, clients, positions (+sheet, import/export), candidates (+interviews),
                     dashboard, reports, attendance, meta
  services/          stage automation, attendance, aggregations/reporting, Excel helpers, serializers
backend/tests        API tests covering auth, permissions, pipeline automation, reports, import/export
frontend/src
  app/login          Sign-in page (marks attendance)
  app/(app)/...      Dashboard, clients, positions/[id] sheet, candidates, interviews, reports, attendance, team
  components/        App shell, candidate sheet, kanban board, candidate drawer, forms, charts, UI kit
  lib/               API client, auth context, stage colours, formatting
```

Tables are created automatically on startup; for schema changes in production add a migration tool such as Alembic.
