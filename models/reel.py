from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from database import Base


class Reel(Base):
    __tablename__ = "reels"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    caption = Column(String)
    video_url = Column(String)
    views_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
