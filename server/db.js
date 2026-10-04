const Database = require("better-sqlite3");
const db = new Database("bulkbee.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    tag TEXT DEFAULT 'Regular',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;