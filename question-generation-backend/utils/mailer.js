import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const mailServiceUrl = (process.env.MAIL_SERVICE_URL || "").replace(/\/$/, "");
const mailServiceKey = process.env.MAIL_SERVICE_KEY || "";
const mailServiceTimeoutMs = parseInt(process.env.MAIL_SERVICE_TIMEOUT_MS || "10000", 10);

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

function buildOtpHtml(subject, otp) {
  const isReset = String(subject || "").toLowerCase().includes("reset");
  const title = isReset ? "Password Reset Code" : "Verify Your Email";
  const subtitle = isReset
    ? "Use this one-time code to reset your password."
    : "Use this one-time code to complete your signup.";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 20px;background:linear-gradient(135deg,#0ea5e9,#22c55e);color:#ffffff;">
                <div style="font-size:12px;letter-spacing:1.2px;opacity:.9;">AI INTERVIEW</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${subtitle}</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">This code expires in <b>10 minutes</b>.</p>
                <div style="margin:0 0 18px;padding:14px 16px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;">
                  <div style="font-size:12px;color:#475569;letter-spacing:1px;margin-bottom:6px;">ONE-TIME CODE</div>
                  <div style="font-size:30px;letter-spacing:8px;font-weight:700;color:#0f172a;">${otp}</div>
                </div>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  If you did not request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <div style="max-width:560px;margin:12px auto 0;color:#94a3b8;font-size:12px;text-align:center;">
            Sent by AI Interview Platform
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendViaMailService(to, subject, html) {
  if (!mailServiceUrl || !mailServiceKey) {
    return { sent: false, reason: "mail_service_not_configured" };
  }

  try {
    const response = await fetch(`${mailServiceUrl}/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mailer-key": mailServiceKey,
      },
      body: JSON.stringify({ to, subject, html }),
      signal: AbortSignal.timeout(mailServiceTimeoutMs),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.error("Mail service error:", response.status, responseBody);
      return { sent: false, reason: "mail_service_send_failed" };
    }

    return { sent: true };
  } catch (err) {
    console.error("Mail service error:", err);
    return { sent: false, reason: "mail_service_send_failed" };
  }
}

// Send OTP email
export async function sendOtpEmail(to, subject, otp) {
  const html = buildOtpHtml(subject, otp);
  const result = await sendViaMailService(to, subject, html);
  if (!result.sent) {
    console.warn("Mail service is not configured or failed.");
  }
  return result;
}
