from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import utcnow
from ..deps import DB, CurrentUser, Manager
from ..models import Attendance, User
from ..schemas import AttendanceOut, CheckoutRequest
from ..services.attendance_service import attendance_out, mark_presence
from ..services.timeutil import local_today

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/check-in", response_model=AttendanceOut)
def check_in(user: CurrentUser, db: DB):
    record = mark_presence(db, user)
    if record.logout_at is not None:
        record.logout_at = None  # checking in again after a check-out resumes the day
    db.commit()
    return attendance_out(record)


@router.post("/check-out", response_model=AttendanceOut)
def check_out(body: CheckoutRequest, user: CurrentUser, db: DB):
    record = mark_presence(db, user)
    record.logout_at = utcnow()
    if body.work_summary is not None:
        record.work_summary = body.work_summary
    db.commit()
    return attendance_out(record)


@router.get("/me", response_model=list[AttendanceOut])
def my_attendance(user: CurrentUser, db: DB, days: int = 31):
    since = local_today() - timedelta(days=max(1, min(days, 366)) - 1)
    records = db.scalars(
        select(Attendance)
        .where(Attendance.user_id == user.id, Attendance.work_date >= since)
        .order_by(Attendance.work_date.desc())
    )
    return [attendance_out(r) for r in records]


@router.get("/today")
def team_today(_: Manager, db: DB, day: date | None = None):
    """Who is in today: every active user with their check-in details (or absent)."""
    day = day or local_today()
    records = {
        r.user_id: r
        for r in db.scalars(select(Attendance).where(Attendance.work_date == day).options(selectinload(Attendance.user)))
    }
    users = db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name)).all()
    return {
        "day": day,
        "present": len(records),
        "total": len(users),
        "rows": [
            {
                "user": {"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role},
                "attendance": attendance_out(records[u.id]) if u.id in records else None,
            }
            for u in users
        ],
    }


@router.patch("/{attendance_id}", response_model=AttendanceOut)
def edit_summary(attendance_id: int, body: CheckoutRequest, user: CurrentUser, db: DB):
    record = db.get(Attendance, attendance_id)
    if record is None or (record.user_id != user.id and user.role not in ("admin", "manager")):
        raise HTTPException(404, "Attendance record not found.")
    record.work_summary = body.work_summary
    db.commit()
    return attendance_out(record)
