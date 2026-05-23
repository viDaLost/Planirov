CREATE TABLE IF NOT EXISTS accounts (
  telegram_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_tokens (
  token_hash TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'device',
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  FOREIGN KEY (telegram_id) REFERENCES accounts(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS datasets (
  telegram_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (telegram_id) REFERENCES accounts(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_telegram_id ON device_tokens(telegram_id);
