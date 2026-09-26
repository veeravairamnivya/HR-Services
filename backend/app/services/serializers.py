"""Builders that attach computed statistics to ORM objects for API responses."""

from collections import defaultdict
from collections.abc import Iterable, Sequence

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..database import utcnow
from ..models import Candidate, Client, InterviewRound, Position
from ..pipeline import stage_rank
from .timeutil import local_today

OFFER_RANK = stage_rank("offer_released")
INTERVIEW_RANK = stage_rank("interview_scheduled")


def _stage_counts_by_position(db: Session, position_ids: Sequence[int]) -> dict[int, dict[str, int]]:
    result: dict[int, dict[str, int]] = defaultdict(dict)
    if not position_ids:
        return result
    rows = db.execute(
        select(Candidate.position_id, Candidate.stage, func.count())
        .where(Candidate.position_id.in_(position_ids))
        .group_by(Candidate.position_id, Candidate.stage)
    )
    for position_id, stage, count in rows:
        result[position_id][stage] = count
    return result


def _milestones_by(db: Session, column, ids: Sequence[int]) -> dict[int, dict[str, int]]:
    """Candidates that ever reached interview / offer / joined, grouped by `column`."""
    result: dict[int, dict[str, int]] = defaultdict(lambda: {"interview": 0, "offer": 0, "joined": 0, "total": 0})
    if not ids:
        return result
    rows = db.execute(
        select(
            column,
            func.count(),
            func.sum(case((Candidate.max_stage_rank >= INTERVIEW_RANK, 1), else_=0)),
            func.sum(case((Candidate.max_stage_rank >= OFFER_RANK, 1), else_=0)),
            func.sum(case((Candidate.stage == "joined", 1), else_=0)),
        )
        .select_from(Candidate)
        .join(Position, Position.id == Candidate.position_id)
        .where(column.in_(ids))
        .group_by(column)
    )
    for key, total, interviews, offers, joined in rows:
        result[key] = {
            "total": total or 0,
            "interview": int(interviews or 0),
            "offer": int(offers or 0),
            "joined": int(joined or 0),
        }
    return result


def positions_out(db: Session, positions: Iterable[Position]) -> list[dict]:
    positions = list(positions)
    ids = [p.id for p in positions]
    stage_counts = _stage_counts_by_position(db, ids)
    milestones = _milestones_by(db, Position.id, ids)
    today = local_today()
    out = []
    for p in positions:
        counts = stage_counts.get(p.id, {})
        m = milestones.get(p.id) or {"interview": 0, "offer": 0, "joined": 0, "total": 0}
        created_local = p.created_at.date() if p.created_at else today
        out.append(
            {
                **{c.key: getattr(p, c.key) for c in Position.__table__.columns},
                "client": p.client,
                "recruiters": p.recruiters,
                "candidate_count": sum(counts.values()),
                "interview_count": m["interview"],
                "offer_count": m["offer"],
                "joined_count": m["joined"],
                "stage_counts": counts,
                "days_open": max((today - created_local).days, 0),
            }
        )
    return out


def clients_out(db: Session, clients: Iterable[Client]) -> list[dict]:
    clients = list(clients)
    ids = [c.id for c in clients]
    pos_stats: dict[int, dict[str, int]] = defaultdict(lambda: {"total": 0, "open": 0, "openings": 0})
    if ids:
        rows = db.execute(
            select(Position.client_id, Position.status, func.count(), func.coalesce(func.sum(Position.openings), 0))
            .where(Position.client_id.in_(ids))
            .group_by(Position.client_id, Position.status)
        )
        for client_id, status, count, openings in rows:
            s = pos_stats[client_id]
            s["total"] += count
            if status == "open":
                s["open"] += count
                s["openings"] += int(openings)
    milestones = _milestones_by(db, Position.client_id, ids)
    out = []
    for c in clients:
        s = pos_stats[c.id]
        m = milestones.get(c.id) or {"offer": 0, "joined": 0, "total": 0}
        out.append(
            {
                **{col.key: getattr(c, col.key) for col in Client.__table__.columns},
                "total_positions": s["total"],
                "open_positions": s["open"],
                "total_openings": s["openings"],
                "total_candidates": m["total"],
                "offers": m["offer"],
                "joined": m["joined"],
            }
        )
    return out


def candidates_out(db: Session, candidates: Iterable[Candidate], with_position: bool = False) -> list[dict]:
    candidates = list(candidates)
    ids = [c.id for c in candidates]
    next_interviews: dict[int, InterviewRound] = {}
    interview_counts: dict[int, int] = {}
    if ids:
        now = utcnow()
        for row in db.scalars(
            select(InterviewRound)
            .where(InterviewRound.candidate_id.in_(ids))
            .order_by(InterviewRound.round_number, InterviewRound.scheduled_at)
        ):
            interview_counts[row.candidate_id] = interview_counts.get(row.candidate_id, 0) + 1
            upcoming = row.result == "pending" and (row.scheduled_at is None or row.scheduled_at >= now)
            if upcoming and row.candidate_id not in next_interviews:
                next_interviews[row.candidate_id] = row
    out = []
    for c in candidates:
        data = {col.key: getattr(c, col.key) for col in Candidate.__table__.columns}
        data["recruiter"] = c.recruiter
        data["next_interview"] = next_interviews.get(c.id)
        data["interview_count"] = interview_counts.get(c.id, 0)
        if with_position:
            data["position"] = c.position
        out.append(data)
    return out
