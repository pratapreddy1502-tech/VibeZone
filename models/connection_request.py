from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from database import Base


class ConnectionRequest(Base):
    __tablename__ = "connection_requests"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
