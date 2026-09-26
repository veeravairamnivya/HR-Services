from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import utcnow
from ..deps import DB, CurrentUser
from ..models import Candidate, Client, InterviewRound, Position
from ..schemas import (
    BulkStageChange,
    CandidateDetail,
    CandidateListItem,
    CandidateOut,
    CandidateUpdate,
    DuplicateMatch,
    InterviewCreate,
    InterviewOut,
    InterviewUpdate,
    Page,
    StageChange,
)
from ..services.candidate_service import can_edit_candidate, ensure_can_edit, find_duplicates, resolve_recruiter
from ..services.pipeline_service import apply_interview_outcome, change_stage, on_interview_scheduled
from ..services.serializers import candidates_out
from ..services.timeutil import day_bounds_utc, local_today

router = APIRouter(tags=["candidates"])

_LOAD = (
    selectinload(Candidate.recruiter),
    selectinload(Candidate.position).selectinload(Position.client),
    selectinload(Candidate.position).selectinload(Position.recruiters),
)


def get_candidate(db: Session, candidate_id: int) -> Candidate:
    candidate = db.get(Candidate, candidate_id, options=_LOAD)
    if candidate is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Candidate not found.")
    return candidate


def _detail(db: Session, candidate: Candidate) -> dict:
    data = candidates_out(db, [candidate], with_position=True)[0]
    data["interviews"] = candidate.interviews
    data["history"] = candidate.history
    return data


