from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select

from ..database import utcnow
from ..deps import DB, CurrentUser
from ..models import User
from ..schemas import LoginRequest, PasswordChange, ProfileUpdate, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password
from ..services.attendance_service import attendance_out, mark_presence

router = APIRouter(prefix="/auth", tags=["auth"])


def _login(db: DB, email: str, password: str) -> TokenOut:
    user = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is deactivated. Contact your admin.")
    user.last_login_at = utcnow()
    attendance = mark_presence(db, user)
    db.commit()
    token, expires_in = create_access_token(user.id, user.role)
    return TokenOut(
        access_token=token,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
        attendance=attendance_out(attendance),
    )


@router.post("/login", response_model=TokenOut)
def login(body: LoginRequest, db: DB):
    """Log in and record today's attendance (the first login of the day is the check-in time)."""
    return _login(db, body.email, body.password)


@router.post("/token", response_model=TokenOut, include_in_schema=True)
def login_form(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DB):
    """OAuth2 password flow used by the interactive API docs."""
    return _login(db, form.username, form.password)


@router.get("/me")
def me(user: CurrentUser, db: DB):
    """Current user plus today's attendance. Opening the app marks the user present for the day."""
    attendance = mark_presence(db, user)
    db.commit()
    return {"user": UserOut.model_validate(user), "attendance": attendance_out(attendance)}


@router.patch("/me", response_model=UserOut)
def update_profile(body: ProfileUpdate, user: CurrentUser, db: DB):
    for key, value in body.model_dump(exclude_unset=True).items():
        if key == "full_name" and value is None:
            continue
        setattr(user, key, value)
    db.commit()
    return user


@router.post("/change-password", status_code=204)
def change_password(body: PasswordChange, user: CurrentUser, db: DB):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
