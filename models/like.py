from sqlalchemy import Column, Integer
from database import Base


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    post_id = Column(Integer)
    reel_id = Column(Integer)
