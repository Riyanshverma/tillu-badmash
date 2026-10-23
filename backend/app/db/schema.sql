CREATE TABLE IF NOT EXISTS wind_actuals_half_hourly (
    start_time TEXT PRIMARY KEY,
    settlement_date TEXT NOT NULL,
    settlement_period INTEGER NOT NULL,
    generation_mw REAL NOT NULL,
    source_publish_time TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_actuals_settlement_date
    ON wind_actuals_half_hourly (settlement_date);
CREATE INDEX IF NOT EXISTS idx_actuals_settlement_period
    ON wind_actuals_half_hourly (settlement_period);

CREATE TABLE IF NOT EXISTS wind_forecasts_hourly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publish_time TEXT NOT NULL,
    start_time TEXT NOT NULL,
    target_date TEXT NOT NULL,
    target_hour INTEGER NOT NULL,
    generation_mw REAL NOT NULL,
    UNIQUE (publish_time, start_time)
);

CREATE INDEX IF NOT EXISTS idx_forecasts_start_publish
    ON wind_forecasts_hourly (start_time, publish_time);
CREATE INDEX IF NOT EXISTS idx_forecasts_target_date
    ON wind_forecasts_hourly (target_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_target_hour
    ON wind_forecasts_hourly (target_hour);
CREATE INDEX IF NOT EXISTS idx_forecasts_publish_time
    ON wind_forecasts_hourly (publish_time);

CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    fuelhh_rows INTEGER NOT NULL DEFAULT 0,
    windfor_rows INTEGER NOT NULL DEFAULT 0,
    rejected_rows INTEGER NOT NULL DEFAULT 0,
    detail TEXT
);
