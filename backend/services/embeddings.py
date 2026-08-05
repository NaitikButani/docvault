"""
Semantic search service using sentence-transformers + cosine similarity.
Embeddings are stored as .npy files and loaded for comparison.
"""
import os
import numpy as np
from pathlib import Path
from typing import List, Tuple

EMBEDDINGS_DIR = Path(__file__).parent.parent.parent / "uploads" / "embeddings"
EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)

# Lazy-load model to avoid slow startup
_model = None


def _get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        except ImportError:
            _model = None
    return _model


def generate_embedding(text: str) -> np.ndarray:
    """Generate a sentence embedding for the given text."""
    model = _get_model()
    if model is None:
        # Fallback: random embedding for demo purposes
        return np.random.rand(384).astype(np.float32)

    # Truncate to avoid memory issues
    text = text[:5000] if len(text) > 5000 else text
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.astype(np.float32)


def save_embedding(doc_id: int, embedding: np.ndarray) -> str:
    """Save embedding to disk and return the path."""
    path = EMBEDDINGS_DIR / f"doc_{doc_id}.npy"
    np.save(str(path), embedding)
    return str(path)


def load_embedding(path: str) -> np.ndarray:
    """Load a saved embedding from disk."""
    try:
        return np.load(path)
    except Exception:
        return np.zeros(384, dtype=np.float32)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def semantic_search(
    query: str,
    doc_embeddings: List[Tuple[int, str]],  # list of (doc_id, embedding_path)
    top_k: int = 10,
    threshold: float = 0.2,
) -> List[Tuple[int, float]]:
    """
    Search documents semantically.
    Returns list of (doc_id, similarity_score) sorted by score descending.
    """
    if not doc_embeddings:
        return []

    query_embedding = generate_embedding(query)
    results = []

    for doc_id, emb_path in doc_embeddings:
        if not emb_path or not os.path.exists(emb_path):
            continue
        doc_embedding = load_embedding(emb_path)
        score = cosine_similarity(query_embedding, doc_embedding)
        if score >= threshold:
            results.append((doc_id, score))

    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]


def embed_document(doc_id: int, text: str) -> str:
    """Generate and save embedding for a document. Returns the saved path."""
    if not text.strip():
        return ""
    embedding = generate_embedding(text)
    path = save_embedding(doc_id, embedding)
    return path
