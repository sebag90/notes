import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from .config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def verify_password_htpasswd(username: str, password: str, htpasswd_path: str) -> bool:
    if not os.path.exists(htpasswd_path):
        print(f"htpasswd file not found at: {htpasswd_path}")
        return False
    try:
        with open(htpasswd_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(":", 1)
                if len(parts) != 2:
                    continue
                user, pwd_hash = parts
                if user == username:
                    # Normalize $2y$ to $2b$ for python bcrypt
                    normalized_hash = pwd_hash
                    if pwd_hash.startswith("$2y$"):
                        normalized_hash = pwd_hash.replace("$2y$", "$2b$", 1)
                    
                    return bcrypt.checkpw(password.encode("utf-8"), normalized_hash.encode("utf-8"))
    except Exception as e:
        print(f"Error reading/parsing htpasswd file: {e}")
    return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
        
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception
