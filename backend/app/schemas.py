from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

# Authentication
class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    username: str
    password: str

# Folders
class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[UUID] = None

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None

class FolderResponse(BaseModel):
    id: UUID
    name: str
    parent_id: Optional[UUID]
    username: str

    model_config = ConfigDict(from_attributes=True)

# Notes
class NoteCreate(BaseModel):
    title: str
    content: Optional[str] = ""
    folder_id: Optional[UUID] = None

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[UUID] = None

class NoteResponse(BaseModel):
    id: UUID
    title: str
    content: str
    folder_id: Optional[UUID]
    username: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
