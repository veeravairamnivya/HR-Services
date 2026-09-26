from datetime import date, datetime, time, timedelta, timezone

from ..config import get_settings


def local_now() -> datetime:
    return datetime.now(get_settings().tz)


def local_today() -> date:
    return local_now().date()


def day_bounds_utc(start: date, end: date | None = None) -> tuple[datetime, datetime]:
    """UTC range covering local calendar days [start, end] inclusive."""
    tz = get_settings().tz
    end = end or start
    lo = datetime.combine(start, time.min, tzinfo=tz).astimezone(timezone.utc)
    hi = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc)
    return lo, hi


def month_start(d: date) -> date:
    return d.replace(day=1)


def add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    return date(d.year + month_index // 12, month_index % 12 + 1, 1)
