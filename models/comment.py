from sqlalchemy import Column, Integer, String
from database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    post_id = Column(Integer)
    reel_id = Column(Integer)
    text = Column(String)
