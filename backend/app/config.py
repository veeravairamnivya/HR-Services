from functools import lru_cache
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, overridable through environment variables prefixed with HR_."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="HR_", extra="ignore")

    app_name: str = "TalentBridge HR"
    database_url: str = "sqlite:///./hr_services.db"
    secret_key: str = "change-this-secret-key-in-production"
    access_token_expire_minutes: int = 12 * 60
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    # Business timezone used for attendance days, "today" and monthly reports.
    timezone: str = "Asia/Kolkata"
    # Logins after this local time are marked late.
    office_start_time: str = "09:45"
    seed_demo_data: bool = True

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)


@lru_cache
def get_settings() -> Settings:
    return Settings()
