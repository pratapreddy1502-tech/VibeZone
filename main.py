from pathlib import Path
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Optional
import json
import os
import re
import secrets
import smtplib
import ssl
import urllib.parse
import urllib.request

import socketio
from fastapi import (
    FastAPI,
    Body,
    Depends,
    File,
    Form,
    UploadFile,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect
)
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from jose import JWTError, jwt
from pydantic import BaseModel

from database import engine, Base, SessionLocal, get_db
from storage import (
    PHOTO_STORAGE_DIR,
    REEL_STORAGE_DIR,
    STORY_STORAGE_DIR,
    STORAGE_ROOT,
    delete_storage_reference,
    ensure_storage_dirs,
    safe_filename,
    save_upload,
    supabase_storage_enabled
)

from models.user import User
from models.post import Post
from models.reel import Reel
from models.story import Story
from models.call_history import CallHistory
from models.like import Like
from models.comment import Comment
from models.follow import Follow
from models.notification import Notification
from models.message import Message
from models.chat_lock import ChatLock
from models.user_vibe import UserVibe
from models.connection_request import ConnectionRequest

from schemas.user_schema import UserCreate, UserUpdate, LoginData
from schemas.user_schema import EmailOtpRequest, VerifyRegisterData
from schemas.post_schema import PostCreate

