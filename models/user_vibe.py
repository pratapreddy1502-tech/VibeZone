from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from database import Base


class UserVibe(Base):
    __tablename__ = "user_vibes"
    __table_args__ = (
        UniqueConstraint("sender_id", "receiver_id", name="unique_user_vibe_pair"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
