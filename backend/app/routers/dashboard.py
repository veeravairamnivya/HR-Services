from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..deps import DB, CurrentUser
from ..models import Attendance, Candidate, Client, InterviewRound, Position, StageHistory, User
from ..pipeline import stage_label
from ..services.reporting import funnel, recruiter_performance, stage_distribution
from ..services.serializers import positions_out
from ..services.timeutil import add_months, day_bounds_utc, local_today, month_start
from .candidates import interview_with_context

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(user: CurrentUser, db: DB, scope: str = Query(default="team", pattern="^(team|me)$")):
    """Everything the home dashboard needs in one call. `scope=me` limits candidate metrics to the caller."""
    today = local_today()
    mine = user.id if scope == "me" else None
    today_lo, today_hi = day_bounds_utc(today)
    week_lo, week_hi = day_bounds_utc(today, today + timedelta(days=6))
    month_lo, month_hi = day_bounds_utc(month_start(today), today)

    def cand_count(*conditions) -> int:
        stmt = select(func.count()).select_from(Candidate).where(*conditions)
        if mine:
            stmt = stmt.where(Candidate.recruiter_id == mine)
        return db.scalar(stmt) or 0

    def interview_count(lo, hi) -> int:
        stmt = (
            select(func.count())
            .select_from(InterviewRound)
            .join(Candidate)
            .where(InterviewRound.scheduled_at >= lo, InterviewRound.scheduled_at < hi)
        )
        if mine:
            stmt = stmt.where(Candidate.recruiter_id == mine)
        return db.scalar(stmt) or 0

    def reached(stage: str, lo, hi) -> int:
        stmt = (
            select(func.count(func.distinct(StageHistory.candidate_id)))
            .join(Candidate)
            .where(StageHistory.to_stage == stage, StageHistory.changed_at >= lo, StageHistory.changed_at < hi)
        )
        if mine:
            stmt = stmt.where(Candidate.recruiter_id == mine)
        return db.scalar(stmt) or 0

    open_positions = db.execute(
        select(func.count(), func.coalesce(func.sum(Position.openings), 0)).where(Position.status == "open")
    ).one()
    team_size = db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0
    present_today = db.scalar(select(func.count()).select_from(Attendance).where(Attendance.work_date == today)) or 0
    active_pipeline = cand_count(Candidate.stage.not_in(("rejected", "dropped", "joined")))

    kpis = {
        "active_clients": db.scalar(select(func.count()).select_from(Client).where(Client.status == "active")) or 0,
        "open_positions": open_positions[0],
        "total_openings": int(open_positions[1]),
        "active_pipeline": active_pipeline,
        "total_candidates": cand_count(),
        "added_today": cand_count(Candidate.created_at >= today_lo, Candidate.created_at < today_hi),
        "added_month": cand_count(Candidate.created_at >= month_lo, Candidate.created_at < month_hi),
        "interviews_today": interview_count(today_lo, today_hi),
        "interviews_week": interview_count(week_lo, week_hi),
        "offers_month": reached("offer_released", month_lo, month_hi),
        "joined_month": reached("joined", month_lo, month_hi),
        "team_size": team_size,
        "present_today": present_today,
    }

    # Six-month trend, bucketed by local month.
    first_month = add_months(month_start(today), -5)
    trend_lo, _ = day_bounds_utc(first_month)
    buckets: dict[str, dict[str, int]] = {}
    for i in range(6):
        m = add_months(first_month, i)
        buckets[m.strftime("%Y-%m")] = {"month": m.strftime("%b %y"), "added": 0, "interviews": 0, "offers": 0, "joined": 0}
    tz = get_settings().tz

    def bucket(dt) -> str:
        return dt.astimezone(tz).strftime("%Y-%m")

    stmt = select(Candidate.created_at).where(Candidate.created_at >= trend_lo)
    if mine:
        stmt = stmt.where(Candidate.recruiter_id == mine)
    for (created,) in db.execute(stmt):
        if (key := bucket(created)) in buckets:
            buckets[key]["added"] += 1
    stmt = select(InterviewRound.scheduled_at).join(Candidate).where(InterviewRound.scheduled_at >= trend_lo)
    if mine:
        stmt = stmt.where(Candidate.recruiter_id == mine)
    for (scheduled,) in db.execute(stmt):
        if (key := bucket(scheduled)) in buckets:
            buckets[key]["interviews"] += 1
    stmt = (
        select(StageHistory.changed_at, StageHistory.to_stage)
        .join(Candidate)
        .where(StageHistory.changed_at >= trend_lo, StageHistory.to_stage.in_(("offer_released", "joined")))
    )
    if mine:
        stmt = stmt.where(Candidate.recruiter_id == mine)
    for changed, to_stage in db.execute(stmt):
        if (key := bucket(changed)) in buckets:
            buckets[key]["offers" if to_stage == "offer_released" else "joined"] += 1

    # Upcoming interviews.
    stmt = (
        select(InterviewRound)
        .join(Candidate)
        .where(InterviewRound.scheduled_at >= today_lo, InterviewRound.scheduled_at < week_hi, InterviewRound.result == "pending")
        .options(
            selectinload(InterviewRound.candidate).selectinload(Candidate.position).selectinload(Position.client),
            selectinload(InterviewRound.candidate).selectinload(Candidate.recruiter),
        )
        .order_by(InterviewRound.scheduled_at)
        .limit(10)
    )
    if mine:
        stmt = stmt.where(Candidate.recruiter_id == mine)
    upcoming = [interview_with_context(i) for i in db.scalars(stmt)]

    # Recent activity feed.
    stmt = (
        select(StageHistory)
        .join(Candidate)
        .options(
            selectinload(StageHistory.changed_by),
            selectinload(StageHistory.candidate).selectinload(Candidate.position).selectinload(Position.client),
        )
        .order_by(StageHistory.changed_at.desc())
        .limit(12)
    )
    if mine:
        stmt = stmt.where(Candidate.recruiter_id == mine)
    activity = [
        {
            "id": h.id,
            "candidate_id": h.candidate_id,
            "candidate_name": h.candidate.full_name,
            "position_id": h.candidate.position_id,
            "position_title": h.candidate.position.title,
            "client_name": h.candidate.position.client.name,
            "from_stage": h.from_stage,
            "to_stage": h.to_stage,
            "to_label": stage_label(h.to_stage),
            "note": h.note,
            "by": h.changed_by.full_name if h.changed_by else None,
            "at": h.changed_at,
        }
        for h in db.scalars(stmt)
    ]

    # Hot positions: open, highest priority first.
    stmt = (
        select(Position)
        .where(Position.status == "open")
        .options(selectinload(Position.client), selectinload(Position.recruiters))
    )
    if mine:
        stmt = stmt.where(Position.recruiters.any(User.id == mine))
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    hot = sorted(db.scalars(stmt).all(), key=lambda p: (priority_order.get(p.priority, 9), p.created_at))[:6]

    # Open positions per client.
    per_client = defaultdict(int)
    for name, count in db.execute(
        select(Client.name, func.count()).join(Position).where(Position.status == "open").group_by(Client.name)
    ):
        per_client[name] = count
    client_distribution = sorted(
        ({"client": k, "positions": v} for k, v in per_client.items()), key=lambda r: r["positions"], reverse=True
    )[:8]

    my_attendance = db.scalar(select(Attendance).where(Attendance.user_id == user.id, Attendance.work_date == today))
    my_added_today = db.scalar(
        select(func.count())
        .select_from(Candidate)
        .where(Candidate.recruiter_id == user.id, Candidate.created_at >= today_lo, Candidate.created_at < today_hi)
    ) or 0

    return {
        "scope": scope,
        "today": today,
        "kpis": kpis,
        "stage_distribution": stage_distribution(db, mine),
        "funnel": funnel(db, mine),
        "trend": list(buckets.values()),
        "leaderboard": recruiter_performance(db, month_start(today), today)[:6],
        "upcoming_interviews": upcoming,
        "recent_activity": activity,
        "hot_positions": positions_out(db, hot),
        "client_distribution": client_distribution,
        "my_day": {
            "added_today": my_added_today,
            "daily_target": user.daily_target,
            "checked_in_at": my_attendance.login_at if my_attendance else None,
            "attendance_status": my_attendance.status if my_attendance else "absent",
        },
    }
