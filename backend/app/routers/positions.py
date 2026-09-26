from datetime import date

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile
from fastapi import status as http
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..deps import DB, Admin, CurrentUser, Manager
from ..models import Candidate, Client, Position, User, position_recruiters
from ..pipeline import CANDIDATE_SOURCES, STAGES
from ..schemas import CandidateCreate, CandidateOut, ImportResult, PositionCreate, PositionOut, PositionUpdate
from ..services.candidate_service import create_candidate, find_duplicates
from ..services.serializers import candidates_out, positions_out
from ..services.spreadsheet import CANDIDATE_HEADERS, build_workbook, candidate_rows, read_table

router = APIRouter(prefix="/positions", tags=["positions"])

PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def get_position(db: Session, position_id: int) -> Position:
    position = db.get(Position, position_id)
    if position is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Position not found.")
    return position


def _set_recruiters(db: Session, position: Position, recruiter_ids: list[int]) -> None:
    users = db.scalars(select(User).where(User.id.in_(recruiter_ids), User.is_active.is_(True))).all() if recruiter_ids else []
    if len(users) != len(set(recruiter_ids)):
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "One or more recruiters were not found.")
    position.recruiters = list(users)


def _validate(db: Session, data: dict, position: Position | None = None) -> None:
    client_id = data.get("client_id") or (position.client_id if position else None)
    if client_id and db.get(Client, client_id) is None:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "Client not found.")
    lo = data.get("min_experience", position.min_experience if position else None)
    hi = data.get("max_experience", position.max_experience if position else None)
    if lo is not None and hi is not None and lo > hi:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "Minimum experience cannot exceed maximum experience.")
    lo = data.get("min_budget", position.min_budget if position else None)
    hi = data.get("max_budget", position.max_budget if position else None)
    if lo is not None and hi is not None and lo > hi:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "Minimum budget cannot exceed maximum budget.")
    if data.get("job_code"):
        stmt = select(Position.id).where(Position.job_code == data["job_code"])
        if position:
            stmt = stmt.where(Position.id != position.id)
        if db.scalar(stmt):
            raise HTTPException(http.HTTP_409_CONFLICT, "Job code is already in use.")


@router.get("", response_model=list[PositionOut])
def list_positions(
    user: CurrentUser,
    db: DB,
    q: str | None = None,
    status: str | None = Query(default=None, description="open | on_hold | closed | filled | active"),
    client_id: int | None = None,
    priority: str | None = None,
    mine: bool = False,
):
    stmt = select(Position).join(Client).options(selectinload(Position.recruiters), selectinload(Position.client))
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Position.title).like(like),
                func.lower(Position.job_code).like(like),
                func.lower(Position.skills).like(like),
                func.lower(Position.location).like(like),
                func.lower(Client.name).like(like),
            )
        )
    if status == "active":
        stmt = stmt.where(Position.status.in_(("open", "on_hold")))
    elif status:
        stmt = stmt.where(Position.status == status)
    if client_id:
        stmt = stmt.where(Position.client_id == client_id)
    if priority:
        stmt = stmt.where(Position.priority == priority)
    if mine:
        stmt = stmt.where(
            Position.id.in_(select(position_recruiters.c.position_id).where(position_recruiters.c.user_id == user.id))
        )
    positions = db.scalars(stmt).unique().all()
    positions = sorted(
        positions,
        key=lambda p: (p.status != "open", PRIORITY_ORDER.get(p.priority, 9), -(p.created_at.timestamp())),
    )
    return positions_out(db, positions)


@router.post("", response_model=PositionOut, status_code=201)
def create_position(body: PositionCreate, user: Manager, db: DB):
    data = body.model_dump(exclude={"recruiter_ids"})
    _validate(db, data)
    position = Position(**data, created_by_id=user.id)
    _set_recruiters(db, position, body.recruiter_ids)
    db.add(position)
    db.commit()
    return positions_out(db, [position])[0]


@router.get("/{position_id}", response_model=PositionOut)
def get_position_detail(position_id: int, _: CurrentUser, db: DB):
    return positions_out(db, [get_position(db, position_id)])[0]


@router.patch("/{position_id}", response_model=PositionOut)
def update_position(position_id: int, body: PositionUpdate, _: Manager, db: DB):
    position = get_position(db, position_id)
    data = body.model_dump(exclude_unset=True)
    recruiter_ids = data.pop("recruiter_ids", None)
    _validate(db, data, position)
    required = ("client_id", "title", "work_mode", "employment_type", "openings", "priority", "status")
    for key, value in data.items():
        if value is None and key in required:
            continue
        setattr(position, key, value)
    if recruiter_ids is not None:
        _set_recruiters(db, position, recruiter_ids)
    db.commit()
    return positions_out(db, [position])[0]


