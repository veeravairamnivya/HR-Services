"""Aggregations used by the dashboard and reports."""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Attendance, Candidate, Client, InterviewRound, Position, StageHistory, User
from ..pipeline import PIPELINE, PROGRESS_STAGES, STAGE_KEYS
from .attendance_service import hours_worked
from .timeutil import day_bounds_utc

MILESTONES = ("shortlisted", "interview_scheduled", "offer_released", "joined", "rejected")


def transition_counts(db: Session, start: date, end: date, group_col) -> dict:
    """{group: {to_stage: distinct candidates}} for stage transitions within the local date range."""
    lo, hi = day_bounds_utc(start, end)
    rows = db.execute(
        select(group_col, StageHistory.to_stage, func.count(func.distinct(StageHistory.candidate_id)))
        .select_from(StageHistory)
        .join(Candidate, Candidate.id == StageHistory.candidate_id)
        .join(Position, Position.id == Candidate.position_id)
        .where(StageHistory.changed_at >= lo, StageHistory.changed_at < hi, StageHistory.from_stage.is_not(None))
        .group_by(group_col, StageHistory.to_stage)
    )
    out: dict = defaultdict(lambda: defaultdict(int))
    for group, stage, count in rows:
        out[group][stage] = count
    return out


def added_counts(db: Session, start: date, end: date, group_col) -> dict:
    lo, hi = day_bounds_utc(start, end)
    rows = db.execute(
        select(group_col, func.count())
        .select_from(Candidate)
        .join(Position, Position.id == Candidate.position_id)
        .where(Candidate.created_at >= lo, Candidate.created_at < hi)
        .group_by(group_col)
    )
    return {g: c for g, c in rows}


def interview_counts(db: Session, start: date, end: date, group_col) -> dict:
    lo, hi = day_bounds_utc(start, end)
    rows = db.execute(
        select(group_col, func.count())
        .select_from(InterviewRound)
        .join(Candidate, Candidate.id == InterviewRound.candidate_id)
        .join(Position, Position.id == Candidate.position_id)
        .where(InterviewRound.scheduled_at >= lo, InterviewRound.scheduled_at < hi)
        .group_by(group_col)
    )
    return {g: c for g, c in rows}


def _working_days(start: date, end: date) -> int:
    days = 0
    d = start
    while d <= end:
        days += d.weekday() < 6  # Monday-Saturday
        d += timedelta(days=1)
    return days


def recruiter_performance(db: Session, start: date, end: date) -> list[dict]:
    users = db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name)).all()
    added = added_counts(db, start, end, Candidate.recruiter_id)
    moves = transition_counts(db, start, end, Candidate.recruiter_id)
    interviews = interview_counts(db, start, end, Candidate.recruiter_id)
    presence = dict(
        db.execute(
            select(Attendance.user_id, func.count())
            .where(Attendance.work_date >= start, Attendance.work_date <= end)
            .group_by(Attendance.user_id)
        ).all()
    )
    rows = []
    for u in users:
        m = moves.get(u.id, {})
        count_added = added.get(u.id, 0)
        days_present = presence.get(u.id, 0)
        target = u.daily_target * max(days_present, 1)
        row = {
            "user_id": u.id,
            "name": u.full_name,
            "role": u.role,
            "days_present": days_present,
            "added": count_added,
            "target": target,
            "target_pct": round(count_added * 100 / target, 1) if target else 0,
            "screening": m.get("screening", 0),
            "shortlisted": m.get("shortlisted", 0),
            "interviews": interviews.get(u.id, 0),
            "round1": m.get("round1_selected", 0),
            "round2": m.get("round2_selected", 0),
            "round3": m.get("round3_selected", 0),
            "hr_discussion": m.get("hr_discussion", 0),
            "offers": m.get("offer_released", 0),
            "joined": m.get("joined", 0),
            "rejected": m.get("rejected", 0),
        }
        row["shortlist_ratio"] = round(row["shortlisted"] * 100 / count_added, 1) if count_added else 0
        row["score"] = (
            row["added"] + 2 * row["shortlisted"] + 3 * row["interviews"] + 8 * row["offers"] + 15 * row["joined"]
        )
        if u.role == "recruiter" or any(row[k] for k in ("added", "shortlisted", "interviews", "offers", "joined")):
            rows.append(row)
    rows.sort(key=lambda r: r["score"], reverse=True)
    return rows


def client_report(db: Session, start: date, end: date) -> list[dict]:
    clients = db.scalars(select(Client).order_by(Client.name)).all()
    added = added_counts(db, start, end, Position.client_id)
    moves = transition_counts(db, start, end, Position.client_id)
    interviews = interview_counts(db, start, end, Position.client_id)
    positions = defaultdict(lambda: {"open": 0, "openings": 0, "total": 0})
    for client_id, status, count, openings in db.execute(
        select(Position.client_id, Position.status, func.count(), func.coalesce(func.sum(Position.openings), 0)).group_by(
            Position.client_id, Position.status
        )
    ):
        positions[client_id]["total"] += count
        if status in ("open", "on_hold"):
            positions[client_id]["open"] += count
            positions[client_id]["openings"] += int(openings)
    total_joined = dict(
        db.execute(
            select(Position.client_id, func.count())
            .select_from(Candidate)
            .join(Position)
            .where(Candidate.stage == "joined")
            .group_by(Position.client_id)
        ).all()
    )
    rows = []
    for c in clients:
        m = moves.get(c.id, {})
        p = positions[c.id]
        rows.append(
            {
                "client_id": c.id,
                "name": c.name,
                "status": c.status,
                "positions": p["total"],
                "active_positions": p["open"],
                "open_openings": p["openings"],
                "added": added.get(c.id, 0),
                "shortlisted": m.get("shortlisted", 0),
                "interviews": interviews.get(c.id, 0),
                "offers": m.get("offer_released", 0),
                "joined": m.get("joined", 0),
                "total_joined": total_joined.get(c.id, 0),
            }
        )
    return rows


