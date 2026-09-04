CREATE TABLE IF NOT EXISTS service_settings (
    service_key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    accepting INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO service_settings (service_key, label, accepting)
VALUES
    ('mix', 'MIX', 1),
    ('mv', 'MV', 1),
    ('movie', '動画編集', 1),
    ('illust', 'イラスト', 1),
    ('set', 'セット', 1);
