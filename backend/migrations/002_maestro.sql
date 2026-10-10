CREATE TABLE IF NOT EXISTS maestro_plan (
    airport TEXT PRIMARY KEY CHECK (airport = 'ESSA'), revision INTEGER NOT NULL DEFAULT 0,
    config JSONB NOT NULL, edits JSONB NOT NULL DEFAULT '{}', updated_by INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO maestro_plan (airport, config) VALUES
    ('ESSA', '{"runways":["19R","26"],"defaultRunway":"19R","spacing":120,"buffer":3}')
ON CONFLICT (airport) DO NOTHING;
