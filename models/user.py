from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)

    full_name = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)
    account_type = Column(String, default="public")
    website = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    theme_settings = Column(Text, nullable=True)
    push_token = Column(String, nullable=True)
    chat_pin_hash = Column(String, nullable=True)
    chat_lock_enabled = Column(Boolean, default=False)
    chat_lock_biometric = Column(Boolean, default=True)
    chat_lock_face_id = Column(Boolean, default=True)
    hide_locked_chats = Column(Boolean, default=False)
    auto_lock_after_exit = Column(Boolean, default=True)
    ghost_lock_mode = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
