CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  new_rooms TEXT NOT NULL DEFAULT '|',
  new_days TEXT NOT NULL DEFAULT '3',
  current_days TEXT NOT NULL DEFAULT '0',
  new_capacity INTEGER NOT NULL DEFAULT 4 CHECK (new_capacity BETWEEN 1 AND 99),
  current_capacity INTEGER NOT NULL DEFAULT 4 CHECK (current_capacity BETWEEN 1 AND 99)
);

CREATE TABLE IF NOT EXISTS reservations (
  room TEXT PRIMARY KEY,
  resident_name TEXT NOT NULL,
  resident_type TEXT NOT NULL CHECK (resident_type IN ('new', 'current')),
  booking_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS reservations_date_group_idx
  ON reservations (booking_date, resident_type);
