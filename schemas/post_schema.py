from pydantic import BaseModel


class PostCreate(BaseModel):
    caption: str