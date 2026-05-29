from sqlalchemy import Column, Integer, UniqueConstraint
from database import Base


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="unique_follow_pair"),
    )

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer)
    following_id = Column(Integer)
