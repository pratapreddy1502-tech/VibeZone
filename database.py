from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os

from settings import load_env_file


load_env_file()

DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("VIBEZONE_DATABASE_URL")
    or "postgresql://postgres:1502@localhost/VIBEZONE"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
