from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
import models
import auth
from services.embeddings import semantic_search

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
def search_documents(
    q: str = Query(..., min_length=1, description="Search query"),
    mode: str = Query("semantic", description="'semantic' or 'keyword'"),
    top_k: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Search documents using semantic (AI) or keyword mode.
    Searches across all documents the user has access to.
    """
    # Get all accessible documents
    owned = db.query(models.Document).filter(models.Document.owner_id == current_user.id).all()
    shared_links = db.query(models.DocumentShare).filter(
        models.DocumentShare.shared_with_id == current_user.id
    ).all()
    shared_docs = [sl.document for sl in shared_links]

    all_docs = list({doc.id: doc for doc in owned + shared_docs}.values())

    if not all_docs:
        return {"query": q, "mode": mode, "results": []}

    if mode == "semantic":
        results = _semantic_search(q, all_docs, top_k)
    else:
        results = _keyword_search(q, all_docs, top_k)

    return {"query": q, "mode": mode, "results": results}


def _semantic_search(query: str, docs: list, top_k: int) -> list:
    """AI-powered semantic search using sentence-transformers."""
    doc_embeddings = [
        (doc.id, doc.embedding_path)
        for doc in docs
        if doc.embedding_path
    ]

    if not doc_embeddings:
        # Fallback to keyword search if no embeddings
        return _keyword_search(query, docs, top_k)

    scored = semantic_search(query, doc_embeddings, top_k=top_k, threshold=0.1)
    doc_map = {doc.id: doc for doc in docs}

    results = []
    for doc_id, score in scored:
        doc = doc_map.get(doc_id)
        if doc:
            results.append(_format_result(doc, score, "semantic"))

    return results


def _keyword_search(query: str, docs: list, top_k: int) -> list:
    """Simple keyword-based search across extracted text and title."""
    query_lower = query.lower()
    results = []

    for doc in docs:
        text_to_search = f"{doc.title} {doc.extracted_text or ''} {' '.join(t.name for t in doc.tags)}".lower()
        if query_lower in text_to_search:
            # Score by frequency
            freq = text_to_search.count(query_lower)
            score = min(freq / 10.0, 1.0)
            results.append(_format_result(doc, score, "keyword"))

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]


def _format_result(doc, score: float, mode: str) -> dict:
    """Format a document as a search result."""
    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "summary": doc.summary[:250] if doc.summary else "",
        "tags": [t.name for t in doc.tags],
        "score": round(score, 4),
        "mode": mode,
        "owner": doc.owner.username,
        "created_at": str(doc.created_at),
    }
