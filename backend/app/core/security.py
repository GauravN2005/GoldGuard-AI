from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
import bcrypt
from app.core.config import settings
from app.core.logger import logger

ALGORITHM = "HS256"


def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not plain_password or not hashed_password:
            return False
            
        password_bytes = plain_password.encode('utf-8')
        # Check bcrypt max length limit (72 bytes)
        if len(password_bytes) > 72:
            logger.warning("Verify password failed: plain password exceeds 72 bytes")
            return False
            
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.error("Error during password verification", error=str(e))
        return False


def get_password_hash(password: str) -> str:
    password_bytes = password.encode('utf-8')
    # Check bcrypt max length limit (72 bytes)
    if len(password_bytes) > 72:
        raise ValueError("Password cannot be longer than 72 bytes")
        
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_refresh_token(token: str) -> dict:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "refresh":
        raise jwt.JWTError("Invalid token type")
    return payload
