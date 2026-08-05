import os
import uuid
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
import models
import auth
from services.extractor import extract_text, get_file_type
from services.embeddings import embed_document
from services.summarizer import summarize_text
from services.tagger import extract_tags

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "files"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "txt", "png", "jpg", "jpeg", "bmp", "tiff", "webp"}


class ShareRequest(BaseModel):
    username: str
    permission: str = "view"  # view or edit


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    file_ext = get_file_type(file.filename)
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{file_ext}' not supported.")

    # Save file with unique name
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = UPLOAD_DIR / unique_filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)
    doc_title = title or Path(file.filename).stem

    # Create document record first (to get ID)
    doc = models.Document(
        title=doc_title,
        filename=file.filename,
        file_path=str(file_path),
        file_type=file_ext,
        file_size=file_size,
        owner_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Extract text
    extracted_text, page_count = extract_text(str(file_path), file_ext)
    doc.extracted_text = extracted_text
    doc.page_count = page_count

    # Generate summary
    doc.summary = summarize_text(extracted_text)

    # Generate embedding for semantic search
    if extracted_text:
        emb_path = embed_document(doc.id, extracted_text)
        doc.embedding_path = emb_path

    # Auto-tagging
    tags_list = extract_tags(extracted_text)
    for tag_name in tags_list:
        tag = db.query(models.Tag).filter(models.Tag.name == tag_name).first()
        if not tag:
            tag = models.Tag(name=tag_name)
            db.add(tag)
            db.flush()
        if tag not in doc.tags:
            doc.tags.append(tag)

    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "summary": doc.summary,
        "tags": [t.name for t in doc.tags],
        "created_at": str(doc.created_at),
    }


@router.get("/")
def list_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """List all documents the user owns or has access to."""
    owned = db.query(models.Document).filter(models.Document.owner_id == current_user.id).all()
    shared_links = db.query(models.DocumentShare).filter(
        models.DocumentShare.shared_with_id == current_user.id
    ).all()
    shared_docs = [sl.document for sl in shared_links]

    all_docs = {doc.id: doc for doc in owned + shared_docs}

    result = []
    for doc in all_docs.values():
        is_owner = doc.owner_id == current_user.id
        result.append({
            "id": doc.id,
            "title": doc.title,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
            "page_count": doc.page_count,
            "summary": doc.summary[:200] if doc.summary else "",
            "tags": [t.name for t in doc.tags],
            "created_at": str(doc.created_at),
            "owner": doc.owner.username,
            "is_owner": is_owner,
            "is_public": doc.is_public,
        })

    return result


@router.get("/{doc_id}")
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = _get_accessible_doc(doc_id, current_user, db)
    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "extracted_text": doc.extracted_text[:3000] if doc.extracted_text else "",
        "summary": doc.summary,
        "tags": [t.name for t in doc.tags],
        "created_at": str(doc.created_at),
        "updated_at": str(doc.updated_at),
        "owner": doc.owner.username,
        "is_owner": doc.owner_id == current_user.id,
        "is_public": doc.is_public,
        "shares": [
            {
                "username": s.shared_with.username,
                "permission": s.permission,
            }
            for s in doc.shares
        ],
    }


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.owner_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or not authorized.")

    # Remove file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    # Remove embedding
    if doc.embedding_path and os.path.exists(doc.embedding_path):
        os.remove(doc.embedding_path)

    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully."}


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = _get_accessible_doc(doc_id, current_user, db)
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File not found on server.")
    return FileResponse(doc.file_path, filename=doc.filename)


@router.post("/{doc_id}/share")
def share_document(
    doc_id: int,
    share_req: ShareRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.owner_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or not authorized.")

    target_user = db.query(models.User).filter(models.User.username == share_req.username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User '{share_req.username}' not found.")

    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share document with yourself.")

    # Check if already shared
    existing = db.query(models.DocumentShare).filter(
        models.DocumentShare.document_id == doc_id,
        models.DocumentShare.shared_with_id == target_user.id,
    ).first()

    if existing:
        existing.permission = share_req.permission
    else:
        share = models.DocumentShare(
            document_id=doc_id,
            shared_by_id=current_user.id,
            shared_with_id=target_user.id,
            permission=share_req.permission,
        )
        db.add(share)

    db.commit()
    return {"message": f"Document shared with {target_user.username} ({share_req.permission} access)."}


@router.delete("/{doc_id}/share/{username}")
def revoke_share(
    doc_id: int,
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    target_user = db.query(models.User).filter(models.User.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    share = db.query(models.DocumentShare).filter(
        models.DocumentShare.document_id == doc_id,
        models.DocumentShare.shared_with_id == target_user.id,
        models.DocumentShare.shared_by_id == current_user.id,
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found.")

    db.delete(share)
    db.commit()
    return {"message": "Access revoked successfully."}


@router.patch("/{doc_id}/toggle-public")
def toggle_public(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.owner_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc.is_public = not doc.is_public
    db.commit()
    return {"is_public": doc.is_public}


def _get_accessible_doc(doc_id: int, user: models.User, db: Session) -> models.Document:
    """Helper: get a document if the user owns it or has been shared access."""
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.owner_id == user.id:
        return doc

    share = db.query(models.DocumentShare).filter(
        models.DocumentShare.document_id == doc_id,
        models.DocumentShare.shared_with_id == user.id,
    ).first()
    if share:
        return doc

    if doc.is_public:
        return doc

    raise HTTPException(status_code=403, detail="Access denied.")
