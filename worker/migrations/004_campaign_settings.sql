CREATE TABLE IF NOT EXISTS campaign_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL DEFAULT 'キャンペーン割引',
    discount_type TEXT NOT NULL DEFAULT 'percent',
    discount_value INTEGER NOT NULL DEFAULT 10,
    limit_type TEXT NOT NULL DEFAULT 'period',
    start_at INTEGER,
    end_at INTEGER,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO campaign_settings (
    id, enabled, name, discount_type, discount_value,
    limit_type, start_at, end_at, max_uses, used_count
)
VALUES (
    1, 0, 'キャンペーン割引', 'percent', 10,
    'period', NULL, NULL, NULL, 0
);
