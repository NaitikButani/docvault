import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import engine, Base
from routes import users, documents, search

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DocVault API",
    description="AI-powered Document Management & Semantic Search",
    version="1.0.0",
)

# CORS — allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router)
app.include_router(documents.router)
app.include_router(search.router)

# Serve frontend static files
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/dashboard")
    def serve_dashboard():
        return FileResponse(str(FRONTEND_DIR / "dashboard.html"))

    @app.get("/upload")
    def serve_upload():
        return FileResponse(str(FRONTEND_DIR / "upload.html"))

    @app.get("/search-page")
    def serve_search():
        return FileResponse(str(FRONTEND_DIR / "search.html"))


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "DocVault", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
