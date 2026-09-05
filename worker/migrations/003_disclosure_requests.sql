CREATE TABLE IF NOT EXISTS disclosure_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    disclosure_id TEXT UNIQUE,
    requester_name TEXT NOT NULL,
    email TEXT NOT NULL,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    discord_notified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disclosure_requests_created_at
ON disclosure_requests(created_at);
