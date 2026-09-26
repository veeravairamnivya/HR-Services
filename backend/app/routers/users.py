from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from ..deps import DB, Admin, CurrentUser
from ..models import User
from ..schemas import UserCreate, UserOut, UserUpdate
from ..security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(_: CurrentUser, db: DB, include_inactive: bool = False, role: str | None = None):
    stmt = select(User).order_by(User.full_name)
    if not include_inactive:
        stmt = stmt.where(User.is_active.is_(True))
    if role:
        stmt = stmt.where(User.role == role)
    return db.scalars(stmt).all()


def _email_taken(db: DB, email: str, exclude_id: int | None = None) -> bool:
    stmt = select(User.id).where(func.lower(User.email) == email.lower())
    if exclude_id:
        stmt = stmt.where(User.id != exclude_id)
    return db.scalar(stmt) is not None


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, _: Admin, db: DB):
    if _email_taken(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists.")
    data = body.model_dump(exclude={"password"})
    user = User(**data, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, admin: Admin, db: DB):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    data = body.model_dump(exclude_unset=True)
    if user.id == admin.id and (data.get("is_active") is False or data.get("role", "admin") != "admin"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate or demote yourself.")
    if data.get("email") and _email_taken(db, data["email"], user.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists.")
    password = data.pop("password", None)
    if password:
        user.hashed_password = hash_password(password)
    for key, value in data.items():
        if value is None and key in ("full_name", "email", "role", "daily_target", "is_active"):
            continue
        setattr(user, key, value)
    db.commit()
    return user
