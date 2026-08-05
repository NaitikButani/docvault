from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from database import get_db
import models
import auth

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str = ""


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    created_at: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


@router.post("/register", response_model=TokenResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    if db.query(models.User).filter(models.User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = auth.get_password_hash(user_data.password)
    user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pw,
        full_name=user_data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email, "full_name": user.full_name},
    }


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == credentials.username).first()
    if not user or not auth.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = auth.create_access_token({"sub": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email, "full_name": user.full_name},
    }


@router.get("/me")
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "created_at": str(current_user.created_at),
        "document_count": len(current_user.documents),
    }


@router.get("/list")
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Get all users (for sharing purposes)."""
    users = db.query(models.User).filter(models.User.id != current_user.id).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name} for u in users]
