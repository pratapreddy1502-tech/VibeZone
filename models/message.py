from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, ForeignKey
from database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String)
    text = Column(String)
    status = Column(String, default="sent")
    is_delivered = Column(Boolean, default=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
