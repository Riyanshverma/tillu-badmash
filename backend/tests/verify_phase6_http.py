"""Explicit live HTTP verification against a temporary full-month database."""

import asyncio
import json
import os
import socket
import subprocess
import time
from dataclasses import asdict
from pathlib import Path
from tempfile import TemporaryDirectory

import httpx

from app.db.connection import connect_database
from app.models.api import (
    AccuracyResponse,
    ComparisonResponse,
    DecisionResponse,
    ForecastEvolutionResponse,
)
from app.services.accuracy_service import january_accuracy


async def service_metrics(path):
    async with connect_database(path) as connection:
        return asdict((await january_accuracy(connection)).metrics)


def verify():
    with TemporaryDirectory(prefix="gridbricks-phase6-") as directory:
        path = Path(directory) / "wind.db"
        env = {**os.environ, "DATABASE_PATH": str(path), "LOG_LEVEL": "WARNING"}
        print("Syncing January into temporary SQLite for real HTTP checks", flush=True)
        sync = subprocess.run(
            ["uv", "run", "python", "-m", "app.scripts.sync_january_2026"],
            env=env, text=True, capture_output=True, timeout=300,
        )
        print("SYNC", sync.returncode, sync.stdout.strip(), flush=True)
        if sync.returncode:
            raise RuntimeError(sync.stderr[-4000:])
        expected_metrics = asyncio.run(service_metrics(path))
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        server = subprocess.Popen(
            ["uv", "run", "uvicorn", "app.main:app", "--host", "127.0.0.1",
             "--port", str(port)],
            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
        )
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=30) as http:
                for _ in range(100):
                    try:
                        if http.get("/api/v1/health").status_code == 200:
                            break
                    except httpx.ConnectError:
                        pass
                    time.sleep(0.1)
                else:
                    raise RuntimeError("Uvicorn did not become healthy")

                def get(url, model):
                    response = http.get(url)
                    response.raise_for_status()
                    body = model.model_validate_json(response.content)
                    assert body.model_dump(mode="json") == response.json()
                    return response.json()

                decision = get("/api/v1/decisions/2026-01-15", DecisionResponse)
                accuracy = get("/api/v1/accuracy", AccuracyResponse)
                comparison = get("/api/v1/comparisons/2026-01-15", ComparisonResponse)
                evolution = get(
                    "/api/v1/forecast-evolution?target_time=2026-01-16T12:00:00Z",
                    ForecastEvolutionResponse,
                )
                boundary = get("/api/v1/decisions/2026-01-31", DecisionResponse)
                assert decision["decision_cutoff"] == "2026-01-15T09:20:00Z"
                assert decision["selected_forecast_publish_time"] == (
                    "2026-01-15T07:30:00Z"
                )
                assert len(decision["series"]) == len(comparison["series"]) == 24
                assert boundary["delivery_date"] == "2026-02-01"
                assert len(boundary["series"]) == 24
                assert accuracy["metrics"] == expected_metrics
                assert accuracy["metrics"]["matched_points"] == 744
                assert len(accuracy["heatmap"]) == 744
                assert len(accuracy["hour_of_day_error"]) == 24
                noon = comparison["series"][12]
                assert (noon["forecast_mw"], noon["actual_mw"], noon["error_mw"],
                        noon["absolute_error_mw"]) == (7779, 8766.5, -987.5, 987.5)
                assert evolution["actual_mw"] == 8766.5
                assert evolution["selected_publish_time"] == "2026-01-15T07:30:00Z"
                by_publication = {r["publish_time"]: r for r in evolution["series"]}
                assert by_publication["2026-01-15T07:30:00Z"]["is_selected_at_decision"]
                assert by_publication["2026-01-15T07:30:00Z"][
                    "is_available_at_decision"
                ]
                assert not by_publication["2026-01-15T09:30:00Z"][
                    "is_available_at_decision"
                ]
                paths = http.get("/openapi.json").json()["paths"]
                assert set(paths) == {
                    "/api/v1/health", "/api/v1/decisions/{decision_date}",
                    "/api/v1/accuracy", "/api/v1/comparisons/{decision_date}",
                    "/api/v1/forecast-evolution",
                }
                assert http.get("/docs").status_code == 200
                samples = {
                    "decision": decision, "comparison": comparison,
                    "evolution": evolution,
                    "accuracy-summary": {
                        "period": accuracy["period"], "metrics": accuracy["metrics"],
                        "heatmap_count": len(accuracy["heatmap"]),
                        "heatmap_sample": [accuracy["heatmap"][14 * 24 + 12]],
                        "hour_of_day_error": accuracy["hour_of_day_error"],
                    },
                }
                print("HTTP_SAMPLES", json.dumps(samples, allow_nan=False), flush=True)
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
            if server.stderr:
                server.stderr.close()


if __name__ == "__main__":
    verify()
