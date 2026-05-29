from datetime import datetime
from dataclasses import dataclass
from pathlib import Path
import json
import mimetypes
import os
import re
import shutil
import urllib.parse
import urllib.request
import uuid
from typing import Optional

from fastapi import UploadFile

from settings import BASE_DIR, load_env_file


load_env_file()
STORAGE_ROOT = Path(os.getenv("VIBEZONE_STORAGE_DIR", BASE_DIR / "uploads")).resolve()
PHOTO_STORAGE_DIR = STORAGE_ROOT / "photos"
REEL_STORAGE_DIR = STORAGE_ROOT / "reels"
STORY_STORAGE_DIR = STORAGE_ROOT / "stories"
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or ""
)
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "vibezone-media")
SUPABASE_PUBLIC_BUCKET = os.getenv("SUPABASE_PUBLIC_BUCKET", "true").lower() != "false"


@dataclass
class StoredUpload:
    public_url: str
    local_path: Optional[Path] = None
    storage_key: Optional[str] = None


def ensure_storage_dirs():
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    PHOTO_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    REEL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    STORY_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def safe_filename(filename: Optional[str], fallback: str):
    original = Path(filename or fallback).name
    stem = Path(original).stem or Path(fallback).stem
    suffix = Path(original).suffix or Path(fallback).suffix
    clean_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", stem).strip("-") or "media"

    return f"{clean_stem}{suffix.lower()}"


def supabase_storage_enabled():
    return bool(SUPABASE_URL and SUPABASE_KEY and SUPABASE_BUCKET)


def upload_storage_key(directory: Path, prefix: str, filename: str):
    try:
        folder = directory.resolve().relative_to(STORAGE_ROOT).as_posix()
    except ValueError:
        folder = directory.name

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    unique = uuid.uuid4().hex[:10]

    return f"{folder}/{prefix}_{timestamp}_{unique}_{filename}"


def quoted_storage_key(key: str):
    return "/".join(urllib.parse.quote(part) for part in key.split("/"))


def content_type_for_upload(upload: UploadFile, filename: str):
    return upload.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"


def supabase_public_url(key: str):
    if not SUPABASE_PUBLIC_BUCKET:
        return f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{quoted_storage_key(key)}"

    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{quoted_storage_key(key)}"


def upload_to_supabase(
    upload: UploadFile,
    directory: Path,
    prefix: str,
    fallback_name: str
):
    filename = safe_filename(upload.filename, fallback_name)
    key = upload_storage_key(directory, prefix, filename)
    upload.file.seek(0)
    body = upload.file.read()
    upload_url = (
        f"{SUPABASE_URL}/storage/v1/object/"
        f"{SUPABASE_BUCKET}/{quoted_storage_key(key)}"
    )
    request = urllib.request.Request(
        upload_url,
        data=body,
        method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": content_type_for_upload(upload, filename),
            "x-upsert": "true"
        }
    )

    try:
        urllib.request.urlopen(request, timeout=60).read()
    except Exception as exc:
        raise RuntimeError(f"Supabase upload failed: {exc}") from exc

    return StoredUpload(
        public_url=supabase_public_url(key),
        storage_key=key
    )


def save_upload(
    upload: UploadFile,
    directory: Path,
    prefix: str,
    fallback_name: str
):
    if supabase_storage_enabled():
        return upload_to_supabase(upload, directory, prefix, fallback_name)

    file_path = save_upload_file(upload, directory, prefix, fallback_name)

    return StoredUpload(
        public_url=public_upload_url(file_path),
        local_path=file_path
    )


def save_upload_file(
    upload: UploadFile,
    directory: Path,
    prefix: str,
    fallback_name: str
):
    ensure_storage_dirs()

    filename = safe_filename(upload.filename, fallback_name)
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    unique = uuid.uuid4().hex[:10]
    file_path = directory / f"{prefix}_{timestamp}_{unique}_{filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)

    return file_path


def delete_storage_file(file_path: Path):
    try:
        file_path.unlink(missing_ok=True)
    except OSError:
        pass


def supabase_key_from_url(public_url: Optional[str]):
    if not public_url or not supabase_storage_enabled():
        return None

    parsed = urllib.parse.urlparse(public_url)
    storage_prefixes = [
        f"/storage/v1/object/public/{SUPABASE_BUCKET}/",
        f"/storage/v1/object/{SUPABASE_BUCKET}/"
    ]

    for prefix in storage_prefixes:
        if parsed.path.startswith(prefix):
            return urllib.parse.unquote(parsed.path.replace(prefix, "", 1))

    return None


def delete_supabase_object(key: str):
    delete_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}"
    payload = json.dumps({"prefixes": [key]}).encode("utf-8")
    request = urllib.request.Request(
        delete_url,
        data=payload,
        method="DELETE",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
    )

    try:
        urllib.request.urlopen(request, timeout=20).read()
    except Exception:
        pass


def delete_storage_reference(public_url: Optional[str], local_path: Optional[Path] = None):
    key = supabase_key_from_url(public_url)

    if key:
        delete_supabase_object(key)
        return

    if local_path:
        delete_storage_file(local_path)


def public_upload_url(file_path: Path):
    relative_path = file_path.resolve().relative_to(STORAGE_ROOT).as_posix()
    return f"/uploads/{relative_path}"
