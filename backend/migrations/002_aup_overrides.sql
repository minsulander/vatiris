CREATE TABLE IF NOT EXISTS aup_overrides (
    fir TEXT PRIMARY KEY,
    overrides JSONB NOT NULL DEFAULT '{}',
    date TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
