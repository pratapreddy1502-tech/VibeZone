from sqlalchemy import Column, Integer, String, ForeignKey
from database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    caption = Column(String)
    image_url = Column(String)