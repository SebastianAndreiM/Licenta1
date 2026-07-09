from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=20)
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)
    institution: str = Field(min_length=2, max_length=160)

class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    institution: str
    created_at: datetime

class UserLogin(BaseModel):
    email: EmailStr
    password: str