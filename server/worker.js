const db = require("./db");
const { sendEmail } = require("./mailer");

const BATCH_SIZE = 10;
let busy = false;

async function processBatch() {
  if (busy) return;
  busy = true;
  try {
    const jobs = db
      .prepare(
        `SELECT l.id, c.name, c.email, m.subject, m.message
         FROM email_logs l
         JOIN customers c ON c.id = l.customer_id
         JOIN campaigns m ON m.id = l.campaign_id
         WHERE l.status = 'pending' LIMIT ?`
      )
      .all(BATCH_SIZE);

    for (const j of jobs) {
      try {
        const body = j.message
          .replace(/\{name\}/g, j.name)
          .replace(/\n/g, "<br>");
        await sendEmail({
          to: j.email,
          name: j.name,
          subject: j.subject,
          html: `<p>${body}</p>`,
        });
        db.prepare(
          "UPDATE email_logs SET status='sent', sent_at=CURRENT_TIMESTAMP WHERE id=?"
        ).run(j.id);
      } catch (e) {
        db.prepare("UPDATE email_logs SET status='failed', error=? WHERE id=?").run(
          String(e.message).slice(0, 200),
          j.id
        );
      }
    }

    db.prepare(
      `UPDATE campaigns SET status='completed'
       WHERE status='queued'
       AND id NOT IN (SELECT DISTINCT campaign_id FROM email_logs WHERE status='pending')`
    ).run();
  } finally {
    busy = false;
  }
}

function startWorker() {
  setInterval(processBatch, 5000);
}

module.exports = { startWorker };