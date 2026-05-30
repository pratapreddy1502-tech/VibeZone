import re
from typing import Optional

from pydantic import BaseModel, EmailStr, validator


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

    @validator("username")
    def username_must_contain_letters_and_numbers(cls, value: str) -> str:
        if not re.match(r"^[A-Za-z0-9_]+$", value):
            raise ValueError("Username may only contain letters, numbers, and underscore")
        return value


class EmailOtpRequest(BaseModel):
    username: str
    email: EmailStr

    @validator("username")
    def username_must_contain_letters_and_numbers(cls, value: str) -> str:
        if not re.match(r"^[A-Za-z0-9_]+$", value):
            raise ValueError("Username may only contain letters, numbers, and underscore")
        return value


class VerifyRegisterData(BaseModel):
    username: str
    email: EmailStr
    password: str
    otp: str

    @validator("username")
    def username_must_contain_letters_and_numbers(cls, value: str) -> str:
        if not re.match(r"^[A-Za-z0-9_]+$", value):
            raise ValueError("Username may only contain letters, numbers, and underscore")
        return value


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetData(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


class UserUpdate(BaseModel):
    username: Optional[str]
    email: Optional[EmailStr]
    bio: Optional[str]
    profile_image: Optional[str]
    account_type: Optional[str]

    @validator("username")
    def username_must_contain_letters_and_numbers(cls, value: str) -> str:
        if value is None:
            return value
        if not re.match(r"^[A-Za-z0-9_]+$", value):
            raise ValueError("Username may only contain letters, numbers, and underscore")
        return value


class LoginData(BaseModel):
    email: EmailStr
    password: str