def position_report(db: Session, status: str | None = None, client_id: int | None = None) -> list[dict]:
    stmt = select(Position).join(Client).order_by(Client.name, Position.title)
    if status == "active":
        stmt = stmt.where(Position.status.in_(("open", "on_hold")))
    elif status:
        stmt = stmt.where(Position.status == status)
    if client_id:
        stmt = stmt.where(Position.client_id == client_id)
    positions = db.scalars(stmt).all()
    counts: dict = defaultdict(lambda: defaultdict(int))
    if positions:
        for pid, stage, count in db.execute(
            select(Candidate.position_id, Candidate.stage, func.count())
            .where(Candidate.position_id.in_([p.id for p in positions]))
            .group_by(Candidate.position_id, Candidate.stage)
        ):
            counts[pid][stage] = count
    rows = []
    for p in positions:
        c = counts[p.id]
        row = {
            "position_id": p.id,
            "client": p.client.name,
            "title": p.title,
            "status": p.status,
            "priority": p.priority,
            "openings": p.openings,
            "total": sum(c.values()),
            "recruiters": ", ".join(r.full_name for r in p.recruiters),
        }
        row.update({k: c.get(k, 0) for k in STAGE_KEYS})
        rows.append(row)
    return rows


def attendance_report(db: Session, start: date, end: date, user_id: int | None = None) -> dict:
    stmt = (
        select(Attendance)
        .join(User)
        .where(Attendance.work_date >= start, Attendance.work_date <= end)
        .order_by(Attendance.work_date.desc(), User.full_name)
    )
    if user_id:
        stmt = stmt.where(Attendance.user_id == user_id)
    records = db.scalars(stmt).all()
    users_stmt = select(User).where(User.is_active.is_(True)).order_by(User.full_name)
    if user_id:
        users_stmt = select(User).where(User.id == user_id)
    working_days = _working_days(start, end)
    summary = []
    for u in db.scalars(users_stmt):
        mine = [r for r in records if r.user_id == u.id]
        hours = [hours_worked(r) for r in mine]
        summary.append(
            {
                "user_id": u.id,
                "name": u.full_name,
                "role": u.role,
                "present": len(mine),
                "late": sum(r.status == "late" for r in mine),
                "absent": max(working_days - len(mine), 0),
                "avg_hours": round(sum(hours) / len(hours), 2) if hours else 0,
                "total_hours": round(sum(hours), 2),
            }
        )
    return {"working_days": working_days, "summary": summary, "records": records}


def daily_activity(db: Session, day: date) -> list[dict]:
    """What each recruiter did on a given day: attendance, candidates added and stage moves."""
    lo, hi = day_bounds_utc(day)
    users = db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name)).all()
    attendance = {
        a.user_id: a for a in db.scalars(select(Attendance).where(Attendance.work_date == day))
    }
    added = dict(
        db.execute(
            select(Candidate.recruiter_id, func.count())
            .where(Candidate.created_at >= lo, Candidate.created_at < hi)
            .group_by(Candidate.recruiter_id)
        ).all()
    )
    moves: dict = defaultdict(lambda: defaultdict(int))
    for user_id, stage, count in db.execute(
        select(StageHistory.changed_by_id, StageHistory.to_stage, func.count())
        .where(StageHistory.changed_at >= lo, StageHistory.changed_at < hi, StageHistory.from_stage.is_not(None))
        .group_by(StageHistory.changed_by_id, StageHistory.to_stage)
    ):
        moves[user_id][stage] = count
    rows = []
    for u in users:
        a = attendance.get(u.id)
        m = moves.get(u.id, {})
        rows.append(
            {
                "user_id": u.id,
                "name": u.full_name,
                "role": u.role,
                "status": a.status if a else "absent",
                "login_at": a.login_at if a else None,
                "logout_at": a.logout_at if a else None,
                "hours": hours_worked(a) if a else 0,
                "work_summary": a.work_summary if a else None,
                "added": added.get(u.id, 0),
                "target": u.daily_target,
                "stage_updates": sum(m.values()),
                "shortlisted": m.get("shortlisted", 0),
                "interviews": m.get("interview_scheduled", 0),
                "offers": m.get("offer_released", 0),
                "joined": m.get("joined", 0),
            }
        )
    return rows


def funnel(db: Session, recruiter_id: int | None = None, position_ids=None) -> list[dict]:
    stmt = select(Candidate.max_stage_rank, func.count()).group_by(Candidate.max_stage_rank)
    if recruiter_id:
        stmt = stmt.where(Candidate.recruiter_id == recruiter_id)
    if position_ids is not None:
        stmt = stmt.where(Candidate.position_id.in_(position_ids))
    by_rank = dict(db.execute(stmt).all())
    return [
        {"stage": s.key, "label": s.label, "count": sum(c for r, c in by_rank.items() if (r or 0) >= s.rank)}
        for s in PROGRESS_STAGES
    ]


def stage_distribution(db: Session, recruiter_id: int | None = None) -> list[dict]:
    stmt = (
        select(Candidate.stage, func.count())
        .join(Position)
        .where(Position.status.in_(("open", "on_hold")))
        .group_by(Candidate.stage)
    )
    if recruiter_id:
        stmt = stmt.where(Candidate.recruiter_id == recruiter_id)
    counts = dict(db.execute(stmt).all())
    return [{"stage": s.key, "label": s.label, "color": s.color, "count": counts.get(s.key, 0)} for s in PIPELINE]

