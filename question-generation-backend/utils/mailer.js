import nodemailer from "nodemailer";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false, // true only if port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
});

// Verify SMTP connection once when server starts
(async () => {
  try {
    await transporter.verify();
    console.log("SMTP server is ready to send emails");
  } catch (error) {
    console.error("SMTP connection failed:", error);
  }
})();

// Generate 6 digit OTP
export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash OTP before storing
export async function hashOtp(otp) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
}

// Verify OTP
export async function verifyOtp(otp, hash) {
  return bcrypt.compare(otp, hash);
}

// OTP expiry helper
export function otpExpiry(minutes = 10) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
  return expiresAt;
}

// Send OTP email
export async function sendOtpEmail(to, subject, otp) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials not configured; OTP email will not be sent.");
    return;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; padding:20px">
      <h2>Email Verification</h2>
      <p>Your one-time password is:</p>
      <h1 style="letter-spacing:4px">${otp}</h1>
      <p>This code will expire in <b>10 minutes</b>.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}
