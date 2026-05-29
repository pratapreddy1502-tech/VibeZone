from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from database import Base


class Story(Base):
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    media_url = Column(String)
    media_type = Column(String)
    caption = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, index=True)
