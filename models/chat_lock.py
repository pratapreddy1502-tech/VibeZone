from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, UniqueConstraint

from database import Base


class ChatLock(Base):
    __tablename__ = "chat_locks"
    __table_args__ = (
        UniqueConstraint("user_id", "chat_id", name="uq_chat_lock_user_chat"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    chat_id = Column(Integer, ForeignKey("users.id"), index=True)
    locked = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
