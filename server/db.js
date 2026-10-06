const Database = require("better-sqlite3");
const db = new Database("bulkbee.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    tag TEXT DEFAULT 'Regular',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    tag TEXT DEFAULT '',
    status TEXT DEFAULT 'queued',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    error TEXT,
    sent_at TEXT
  );
`);

module.exports = db;