CREATE TABLE IF NOT EXISTS cancellation_attempts (
  room TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
