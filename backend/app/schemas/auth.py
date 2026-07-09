
from pydantic import BaseModel
from app.schemas.user import UserRead

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead

class TokenPayload(BaseModel):
    sub: str | None = None