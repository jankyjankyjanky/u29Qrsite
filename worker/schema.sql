CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    request_id TEXT UNIQUE,

    status TEXT NOT NULL DEFAULT 'new',

    activity_name TEXT NOT NULL,
    contact_method TEXT NOT NULL,
    contact_value TEXT NOT NULL,

    deadline TEXT,
    public_date TEXT,
    materials_url TEXT,
    reference_url TEXT,
    notes TEXT,

    estimate_tab TEXT NOT NULL,
    estimate_category TEXT NOT NULL,
    estimate_total INTEGER NOT NULL,

    request_json TEXT NOT NULL,

    discord_notified INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_requests_request_id
ON requests(request_id);

CREATE INDEX IF NOT EXISTS idx_requests_created_at
ON requests(created_at);
