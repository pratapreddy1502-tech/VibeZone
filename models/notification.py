from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    data_json = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
