from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql://notes:notes@localhost:5433/notes",
        validation_alias="DATABASE_URL"
    )
    jwt_secret: str = Field(
        default="super-secret-notes-key-change-in-production-12345!",
        validation_alias="JWT_SECRET"
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 1 day
    htpasswd_path: str = Field(
        default="../auth/.htpasswd",
        validation_alias="HTPASSWD_PATH"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
