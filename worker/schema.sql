-- ==========================================================
-- 王者测试 · D1 schema
-- 数据保留 30 天（由 Worker 的 cron 自动清理）
-- ==========================================================

CREATE TABLE IF NOT EXISTS visits (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    visited_at   INTEGER NOT NULL,      -- unix timestamp (ms)
    visitor_id   TEXT    NOT NULL,      -- anon client id (from localStorage)
    ip_hash      TEXT,                  -- hashed IP (sha256, last 16 hex)
    country      TEXT,                  -- CF-IPCountry
    path         TEXT,                  -- request path recorded
    referrer     TEXT,
    ua           TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_time   ON visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_visits_vid    ON visits(visitor_id);

CREATE TABLE IF NOT EXISTS results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   INTEGER NOT NULL,
    visitor_id   TEXT    NOT NULL,
    hero_id      TEXT    NOT NULL,
    scores_json  TEXT                        -- {"A":..,"D":..,...}
);
CREATE INDEX IF NOT EXISTS idx_results_time  ON results(created_at);
CREATE INDEX IF NOT EXISTS idx_results_hero  ON results(hero_id);
