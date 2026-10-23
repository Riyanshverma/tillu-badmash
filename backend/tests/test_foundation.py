from datetime import time
from pathlib import Path

import httpx
import pytest

from app.core.config import Settings
from app.main import create_app


def test_settings_defaults_and_example():
    settings = Settings(_env_file=None)
    assert settings.api_prefix == "/api/v1"
    assert settings.decision_time == time(9, 20)
    assert settings.market_timezone == "Europe/London"
    assert settings.cors_origins == []
    example = Settings(_env_file=".env.example")
    assert example.cors_origins == ["http://localhost:5173"]
    assert example.database_path == Path("data/wind.db")


@pytest.mark.asyncio
async def test_health_matches_contract():
    app = create_app(Settings(_env_file=None))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert set(app.openapi()["paths"]) == {"/api/v1/health"}


@pytest.mark.asyncio
async def test_environment_controls_prefix_and_cors(monkeypatch):
    monkeypatch.setenv("API_PREFIX", "/custom")
    monkeypatch.setenv("CORS_ORIGINS", '["https://frontend.example"]')
    app = create_app(Settings(_env_file=None))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        allowed = await client.options(
            "/custom/health",
            headers={
                "Origin": "https://frontend.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        denied = await client.options(
            "/custom/health",
            headers={
                "Origin": "https://other.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        health = await client.get("/custom/health")
    assert health.status_code == 200
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "https://frontend.example"
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers
