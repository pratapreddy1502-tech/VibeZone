import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from settings import load_env_file


load_env_file()

def default_database_url():
    if (
        os.getenv("RENDER")
        or os.getenv("RENDER_SERVICE_ID")
        or os.getenv("RENDER_EXTERNAL_URL")
    ):
        return "sqlite:////tmp/vibezone.db"

    return "sqlite:///./vibezone.db"


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv("VIBEZONE_DATABASE_URL", default_database_url())
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine_kwargs = {
    "pool_pre_ping": True,
}

if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)

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