from auth import (
    ALGORITHM,
    SECRET_KEY,
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

Base.metadata.create_all(bind=engine)


ADD_COLUMN_IF_NOT_EXISTS_PATTERN = re.compile(
    r"^\s*ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+"
    r"ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"
    r"([A-Za-z_][A-Za-z0-9_]*)\s+(.+?)\s*;?\s*$",
    re.IGNORECASE | re.DOTALL
)


def column_exists(connection, table_name: str, column_name: str):
    try:
        columns = inspect(connection).get_columns(table_name)
    except Exception:
        return False

    return any(column["name"] == column_name for column in columns)


def execute_add_column_if_not_exists(statement: str):
    match = ADD_COLUMN_IF_NOT_EXISTS_PATTERN.match(statement)

    if not match:
        return False

    table_name, column_name, column_definition = match.groups()

    sqlite_statement = (
        f"ALTER TABLE {table_name} "
        f"ADD COLUMN {column_name} {column_definition}"
    )

    with engine.begin() as connection:
        if column_exists(connection, table_name, column_name):
            return True

    try:
        with engine.begin() as connection:
            connection.execute(text(sqlite_statement))
    except Exception:
        with engine.connect() as connection:
            if column_exists(connection, table_name, column_name):
                return True
        raise

    return True


def execute_schema_statements(statements: list[str]):
    for statement in statements:
        if execute_add_column_if_not_exists(statement):
            continue

        with engine.begin() as connection:
            connection.execute(text(statement))


def ensure_reel_schema():
    statements = [
        "ALTER TABLE reels ADD COLUMN views_count INTEGER DEFAULT 0",
        "ALTER TABLE reels ADD COLUMN shares_count INTEGER DEFAULT 0",
        "ALTER TABLE likes ADD COLUMN reel_id INTEGER",
        "ALTER TABLE comments ADD COLUMN reel_id INTEGER"
    ]

    execute_schema_statements(statements)


ensure_reel_schema()


def ensure_story_schema():
    statements = [
        """
        CREATE TABLE IF NOT EXISTS stories (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            media_url VARCHAR,
            media_type VARCHAR,
            caption VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        )
        """,
        "ALTER TABLE stories ADD COLUMN user_id INTEGER",
        "ALTER TABLE stories ADD COLUMN media_url VARCHAR",
        "ALTER TABLE stories ADD COLUMN media_type VARCHAR",
        "ALTER TABLE stories ADD COLUMN caption VARCHAR",
        "ALTER TABLE stories ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE stories ADD COLUMN expires_at TIMESTAMP",
        "CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at)"
    ]

    execute_schema_statements(statements)


ensure_story_schema()


def ensure_call_history_schema():
    statements = [
        """
        CREATE TABLE IF NOT EXISTS call_history (
            id SERIAL PRIMARY KEY,
            caller_id INTEGER REFERENCES users(id),
            receiver_id INTEGER REFERENCES users(id),
            call_type VARCHAR DEFAULT 'voice',
            duration INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "ALTER TABLE call_history ADD COLUMN caller_id INTEGER",
        "ALTER TABLE call_history ADD COLUMN receiver_id INTEGER",
        "ALTER TABLE call_history ADD COLUMN call_type VARCHAR DEFAULT 'voice'",
        "UPDATE call_history SET call_type = 'voice' WHERE call_type IS NULL",
        "ALTER TABLE call_history ADD COLUMN duration INTEGER DEFAULT 0",
        "ALTER TABLE call_history ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "CREATE INDEX IF NOT EXISTS idx_call_history_caller_id ON call_history(caller_id)",
        "CREATE INDEX IF NOT EXISTS idx_call_history_receiver_id ON call_history(receiver_id)"
    ]

    execute_schema_statements(statements)


ensure_call_history_schema()


def ensure_chat_schema():
    statements = [
        "ALTER TABLE messages ADD COLUMN is_delivered BOOLEAN DEFAULT FALSE",
        "ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE",
        "ALTER TABLE messages ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE messages ADD COLUMN content VARCHAR",
        "UPDATE messages SET content = text WHERE content IS NULL AND text IS NOT NULL",
        "ALTER TABLE messages ADD COLUMN status VARCHAR DEFAULT 'sent'",
        "UPDATE messages SET status = CASE WHEN is_read IS TRUE THEN 'seen' WHEN is_delivered IS TRUE THEN 'delivered' ELSE 'sent' END WHERE status IS NULL",
        "ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE",
        "ALTER TABLE notifications ADD COLUMN data_json VARCHAR",
        "ALTER TABLE users ADD COLUMN push_token VARCHAR",
        "ALTER TABLE users ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE users ADD COLUMN full_name VARCHAR",
        "ALTER TABLE users ADD COLUMN website VARCHAR",
        "ALTER TABLE users ADD COLUMN gender VARCHAR",
        "ALTER TABLE users ADD COLUMN date_of_birth VARCHAR",
        "ALTER TABLE users ADD COLUMN theme_settings TEXT",
        "ALTER TABLE users ADD COLUMN chat_pin_hash VARCHAR",
        "ALTER TABLE users ADD COLUMN chat_lock_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN chat_lock_biometric BOOLEAN DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN chat_lock_face_id BOOLEAN DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN hide_locked_chats BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN auto_lock_after_exit BOOLEAN DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN ghost_lock_mode BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN account_type VARCHAR DEFAULT 'public'",
        "UPDATE users SET account_type = 'public' WHERE account_type IS NULL OR account_type NOT IN ('public', 'private')",
        "ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ]

    execute_schema_statements(statements)


ensure_chat_schema()


class ChatPinPayload(BaseModel):
    pin: Optional[str] = None


class ChatLockSettingsPayload(BaseModel):
    enabled: Optional[bool] = None
    biometric_enabled: Optional[bool] = None
    face_id_enabled: Optional[bool] = None
    hide_locked_chats: Optional[bool] = None
    auto_lock_after_exit: Optional[bool] = None
    ghost_lock_mode: Optional[bool] = None
    new_pin: Optional[str] = None


class AccountPrivacyPayload(BaseModel):
    account_type: str


class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        was_offline = not self.is_online(user_id)
        self.active_connections.setdefault(user_id, set()).add(websocket)

        if was_offline:
            await self.broadcast_presence(user_id, True)

    async def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)

            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                last_seen = datetime.utcnow()
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.id == user_id).first()
                    if user:
                        user.last_seen = last_seen
                        db.commit()
                finally:
                    db.close()

                await self.broadcast_presence(user_id, False, last_seen)

    async def send_personal_message(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            dead_connections = []

            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    dead_connections.append(websocket)

            for websocket in dead_connections:
                self.active_connections[user_id].discard(websocket)

            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_chat_message(self, sender_id: int, receiver_id: int, message: dict):
        await self.send_personal_message(receiver_id, message)
        await self.send_personal_message(sender_id, message)

    async def broadcast_presence(self, user_id: int, is_online: bool, last_seen: Optional[datetime] = None):
        payload = {
            "type": "presence",
            "user_id": user_id,
            "is_online": is_online,
            "last_seen": isoformat_utc(last_seen) if last_seen else None
        }

        for connected_user_id in list(self.active_connections.keys()):
            if connected_user_id != user_id:
                await self.send_personal_message(connected_user_id, payload)

    def is_online(self, user_id: int):
        return user_id in self.active_connections and bool(self.active_connections[user_id])


manager = ConnectionManager()


def production_cors_origins():
    raw_origins = os.getenv("CORS_ORIGINS") or os.getenv("ALLOWED_ORIGINS") or "*"

    if raw_origins.strip() == "*":
        return "*"

    origins = [
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    ]

    return origins or "*"


cors_origins = production_cors_origins()

fastapi_app = FastAPI()
app = fastapi_app
ensure_storage_dirs()
app.mount("/uploads", StaticFiles(directory=str(STORAGE_ROOT)), name="uploads")
EMAIL_OTP_STORE = {}
OTP_EXPIRY_MINUTES = 10
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=cors_origins,
    ping_timeout=35,
    ping_interval=20
)
call_sid_to_user = {}
call_user_to_sids = {}
saved_call_ids = set()


def load_env_file():
    env_path = Path(__file__).resolve().parent / ".env"

    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()


def utc_now():
    return datetime.utcnow()


def isoformat_utc(value: Optional[datetime]):
    if not value:
        return None

    if value.tzinfo:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)

    return f"{value.isoformat(timespec='milliseconds')}Z"


def parse_iso_datetime(value: Optional[str]):
    if not value:
        return utc_now()

    try:
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except ValueError:
        return utc_now()


USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,30}$")


def clean_optional_text(value: Optional[str]):
    if value is None:
        return None

    value = value.strip()
    return value or None


def validate_profile_username(username: Optional[str], user_id: int, db: Session):
    if username is None:
        return None

    username = username.strip()

    if not USERNAME_PATTERN.fullmatch(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-30 characters and contain no spaces."
        )

    existing_user = db.query(User).filter(
        User.username == username,
        User.id != user_id
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    return username


def validate_profile_image(file: UploadFile):
    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()
    allowed_suffixes = (".jpg", ".jpeg", ".png", ".webp")

    if content_type.startswith("image/") or filename.endswith(allowed_suffixes):
        return

    raise HTTPException(status_code=400, detail="Profile picture must be an image.")


def parse_theme_settings(value: Optional[str]):
    if not value:
        return None

    try:
        return json.loads(value)
    except Exception:
        return None


AVATAR_COLORS = ["7C3AED", "EC4899", "2563EB", "059669", "F59E0B", "DC2626", "0891B2", "4F46E5"]


def default_profile_image(user: Optional[User]):
    if not user:
        return None

    name = re.sub(r"[._-]+", " ", (user.username or f"User {user.id}")).strip() or f"User {user.id}"
    key = f"{user.id}:{user.username or name}"
    color_index = sum(ord(char) for char in key) % len(AVATAR_COLORS)
    return (
        "https://ui-avatars.com/api/"
        f"?name={urllib.parse.quote(name)}"
        f"&background={AVATAR_COLORS[color_index]}"
        "&color=FFFFFF&bold=true&size=256&format=png"
    )


def profile_image_for_user(user: Optional[User]):
    if not user:
        return None

    return user.profile_image or default_profile_image(user)


def normalize_account_type(value: Optional[str]):
    return "private" if value == "private" else "public"


def validate_account_type(value: Optional[str]):
    account_type = (value or "public").strip().lower()

    if account_type not in ("public", "private"):
        raise HTTPException(status_code=400, detail="Account type must be public or private")

    return account_type


def optional_current_user_from_request(request: Request, db: Session):
    authorization = request.headers.get("Authorization") or ""

    if not authorization.startswith("Bearer "):
        return None

    token = authorization.replace("Bearer ", "", 1).strip()

    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        return None

    if not email:
        return None

    return db.query(User).filter(User.email == email).first()


def user_from_access_token(token: Optional[str], db: Session):
    if not token:
        return None

    if token.startswith("Bearer "):
        token = token.replace("Bearer ", "", 1).strip()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        return None

    if not email:
        return None

    return db.query(User).filter(User.email == email).first()


def viewer_is_viber(user: User, db: Session, viewer: Optional[User] = None):
    if not viewer:
        return False

    if viewer.id == user.id:
        return True

    return db.query(UserVibe).filter_by(
        sender_id=viewer.id,
        receiver_id=user.id
    ).first() is not None


def can_view_private_content(user: User, db: Session, viewer: Optional[User] = None):
    if normalize_account_type(user.account_type) == "public":
        return True

    return viewer_is_viber(user, db, viewer)


def visible_author_ids(db: Session, viewer_id: int):
    vibed_ids = [
        row[0]
        for row in db.query(UserVibe.receiver_id).filter(UserVibe.sender_id == viewer_id).all()
    ]

    public_ids = [
        row[0]
        for row in db.query(User.id).filter(
            (User.account_type != "private") | (User.account_type == None)
        ).all()
    ]

    return set(public_ids + vibed_ids + [viewer_id])


def user_payload(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "bio": user.bio,
        "profile_image": profile_image_for_user(user),
        "account_type": normalize_account_type(user.account_type),
        "website": user.website,
        "gender": user.gender,
        "date_of_birth": user.date_of_birth,
        "theme_settings": parse_theme_settings(user.theme_settings),
        "created_at": isoformat_utc(user.created_at),
        "last_seen": isoformat_utc(user.last_seen)
    }


def get_profile_counts(user_id: int, db: Session):
    vibers_count = db.query(UserVibe).filter_by(receiver_id=user_id).count()
    legacy_followers_count = db.query(Follow).filter_by(following_id=user_id).count()
    accepted_connections = db.query(ConnectionRequest).filter(
        (
            (ConnectionRequest.sender_id == user_id) |
            (ConnectionRequest.receiver_id == user_id)
        ),
        ConnectionRequest.status == "accepted"
    ).all()
    connected_user_ids = {
        request.receiver_id if request.sender_id == user_id else request.sender_id
        for request in accepted_connections
    }
    accepted_connections_count = len(connected_user_ids)
    posts_count = db.query(Post).filter_by(user_id=user_id).count()
    reels_count = db.query(Reel).filter_by(user_id=user_id).count()
    vibes_count = posts_count + reels_count

    return {
        "vibers_count": vibers_count,
        "followers_count": legacy_followers_count,
        "connections_count": accepted_connections_count,
        "following_count": accepted_connections_count,
        "vibes_count": vibes_count,
        "posts_count": posts_count,
        "reels_count": reels_count
    }


def connection_between(user_a_id: int, user_b_id: int, db: Session):
    return db.query(ConnectionRequest).filter(
        (
            (ConnectionRequest.sender_id == user_a_id) &
            (ConnectionRequest.receiver_id == user_b_id)
        ) |
        (
            (ConnectionRequest.sender_id == user_b_id) &
            (ConnectionRequest.receiver_id == user_a_id)
        )
    ).order_by(ConnectionRequest.id.desc()).first()


def user_card_payload(user: User, db: Session, viewer: Optional[User] = None):
    payload = user_payload(user)
    payload.update(get_profile_counts(user.id, db))
    payload["is_online"] = manager.is_online(user.id)
    payload["viewer_is_viber"] = viewer_is_viber(user, db, viewer)
    payload["private_content_locked"] = not can_view_private_content(user, db, viewer)

    if viewer:
        payload["has_vibed"] = db.query(UserVibe).filter_by(
            sender_id=viewer.id,
            receiver_id=user.id
        ).first() is not None
        connection = connection_between(viewer.id, user.id, db)
        payload["connection_status"] = connection.status if connection else (
            "self" if viewer.id == user.id else "none"
        )
        payload["connection_request_id"] = connection.id if connection else None

    return payload


def story_user_payload(user: Optional[User]):
    if not user:
        return {
            "id": None,
            "username": "vibezone",
            "profile_image": default_profile_image(None)
        }

    return {
        "id": user.id,
        "username": user.username,
        "profile_image": profile_image_for_user(user),
        "account_type": normalize_account_type(user.account_type)
    }


def story_payload(story: Story, db: Session):
    author = db.query(User).filter(User.id == story.user_id).first()

    return {
        "id": story.id,
        "user_id": story.user_id,
        "media_url": story.media_url,
        "media_type": story.media_type,
        "caption": story.caption or "",
        "created_at": isoformat_utc(story.created_at),
        "expires_at": isoformat_utc(story.expires_at),
        "user": story_user_payload(author)
    }


def story_group_payload(user: User, stories: list[Story], db: Session):
    return {
        "user": story_user_payload(user),
        "stories": [
            story_payload(story, db)
            for story in sorted(stories, key=lambda item: item.created_at or utc_now())
        ]
    }


def story_media_type(upload: UploadFile):
    content_type = upload.content_type or ""
    suffix = Path(upload.filename or "").suffix.lower()

    if content_type.startswith("image/") or suffix in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        return "image"

    if content_type.startswith("video/") or suffix in [".mp4", ".mov", ".m4v", ".webm"]:
        return "video"

    raise HTTPException(status_code=400, detail="Upload an image or video story")


def story_or_404(story_id: int, db: Session):
    story = db.query(Story).filter(Story.id == story_id).first()

    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    return story


def ensure_story_visible(story: Story, db: Session, viewer: Optional[User] = None):
    if story.expires_at and story.expires_at <= utc_now():
        raise HTTPException(status_code=404, detail="Story expired")

    author = db.query(User).filter(User.id == story.user_id).first()

    if author and can_view_private_content(author, db, viewer):
        return

    raise HTTPException(status_code=403, detail="This story belongs to a private account")


def local_upload_path(public_url: Optional[str]):
    if not public_url:
        return None

    parsed_path = urllib.parse.urlparse(public_url).path

    if not parsed_path.startswith("/uploads/"):
        return None

    candidate = (STORAGE_ROOT / parsed_path.replace("/uploads/", "", 1)).resolve()

    try:
        candidate.relative_to(STORAGE_ROOT)
    except ValueError:
        return None

    return candidate


def call_user_payload(user: Optional[User]):
    if not user:
        return None

    return {
        "id": user.id,
        "username": user.username,
        "profile_image": profile_image_for_user(user),
        "is_online": manager.is_online(user.id) or user.id in call_user_to_sids
    }


def call_history_payload(call: CallHistory):
    return {
        "id": call.id,
        "caller_id": call.caller_id,
        "receiver_id": call.receiver_id,
        "call_type": call.call_type or "voice",
        "duration": call.duration or 0,
        "created_at": isoformat_utc(call.created_at)
    }


def normalize_call_type(value: Optional[str]):
    return "video" if value == "video" else "voice"


def save_call_history_once(
    call_id: Optional[str],
    caller_id: Optional[int],
    receiver_id: Optional[int],
    duration: Optional[int],
    call_type: Optional[str] = "voice"
):
    if not caller_id or not receiver_id:
        return None

    dedupe_key = call_id or f"{caller_id}:{receiver_id}:{utc_now().timestamp()}"

    if dedupe_key in saved_call_ids:
        return None

    saved_call_ids.add(dedupe_key)
    db = SessionLocal()

    try:
        call = CallHistory(
            caller_id=int(caller_id),
            receiver_id=int(receiver_id),
            call_type=normalize_call_type(call_type),
            duration=max(0, int(duration or 0))
        )
        db.add(call)
        db.commit()
        db.refresh(call)
        return call_history_payload(call)
    finally:
        db.close()


async def emit_call_event(user_id: int, event: str, payload: dict):
    for sid in list(call_user_to_sids.get(user_id, set())):
        await sio.emit(event, payload, to=sid)


def socketio_token(environ: dict, auth: Optional[dict]):
    if isinstance(auth, dict):
        token = auth.get("token") or auth.get("Authorization") or auth.get("authorization")

        if token:
            return str(token)

    query = urllib.parse.parse_qs(environ.get("QUERY_STRING", ""))
    token = query.get("token", [None])[0]

    if token:
        return token

    auth_header = environ.get("HTTP_AUTHORIZATION")

    return auth_header


def reel_payload(reel: Reel, db: Session):
    author = db.query(User).filter(User.id == reel.user_id).first()
    likes_count = db.query(Like).filter(Like.reel_id == reel.id).count()
    comments_count = db.query(Comment).filter(Comment.reel_id == reel.id).count()
    views_count = reel.views_count or 0
    shares_count = reel.shares_count or 0

    return {
        "id": reel.id,
        "user_id": reel.user_id,
        "username": author.username if author else "VibeZone",
        "profile_image": profile_image_for_user(author),
        "caption": reel.caption,
        "video_url": reel.video_url,
        "media_type": "reel",
        "resonates_count": likes_count,
        "likes_count": likes_count,
        "comments_count": comments_count,
        "views_count": views_count,
        "shares_count": shares_count,
        "created_at": reel.created_at.isoformat() if reel.created_at else None
    }


def reel_or_404(reel_id: int, db: Session):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()

    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")

    return reel


def ensure_reel_visible(reel: Reel, db: Session, viewer: Optional[User] = None):
    author = db.query(User).filter(User.id == reel.user_id).first()

    if author and can_view_private_content(author, db, viewer):
        return

    raise HTTPException(status_code=403, detail="This reel belongs to a private account")


def ensure_post_visible(post: Post, db: Session, viewer: Optional[User] = None):
    author = db.query(User).filter(User.id == post.user_id).first()

    if author and can_view_private_content(author, db, viewer):
        return

    raise HTTPException(status_code=403, detail="This vibe belongs to a private account")


def message_payload(message: Message, db: Session):
    sender = db.query(User).filter(User.id == message.sender_id).first()
    receiver = db.query(User).filter(User.id == message.receiver_id).first()
    status = "seen" if message.is_read else "delivered" if message.is_delivered else "sent"
    content = message.content if message.content is not None else message.text or ""

    return {
        "id": message.id,
        "sender_id": message.sender_id,
        "receiver_id": message.receiver_id,
        "sender_username": sender.username if sender else "vibezone",
        "receiver_username": receiver.username if receiver else "vibezone",
        "content": content,
        "text": content,
        "status": status,
        "is_delivered": message.is_delivered,
        "is_read": message.is_read,
        "created_at": isoformat_utc(message.created_at)
    }


def is_chat_locked_for_user(db: Session, user_id: int, chat_id: int):
    return db.query(ChatLock).filter(
        ChatLock.user_id == user_id,
        ChatLock.chat_id == chat_id,
        ChatLock.locked == True
    ).first() is not None


def validate_chat_target(db: Session, current_user: User, chat_id: int):
    if chat_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot lock your own chat")

    user = db.query(User).filter(User.id == chat_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Chat user not found")

    return user


def validate_chat_pin(pin: Optional[str]):
    clean_pin = str(pin or "").strip()

    if not re.fullmatch(r"\d{4,8}", clean_pin):
        raise HTTPException(status_code=400, detail="PIN must be 4 to 8 digits")

    return clean_pin


def chat_lock_settings_payload(user: User):
    return {
        "enabled": bool(user.chat_lock_enabled),
        "pin_set": bool(user.chat_pin_hash),
        "biometric_enabled": bool(user.chat_lock_biometric),
        "face_id_enabled": bool(user.chat_lock_face_id),
        "hide_locked_chats": bool(user.hide_locked_chats),
        "auto_lock_after_exit": bool(user.auto_lock_after_exit),
        "ghost_lock_mode": bool(user.ghost_lock_mode)
    }


def chat_lock_payload(lock: ChatLock):
    return {
        "id": lock.id,
        "user_id": lock.user_id,
        "chat_id": lock.chat_id,
        "locked": lock.locked,
        "created_at": isoformat_utc(lock.created_at)
    }


def chat_user_payload(db: Session, current_user: User, user: User, mask_locked: bool = True):
    last_message = db.query(Message).filter(
        (
            (Message.sender_id == current_user.id) &
            (Message.receiver_id == user.id)
        ) |
        (
            (Message.sender_id == user.id) &
            (Message.receiver_id == current_user.id)
        )
    ).order_by(Message.id.desc()).first()
    unread_count = db.query(Message).filter(
        Message.sender_id == user.id,
        Message.receiver_id == current_user.id,
        Message.is_read == False
    ).count()
    is_locked = is_chat_locked_for_user(db, current_user.id, user.id)
    last_message_text = (
        last_message.content
        if last_message and last_message.content is not None
        else last_message.text
        if last_message
        else "Start a vibe chat"
    )

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "profile_image": profile_image_for_user(user),
        "is_online": manager.is_online(user.id),
        "last_seen": isoformat_utc(user.last_seen),
        "last_message": "🔒 New Message" if mask_locked and is_locked and last_message else last_message_text,
        "last_message_at": (
            last_message.created_at.isoformat()
            if last_message and last_message.created_at
            else None
        ),
        "unread_count": unread_count,
        "is_locked": is_locked
    }


async def mark_pending_messages_delivered(user_id: int, db: Session):
    messages = db.query(Message).filter(
        Message.receiver_id == user_id,
        Message.is_delivered == False
    ).all()

    if not messages:
        return

    by_sender = {}

    for message in messages:
        message.is_delivered = True
        message.status = "seen" if message.is_read else "delivered"
        by_sender.setdefault(message.sender_id, []).append(message.id)

    db.commit()

    for sender_id, message_ids in by_sender.items():
        await manager.send_personal_message(sender_id, {
            "type": "delivery_receipt",
            "receiver_id": user_id,
            "message_ids": message_ids
        })


def notification_payload(notification: Notification):
    data = {}

    if notification.data_json:
        try:
            data = json.loads(notification.data_json)
        except Exception:
            data = {}

    return {
        "id": notification.id,
        "message": notification.message,
        "is_read": notification.is_read,
        "data": data
    }


def send_expo_push_notification(push_token: Optional[str], title: str, body: str, data: Optional[dict] = None):
    if not push_token or not push_token.startswith("ExponentPushToken"):
        return

    payload = json.dumps({
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://exp.host/--/api/v2/push/send",
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        urllib.request.urlopen(request, timeout=5).read()
    except Exception:
        pass


async def notify_user(db: Session, user_id: int, message: str, data: Optional[dict] = None):
    notification_data = data or {}
    sender_id = notification_data.get("sender_id")
    locked_chat_notification = (
        notification_data.get("type") == "message"
        and sender_id
        and is_chat_locked_for_user(db, user_id, int(sender_id))
    )

    if locked_chat_notification:
        message = "🔒 New Message"
        notification_data = {
            **notification_data,
            "locked_chat": True
        }

    if sender_id and not locked_chat_notification:
        sender = db.query(User).filter(User.id == sender_id).first()

        if sender:
            notification_data = {
                **notification_data,
                "sender_username": sender.username,
                "sender_profile_image": profile_image_for_user(sender)
            }

    notification = Notification(
        user_id=user_id,
        message=message,
        data_json=json.dumps(notification_data)
    )
    db.add(notification)
    db.flush()
    payload = notification_payload(notification)
    await manager.send_personal_message(user_id, {
        "type": "notification",
        "notification": payload
    })

    user = db.query(User).filter(User.id == user_id).first()

    if user:
        send_expo_push_notification(
            user.push_token,
            "VibeZone Buzz",
            message,
            notification_data or {"notification_id": notification.id}
        )

    return notification


async def send_profile_update(user_id: int, db: Session):
    await send_profile_view_update(user_id, user_id, db)


async def send_profile_view_update(viewer_id: int, target_user_id: int, db: Session):
    viewer = db.query(User).filter(User.id == viewer_id).first()
    target_user = db.query(User).filter(User.id == target_user_id).first()

    if not target_user:
        return

    await manager.send_personal_message(viewer_id, {
        "type": "profile_update",
        "user_id": target_user_id,
        "counts": get_profile_counts(target_user_id, db),
        "profile": profile_payload(target_user, db, viewer)
    })


def profile_payload(user: User, db: Session, viewer: Optional[User] = None):
    counts = get_profile_counts(user.id, db)
    has_vibed = False
    connection_status = "self" if viewer and viewer.id == user.id else "none"
    connection_request_id = None
    is_viber = viewer_is_viber(user, db, viewer)
    can_view_content = can_view_private_content(user, db, viewer)
    posts = []
    reels = []

    if can_view_content:
        posts = db.query(Post).filter_by(user_id=user.id).order_by(Post.id.desc()).all()
        reels = db.query(Reel).filter_by(user_id=user.id).order_by(Reel.created_at.desc()).all()

    if viewer and viewer.id != user.id:
        has_vibed = db.query(UserVibe).filter_by(
            sender_id=viewer.id,
            receiver_id=user.id
        ).first() is not None
        connection = connection_between(viewer.id, user.id, db)

        if connection:
            connection_status = connection.status
            connection_request_id = connection.id

    return {
        **user_payload(user),
        **counts,
        "has_vibed": has_vibed,
        "viewer_is_viber": is_viber,
        "private_content_locked": not can_view_content,
        "connection_status": connection_status,
        "connection_request_id": connection_request_id,
        "vibes": [
            {
                "id": post.id,
                "caption": post.caption,
                "image_url": post.image_url
            }
            for post in posts
        ],
        "posts": [
            {
                "id": post.id,
                "caption": post.caption,
                "image_url": post.image_url
            }
            for post in posts
        ],
        "reels": [
            reel_payload(reel, db)
            for reel in reels
        ]
    }


def create_user_account(user, db: Session):
    existing_user = db.query(User).filter(
        User.username == user.username
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    existing_email = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        hashed_password = hash_password(user.password)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not secure password. Please try again."
        ) from exc

    new_user = User(
        username=user.username,
        email=user.email,
        password=hashed_password
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Username or email already exists"
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not create account. Please try again."
        ) from exc

    return new_user


def send_otp_email(email: str, otp: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_from = os.getenv("SMTP_FROM") or os.getenv("SMTP_USERNAME")

    if not smtp_host or not smtp_from:
        return False

    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    use_tls = os.getenv("SMTP_TLS", "true").lower() != "false"

    message = EmailMessage()
    message["Subject"] = "Your VibeZone verification code"
    message["From"] = smtp_from
    message["To"] = email
    message.set_content(
        f"Your VibeZone verification code is {otp}.\n\n"
        f"This code expires in {OTP_EXPIRY_MINUTES} minutes."
    )

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        if use_tls:
            server.starttls(context=ssl.create_default_context())
        if smtp_username and smtp_password:
            server.login(smtp_username, smtp_password)
        server.send_message(message)

    return True


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if cors_origins == "*" else cors_origins,
    allow_credentials=False if cors_origins == "*" else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse)
def home():
    template_path = Path(__file__).resolve().parent / "templates" / "index.html"
    return HTMLResponse(template_path.read_text(encoding="utf-8"))


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
        "storage_root": str(STORAGE_ROOT),
        "storage_mode": "supabase" if supabase_storage_enabled() else "local",
        "photos": "/uploads/photos",
        "reels": "/uploads/reels",
        "stories": "/uploads/stories"
    }


@app.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "user": user_payload(current_user)
    }


@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):

    new_user = create_user_account(user, db)

    return {
        "message": "User created successfully",
        "user": user_payload(new_user)
    }


@app.post("/request-email-otp")
def request_email_otp(payload: EmailOtpRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(
        User.username == payload.username
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    existing_email = db.query(User).filter(
        User.email == payload.email
    ).first()

    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    otp = f"{secrets.randbelow(1000000):06d}"
    email_key = payload.email.lower()
    EMAIL_OTP_STORE[email_key] = {
        "otp": otp,
        "username": payload.username,
        "expires_at": datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        "attempts": 0
    }

    sent = send_otp_email(payload.email, otp)
    response = {
        "message": "Verification code sent to your email"
        if sent
        else "Verification code generated. Configure SMTP to send real emails."
    }

    if not sent:
        response["dev_otp"] = otp

    return response


@app.post("/verify-register")
def verify_register(payload: VerifyRegisterData, db: Session = Depends(get_db)):
    email_key = payload.email.lower()
    record = EMAIL_OTP_STORE.get(email_key)

    if not record:
        raise HTTPException(status_code=400, detail="Request a verification code first")

    if datetime.utcnow() > record["expires_at"]:
        del EMAIL_OTP_STORE[email_key]
        raise HTTPException(status_code=400, detail="Verification code expired")

    if record["username"] != payload.username:
        raise HTTPException(status_code=400, detail="Verification code does not match this username")

    if record["otp"] != payload.otp.strip():
        record["attempts"] += 1
        if record["attempts"] >= 5:
            del EMAIL_OTP_STORE[email_key]
        raise HTTPException(status_code=400, detail="Invalid verification code")

    new_user = create_user_account(payload, db)
    del EMAIL_OTP_STORE[email_key]

    access_token = create_access_token(
        data={"sub": new_user.email}
    )

    return {
        "message": "User created successfully",
        "token": access_token,
        "user": user_payload(new_user)
    }
@app.post("/login")
def login(user: LoginData, db: Session = Depends(get_db)):

    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email")

    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid password")

    access_token = create_access_token(
        data={"sub": db_user.email}
    )

    return {
        "message": "Login successful",
        "token": access_token,
        "user": user_payload(db_user)
    }
@app.post("/create-post")
def create_post(post: PostCreate, db: Session = Depends(get_db)):

    new_post = Post(
        caption=post.caption
    )

    db.add(new_post)
    try:
        db.commit()
        db.refresh(new_post)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Post created successfully",
        "caption": new_post.caption
    }
@app.post("/upload-post")
def upload_post(
    caption: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    safe_name = safe_filename(file.filename, "vibe.jpg")

    duplicate_post = db.query(Post).filter(
        Post.user_id == current_user.id,
        Post.caption == caption,
        Post.image_url.like(f"%{safe_name}")
    ).first()

    if duplicate_post:
        raise HTTPException(
            status_code=409,
            detail="This vibe already exists"
        )

    stored_upload = save_upload(
        file,
        PHOTO_STORAGE_DIR,
        f"user-{current_user.id}",
        "vibe.jpg"
    )
    image_url = stored_upload.public_url

    new_post = Post(
        user_id=current_user.id,
        caption=caption,
        image_url=image_url
    )

    db.add(new_post)
    try:
        db.commit()
        db.refresh(new_post)
    except Exception:
        db.rollback()
        delete_storage_reference(image_url, stored_upload.local_path)
        raise

    return {
        "message": "Vibe uploaded successfully",
        "post": {
            "id": new_post.id,
            "user_id": current_user.id,
            "username": current_user.username,
            "profile_image": profile_image_for_user(current_user),
            "caption": new_post.caption,
            "image_url": new_post.image_url,
            "resonates_count": 0,
            "likes_count": 0,
            "comments_count": 0
        }
    }


@app.post("/upload-reel")
def upload_reel(
    caption: str = Form(""),
    video: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = video or file

    if not upload:
        raise HTTPException(status_code=400, detail="Choose a video file")

    safe_name = Path(upload.filename or "reel.mp4").name
    suffix = Path(safe_name).suffix.lower()
    content_type = upload.content_type or ""

    if not content_type.startswith("video/") and suffix not in [".mp4", ".mov", ".m4v", ".webm"]:
        raise HTTPException(status_code=400, detail="Upload a valid video file")

    stored_upload = save_upload(
        upload,
        REEL_STORAGE_DIR,
        f"user-{current_user.id}-reel",
        "reel.mp4"
    )
    video_url = stored_upload.public_url

    new_reel = Reel(
        user_id=current_user.id,
        caption=caption,
        video_url=video_url
    )

    db.add(new_reel)
    try:
        db.commit()
        db.refresh(new_reel)
    except Exception:
        db.rollback()
        delete_storage_reference(video_url, stored_upload.local_path)
        raise

    return {
        "message": "Reel uploaded successfully",
        "reel": reel_payload(new_reel, db)
    }


@app.post("/stories/upload")
def upload_story(
    caption: str = Form(""),
    media: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = media or file

    if not upload:
        raise HTTPException(status_code=400, detail="Choose an image or video story")

    media_type = story_media_type(upload)
    fallback_name = "story.mp4" if media_type == "video" else "story.jpg"
    stored_upload = save_upload(
        upload,
        STORY_STORAGE_DIR,
        f"user-{current_user.id}-story",
        fallback_name
    )
    media_url = stored_upload.public_url
    now = utc_now()
    new_story = Story(
        user_id=current_user.id,
        media_url=media_url,
        media_type=media_type,
        caption=caption.strip(),
        created_at=now,
        expires_at=now + timedelta(hours=24)
    )

    db.add(new_story)
    try:
        db.commit()
        db.refresh(new_story)
    except Exception:
        db.rollback()
        delete_storage_reference(media_url, stored_upload.local_path)
        raise

    return {
        "message": "Story uploaded successfully",
        "story": story_payload(new_story, db)
    }


@app.get("/stories/feed")
def get_stories_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stories = db.query(Story).filter(
        Story.expires_at > utc_now()
    ).order_by(Story.created_at.desc()).all()
    groups_by_user = {}

    for story in stories:
        author = db.query(User).filter(User.id == story.user_id).first()

        if not author or not can_view_private_content(author, db, current_user):
            continue

        if author.id not in groups_by_user:
            groups_by_user[author.id] = {
                "user": author,
                "stories": []
            }

        groups_by_user[author.id]["stories"].append(story)

    groups = list(groups_by_user.values())
    groups.sort(
        key=lambda group: (
            group["user"].id != current_user.id,
            -(max(story.created_at or utc_now() for story in group["stories"]).timestamp())
        )
    )

    return [
        story_group_payload(group["user"], group["stories"], db)
        for group in groups
    ]


@app.get("/stories/user/{user_id}")
def get_user_stories(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not can_view_private_content(user, db, current_user):
        raise HTTPException(status_code=403, detail="This profile is private")

    stories = db.query(Story).filter(
        Story.user_id == user_id,
        Story.expires_at > utc_now()
    ).order_by(Story.created_at.asc()).all()

    return story_group_payload(user, stories, db)


@app.delete("/stories/{story_id}")
def delete_story(
    story_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    story = story_or_404(story_id, db)

    if story.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can delete only your own story")

    file_path = local_upload_path(story.media_url)
    media_url = story.media_url
    db.delete(story)
    db.commit()

    delete_storage_reference(media_url, file_path)

    return {
        "message": "Story deleted successfully",
        "story_id": story_id
    }


@app.get("/reels")
def get_reels(request: Request, db: Session = Depends(get_db)):
    viewer = optional_current_user_from_request(request, db)
    allowed_user_ids = visible_author_ids(db, viewer.id) if viewer else visible_author_ids(db, 0)
    reels = db.query(Reel).filter(
        Reel.user_id.in_(allowed_user_ids)
    ).order_by(Reel.created_at.desc()).all()

    return {
        "reels": [
            reel_payload(reel, db)
            for reel in reels
        ]
    }


@app.post("/like-reel")
async def like_reel(
    reel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = reel_or_404(reel_id, db)
    ensure_reel_visible(reel, db, current_user)

    existing_like = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.reel_id == reel_id
    ).first()

    if existing_like:
        raise HTTPException(status_code=409, detail="You already resonated with this reel")

    db.add(Like(user_id=current_user.id, reel_id=reel_id))

    if reel.user_id != current_user.id:
        await notify_user(
            db,
            reel.user_id,
            f"{current_user.username} resonated with your reel",
            {"type": "reel_like", "reel_id": reel.id, "sender_id": current_user.id}
        )

    db.commit()
    db.refresh(reel)

    return {
        "message": "Reel resonated successfully",
        "reel": reel_payload(reel, db)
    }


@app.delete("/unlike-reel")
def unlike_reel(
    reel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = reel_or_404(reel_id, db)
    ensure_reel_visible(reel, db, current_user)
    like = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.reel_id == reel_id
    ).first()

    if not like:
        raise HTTPException(status_code=404, detail="Reel resonate not found")

    db.delete(like)
    db.commit()
    db.refresh(reel)

    return {
        "message": "Reel resonate removed",
        "reel": reel_payload(reel, db)
    }


@app.post("/comment-reel")
async def comment_reel(
    reel_id: int,
    text: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = reel_or_404(reel_id, db)
    ensure_reel_visible(reel, db, current_user)
    clean_text = text.strip()

    if not clean_text:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    new_comment = Comment(
        user_id=current_user.id,
        reel_id=reel_id,
        text=clean_text
    )
    db.add(new_comment)

    if reel.user_id != current_user.id:
        await notify_user(
            db,
            reel.user_id,
            f"{current_user.username} commented on your reel",
            {"type": "reel_comment", "reel_id": reel.id, "sender_id": current_user.id}
        )

    db.commit()
    db.refresh(new_comment)
    db.refresh(reel)

    return {
        "message": "Comment added successfully",
        "comment": {
            "id": new_comment.id,
            "user_id": current_user.id,
            "username": current_user.username,
            "profile_image": profile_image_for_user(current_user),
            "text": new_comment.text
        },
        "reel": reel_payload(reel, db)
    }


@app.get("/reel-comments/{reel_id}")
def get_reel_comments(reel_id: int, request: Request, db: Session = Depends(get_db)):
    reel = reel_or_404(reel_id, db)
    viewer = optional_current_user_from_request(request, db)
    ensure_reel_visible(reel, db, viewer)
    comments = db.query(Comment).filter(
        Comment.reel_id == reel_id
    ).order_by(Comment.id.asc()).all()
    comment_payloads = []

    for comment in comments:
        author = db.query(User).filter(User.id == comment.user_id).first()
        comment_payloads.append({
            "id": comment.id,
            "user_id": comment.user_id,
            "username": author.username if author else "vibezone",
            "profile_image": profile_image_for_user(author),
            "text": comment.text
        })

    return {
        "comments": comment_payloads
    }


@app.post("/view-reel")
def view_reel(reel_id: int, request: Request, db: Session = Depends(get_db)):
    reel = reel_or_404(reel_id, db)
    viewer = optional_current_user_from_request(request, db)
    ensure_reel_visible(reel, db, viewer)
    reel.views_count = (reel.views_count or 0) + 1
    db.commit()
    db.refresh(reel)

    return {
        "message": "Reel view counted",
        "reel": reel_payload(reel, db)
    }


@app.post("/share-reel")
def share_reel(reel_id: int, request: Request, db: Session = Depends(get_db)):
    reel = reel_or_404(reel_id, db)
    viewer = optional_current_user_from_request(request, db)
    ensure_reel_visible(reel, db, viewer)
    reel.shares_count = (reel.shares_count or 0) + 1
    db.commit()
    db.refresh(reel)

    return {
        "message": "Reel share counted",
        "reel": reel_payload(reel, db)
    }


@app.post("/like-post")
async def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Vibe not found")
    ensure_post_visible(post, db, current_user)

    # Prevent duplicate likes
    existing_like = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.post_id == post_id
    ).first()

    if existing_like:
        raise HTTPException(status_code=400, detail="You already resonated with this vibe")

    # Create like
    new_like = Like(
        user_id=current_user.id,
        post_id=post_id
    )
    db.add(new_like)

    # Create notification for post owner
    if post.user_id != current_user.id:
        await notify_user(
            db,
            post.user_id,
            f"{current_user.username} resonated with your vibe",
            {"type": "vibe_like", "post_id": post.id, "sender_id": current_user.id}
        )

    db.commit()

    return {
        "message": "Vibe resonated successfully"
    }
@app.post("/comment-post")
async def comment_post(
    post_id: int,
    text: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Vibe not found")
    ensure_post_visible(post, db, current_user)

    # Create comment
    new_comment = Comment(
        user_id=current_user.id,
        post_id=post_id,
        text=text
    )
    db.add(new_comment)

    # Create notification for post owner
    if post.user_id != current_user.id:
        await notify_user(
            db,
            post.user_id,
            f"{current_user.username} commented: {text}",
            {"type": "vibe_comment", "post_id": post.id, "sender_id": current_user.id}
        )

    db.commit()
    db.refresh(new_comment)

    return {
        "message": "Comment added successfully",
        "comment": {
            "id": new_comment.id,
            "user_id": current_user.id,
            "username": current_user.username,
            "profile_image": profile_image_for_user(current_user),
            "text": new_comment.text
        }
    }
@app.post("/follow-user")
async def follow_user(
    following_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if following_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot connect with yourself")

    # Check if target user exists
    target_user = db.query(User).filter(User.id == following_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent duplicate follow
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == following_id
    ).first()

    if existing_follow:
        raise HTTPException(
            status_code=409,
            detail="Already connected with this viber"
        )

    # Create follow record
    new_follow = Follow(
        follower_id=current_user.id,
        following_id=following_id
    )
    db.add(new_follow)

    await notify_user(
        db,
        following_id,
        f"{current_user.username} became your viber",
        {"type": "follow", "user_id": current_user.id, "sender_id": current_user.id}
    )

    db.commit()

    return {
        "message": "Connection created successfully",
        "target_user": profile_payload(target_user, db),
        "current_user_counts": get_profile_counts(current_user.id, db)
    }


@app.post("/unfollow-user")
def unfollow_user(
    following_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    follow = db.query(Follow).filter_by(
        follower_id=current_user.id,
        following_id=following_id
    ).first()

    if follow:
        db.delete(follow)
        db.commit()
        target_user = db.query(User).filter_by(id=following_id).first()
        return {
            "message": "Connection removed successfully",
            "target_user": profile_payload(target_user, db) if target_user else None,
            "current_user_counts": get_profile_counts(current_user.id, db)
        }

    raise HTTPException(status_code=404, detail="Connection not found")


@app.post("/users/{user_id}/vibe")
async def vibe_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot vibe yourself")

    receiver = db.query(User).filter(User.id == user_id).first()

    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")

    existing_vibe = db.query(UserVibe).filter_by(
        sender_id=current_user.id,
        receiver_id=user_id
    ).first()

    if existing_vibe:
        raise HTTPException(status_code=409, detail="You already vibed this profile")

    db.add(UserVibe(sender_id=current_user.id, receiver_id=user_id))
    await notify_user(
        db,
        user_id,
        f"{current_user.username} vibed your profile ❤️",
        {"type": "profile_vibe", "sender_id": current_user.id}
    )
    db.commit()
    db.refresh(receiver)
    await send_profile_update(user_id, db)
    await send_profile_view_update(current_user.id, user_id, db)

    return {
        "message": "Profile vibed",
        "target_user": profile_payload(receiver, db, current_user),
        "current_user_counts": get_profile_counts(current_user.id, db)
    }


@app.delete("/users/{user_id}/vibe")
async def unvibe_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot unvibe yourself")

    receiver = db.query(User).filter(User.id == user_id).first()

    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")

    vibe = db.query(UserVibe).filter_by(
        sender_id=current_user.id,
        receiver_id=user_id
    ).first()

    if not vibe:
        raise HTTPException(status_code=404, detail="Profile vibe not found")

    db.delete(vibe)
    db.commit()
    await send_profile_update(user_id, db)
    await send_profile_view_update(current_user.id, user_id, db)

    return {
        "message": "Profile unvibed",
        "target_user": profile_payload(receiver, db, current_user),
        "current_user_counts": get_profile_counts(current_user.id, db)
    }


@app.post("/users/{user_id}/connection-request")
async def create_connection_request(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot connect with yourself")

    receiver = db.query(User).filter(User.id == user_id).first()

    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")

    existing_connection = connection_between(current_user.id, user_id, db)

    if existing_connection and existing_connection.status in ("pending", "accepted"):
        raise HTTPException(
            status_code=409,
            detail=(
                "Connection request already sent"
                if existing_connection.status == "pending"
                else "Already connected"
            )
        )

    if existing_connection and existing_connection.status == "rejected":
        existing_connection.sender_id = current_user.id
        existing_connection.receiver_id = user_id
        existing_connection.status = "pending"
        existing_connection.created_at = utc_now()
        request = existing_connection
    else:
        request = ConnectionRequest(
            sender_id=current_user.id,
            receiver_id=user_id,
            status="pending"
        )
        db.add(request)

    db.flush()
    await notify_user(
        db,
        user_id,
        f"{current_user.username} sent you a connection request 🤝",
        {
            "type": "connection_request",
            "request_id": request.id,
            "sender_id": current_user.id
        }
    )
    db.commit()
    db.refresh(request)
    db.refresh(receiver)
    await send_profile_view_update(current_user.id, user_id, db)

    return {
        "message": "Connection request sent",
        "request": {
            "id": request.id,
            "sender_id": request.sender_id,
            "receiver_id": request.receiver_id,
            "status": request.status,
            "created_at": isoformat_utc(request.created_at)
        },
        "target_user": profile_payload(receiver, db, current_user)
    }


@app.post("/connections/{request_id}/accept")
async def accept_connection_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    request = db.query(ConnectionRequest).filter(
        ConnectionRequest.id == request_id,
        ConnectionRequest.receiver_id == current_user.id
    ).first()

    if not request:
        raise HTTPException(status_code=404, detail="Connection request not found")

    if request.status == "accepted":
        raise HTTPException(status_code=409, detail="Connection request already accepted")

    if request.status != "pending":
        raise HTTPException(status_code=400, detail="Connection request is not pending")

    sender = db.query(User).filter(User.id == request.sender_id).first()

    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    request.status = "accepted"
    await notify_user(
        db,
        request.sender_id,
        f"You are now connected with {current_user.username} 🤝",
        {"type": "connection_accepted", "receiver_id": current_user.id, "sender_id": current_user.id}
    )
    db.commit()
    await send_profile_update(current_user.id, db)
    await send_profile_update(request.sender_id, db)
    await send_profile_view_update(request.sender_id, current_user.id, db)
    await send_profile_view_update(current_user.id, request.sender_id, db)

    return {
        "message": "Connection accepted",
        "request_id": request.id,
        "status": request.status,
        "current_user_counts": get_profile_counts(current_user.id, db),
        "current_user_profile": profile_payload(current_user, db, current_user),
        "sender_profile": profile_payload(sender, db, current_user)
    }


@app.post("/connections/{request_id}/reject")
async def reject_connection_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    request = db.query(ConnectionRequest).filter(
        ConnectionRequest.id == request_id,
        ConnectionRequest.receiver_id == current_user.id
    ).first()

    if not request:
        raise HTTPException(status_code=404, detail="Connection request not found")

    if request.status != "pending":
        raise HTTPException(status_code=400, detail="Connection request is not pending")

    request.status = "rejected"
    db.commit()
    await send_profile_view_update(request.sender_id, current_user.id, db)

    return {
        "message": "Connection rejected",
        "request_id": request.id,
        "status": request.status,
        "sender_id": request.sender_id,
        "receiver_profile": profile_payload(current_user, db, db.query(User).filter(User.id == request.sender_id).first())
    }


@app.get("/users/{user_id}/vibers")
def get_user_vibers(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    vibe_rows = db.query(UserVibe).filter(
        UserVibe.receiver_id == user_id
    ).order_by(UserVibe.created_at.desc()).all()
    vibers = []

    for vibe in vibe_rows:
        viber = db.query(User).filter(User.id == vibe.sender_id).first()

        if viber:
            payload = user_card_payload(viber, db, current_user)
            payload["vibed_at"] = isoformat_utc(vibe.created_at)
            vibers.append(payload)

    return {
        "user_id": user_id,
        "count": len(vibers),
        "vibers": vibers
    }


@app.get("/users/{user_id}/connections")
def get_user_connections(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    accepted_requests = db.query(ConnectionRequest).filter(
        (
            (ConnectionRequest.sender_id == user_id) |
            (ConnectionRequest.receiver_id == user_id)
        ),
        ConnectionRequest.status == "accepted"
    ).order_by(ConnectionRequest.created_at.desc()).all()
    seen_ids = set()
    connections = []

    for request in accepted_requests:
        connected_user_id = (
            request.receiver_id if request.sender_id == user_id else request.sender_id
        )

        if connected_user_id in seen_ids:
            continue

        connected_user = db.query(User).filter(User.id == connected_user_id).first()

        if connected_user:
            seen_ids.add(connected_user_id)
            payload = user_card_payload(connected_user, db, current_user)
            payload["connected_at"] = isoformat_utc(request.created_at)
            connections.append(payload)

    return {
        "user_id": user_id,
        "count": len(connections),
        "connections": connections
    }

@app.get("/profile/{user_id}")
def get_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter_by(id=user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return profile_payload(user, db, current_user)


@app.get("/users/{user_id}")
def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter_by(id=user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return profile_payload(user, db, current_user)


@app.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.query(User).filter(User.id != current_user.id).order_by(User.username.asc()).all()

    return {
        "users": [
            user_card_payload(user, db, current_user)
            for user in users
        ]
    }


@app.get("/settings/theme")
def get_theme_settings(current_user: User = Depends(get_current_user)):
    return {
        "theme": parse_theme_settings(current_user.theme_settings)
    }


@app.put("/settings/theme")
async def update_theme_settings(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    body = await request.json()
    theme = body.get("theme")

    if not isinstance(theme, dict) or not theme.get("id") or not theme.get("name"):
        raise HTTPException(status_code=400, detail="Valid theme settings are required")

    current_user.theme_settings = json.dumps(theme)
    db.commit()

    return {
        "message": "Theme saved",
        "theme": theme
    }


@app.get("/account-privacy")
def get_account_privacy(current_user: User = Depends(get_current_user)):
    return {
        "account_type": normalize_account_type(current_user.account_type)
    }


@app.put("/account-privacy")
def update_account_privacy(
    payload: AccountPrivacyPayload = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.account_type = validate_account_type(payload.account_type)
    db.commit()
    db.refresh(current_user)

    return {
        "account_type": normalize_account_type(current_user.account_type),
        "user": user_payload(current_user)
    }


@app.put("/profile/{user_id}")
async def update_profile(
    user_id: int,
    username: Optional[str] = Form(None),
    full_name: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    date_of_birth: Optional[str] = Form(None),
    profile_image: Optional[str] = Form(None),
    account_type: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own profile")

    validated_username = validate_profile_username(username, current_user.id, db)
    cleaned_bio = "" if bio == "" else clean_optional_text(bio)

    if cleaned_bio and len(cleaned_bio) > 150:
        raise HTTPException(status_code=400, detail="Bio must be 150 characters or less")

    stored_upload = None

    if file:
        validate_profile_image(file)
        stored_upload = save_upload(
            file,
            PHOTO_STORAGE_DIR,
            f"user-{current_user.id}-profile",
            "profile.jpg"
        )
        profile_image = stored_upload.public_url

    if validated_username is not None:
        current_user.username = validated_username

    if full_name is not None:
        current_user.full_name = clean_optional_text(full_name)

    if bio is not None:
        current_user.bio = cleaned_bio

    if website is not None:
        current_user.website = clean_optional_text(website)

    if gender is not None:
        current_user.gender = clean_optional_text(gender)

    if date_of_birth is not None:
        current_user.date_of_birth = clean_optional_text(date_of_birth)

    if profile_image is not None:
        current_user.profile_image = clean_optional_text(profile_image)

    if account_type is not None:
        current_user.account_type = validate_account_type(account_type)

    try:
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()
        if stored_upload:
            delete_storage_reference(profile_image, stored_upload.local_path)
        raise

    await send_profile_update(current_user.id, db)

    return {
        "message": "Profile updated successfully",
        "profile": profile_payload(current_user, db, current_user)
    }
@app.get("/feed/{user_id}")
def get_feed(user_id: int, db: Session = Depends(get_db)):
    following_ids = db.query(Follow.following_id).filter(Follow.follower_id == user_id).all()
    following_ids = [id[0] for id in following_ids]
    vibed_ids = [
        row[0]
        for row in db.query(UserVibe.receiver_id).filter(UserVibe.sender_id == user_id).all()
    ]
    allowed_user_ids = visible_author_ids(db, user_id)
    visible_user_ids = list((set([user_id] + following_ids + vibed_ids)) & allowed_user_ids)

    reels = db.query(Reel).filter(Reel.user_id.in_(visible_user_ids)).order_by(Reel.created_at.desc()).all()
    posts = db.query(Post).filter(Post.user_id.in_(visible_user_ids)).order_by(Post.id.desc()).all()

    feed_posts = []
    for reel in reels:
        item = reel_payload(reel, db)
        item.update({
            "id": f"reel-{reel.id}",
            "reel_id": reel.id,
            "image_url": None
        })
        feed_posts.append(item)

    for post in posts:
        author = db.query(User).filter(User.id == post.user_id).first()
        likes = db.query(Like).filter_by(post_id=post.id).count()
        comments = db.query(Comment).filter_by(post_id=post.id).count()
        feed_posts.append({
            "id": post.id,
            "user_id": post.user_id,
            "username": author.username if author else "VibeZone",
            "profile_image": profile_image_for_user(author),
            "caption": post.caption,
            "image_url": post.image_url,
            "resonates_count": likes,
            "likes_count": likes,
            "comments_count": comments
        })

    return {
        "vibes": feed_posts,
        "posts": feed_posts
    }
@app.get("/post/{post_id}")
def get_post(post_id: int, request: Request, db: Session = Depends(get_db)):
    post = db.query(Post).filter_by(id=post_id).first()

    if not post:
        raise HTTPException(status_code=404, detail="Vibe not found")
    viewer = optional_current_user_from_request(request, db)
    ensure_post_visible(post, db, viewer)

    likes = db.query(Like).filter_by(post_id=post_id).count()
    comments = db.query(Comment).filter_by(post_id=post_id).all()
    comment_payloads = []

    for comment in comments:
        author = db.query(User).filter(User.id == comment.user_id).first()
        comment_payloads.append({
            "id": comment.id,
            "user_id": comment.user_id,
            "username": author.username if author else "vibezone",
            "profile_image": profile_image_for_user(author),
            "text": comment.text
        })

    return {
        "caption": post.caption,
        "image_url": post.image_url,
        "resonates": likes,
        "likes": likes,
        "comments": comment_payloads
    }


@app.get("/search")
def search(query: str, db: Session = Depends(get_db)):
    users = db.query(User).filter(User.username.ilike(f"%{query}%")).all()
    posts = db.query(Post).filter(Post.caption.ilike(f"%{query}%")).all()

    return {
        "users": [{"username": user.username} for user in users],
        "vibes": [{"caption": post.caption, "image_url": post.image_url} for post in posts],
        "posts": [{"caption": post.caption, "image_url": post.image_url} for post in posts]
    }
@app.put("/edit-profile")
def edit_profile(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    if user_update.username:
        existing_user = db.query(User).filter(
            User.username == user_update.username,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = user_update.username

    if user_update.email:
        existing_user = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = user_update.email

    if user_update.bio is not None:
        current_user.bio = user_update.bio

    if user_update.profile_image is not None:
        current_user.profile_image = user_update.profile_image

    if user_update.account_type is not None:
        current_user.account_type = validate_account_type(user_update.account_type)

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully",
        "username": current_user.username,
        "email": current_user.email,
        "bio": current_user.bio,
        "profile_image": profile_image_for_user(current_user),
        "account_type": normalize_account_type(current_user.account_type)
    }
@app.delete("/unlike-post")
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    like = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.post_id == post_id
    ).first()

    if not like:
        raise HTTPException(status_code=404, detail="Resonate not found")

    db.delete(like)
    db.commit()

    return {
        "message": "Vibe unresonated successfully"
    }
@app.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.id.desc()).all()

    return {
        "unread_count": db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        ).count(),
        "notifications": [
            {
                "id": notification.id,
                "message": notification.message,
                "is_read": notification.is_read,
                "data": notification_payload(notification)["data"]
            }
            for notification in notifications
        ]
    }
@app.put("/notifications/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    return {
        "message": "Notification marked as read",
        "notification_id": notification.id,
        "is_read": notification.is_read
    }


@app.post("/push-token")
def save_push_token(
    push_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.push_token = push_token
    db.commit()
    db.refresh(current_user)

    return {
        "message": "Push token saved",
        "push_token": current_user.push_token
    }


@app.get("/online-users")
def get_online_users():
    return {"online_user_ids": list(manager.active_connections.keys())}


@app.get("/call-history")
def get_call_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    calls = db.query(CallHistory).filter(
        (CallHistory.caller_id == current_user.id) |
        (CallHistory.receiver_id == current_user.id)
    ).order_by(CallHistory.created_at.desc()).limit(50).all()

    return {
        "calls": [
            call_history_payload(call)
            for call in calls
        ]
    }


@app.get("/chat-users")
def get_chat_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.query(User).filter(User.id != current_user.id).order_by(User.username.asc()).all()
    chat_users = [
        chat_user_payload(db, current_user, user)
        for user in users
        if not is_chat_locked_for_user(db, current_user.id, user.id)
    ]

    locked_count = db.query(ChatLock).filter(
        ChatLock.user_id == current_user.id,
        ChatLock.locked == True
    ).count()

    return {
        "users": chat_users,
        "locked_count": locked_count,
        "settings": chat_lock_settings_payload(current_user)
    }


@app.get("/chat-lock-settings")
def get_chat_lock_settings(
    current_user: User = Depends(get_current_user)
):
    return chat_lock_settings_payload(current_user)


@app.put("/chat-lock-settings")
def update_chat_lock_settings(
    payload: ChatLockSettingsPayload = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.new_pin is not None:
        current_user.chat_pin_hash = hash_password(validate_chat_pin(payload.new_pin))
        current_user.chat_lock_enabled = True

    if payload.enabled is not None:
        current_user.chat_lock_enabled = payload.enabled

    if payload.biometric_enabled is not None:
        current_user.chat_lock_biometric = payload.biometric_enabled

    if payload.face_id_enabled is not None:
        current_user.chat_lock_face_id = payload.face_id_enabled

    if payload.hide_locked_chats is not None:
        current_user.hide_locked_chats = payload.hide_locked_chats

    if payload.auto_lock_after_exit is not None:
        current_user.auto_lock_after_exit = payload.auto_lock_after_exit

    if payload.ghost_lock_mode is not None:
        current_user.ghost_lock_mode = payload.ghost_lock_mode

    db.commit()
    db.refresh(current_user)

    return chat_lock_settings_payload(current_user)


@app.post("/verify-chat-pin")
def verify_chat_pin(
    payload: ChatPinPayload = Body(...),
    current_user: User = Depends(get_current_user)
):
    if not current_user.chat_pin_hash:
        raise HTTPException(status_code=400, detail="Chat Lock PIN is not set")

    pin = validate_chat_pin(payload.pin)

    if not verify_password(pin, current_user.chat_pin_hash):
        raise HTTPException(status_code=401, detail="Invalid Chat Lock PIN")

    return {"verified": True}


@app.post("/chat-lock/{chat_id}")
def lock_chat(
    chat_id: int,
    payload: ChatPinPayload = Body(default=ChatPinPayload()),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    validate_chat_target(db, current_user, chat_id)

    if not current_user.chat_pin_hash:
        current_user.chat_pin_hash = hash_password(validate_chat_pin(payload.pin))
    elif payload.pin:
        pin = validate_chat_pin(payload.pin)

        if not verify_password(pin, current_user.chat_pin_hash):
            raise HTTPException(status_code=401, detail="Invalid Chat Lock PIN")

    current_user.chat_lock_enabled = True
    lock = db.query(ChatLock).filter(
        ChatLock.user_id == current_user.id,
        ChatLock.chat_id == chat_id
    ).first()

    if not lock:
        lock = ChatLock(user_id=current_user.id, chat_id=chat_id, locked=True)
        db.add(lock)
    else:
        lock.locked = True

    db.commit()
    db.refresh(lock)

    return {
        "message": "Chat locked",
        "lock": chat_lock_payload(lock),
        "settings": chat_lock_settings_payload(current_user)
    }


@app.delete("/chat-lock/{chat_id}")
def unlock_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    validate_chat_target(db, current_user, chat_id)
    lock = db.query(ChatLock).filter(
        ChatLock.user_id == current_user.id,
        ChatLock.chat_id == chat_id
    ).first()

    if lock:
        lock.locked = False
        db.commit()
        db.refresh(lock)

    return {
        "message": "Chat unlocked",
        "lock": chat_lock_payload(lock) if lock else None
    }


@app.get("/locked-chats")
def get_locked_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    locks = db.query(ChatLock).filter(
        ChatLock.user_id == current_user.id,
        ChatLock.locked == True
    ).order_by(ChatLock.created_at.desc()).all()
    users = []

    for lock in locks:
        user = db.query(User).filter(User.id == lock.chat_id).first()

        if user:
            users.append(chat_user_payload(db, current_user, user, mask_locked=False))

    return {
        "users": users,
        "locked_count": len(users),
        "settings": chat_lock_settings_payload(current_user)
    }


@app.get("/messages/{user_id}")
async def get_messages(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    other_user = db.query(User).filter(User.id == user_id).first()

    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    messages = db.query(Message).filter(
        (
            (Message.sender_id == current_user.id) &
            (Message.receiver_id == user_id)
        ) |
        (
            (Message.sender_id == user_id) &
            (Message.receiver_id == current_user.id)
        )
    ).order_by(Message.id.asc()).all()

    read_message_ids = []

    for msg in messages:
        if msg.receiver_id == current_user.id and not msg.is_read:
            msg.is_read = True
            msg.is_delivered = True
            msg.status = "seen"
            read_message_ids.append(msg.id)

    db.commit()

    if read_message_ids:
        await manager.send_personal_message(user_id, {
            "type": "read_receipt",
            "reader_id": current_user.id,
            "message_ids": read_message_ids
        })

    return {
        "messages": [
            message_payload(msg, db)
            for msg in messages
        ]
    }


@app.post("/send-message")
async def send_message(
    receiver_id: int,
    text: Optional[str] = None,
    content: Optional[str] = None,
    created_at: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    receiver = db.query(User).filter(User.id == receiver_id).first()

    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    raw_content = content if content is not None else text or ""
    clean_text = raw_content.strip()

    if not clean_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    message = Message(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        content=raw_content,
        text=raw_content,
        created_at=parse_iso_datetime(created_at),
        status="delivered" if manager.is_online(receiver_id) else "sent",
        is_delivered=manager.is_online(receiver_id)
    )

    db.add(message)
    db.commit()
    db.refresh(message)
    payload = {
        "type": "message",
        "message": message_payload(message, db)
    }
    await notify_user(
        db,
        receiver_id,
        f"{current_user.username} sent you a message",
        {"type": "message", "sender_id": current_user.id}
    )
    db.commit()
    await manager.broadcast_chat_message(current_user.id, receiver_id, payload)

    return {
        "message": "Message sent successfully",
        "chat_message": payload["message"]
    }


@sio.event
async def connect(sid, environ, auth):
    db = SessionLocal()

    try:
        user = user_from_access_token(socketio_token(environ, auth), db)

        if not user:
            return False

        call_sid_to_user[sid] = user.id
        call_user_to_sids.setdefault(user.id, set()).add(sid)
        await sio.save_session(sid, {"user_id": user.id})
        await sio.emit("call_socket_ready", {
            "user": call_user_payload(user)
        }, to=sid)
    finally:
        db.close()


@sio.event
async def disconnect(sid):
    user_id = call_sid_to_user.pop(sid, None)

    if user_id and user_id in call_user_to_sids:
        call_user_to_sids[user_id].discard(sid)

        if not call_user_to_sids[user_id]:
            del call_user_to_sids[user_id]


@sio.event
async def voice_call(sid, data):
    await start_socket_call(sid, data, "voice")


@sio.event
async def video_call(sid, data):
    await start_socket_call(sid, data, "video")


async def start_socket_call(sid, data, requested_call_type: str):
    session = await sio.get_session(sid)
    caller_id = int(session.get("user_id"))
    receiver_id = int((data or {}).get("receiver_id") or 0)
    call_id = str((data or {}).get("call_id") or f"{caller_id}-{receiver_id}-{utc_now().timestamp()}")
    call_type = normalize_call_type(requested_call_type)
    db = SessionLocal()

    try:
        caller = db.query(User).filter(User.id == caller_id).first()
        receiver = db.query(User).filter(User.id == receiver_id).first()

        if not caller or not receiver or caller.id == receiver.id:
            await sio.emit("call_error", {
                "call_id": call_id,
                "message": "Call user not found"
            }, to=sid)
            return

        payload = {
            "call_id": call_id,
            "caller_id": caller.id,
            "receiver_id": receiver.id,
            "caller": call_user_payload(caller),
            "receiver": call_user_payload(receiver),
            "call_type": call_type
        }
        await notify_user(
            db,
            receiver.id,
            f"{caller.username} is calling you",
            {"type": f"{call_type}_call", "sender_id": caller.id, "call_id": call_id}
        )
        db.commit()
        await emit_call_event(receiver.id, f"{call_type}_call", payload)
        await sio.emit("call_status", {
            **payload,
            "status": "ringing" if receiver.id in call_user_to_sids else "notified"
        }, to=sid)
    finally:
        db.close()


@sio.event
async def call_accepted(sid, data):
    session = await sio.get_session(sid)
    receiver_id = int(session.get("user_id"))
    caller_id = int((data or {}).get("caller_id") or 0)
    call_id = str((data or {}).get("call_id") or "")
    call_type = normalize_call_type((data or {}).get("call_type"))
    db = SessionLocal()

    try:
        receiver = db.query(User).filter(User.id == receiver_id).first()
        caller = db.query(User).filter(User.id == caller_id).first()
        payload = {
            "call_id": call_id,
            "caller_id": caller_id,
            "receiver_id": receiver_id,
            "caller": call_user_payload(caller),
            "receiver": call_user_payload(receiver),
            "call_type": call_type
        }
        await emit_call_event(caller_id, "call_accepted", payload)
        await sio.emit("call_accepted", payload, to=sid)
    finally:
        db.close()


@sio.event
async def call_rejected(sid, data):
    session = await sio.get_session(sid)
    receiver_id = int(session.get("user_id"))
    caller_id = int((data or {}).get("caller_id") or 0)
    call_id = str((data or {}).get("call_id") or "")
    call_type = normalize_call_type((data or {}).get("call_type"))
    payload = {
        "call_id": call_id,
        "caller_id": caller_id,
        "receiver_id": receiver_id,
        "call_type": call_type
    }
    save_call_history_once(call_id, caller_id, receiver_id, 0, call_type)
    await emit_call_event(caller_id, "call_rejected", payload)
    await sio.emit("call_rejected", payload, to=sid)


@sio.event
async def offer(sid, data):
    session = await sio.get_session(sid)
    sender_id = int(session.get("user_id"))
    receiver_id = int((data or {}).get("receiver_id") or 0)
    await emit_call_event(receiver_id, "offer", {
        "call_id": (data or {}).get("call_id"),
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "call_type": normalize_call_type((data or {}).get("call_type")),
        "offer": (data or {}).get("offer")
    })


@sio.event
async def answer(sid, data):
    session = await sio.get_session(sid)
    sender_id = int(session.get("user_id"))
    receiver_id = int((data or {}).get("receiver_id") or 0)
    await emit_call_event(receiver_id, "answer", {
        "call_id": (data or {}).get("call_id"),
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "call_type": normalize_call_type((data or {}).get("call_type")),
        "answer": (data or {}).get("answer")
    })


@sio.event
async def ice_candidate(sid, data):
    session = await sio.get_session(sid)
    sender_id = int(session.get("user_id"))
    receiver_id = int((data or {}).get("receiver_id") or 0)
    await emit_call_event(receiver_id, "ice_candidate", {
        "call_id": (data or {}).get("call_id"),
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "call_type": normalize_call_type((data or {}).get("call_type")),
        "candidate": (data or {}).get("candidate")
    })


@sio.event
async def end_call(sid, data):
    session = await sio.get_session(sid)
    sender_id = int(session.get("user_id"))
    receiver_id = int((data or {}).get("receiver_id") or 0)
    caller_id = int((data or {}).get("caller_id") or sender_id)
    call_receiver_id = int((data or {}).get("call_receiver_id") or (sender_id if caller_id != sender_id else receiver_id))
    call_id = str((data or {}).get("call_id") or "")
    duration = int((data or {}).get("duration") or 0)
    call_type = normalize_call_type((data or {}).get("call_type"))
    payload = {
        "call_id": call_id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "caller_id": caller_id,
        "call_receiver_id": call_receiver_id,
        "duration": duration,
        "call_type": call_type
    }
    save_call_history_once(call_id, caller_id, call_receiver_id, duration, call_type)
    await emit_call_event(receiver_id, "end_call", payload)
    await sio.emit("end_call", payload, to=sid)


@app.websocket("/ws/{user_id}")
async def chat_websocket(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    db = SessionLocal()
    await mark_pending_messages_delivered(user_id, db)

    try:
        while True:
            data = await websocket.receive_json()
            try:
                receiver_id = int(data.get("receiver_id"))
            except (TypeError, ValueError):
                await websocket.send_json({
                    "type": "error",
                    "message": "Receiver is required"
                })
                continue

            event_type = data.get("type", "message")

            if event_type == "typing":
                await manager.send_personal_message(receiver_id, {
                    "type": "typing",
                    "sender_id": user_id,
                    "is_typing": bool(data.get("is_typing"))
                })
                continue

            if event_type == "read":
                message_ids = data.get("message_ids") or []
                messages = db.query(Message).filter(
                    Message.id.in_(message_ids),
                    Message.sender_id == receiver_id,
                    Message.receiver_id == user_id
                ).all()
                read_ids = []

                for message in messages:
                    if not message.is_read:
                        message.is_read = True
                        message.is_delivered = True
                        message.status = "seen"
                        read_ids.append(message.id)

                db.commit()

                if read_ids:
                    await manager.send_personal_message(receiver_id, {
                        "type": "read_receipt",
                        "reader_id": user_id,
                        "message_ids": read_ids
                    })
                continue

            if event_type in ("audio_call", "video_call"):
                sender = db.query(User).filter(User.id == user_id).first()
                receiver = db.query(User).filter(User.id == receiver_id).first()

                if not sender or not receiver:
                    await websocket.send_json({
                        "type": "error",
                        "message": "User not found"
                    })
                    continue

                call_type = "video" if event_type == "video_call" else "audio"
                await notify_user(
                    db,
                    receiver_id,
                    f"{sender.username} is calling you",
                    {"type": event_type, "sender_id": user_id}
                )
                db.commit()

                await manager.send_personal_message(receiver_id, {
                    "type": "call_request",
                    "call_type": call_type,
                    "sender_id": user_id,
                    "sender_username": sender.username,
                    "receiver_id": receiver_id
                })

                await websocket.send_json({
                    "type": "call_status",
                    "call_type": call_type,
                    "receiver_id": receiver_id,
                    "status": "ringing" if manager.is_online(receiver_id) else "notified"
                })
                continue

            raw_content = str(data.get("content", data.get("text", "")))
            clean_text = raw_content.strip()

            if not clean_text:
                continue

            sender = db.query(User).filter(User.id == user_id).first()
            receiver = db.query(User).filter(User.id == receiver_id).first()

            if not sender or not receiver:
                await websocket.send_json({
                    "type": "error",
                    "message": "User not found"
                })
                continue

            message = Message(
                sender_id=user_id,
                receiver_id=receiver_id,
                content=raw_content,
                text=raw_content,
                created_at=parse_iso_datetime(data.get("created_at")),
                status="delivered" if manager.is_online(receiver_id) else "sent",
                is_delivered=manager.is_online(receiver_id)
            )
            db.add(message)
            db.commit()
            db.refresh(message)
            await notify_user(
                db,
                receiver_id,
                f"{sender.username} sent you a message",
                {"type": "message", "sender_id": user_id}
            )
            db.commit()

            await manager.broadcast_chat_message(user_id, receiver_id, {
                "type": "message",
                "message": message_payload(message, db)
            })
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, websocket)
        db.close()


app = socketio.ASGIApp(
    sio,
    other_asgi_app=fastapi_app,
    socketio_path="socket.io"
)
