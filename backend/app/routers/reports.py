from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import select

from ..config import get_settings
from ..deps import DB, CurrentUser, Manager, is_manager
from ..models import Candidate, Position
from ..pipeline import PIPELINE
from ..services.attendance_service import attendance_out
from ..services.reporting import (
    attendance_report,
    client_report,
    daily_activity,
    position_report,
    recruiter_performance,
)
from ..services.spreadsheet import CANDIDATE_HEADERS, build_workbook, candidate_rows
from ..services.timeutil import local_today, month_start

router = APIRouter(prefix="/reports", tags=["reports"])


def _range(start: date | None, end: date | None) -> tuple[date, date]:
    today = local_today()
    start = start or month_start(today)
    end = end or today
    if start > end:
        raise HTTPException(400, "Start date must be before end date.")
    if (end - start).days > 366 * 2:
        raise HTTPException(400, "Date range is limited to two years.")
    return start, end


@router.get("/recruiters")
def recruiters(_: CurrentUser, db: DB, start: date | None = None, end: date | None = None):
    start, end = _range(start, end)
    return {"start": start, "end": end, "rows": recruiter_performance(db, start, end)}


@router.get("/clients")
def clients(_: CurrentUser, db: DB, start: date | None = None, end: date | None = None):
    start, end = _range(start, end)
    return {"start": start, "end": end, "rows": client_report(db, start, end)}


@router.get("/positions")
def positions(_: CurrentUser, db: DB, status: str | None = "active", client_id: int | None = None):
    return {
        "stages": [{"key": s.key, "label": s.label, "color": s.color} for s in PIPELINE],
        "rows": position_report(db, status, client_id),
    }


@router.get("/attendance")
def attendance(
    user: CurrentUser, db: DB, start: date | None = None, end: date | None = None, user_id: int | None = None
):
    start, end = _range(start, end)
    if not is_manager(user):
        user_id = user.id  # recruiters only see their own attendance
    data = attendance_report(db, start, end, user_id)
    data["records"] = [attendance_out(r, include_user=True) for r in data["records"]]
    return {"start": start, "end": end, **data}


@router.get("/daily")
def daily(_: Manager, db: DB, day: date | None = None):
    day = day or local_today()
    return {"day": day, "rows": daily_activity(db, day)}


# ---------------------------------------------------------------- exports
RECRUITER_COLS = [
    ("Recruiter", "name"), ("Days Present", "days_present"), ("Candidates Added", "added"), ("Target", "target"),
    ("Target %", "target_pct"), ("Screening", "screening"), ("Shortlisted", "shortlisted"),
    ("Interviews", "interviews"), ("Round 1", "round1"), ("Round 2", "round2"), ("Round 3", "round3"),
    ("HR Discussion", "hr_discussion"), ("Offers", "offers"), ("Joined", "joined"), ("Rejected", "rejected"),
    ("Shortlist %", "shortlist_ratio"), ("Score", "score"),
]
CLIENT_COLS = [
    ("Client", "name"), ("Status", "status"), ("Positions", "positions"), ("Active Positions", "active_positions"),
    ("Open Openings", "open_openings"), ("Candidates Added", "added"), ("Shortlisted", "shortlisted"),
    ("Interviews", "interviews"), ("Offers", "offers"), ("Joined (period)", "joined"), ("Joined (all time)", "total_joined"),
]
ATTENDANCE_SUMMARY_COLS = [
    ("Name", "name"), ("Role", "role"), ("Present", "present"), ("Late", "late"), ("Absent", "absent"),
    ("Avg Hours", "avg_hours"), ("Total Hours", "total_hours"),
]
DAILY_COLS = [
    ("Name", "name"), ("Status", "status"), ("Login", "login_at"), ("Logout", "logout_at"), ("Hours", "hours"),
    ("Added", "added"), ("Target", "target"), ("Stage Updates", "stage_updates"), ("Shortlisted", "shortlisted"),
    ("Interviews", "interviews"), ("Offers", "offers"), ("Joined", "joined"), ("Work Summary", "work_summary"),
]


