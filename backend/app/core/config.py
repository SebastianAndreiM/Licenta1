from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = " Degradation Monitoring Tool"
    DATABASE_URL: str = "postgresql+psycopg2://degradation_user:degradation_password@127.0.0.1:5433/degradation_db"
    SECRET_KEY: str = "secret_sa_schimb_sa_nu_uit"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24
    FRONTEND_URL: str = "http://localhost:5173"
settings = Settings()