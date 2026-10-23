import json
from datetime import datetime
from pathlib import Path

import pytest
from pydantic import ValidationError

SAMPLES = Path(__file__).parents[2] / "docs/samples"


@pytest.mark.parametrize("dataset,model_name", [
    ("fuelhh-wind", "ElexonFuelhhRawRecord"),
    ("windfor", "ElexonWindforRawRecord"),
])
def test_real_samples_parse(dataset, model_name):
    from app.models import upstream

    samples = json.loads((SAMPLES / f"{dataset}.sample.json").read_text())
    records = [getattr(upstream, model_name).model_validate(row) for row in samples]
    assert len(records) == len(samples)
    assert all(r.startTime.utcoffset() is not None for r in records)
    if dataset == "windfor":
        assert set(upstream.ElexonWindforRawRecord.model_fields) == {
            "dataset", "publishTime", "startTime", "generation"
        }


@pytest.mark.parametrize("dataset,model_name", [
    ("fuelhh-wind", "ElexonFuelhhRawRecord"),
    ("windfor", "ElexonWindforRawRecord"),
])
@pytest.mark.parametrize("changes", [
    {"generation": -1}, {"generation": float("nan")},
    {"generation": float("inf")}, {"generation": "0"}, {"generation": False},
    {"startTime": datetime(2026, 1, 15)}, {"publishTime": "2026-01-15T07:30:00"},
    {"dataset": "OTHER"}, {"startTime": 1768478400}, {"startTime": "1768478400"},
])
def test_invalid_upstream_values_fail(dataset, model_name, changes):
    from app.models import upstream

    row = json.loads((SAMPLES / f"{dataset}.sample.json").read_text())[0]
    with pytest.raises(ValidationError):
        getattr(upstream, model_name).model_validate(row | changes)


@pytest.mark.parametrize("period", [0, 49, "1", True])
def test_invalid_fuelhh_period_fails(period):
    from app.models.upstream import ElexonFuelhhRawRecord

    row = json.loads((SAMPLES / "fuelhh-wind.sample.json").read_text())[0]
    with pytest.raises(ValidationError):
        ElexonFuelhhRawRecord.model_validate(row | {"settlementPeriod": period})


@pytest.mark.parametrize("dataset,model_name", [
    ("fuelhh-wind", "ElexonFuelhhRawRecord"),
    ("windfor", "ElexonWindforRawRecord"),
])
def test_zero_generation_is_valid(dataset, model_name):
    from app.models import upstream

    row = json.loads((SAMPLES / f"{dataset}.sample.json").read_text())[0]
    record = getattr(upstream, model_name).model_validate(row | {"generation": 0})
    assert record.generation == 0