@router.get("/candidates", response_model=Page)
def search_candidates(
    user: CurrentUser,
    db: DB,
    q: str | None = None,
    stage: str | None = Query(default=None, description="Comma separated stage keys"),
    position_id: int | None = None,
    client_id: int | None = None,
    recruiter_id: int | None = None,
    mine: bool = False,
    added_from: date | None = None,
    added_to: date | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Search candidates across every client and position."""
    stmt = select(Candidate).join(Position).join(Client)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Candidate.full_name).like(like),
                func.lower(Candidate.email).like(like),
                Candidate.phone.like(like),
                func.lower(Candidate.current_company).like(like),
                func.lower(Candidate.skills).like(like),
                func.lower(Position.title).like(like),
                func.lower(Client.name).like(like),
            )
        )
    if stage:
        stmt = stmt.where(Candidate.stage.in_(stage.split(",")))
    if position_id:
        stmt = stmt.where(Candidate.position_id == position_id)
    if client_id:
        stmt = stmt.where(Position.client_id == client_id)
    if mine:
        stmt = stmt.where(Candidate.recruiter_id == user.id)
    elif recruiter_id:
        stmt = stmt.where(Candidate.recruiter_id == recruiter_id)
    if added_from or added_to:
        lo, hi = day_bounds_utc(added_from or date(2000, 1, 1), added_to or local_today())
        stmt = stmt.where(Candidate.created_at >= lo, Candidate.created_at < hi)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.options(*_LOAD).order_by(Candidate.updated_at.desc()).limit(limit).offset(offset)).all()
    items = [CandidateListItem.model_validate(c) for c in candidates_out(db, rows, with_position=True)]
    return Page(total=total, items=items)


@router.get("/candidates/duplicates", response_model=list[DuplicateMatch])
def check_duplicates(_: CurrentUser, db: DB, email: str | None = None, phone: str | None = None, exclude_id: int | None = None):
    """Find existing candidates with the same email or phone, across all positions."""
    return find_duplicates(db, email, phone, exclude_id=exclude_id)[:20]


@router.post("/candidates/bulk-stage")
def bulk_stage(body: BulkStageChange, user: CurrentUser, db: DB):
    candidates = db.scalars(select(Candidate).where(Candidate.id.in_(body.candidate_ids)).options(*_LOAD)).all()
    updated, denied = 0, 0
    for candidate in candidates:
        if not can_edit_candidate(user, candidate):
            denied += 1
            continue
        updated += change_stage(db, candidate, body.stage, user, body.note)
    db.commit()
    return {"updated": updated, "denied": denied}


@router.get("/candidates/{candidate_id}", response_model=CandidateDetail)
def candidate_detail(candidate_id: int, _: CurrentUser, db: DB):
    return _detail(db, get_candidate(db, candidate_id))


@router.patch("/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(candidate_id: int, body: CandidateUpdate, user: CurrentUser, db: DB):
    """Update any cell of the tracker sheet. Changing `stage` records pipeline history."""
    candidate = get_candidate(db, candidate_id)
    ensure_can_edit(user, candidate)
    data = body.model_dump(exclude_unset=True)
    stage = data.pop("stage", None)
    note = data.pop("stage_note", None)
    if "recruiter_id" in data:
        candidate.recruiter_id = resolve_recruiter(db, data.pop("recruiter_id"), user)
    if ("email" in data or "phone" in data) and (data.get("email") or data.get("phone")):
        dupes = find_duplicates(db, data.get("email"), data.get("phone"), position_id=candidate.position_id, exclude_id=candidate.id)
        if dupes:
            raise HTTPException(http.HTTP_409_CONFLICT, f"{dupes[0].full_name} already uses this email/phone in this position.")
    for key, value in data.items():
        if key == "full_name" and value is None:
            continue
        setattr(candidate, key, value)
    if stage:
        change_stage(db, candidate, stage, user, note)
    candidate.updated_at = utcnow()
    db.commit()
    return candidates_out(db, [candidate])[0]


@router.post("/candidates/{candidate_id}/stage", response_model=CandidateOut)
def move_stage(candidate_id: int, body: StageChange, user: CurrentUser, db: DB):
    candidate = get_candidate(db, candidate_id)
    ensure_can_edit(user, candidate)
    change_stage(db, candidate, body.stage, user, body.note)
    candidate.updated_at = utcnow()
    db.commit()
    return candidates_out(db, [candidate])[0]


@router.delete("/candidates/{candidate_id}", status_code=204)
def delete_candidate(candidate_id: int, user: CurrentUser, db: DB):
    candidate = get_candidate(db, candidate_id)
    ensure_can_edit(user, candidate)
    db.delete(candidate)
    db.commit()


# ---------------------------------------------------------------- interviews
@router.post("/candidates/{candidate_id}/interviews", response_model=InterviewOut, status_code=201)
def schedule_interview(candidate_id: int, body: InterviewCreate, user: CurrentUser, db: DB):
    candidate = get_candidate(db, candidate_id)
    ensure_can_edit(user, candidate)
    data = body.model_dump()
    if data["round_number"] is None:
        data["round_number"] = max((i.round_number for i in candidate.interviews), default=0) + 1
    interview = InterviewRound(**data, candidate=candidate, created_by_id=user.id)
    db.add(interview)
    on_interview_scheduled(db, interview, user)
    candidate.updated_at = utcnow()
    db.commit()
    return interview


def _get_interview(db: Session, interview_id: int) -> InterviewRound:
    interview = db.get(InterviewRound, interview_id)
    if interview is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Interview not found.")
    return interview


@router.patch("/interviews/{interview_id}", response_model=InterviewOut)
def update_interview(interview_id: int, body: InterviewUpdate, user: CurrentUser, db: DB):
    """Update an interview round. Recording a result moves the candidate along the pipeline automatically."""
    interview = _get_interview(db, interview_id)
    ensure_can_edit(user, interview.candidate)
    data = body.model_dump(exclude_unset=True)
    previous_result = interview.result
    for key, value in data.items():
        if value is None and key in ("round_number", "mode", "result"):
            continue
        setattr(interview, key, value)
    if interview.result != previous_result:
        apply_interview_outcome(db, interview, user)
    interview.candidate.updated_at = utcnow()
    db.commit()
    return interview


@router.delete("/interviews/{interview_id}", status_code=204)
def delete_interview(interview_id: int, user: CurrentUser, db: DB):
    interview = _get_interview(db, interview_id)
    ensure_can_edit(user, interview.candidate)
    db.delete(interview)
    db.commit()


@router.get("/interviews")
def list_interviews(
    user: CurrentUser,
    db: DB,
    start: date | None = None,
    end: date | None = None,
    mine: bool = False,
    result: str | None = None,
):
    """Interview calendar. Defaults to today and the next 7 days."""
    start = start or local_today()
    end = end or date.fromordinal(start.toordinal() + 7)
    lo, hi = day_bounds_utc(start, end)
    stmt = (
        select(InterviewRound)
        .join(Candidate)
        .where(InterviewRound.scheduled_at >= lo, InterviewRound.scheduled_at < hi)
        .options(
            selectinload(InterviewRound.candidate).selectinload(Candidate.position).selectinload(Position.client),
            selectinload(InterviewRound.candidate).selectinload(Candidate.recruiter),
        )
        .order_by(InterviewRound.scheduled_at)
    )
    if mine:
        stmt = stmt.where(Candidate.recruiter_id == user.id)
    if result:
        stmt = stmt.where(InterviewRound.result == result)
    return [interview_with_context(i) for i in db.scalars(stmt)]


def interview_with_context(interview: InterviewRound) -> dict:
    c = interview.candidate
    return {
        **InterviewOut.model_validate(interview).model_dump(),
        "candidate_name": c.full_name,
        "candidate_phone": c.phone,
        "candidate_stage": c.stage,
        "position_id": c.position_id,
        "position_title": c.position.title,
        "client_name": c.position.client.name,
        "recruiter_name": c.recruiter.full_name if c.recruiter else None,
    }
