from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.database import get_session
from app.db.models import User
from app.schemas.auth import Token
from app.schemas.user import UserCreate, UserLogin, UserRead

router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_user_by_email(session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def authenticate_user(session: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(session, email)

    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = session.get(User, int(user_id))

    if user is None:
        raise credentials_exception

    return user


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_user(
    user_data: UserCreate,
    session: Session = Depends(get_session),
):
    existing_user = get_user_by_email(session, user_data.email)

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        name=user_data.name,
        email=user_data.email,
        institution=user_data.institution,
        hashed_password=get_password_hash(user_data.password),
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
    )

    return Token(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_HOURS,
        user=UserRead(
            id=user.id,
            name=user.name,
            email=user.email,
            institution=user.institution,
            created_at=user.created_at,
        ),
    )


@router.post("/login", response_model=Token)
def login_user(
    login_data: UserLogin,
    session: Session = Depends(get_session),
):
    user = authenticate_user(session, login_data.email, login_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
    )

    return Token(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_HOURS,
        user=UserRead(
            id=user.id,
            name=user.name,
            email=user.email,
            institution=user.institution,
            created_at=user.created_at,
        ),
    )


@router.get("/me", response_model=UserRead)
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return UserRead(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        institution=current_user.institution,
        created_at=current_user.created_at,
    )