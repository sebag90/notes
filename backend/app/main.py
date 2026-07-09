import time
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from .config import settings
from .database import engine, Base, get_db
from .schemas import LoginRequest, Token
from .auth import verify_password_htpasswd, create_access_token
from .routers import folders, notes

# Implement retry logic for database connection on startup
MAX_RETRIES = 5
RETRY_DELAY = 2

for i in range(MAX_RETRIES):
    try:
        print(f"Connecting to database (attempt {i+1}/{MAX_RETRIES})...")
        Base.metadata.create_all(bind=engine)
        print("Database tables verified successfully.")
        break
    except OperationalError as e:
        if i == MAX_RETRIES - 1:
            print("Could not connect to database after maximum retries.")
            raise e
        print(f"Database connection failed: {e}. Retrying in {RETRY_DELAY} seconds...")
        time.sleep(RETRY_DELAY)

app = FastAPI(
    title="Markdown Notes API",
    description="Backend API for Markdown Notes Application",
    version="1.0.0"
)

# Enable CORS for the frontend container
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, we'd specify the exact frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication login endpoint
@app.post("/api/auth/login", response_model=Token)
def login(login_data: LoginRequest):
    is_valid = verify_password_htpasswd(
        username=login_data.username,
        password=login_data.password,
        htpasswd_path=settings.htpasswd_path
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": login_data.username})
    return {"access_token": access_token, "token_type": "bearer"}

# Include routers under /api prefix
app.include_router(folders.router, prefix="/api")
app.include_router(notes.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
