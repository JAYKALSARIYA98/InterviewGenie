import nodemailer from "nodemailer";
import dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";

dotenv.config();

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const smtpSecure =
  process.env.SMTP_SECURE != null
    ? String(process.env.SMTP_SECURE).toLowerCase() === "true"
    : smtpPort === 465;
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  requireTLS: String(process.env.SMTP_REQUIRE_TLS || "false").toLowerCase() === "true",
  connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || "10000", 10),
  greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT_MS || "10000", 10),
  socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS || "15000", 10),
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export function generateOtp() {
  return (Math.floor(100000 + Math.random() * 900000)).toString();
}

export async function hashOtp(otp) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
}

export function verifyOtp(otp, hash) {
  return bcrypt.compare(otp, hash);
}

export function otpExpiry(minutes = 10) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
  return expiresAt;
}

export async function sendOtpEmail(to, subject, otp) {
  if (!smtpUser || !smtpPass) {
    console.warn("SMTP credentials not configured; OTP email will not be sent.");
    return { sent: false, reason: "smtp_not_configured" };
  }

  const html = `<p>Your one-time password is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("SMTP send error:", err);
    return { sent: false, reason: "smtp_send_failed" };
  }
}
