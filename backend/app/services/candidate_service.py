from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..deps import is_manager
from ..models import Candidate, Position, User
from ..schemas import CandidateCreate
from .pipeline_service import change_stage


def _digits(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits or None


def find_duplicates(
    db: Session,
    email: str | None,
    phone: str | None,
    position_id: int | None = None,
    exclude_id: int | None = None,
) -> list[Candidate]:
    conditions = []
    if email:
        conditions.append(func.lower(Candidate.email) == email.lower())
    digits = _digits(phone)
    if digits:
        conditions.append(Candidate.phone.like(f"%{digits}"))
    if not conditions:
        return []
    stmt = (
        select(Candidate)
        .where(or_(*conditions))
        .options(selectinload(Candidate.position).selectinload(Position.client), selectinload(Candidate.recruiter))
        .order_by(Candidate.created_at.desc())
    )
    if position_id:
        stmt = stmt.where(Candidate.position_id == position_id)
    if exclude_id:
        stmt = stmt.where(Candidate.id != exclude_id)
    return list(db.scalars(stmt).all())


def resolve_recruiter(db: Session, requested_id: int | None, user: User) -> int:
    if requested_id is None or requested_id == user.id:
        return user.id
    if not is_manager(user):
        raise HTTPException(http.HTTP_403_FORBIDDEN, "Only managers can assign candidates to other recruiters.")
    recruiter = db.get(User, requested_id)
    if recruiter is None or not recruiter.is_active:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "Recruiter not found.")
    return recruiter.id


def create_candidate(
    db: Session, position: Position, body: CandidateCreate, user: User, check_duplicates: bool = True
) -> Candidate:
    if position.status in ("closed", "filled"):
        raise HTTPException(http.HTTP_400_BAD_REQUEST, f"Position is {position.status}; reopen it to add candidates.")
    if check_duplicates:
        dupes = find_duplicates(db, body.email, body.phone, position_id=position.id)
        if dupes:
            raise HTTPException(
                http.HTTP_409_CONFLICT,
                f"{dupes[0].full_name} with the same email/phone is already in this position's sheet.",
            )
    data = body.model_dump(exclude={"stage", "recruiter_id"})
    candidate = Candidate(**data, position=position, recruiter_id=resolve_recruiter(db, body.recruiter_id, user))
    candidate.max_stage_rank = 0
    candidate.stage = body.stage
    db.add(candidate)
    change_stage(db, candidate, body.stage, user, "Candidate added")
    return candidate


def can_edit_candidate(user: User, candidate: Candidate) -> bool:
    if is_manager(user) or candidate.recruiter_id == user.id:
        return True
    return any(r.id == user.id for r in candidate.position.recruiters)


def ensure_can_edit(user: User, candidate: Candidate) -> None:
    if not can_edit_candidate(user, candidate):
        raise HTTPException(
            http.HTTP_403_FORBIDDEN,
            "Only the owning recruiter, recruiters assigned to this position or managers can edit this candidate.",
        )
