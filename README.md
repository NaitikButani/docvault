# DocVault — AI-Powered Document Management

---


## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **Auth** | JWT-based register/login with bcrypt |
| 📤 **Upload** | PDF, DOCX, TXT, PNG, JPG, TIFF drag-and-drop |
| 📝 **OCR** | pytesseract fallback for scanned/image documents |
| 🤖 **Semantic Search** | sentence-transformers + cosine similarity |
| 📋 **Auto-Summary** | Extractive summarization (sumy LSA) |
| 🏷️ **Auto-Tagging** | RAKE keyword extraction |
| 🔗 **Sharing** | Share with view/edit permissions per user |
| 🌐 **Public Docs** | Toggle documents as public |
| ⬇️ **Download** | Download original files |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Download NLTK data (for RAKE)

```python
python -c "import nltk; nltk.download('stopwords'); nltk.download('punkt')"
```

### 3. Run the Server

```bash
cd backend
python main.py
```

Server starts at: **http://localhost:8000**

### 4. Open in Browser

Navigate to: **http://localhost:8000**

---

## 📁 Project Structure

```
docvault/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── database.py          # SQLAlchemy + SQLite
│   ├── models.py            # DB models
│   ├── auth.py              # JWT authentication
│   ├── routes/
│   │   ├── users.py         # Register, login, profile
│   │   ├── documents.py     # Upload, list, share, delete
│   │   └── search.py        # Semantic + keyword search
│   ├── services/
│   │   ├── extractor.py     # PDF/DOCX/OCR text extraction
│   │   ├── embeddings.py    # sentence-transformers search
│   │   ├── summarizer.py    # Extractive summarization
│   │   └── tagger.py        # RAKE auto-tagging
│   └── requirements.txt
├── frontend/
│   ├── index.html           # Login / Landing page
│   ├── dashboard.html       # Document management
│   ├── upload.html          # File upload
│   ├── search.html          # AI semantic search
│   ├── css/style.css        # Dark glassmorphism design
│   └── js/
│       ├── auth.js          # Auth utilities
│       ├── dashboard.js     # Dashboard logic
│       ├── upload.js        # Upload logic
│       └── search.js        # Search logic
└── uploads/                 # Stored files + embeddings
```

---

## 🛠️ Tech Stack

- **FastAPI** — Modern async Python web framework
- **SQLAlchemy + SQLite** — ORM + embedded database
- **sentence-transformers** — AI embeddings (`all-MiniLM-L6-v2`)
- **PyMuPDF (fitz)** — Fast PDF text extraction
- **python-docx** — DOCX text extraction
- **pytesseract** — OCR for scanned documents
- **sumy** — Extractive text summarization
- **rake-nltk** — Keyword extraction for auto-tagging
- **python-jose** — JWT tokens
- **passlib + bcrypt** — Password hashing

---

## 📸 Pages

| Page | URL | Description |
|------|-----|-------------|
| Landing/Login | `/` | Auth page with hero section |
| Dashboard | `/dashboard` | Document management with filters |
| Upload | `/upload` | Drag-and-drop with AI processing |
| Search | `/search-page` | AI semantic + keyword search |
| API Docs | `/docs` | FastAPI auto-generated Swagger UI |

---

## 🤖 How Semantic Search Works

1. On upload, document text is encoded using `all-MiniLM-L6-v2` (384-dim vectors)
2. Vectors are saved as `.npy` files on disk
3. On search, your query is encoded the same way
4. Cosine similarity is computed between query and all doc vectors
5. Results are ranked by similarity score (0–1)

---

## 📝 API Endpoints

```
POST   /users/register          Register a new user
POST   /users/login             Login and get JWT token
GET    /users/me                Get current user profile
GET    /users/list              List all users (for sharing)

POST   /documents/upload        Upload a document
GET    /documents/              List all accessible documents
GET    /documents/{id}          Get document details
DELETE /documents/{id}          Delete a document
GET    /documents/{id}/download Download original file
POST   /documents/{id}/share    Share with another user
DELETE /documents/{id}/share/{username}  Revoke access
PATCH  /documents/{id}/toggle-public     Toggle public/private

GET    /search/?q=...&mode=semantic   Semantic search
GET    /search/?q=...&mode=keyword    Keyword search
```

---

## 💡 Resume Talking Points

- Built a **full-stack Python application** with FastAPI, SQLAlchemy, and JWT authentication
- Implemented **AI semantic search** using sentence-transformers (all-MiniLM-L6-v2) and cosine similarity
- Created a **document processing pipeline**: OCR (pytesseract) → extraction (PyMuPDF) → embedding → summarization → tagging
- Designed a **RESTful API** with proper auth middleware, permissions, and error handling
- Built a **responsive dark-mode UI** with drag-and-drop upload and real-time AI processing feedback

---

*Built with ❤️ using Python + FastAPI*
