from collections.abc import Sequence
from dataclasses import dataclass
from math import isfinite

import numpy as np

from app.domain.comparison import ComparisonPoint


@dataclass(frozen=True)
class AccuracyMetrics:
    mae_mw: float | None = None
    rmse_mw: float | None = None
    bias_mw: float | None = None
    wape_percent: float | None = None
    p90_abs_error_mw: float | None = None
    over_forecast_percent: float | None = None
    under_forecast_percent: float | None = None
    matched_points: int = 0


def calculate_metrics(points: Sequence[ComparisonPoint]) -> AccuracyMetrics:
    if not points:
        return AccuracyMetrics()
    errors = np.array([p.error_mw for p in points], dtype=float)
    absolute = np.abs(errors)
    try:
        with np.errstate(over="raise", invalid="raise", divide="raise"):
            denominator = np.sum([abs(p.actual_mw) for p in points])
            values = {
                "mae_mw": float(np.mean(absolute)),
                "rmse_mw": float(np.sqrt(np.mean([p.squared_error for p in points]))),
                "bias_mw": float(np.mean(errors)),
                "wape_percent": (
                    float(np.sum(absolute) / denominator * 100)
                    if denominator != 0 else None
                ),
                "p90_abs_error_mw": float(np.percentile(absolute, 90, method="linear")),
                "over_forecast_percent": float(np.count_nonzero(errors > 0)
                                               / len(points) * 100),
                "under_forecast_percent": float(np.count_nonzero(errors < 0)
                                                / len(points) * 100),
            }
    except FloatingPointError as error:
        raise ValueError("Metric calculation exceeds finite numeric range") from error
    if any(v is not None and not isfinite(v) for v in values.values()):
        raise ValueError("Metrics must be finite or None")
    return AccuracyMetrics(**values, matched_points=len(points))
