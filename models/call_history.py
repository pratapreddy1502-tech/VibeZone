from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from database import Base


class CallHistory(Base):
    __tablename__ = "call_history"

    id = Column(Integer, primary_key=True, index=True)
    caller_id = Column(Integer, ForeignKey("users.id"), index=True)
    receiver_id = Column(Integer, ForeignKey("users.id"), index=True)
    call_type = Column(String, default="voice")
    duration = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
