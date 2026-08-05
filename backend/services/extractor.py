"""
Text extraction service — handles PDF, DOCX, TXT, and image (OCR) files.
"""
import os
import io
from pathlib import Path
from typing import Tuple

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

try:
    import pytesseract
    from PIL import Image
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


def extract_text(file_path: str, file_type: str) -> Tuple[str, int]:
    """
    Extract text from a document.
    Returns (extracted_text, page_count)
    """
    file_type = file_type.lower()

    if file_type == "pdf":
        return _extract_pdf(file_path)
    elif file_type in ("docx", "doc"):
        return _extract_docx(file_path), 1
    elif file_type == "txt":
        return _extract_txt(file_path), 1
    elif file_type in ("png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"):
        return _extract_image_ocr(file_path), 1
    else:
        return "", 0


def _extract_pdf(file_path: str) -> Tuple[str, int]:
    if not HAS_PYMUPDF:
        return "PyMuPDF not installed.", 0
    try:
        doc = fitz.open(file_path)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        full_text = "\n".join(text_parts).strip()

        # If PDF has no text (scanned), fall back to OCR per page
        if not full_text and HAS_OCR:
            full_text = _pdf_ocr_fallback(file_path)

        return full_text, doc.page_count if hasattr(doc, 'page_count') else len(text_parts)
    except Exception as e:
        return f"Error extracting PDF: {str(e)}", 0


def _pdf_ocr_fallback(file_path: str) -> str:
    """OCR fallback for scanned PDFs."""
    try:
        doc = fitz.open(file_path)
        texts = []
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            texts.append(pytesseract.image_to_string(img))
        doc.close()
        return "\n".join(texts).strip()
    except Exception as e:
        return f"OCR error: {str(e)}"


def _extract_docx(file_path: str) -> str:
    if not HAS_DOCX:
        return "python-docx not installed."
    try:
        doc = DocxDocument(file_path)
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        return f"Error extracting DOCX: {str(e)}"


def _extract_txt(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        return f"Error reading TXT: {str(e)}"


def _extract_image_ocr(file_path: str) -> str:
    if not HAS_OCR:
        return "pytesseract not installed. Cannot perform OCR."
    try:
        img = Image.open(file_path)
        return pytesseract.image_to_string(img).strip()
    except Exception as e:
        return f"OCR error: {str(e)}"


def get_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower().lstrip(".")
    return ext if ext else "unknown"
