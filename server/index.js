const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
require("dotenv").config();
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => res.send("BulkBee server running"));

// List customers (optional ?search= and ?tag=)
app.get("/api/customers", (req, res) => {
  const { search = "", tag = "" } = req.query;
  const q = `%${search}%`;
  const rows = db
    .prepare(
      `SELECT * FROM customers
       WHERE (name LIKE ? OR email LIKE ?) AND (? = '' OR tag = ?)
       ORDER BY id DESC`
    )
    .all(q, q, tag, tag);
  res.json(rows);
});

// Upload CSV (columns: name, email, tag)
app.post("/api/customers/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "CSV file required" });

  let records;
  try {
    records = parse(req.file.buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (e) {
    return res.status(400).json({ error: "Invalid CSV file" });
  }

  const insert = db.prepare(
    "INSERT OR IGNORE INTO customers (name, email, tag) VALUES (?, ?, ?)"
  );
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  let added = 0, skipped = 0, invalid = 0;

  db.transaction((rows) => {
    for (const r of rows) {
      const name = (r.name || "").trim();
      const email = (r.email || "").trim().toLowerCase();
      const tag = (r.tag || "Regular").trim();
      if (!name || !emailOk(email)) { invalid++; continue; }
      insert.run(name, email, tag).changes ? added++ : skipped++;
    }
  })(records);

  res.json({ total: records.length, added, skipped, invalid });
});

app.listen(5000, () => console.log("Server on port 5000"));