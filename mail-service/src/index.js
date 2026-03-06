import express from "express";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "8787", 10);
const MAILER_SHARED_KEY = process.env.MAILER_SHARED_KEY || "";
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpFrom = process.env.SMTP_FROM || smtpUser;

if (!MAILER_SHARED_KEY) {
  console.warn("MAILER_SHARED_KEY is missing.");
}
if (!smtpUser || !smtpPass) {
  console.warn("SMTP credentials are missing.");
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: { user: smtpUser, pass: smtpPass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

app.use(express.json({ limit: "200kb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "mail-service", time: new Date().toISOString() });
});

app.post("/send-otp", async (req, res) => {
  const incomingKey = req.header("x-mailer-key") || "";
  if (!MAILER_SHARED_KEY || incomingKey !== MAILER_SHARED_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: "to, subject and html are required" });
  }

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: String(to),
      subject: String(subject),
      html: String(html),
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Mailer send error:", err);
    return res.status(502).json({ error: "Failed to send email" });
  }
});

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Mail service running on http://localhost:${PORT}`);
  });
}
