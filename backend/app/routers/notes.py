from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
from ..database import get_db
from ..models import Note, Folder
from ..schemas import NoteCreate, NoteUpdate, NoteResponse
from ..auth import get_current_user

router = APIRouter(
    prefix="/notes",
    tags=["notes"]
)

@router.get("", response_model=List[NoteResponse])
def get_notes(db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    return db.query(Note).filter(Note.username == username).all()

@router.get("/{note_id}", response_model=NoteResponse)
def get_note(note_id: UUID, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    db_note = db.query(Note).filter(Note.id == note_id, Note.username == username).first()
    if not db_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    return db_note

@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(note_in: NoteCreate, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    if note_in.folder_id:
        folder = db.query(Folder).filter(Folder.id == note_in.folder_id, Folder.username == username).first()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )
            
    db_note = Note(
        title=note_in.title,
        content=note_in.content or "",
        folder_id=note_in.folder_id,
        username=username
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

@router.patch("/{note_id}", response_model=NoteResponse)
def update_note(note_id: UUID, note_in: NoteUpdate, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    db_note = db.query(Note).filter(Note.id == note_id, Note.username == username).first()
    if not db_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
        
    if note_in.title is not None:
        db_note.title = note_in.title
        
    if note_in.content is not None:
        db_note.content = note_in.content
        
    if note_in.folder_id is not None:
        # Verify folder exists and belongs to user
        folder = db.query(Folder).filter(Folder.id == note_in.folder_id, Folder.username == username).first()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="New folder not found"
            )
        db_note.folder_id = note_in.folder_id
    elif "folder_id" in note_in.model_fields_set and note_in.folder_id is None:
        db_note.folder_id = None
        
    db.commit()
    db.refresh(db_note)
    return db_note

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: UUID, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    db_note = db.query(Note).filter(Note.id == note_id, Note.username == username).first()
    if not db_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    db.delete(db_note)
    db.commit()
    return None
