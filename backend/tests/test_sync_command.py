import sqlite3
from datetime import UTC, date, datetime, timedelta

import httpx


def install_mock_client(monkeypatch, command, path, handler):
    original = httpx.AsyncClient
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ELEXON_BASE_URL", "https://elexon.test/bmrs/api/v1")
    monkeypatch.setattr(command.httpx, "AsyncClient", lambda **kwargs: original(
        transport=httpx.MockTransport(handler), **kwargs,
    ))


def test_january_command_covers_all_windows_and_is_idempotent(
    tmp_path, monkeypatch, capsys,
):
    from app.scripts import sync_january_2026 as command

    requests = []

    def handler(request):
        requests.append(request)
        params = request.url.params
        if "FUELHH" in request.url.path:
            day = date.fromisoformat(params["settlementDateFrom"])
            start = datetime(day.year, day.month, day.day, tzinfo=UTC)
            rows = [{
                "dataset": "FUELHH", "fuelType": "WIND",
                "settlementDate": day.isoformat(), "settlementPeriod": period + 1,
                "startTime": (start + timedelta(minutes=period * 30)).isoformat(),
                "publishTime": (
                    start + timedelta(minutes=(period + 1) * 30)
                ).isoformat(),
                "generation": 0 if period == 0 else 1000,
            } for period in range(48)]
        else:
            day = date.fromisoformat(params["publishDateTimeFrom"][:10])
            delivery = day + timedelta(days=1)
            rows = [{
                "dataset": "WINDFOR",
                "publishTime": f"{day}T{publish}:00Z",
                "startTime": f"{delivery}T{hour:02d}:00:00Z", "generation": 2000,
            } for publish in ["02:30", "04:30", "07:30", "09:30",
                              "12:25", "15:30", "18:30", "22:30"]
                for hour in range(24)]
        return httpx.Response(200, json=rows)

    path = tmp_path / "wind.db"
    install_mock_client(monkeypatch, command, path, handler)
    assert command.main() == 0
    assert command.main() == 0
    assert "fuelhh_rows=1488" in capsys.readouterr().out
    fuel_requests = [r for r in requests if "FUELHH" in r.url.path]
    forecast_requests = [r for r in requests if "WINDFOR" in r.url.path]
    assert len(fuel_requests) == len(forecast_requests) == 62
    assert {r.url.params["settlementDateFrom"] for r in fuel_requests} == {
        (date(2026, 1, 2) + timedelta(days=i)).isoformat() for i in range(31)
    }
    assert {r.url.params["publishDateTimeFrom"][:10] for r in forecast_requests} == {
        (date(2026, 1, 1) + timedelta(days=i)).isoformat() for i in range(31)
    }
    with sqlite3.connect(path) as db:
        assert db.execute(
            "SELECT COUNT(*) FROM wind_actuals_half_hourly"
        ).fetchone() == (1488,)
        assert db.execute("SELECT COUNT(*) FROM wind_forecasts_hourly").fetchone() == (
            5952,
        )
        assert db.execute("""
            SELECT COUNT(*) FROM wind_actuals_half_hourly
            WHERE settlement_date='2026-02-01'
        """).fetchone() == (48,)
        assert db.execute("""
            SELECT COUNT(DISTINCT target_hour) FROM wind_forecasts_hourly
            WHERE target_date='2026-02-01'
        """).fetchone() == (24,)
        assert db.execute("""
            SELECT status, fuelhh_rows, windfor_rows, rejected_rows FROM sync_runs
        """).fetchall() == [("success", 1488, 5952, 0)] * 2


def test_command_returns_nonzero_and_records_upstream_failure(
    tmp_path, monkeypatch, capsys,
):
    from app.scripts import sync_january_2026 as command

    path = tmp_path / "wind.db"
    install_mock_client(
        monkeypatch, command, path,
        lambda _: httpx.Response(400, json={"detail": "bad"}),
    )
    assert command.main() == 1
    assert "Sync failed" in capsys.readouterr().err
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT status FROM sync_runs").fetchone() == ("failed",)
