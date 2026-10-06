const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
require("dotenv").config();
const db = require("./db");
const { startWorker } = require("./worker");

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => res.send("BulkBee server running"));

// ---------- Customers ----------
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
  let added = 0,
    skipped = 0,
    invalid = 0;

  db.transaction((rows) => {
    for (const r of rows) {
      const name = (r.name || "").trim();
      const email = (r.email || "").trim().toLowerCase();
      const tag = (r.tag || "Regular").trim();
      if (!name || !emailOk(email)) {
        invalid++;
        continue;
      }
      insert.run(name, email, tag).changes ? added++ : skipped++;
    }
  })(records);

  res.json({ total: records.length, added, skipped, invalid });
});

// ---------- Campaigns ----------
app.post("/api/campaigns", (req, res) => {
  const { name, subject, message, tag = "" } = req.body;
  if (!name || !subject || !message)
    return res
      .status(400)
      .json({ error: "name, subject and message are required" });

  const customers = db
    .prepare("SELECT id FROM customers WHERE (? = '' OR tag = ?)")
    .all(tag, tag);
  if (!customers.length)
    return res.status(400).json({ error: "No customers match this segment" });

  const info = db
    .prepare(
      "INSERT INTO campaigns (name, subject, message, tag) VALUES (?, ?, ?, ?)"
    )
    .run(name, subject, message, tag);
  const ins = db.prepare(
    "INSERT INTO email_logs (campaign_id, customer_id) VALUES (?, ?)"
  );
  db.transaction(() => {
    for (const c of customers) ins.run(info.lastInsertRowid, c.id);
  })();

  res.json({ id: info.lastInsertRowid, queued: customers.length });
});

app.get("/api/campaigns", (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*,
         COALESCE(SUM(l.status='sent'),0) AS sent,
         COALESCE(SUM(l.status='failed'),0) AS failed,
         COALESCE(SUM(l.status='pending'),0) AS pending
       FROM campaigns c LEFT JOIN email_logs l ON l.campaign_id = c.id
       GROUP BY c.id ORDER BY c.id DESC`
    )
    .all();
  res.json(rows);
});

app.listen(5000, () => console.log("Server on port 5000"));
startWorker();