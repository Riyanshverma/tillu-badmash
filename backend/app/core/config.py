from datetime import time
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    database_path: Path = Path("data/wind.db")
    decision_time: time = time(9, 20)
    market_timezone: str = "Europe/London"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = []
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