def _local(value):
    """Excel cannot store timezone-aware datetimes; show them in the business timezone."""
    if isinstance(value, datetime) and value.tzinfo:
        return value.astimezone(get_settings().tz).replace(tzinfo=None)
    return value


def _table(rows: list[dict], cols) -> tuple[list[str], list[list]]:
    return [c[0] for c in cols], [[_local(r.get(c[1])) for c in cols] for r in rows]


def _xlsx(content: bytes, name: str) -> Response:
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}.xlsx"'},
    )


@router.get("/export/{kind}")
def export(
    kind: str,
    user: CurrentUser,
    db: DB,
    start: date | None = None,
    end: date | None = None,
    status: str | None = "active",
    client_id: int | None = None,
    day: date | None = None,
    user_id: int | None = None,
    stage: str | None = Query(default=None),
):
    """Download a report as Excel: recruiters | clients | positions | attendance | daily | candidates."""
    start, end = _range(start, end)
    suffix = f"{start}_to_{end}"
    if kind == "recruiters":
        headers, rows = _table(recruiter_performance(db, start, end), RECRUITER_COLS)
        return _xlsx(build_workbook([("Recruiter Performance", headers, rows)]), f"recruiter_performance_{suffix}")
    if kind == "clients":
        headers, rows = _table(client_report(db, start, end), CLIENT_COLS)
        return _xlsx(build_workbook([("Clients", headers, rows)]), f"client_report_{suffix}")
    if kind == "positions":
        cols = [("Client", "client"), ("Position", "title"), ("Status", "status"), ("Priority", "priority"),
                ("Openings", "openings"), ("Recruiters", "recruiters"), ("Total", "total")]
        cols += [(s.label, s.key) for s in PIPELINE]
        headers, rows = _table(position_report(db, status, client_id), cols)
        return _xlsx(build_workbook([("Positions", headers, rows)]), f"position_pipeline_{local_today()}")
    if kind == "attendance":
        if not is_manager(user):
            user_id = user.id
        data = attendance_report(db, start, end, user_id)
        headers, rows = _table(data["summary"], ATTENDANCE_SUMMARY_COLS)
        detail = [attendance_out(r, include_user=True) for r in data["records"]]
        detail_rows = [
            [d["user"].full_name, d["work_date"], d["status"], _local(d["login_at"]), _local(d["logout_at"]),
             d["hours_worked"], d["work_summary"]]
            for d in detail
        ]
        return _xlsx(
            build_workbook([
                ("Summary", headers, rows),
                ("Daily Log", ["Name", "Date", "Status", "Login", "Logout", "Hours", "Summary"], detail_rows),
            ]),
            f"attendance_{suffix}",
        )
    if kind == "daily":
        if not is_manager(user):
            raise HTTPException(403, "Only managers can export the daily team report.")
        day = day or local_today()
        headers, rows = _table(daily_activity(db, day), DAILY_COLS)
        return _xlsx(build_workbook([("Daily Report", headers, rows)]), f"daily_report_{day}")
    if kind == "candidates":
        stmt = select(Candidate).join(Position).order_by(Position.title, Candidate.created_at)
        if client_id:
            stmt = stmt.where(Position.client_id == client_id)
        if stage:
            stmt = stmt.where(Candidate.stage.in_(stage.split(",")))
        candidates = db.scalars(stmt).all()
        headers = ["Client", "Position"] + CANDIDATE_HEADERS
        rows = [
            [c.position.client.name, c.position.title, *row]
            for c, row in zip(candidates, candidate_rows(candidates))
        ]
        return _xlsx(build_workbook([("Candidates", headers, rows)]), f"candidates_{local_today()}")
    raise HTTPException(404, "Unknown report.")


@router.get("/weekly-summary")
def weekly_summary(_: CurrentUser, db: DB):
    """Last 7 days vs the 7 days before, for quick trend badges."""
    today = local_today()
    this_week = recruiter_performance(db, today - timedelta(days=6), today)
    last_week = recruiter_performance(db, today - timedelta(days=13), today - timedelta(days=7))

    def total(rows, key):
        return sum(r[key] for r in rows)

    keys = ("added", "shortlisted", "interviews", "offers", "joined")
    return {k: {"current": total(this_week, k), "previous": total(last_week, k)} for k in keys}
