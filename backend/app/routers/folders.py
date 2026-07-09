from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
from ..database import get_db
from ..models import Folder
from ..schemas import FolderCreate, FolderUpdate, FolderResponse
from ..auth import get_current_user

router = APIRouter(
    prefix="/folders",
    tags=["folders"]
)

@router.get("", response_model=List[FolderResponse])
def get_folders(db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    return db.query(Folder).filter(Folder.username == username).all()

@router.post("", response_model=FolderResponse)
def create_folder(folder_in: FolderCreate, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    # If parent_id is specified, verify it exists and belongs to the user
    if folder_in.parent_id:
        parent = db.query(Folder).filter(Folder.id == folder_in.parent_id, Folder.username == username).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent folder not found"
            )
    
    db_folder = Folder(
        name=folder_in.name,
        parent_id=folder_in.parent_id,
        username=username
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

def is_descendant(db: Session, folder_id: UUID, possible_descendant_id: UUID, username: str) -> bool:
    """Helper to check if possible_descendant_id is a child/subfolder of folder_id."""
    current_parent_id = possible_descendant_id
    visited = set() # Avoid potential infinite loops
    while current_parent_id is not None:
        if current_parent_id == folder_id:
            return True
        if current_parent_id in visited:
            break
        visited.add(current_parent_id)
        
        # Look up parent of the current folder
        curr = db.query(Folder).filter(Folder.id == current_parent_id, Folder.username == username).first()
        if not curr:
            break
        current_parent_id = curr.parent_id
    return False

@router.patch("/{folder_id}", response_model=FolderResponse)
def update_folder(folder_id: UUID, folder_in: FolderUpdate, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id, Folder.username == username).first()
    if not db_folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    
    if folder_in.name is not None:
        db_folder.name = folder_in.name
        
    if folder_in.parent_id is not None:
        if folder_in.parent_id == folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A folder cannot be its own parent"
            )
            
        # Verify parent exists and belongs to user
        parent = db.query(Folder).filter(Folder.id == folder_in.parent_id, Folder.username == username).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="New parent folder not found"
            )
            
        # Check for circular reference (cannot move a folder into its own subfolder)
        if is_descendant(db, folder_id, folder_in.parent_id, username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move a folder into its own subfolder"
            )
            
        db_folder.parent_id = folder_in.parent_id
    elif "parent_id" in folder_in.model_fields_set and folder_in.parent_id is None:
        db_folder.parent_id = None
        
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: UUID, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id, Folder.username == username).first()
    if not db_folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    db.delete(db_folder)
    db.commit()
    return None
