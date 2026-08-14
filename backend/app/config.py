from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./mindtrace.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    baseline_sessions_required: int = 1
    deviation_threshold: float = 1.5  # z-score threshold for flagging

    class Config:
        env_file = ".env"


settings = Settings()