@router.delete("/{position_id}", status_code=204)
def delete_position(position_id: int, _: Admin, db: DB):
    db.delete(get_position(db, position_id))
    db.commit()


# ---------------------------------------------------------------- candidate sheet
def _sheet_query(position_id: int, stage: str | None, q: str | None, recruiter_id: int | None):
    stmt = (
        select(Candidate)
        .where(Candidate.position_id == position_id)
        .options(selectinload(Candidate.recruiter))
        .order_by(Candidate.created_at.asc(), Candidate.id.asc())
    )
    if stage:
        stmt = stmt.where(Candidate.stage.in_(stage.split(",")))
    if recruiter_id:
        stmt = stmt.where(Candidate.recruiter_id == recruiter_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Candidate.full_name).like(like),
                func.lower(Candidate.email).like(like),
                Candidate.phone.like(like),
                func.lower(Candidate.current_company).like(like),
                func.lower(Candidate.skills).like(like),
            )
        )
    return stmt


@router.get("/{position_id}/candidates", response_model=list[CandidateOut])
def position_candidates(
    position_id: int,
    _: CurrentUser,
    db: DB,
    stage: str | None = Query(default=None, description="Comma separated stage keys"),
    q: str | None = None,
    recruiter_id: int | None = None,
):
    """The candidate tracker sheet of a position."""
    get_position(db, position_id)
    return candidates_out(db, db.scalars(_sheet_query(position_id, stage, q, recruiter_id)))


@router.post("/{position_id}/candidates", response_model=CandidateOut, status_code=201)
def add_candidate(position_id: int, body: CandidateCreate, user: CurrentUser, db: DB):
    position = get_position(db, position_id)
    candidate = create_candidate(db, position, body, user)
    db.commit()
    return candidates_out(db, [candidate])[0]


@router.get("/{position_id}/candidates/export")
def export_sheet(position_id: int, _: CurrentUser, db: DB, stage: str | None = None):
    position = get_position(db, position_id)
    candidates = db.scalars(_sheet_query(position_id, stage, None, None)).all()
    content = build_workbook([(position.title, CANDIDATE_HEADERS, candidate_rows(candidates))])
    safe = "".join(ch if ch.isalnum() else "_" for ch in f"{position.client.name}_{position.title}")
    filename = f"{safe}_{date.today().isoformat()}.xlsx"
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{position_id}/candidates/template")
def import_template(position_id: int, _: CurrentUser, db: DB):
    get_position(db, position_id)
    headers = CANDIDATE_HEADERS[:-2]
    example = ["Priya Sharma", "9876543210", "priya@example.com", "Infosys", "Senior Engineer", 5, 4, 12, 16, None,
               30, "Bengaluru", "Bengaluru", "Python, Django", "naukri", None, "Sourced", None, "Strong communication"]
    content = build_workbook([("Candidates", headers, [example])])
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="candidate_import_template.xlsx"'},
    )


_STAGE_BY_LABEL = {s.label.lower(): s.key for s in STAGES.values()} | {k: k for k in STAGES}


@router.post("/{position_id}/candidates/import", response_model=ImportResult)
async def import_candidates(position_id: int, user: CurrentUser, db: DB, file: UploadFile = File(...)):
    """Bulk-add candidates from an .xlsx or .csv file (first row = headers)."""
    position = get_position(db, position_id)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "File is too large (max 5 MB).")
    try:
        records = read_table(file.filename or "upload.csv", content)
    except Exception as exc:  # noqa: BLE001 - surface parse errors to the user
        raise HTTPException(http.HTTP_400_BAD_REQUEST, f"Could not read file: {exc}") from exc
    created, skipped, errors = 0, 0, []
    for index, record in enumerate(records, start=2):
        if "stage" in record:
            record["stage"] = _STAGE_BY_LABEL.get(str(record["stage"]).strip().lower(), "sourced")
        if "source" in record:
            source = str(record["source"]).strip().lower().replace(" ", "_")
            record["source"] = source if source in CANDIDATE_SOURCES else "other"
        for key in ("phone",):
            if key in record:
                record[key] = str(record[key]).removesuffix(".0")
        try:
            body = CandidateCreate(**record)
        except ValidationError as exc:
            first = exc.errors()[0]
            errors.append(f"Row {index}: {'.'.join(map(str, first['loc']))} - {first['msg']}")
            skipped += 1
            continue
        if find_duplicates(db, body.email, body.phone, position_id=position.id):
            errors.append(f"Row {index}: {body.full_name} already exists in this position")
            skipped += 1
            continue
        create_candidate(db, position, body, user, check_duplicates=False)
        db.flush()
        created += 1
    db.commit()
    return ImportResult(created=created, skipped=skipped, errors=errors[:50])
