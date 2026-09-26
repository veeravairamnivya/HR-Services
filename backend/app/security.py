from datetime import timedelta

import bcrypt
import jwt

from .config import get_settings
from .database import utcnow

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    settings = get_settings()
    expires_in = settings.access_token_expire_minutes * 60
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": utcnow(),
        "exp": utcnow() + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM), expires_in


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
