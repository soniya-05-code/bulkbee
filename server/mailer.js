async function sendEmail({ to, name, subject, html }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: process.env.SENDER_NAME || "BulkBee",
        email: process.env.SENDER_EMAIL,
      },
      to: [{ email: to, name }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 200));
}

module.exports = { sendEmail };