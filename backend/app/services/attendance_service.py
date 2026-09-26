from datetime import datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import utcnow
from ..models import Attendance, User
from .timeutil import local_now


def _is_late(moment: datetime) -> bool:
    hour, minute = (int(x) for x in get_settings().office_start_time.split(":"))
    return moment.timetz().replace(tzinfo=None) > time(hour, minute)


def mark_presence(db: Session, user: User) -> Attendance:
    """Record the user's attendance for today (first login of the day) or refresh last-seen."""
    now_local = local_now()
    today = now_local.date()
    record = db.scalar(select(Attendance).where(Attendance.user_id == user.id, Attendance.work_date == today))
    now = utcnow()
    if record is None:
        record = Attendance(
            user_id=user.id,
            work_date=today,
            login_at=now,
            last_seen_at=now,
            status="late" if _is_late(now_local) else "present",
        )
        db.add(record)
    else:
        record.last_seen_at = now
    return record


def hours_worked(record: Attendance) -> float:
    end = record.logout_at or record.last_seen_at
    if not end or end < record.login_at:
        return 0.0
    return round((end - record.login_at).total_seconds() / 3600, 2)


def attendance_out(record: Attendance, include_user: bool = False) -> dict:
    data = {
        "id": record.id,
        "user_id": record.user_id,
        "work_date": record.work_date,
        "login_at": record.login_at,
        "last_seen_at": record.last_seen_at,
        "logout_at": record.logout_at,
        "status": record.status,
        "work_summary": record.work_summary,
        "hours_worked": hours_worked(record),
    }
    if include_user:
        data["user"] = record.user
    return data
