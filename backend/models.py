from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


# Association table for document tags
document_tags = Table(
    "document_tags",
    Base.metadata,
    Column("document_id", Integer, ForeignKey("documents.id")),
    Column("tag_id", Integer, ForeignKey("tags.id")),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    full_name = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    shares_given = relationship("DocumentShare", foreign_keys="DocumentShare.shared_by_id", back_populates="shared_by")
    shares_received = relationship("DocumentShare", foreign_keys="DocumentShare.shared_with_id", back_populates="shared_with")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False)  # pdf, docx, txt, image
    file_size = Column(Integer, default=0)  # bytes
    extracted_text = Column(Text, default="")
    summary = Column(Text, default="")
    embedding_path = Column(String(500), default="")  # path to saved .npy file
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_public = Column(Boolean, default=False)
    page_count = Column(Integer, default=0)

    owner = relationship("User", back_populates="documents")
    tags = relationship("Tag", secondary=document_tags, back_populates="documents")
    shares = relationship("DocumentShare", back_populates="document", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)

    documents = relationship("Document", secondary=document_tags, back_populates="tags")


class DocumentShare(Base):
    __tablename__ = "document_shares"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    shared_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_with_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission = Column(String(20), default="view")  # view or edit
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="shares")
    shared_by = relationship("User", foreign_keys=[shared_by_id], back_populates="shares_given")
    shared_with = relationship("User", foreign_keys=[shared_with_id], back_populates="shares_received")
