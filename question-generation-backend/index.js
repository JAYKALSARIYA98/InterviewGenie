import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import multer from "multer";
import { connectDB } from "./utils/db.js";
import User from "./models/User.js";
import Interview from "./models/Interview.js";
import { authenticateMiddleware, hashPassword, signToken } from "./utils/auth.js";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  otpExpiry,
  sendOtpEmail,
} from "./utils/mailer.js";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
const QUESTION_MODEL =
  process.env.QUESTION_MODEL || "meta-llama/llama-4-maverick-17b-128e-instruct";
const VIDEO_API_BASE = (
  process.env.VIDEO_API_BASE ||
  process.env.VITE_VIDEO_API_BASE ||
  "http://localhost:5000"
).replace(/\/$/, "");

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});
const VIDEO_UPSTREAM_TIMEOUT_MS = parseInt(process.env.VIDEO_UPSTREAM_TIMEOUT_MS || "240000", 10);
const VIDEO_UPSTREAM_RETRIES = parseInt(process.env.VIDEO_UPSTREAM_RETRIES || "1", 10);

async function fetchVideoUpstream(url, options = {}, retries = VIDEO_UPSTREAM_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(VIDEO_UPSTREAM_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err;
      if (attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
  })
);
app.use(express.json());

const healthHandler = (req, res) => {
  res.json({
    ok: true,
    service: "app-api",
    time: new Date().toISOString(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

app.get("/video/health", async (req, res) => {
  try {
    const upstream = await fetchVideoUpstream(`${VIDEO_API_BASE}/health`, { method: "GET" }, 0);
    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";
    res.status(upstream.status).type(contentType).send(text);
  } catch (err) {
    console.error("Video health proxy error:", err);
    res.status(502).json({ error: "Video backend is unreachable" });
  }
});

app.post("/video/jobs", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const form = new FormData();
    form.append("questionText", req.body?.questionText || "");
    form.append(
      "video",
      new Blob([req.file.buffer], { type: req.file.mimetype || "application/octet-stream" }),
      req.file.originalname || "response.mp4"
    );

    const upstream = await fetchVideoUpstream(`${VIDEO_API_BASE}/jobs`, {
      method: "POST",
      body: form,
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";
    res.status(upstream.status).type(contentType).send(text);
  } catch (err) {
    console.error("Video queue proxy error:", err);
    res.status(502).json({ error: "Failed to submit video job" });
  }
});

app.get("/video/jobs/:jobId", async (req, res) => {
  try {
    const upstream = await fetchVideoUpstream(
      `${VIDEO_API_BASE}/jobs/${encodeURIComponent(req.params.jobId)}`,
      { method: "GET" },
      0
    );
    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";
    res.status(upstream.status).type(contentType).send(text);
  } catch (err) {
    console.error("Video job status proxy error:", err);
    res.status(502).json({ error: "Failed to fetch video job status" });
  }
});

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).json({ error: "Database connection error" });
  }
});

app.post("/generate-questions", async (req, res) => {
  try {
    const { role, experience, industry, difficulty } = req.body;

    if (!role || !experience || !industry || !difficulty) {
      return res
        .status(400)
        .json({ error: "Missing required fields: role, experience, industry, difficulty" });
    }

    const prompt = `
You are generating spoken mock interview questions.

Role: ${role}
Experience: ${experience}
Domain: ${industry}
Difficulty: ${difficulty}

Rules:
- Generate exactly 5 concise, verbal-answer questions.
- Focus on real-world decision making, communication, and practical depth.
- No coding exercise questions.
- Keep questions clear enough to answer in 60-120 seconds.
- Return ONLY JSON in this schema:
{
  "questions": ["q1", "q2", "q3", "q4", "q5"]
}
`;

    const completion = await groq.chat.completions.create({
      model: QUESTION_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.map((q) => String(q).trim()).filter(Boolean).slice(0, 5)
      : [];

    if (questions.length !== 5) {
      return res.status(500).json({ error: "Failed to generate 5 valid questions." });
    }

    res.json({ questions });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred while processing your request." });
  }
});

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password and name are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const otp = generateOtp();
    const codeHash = await hashOtp(otp);
    const expiresAt = otpExpiry(10);

    const user = await User.create({
      email: email.toLowerCase(),
      name,
      passwordHash,
      isVerified: false,
      emailOtp: { codeHash, expiresAt },
    });

    const emailResult = await sendOtpEmail(user.email, "Verify your email", otp);
    if (!emailResult?.sent) {
      await User.deleteOne({ _id: user._id });
      return res
        .status(503)
        .json({ error: "OTP email service is unavailable. Please try again shortly." });
    }

    res.status(201).json({ message: "Registered successfully. Please verify your email." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register" });
  }
});

app.post("/auth/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.emailOtp) {
      return res.status(400).json({ error: "Invalid verification request" });
    }

    if (user.emailOtp.expiresAt < new Date()) {
      return res.status(400).json({ error: "OTP expired" });
    }

    const isValid = await verifyOtp(otp, user.emailOtp.codeHash);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    user.isVerified = true;
    user.emailOtp = undefined;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("Verify email error:", err);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Please verify your email before logging in" });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name, isVerified: user.isVerified },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/auth/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ message: "If this email exists, a reset code has been sent." });
    }

    const otp = generateOtp();
    const codeHash = await hashOtp(otp);
    const expiresAt = otpExpiry(10);

    user.resetOtp = { codeHash, expiresAt };
    await user.save();

    const emailResult = await sendOtpEmail(user.email, "Password reset code", otp);
    if (!emailResult?.sent) {
      user.resetOtp = undefined;
      await user.save();
      return res
        .status(503)
        .json({ error: "OTP email service is unavailable. Please try again shortly." });
    }

    res.json({ message: "If this email exists, a reset code has been sent." });
  } catch (err) {
    console.error("Request reset error:", err);
    res.status(500).json({ error: "Failed to send reset code" });
  }
});

app.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP and new password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.resetOtp) {
      return res.status(400).json({ error: "Invalid reset request" });
    }

    if (user.resetOtp.expiresAt < new Date()) {
      return res.status(400).json({ error: "OTP expired" });
    }

    const isValid = await verifyOtp(otp, user.resetOtp.codeHash);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.resetOtp = undefined;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

app.get("/auth/me", authenticateMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select("_id email name isVerified");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Failed to load user" });
  }
});

app.patch("/auth/profile", authenticateMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.sub,
      { name },
      { new: true, select: "_id email name isVerified" }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

app.post("/auth/change-password", authenticateMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current password and new password are required" });
    }

    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

app.post("/interviews", authenticateMiddleware, async (req, res) => {
  try {
    const { questions, results, overallScore } = req.body;
    if (!Array.isArray(questions) || !Array.isArray(results) || typeof overallScore !== "number") {
      return res.status(400).json({ error: "questions, results and overallScore are required" });
    }

    const normalizedResults = questions.map((question, index) => {
      const result = results[index] || {};
      const transcript = String(result.transcript || result.answerText || "").trim();
      const finalScore = Number.isFinite(Number(result.finalScore)) ? Number(result.finalScore) : 0;
      const audioScore = Number.isFinite(Number(result.audioScore)) ? Number(result.audioScore) : 0;
      const videoScore = Number.isFinite(Number(result.videoScore)) ? Number(result.videoScore) : 0;

      return {
        question: String(result.question || question || "").trim(),
        answerQuality: result.answerQuality || "",
        bodyLanguage: result.bodyLanguage || "",
        finalScore,
        audioScore,
        videoScore,
        answerText: transcript,
        transcript,
        speechMetrics: result.speechMetrics || {},
        visualMetrics: result.visualMetrics || {},
      };
    });

    const interview = await Interview.create({
      user: req.user.sub,
      questions,
      results: normalizedResults,
      overallScore,
    });

    res.status(201).json({ interview });
  } catch (err) {
    console.error("Create interview error:", err);
    res.status(500).json({ error: "Failed to save interview" });
  }
});

app.get("/interviews", authenticateMiddleware, async (req, res) => {
  try {
    const interviews = await Interview.find({ user: req.user.sub })
      .sort({ createdAt: -1 })
      .select("_id overallScore createdAt");

    res.json({ interviews });
  } catch (err) {
    console.error("List interviews error:", err);
    res.status(500).json({ error: "Failed to load interviews" });
  }
});

app.get("/interviews/:id", authenticateMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user.sub,
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    res.json({ interview });
  } catch (err) {
    console.error("Get interview error:", err);
    res.status(500).json({ error: "Failed to load interview" });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const period = String(req.query.period || "all");
    const metric = String(req.query.metric || "best");
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 50);
    const minInterviews = Math.max(parseInt(req.query.minInterviews || "1", 10), 1);

    const daysMap = { "7d": 7, "30d": 30, "90d": 90, all: 0 };
    const days = daysMap[period] ?? 0;
    const sortField = metric === "average" ? "avgScore" : "bestScore";

    const pipeline = [];
    if (days > 0) {
      const from = new Date();
      from.setDate(from.getDate() - days);
      pipeline.push({ $match: { createdAt: { $gte: from } } });
    }

    pipeline.push(
      {
        $group: {
          _id: "$user",
          bestScore: { $max: "$overallScore" },
          avgScore: { $avg: "$overallScore" },
          attempts: { $sum: 1 },
          lastInterview: { $max: "$createdAt" },
        },
      },
      { $match: { attempts: { $gte: minInterviews } } },
      { $sort: { [sortField]: -1, lastInterview: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: "$user.name",
          email: "$user.email",
          bestScore: { $round: ["$bestScore", 2] },
          avgScore: { $round: ["$avgScore", 2] },
          attempts: 1,
          lastInterview: 1,
        },
      }
    );

    const top = await Interview.aggregate(pipeline);
    res.json({
      leaderboard: top,
      filters: { period, metric, minInterviews, limit },
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

app.get("/leaderboard/me", authenticateMiddleware, async (req, res) => {
  try {
    const period = String(req.query.period || "all");
    const metric = String(req.query.metric || "best");
    const minInterviews = Math.max(parseInt(req.query.minInterviews || "1", 10), 1);

    const daysMap = { "7d": 7, "30d": 30, "90d": 90, all: 0 };
    const days = daysMap[period] ?? 0;
    const scoreField = metric === "average" ? "avgScore" : "bestScore";

    const basePipeline = [];
    if (days > 0) {
      const from = new Date();
      from.setDate(from.getDate() - days);
      basePipeline.push({ $match: { createdAt: { $gte: from } } });
    }

    basePipeline.push(
      {
        $group: {
          _id: "$user",
          bestScore: { $max: "$overallScore" },
          avgScore: { $avg: "$overallScore" },
          attempts: { $sum: 1 },
          lastInterview: { $max: "$createdAt" },
        },
      },
      { $match: { attempts: { $gte: minInterviews } } }
    );

    const meSummary = await Interview.aggregate([
      ...basePipeline,
      { $match: { _id: req.user.sub } },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          bestScore: { $round: ["$bestScore", 2] },
          avgScore: { $round: ["$avgScore", 2] },
          attempts: 1,
          lastInterview: 1,
        },
      },
    ]);

    if (!meSummary.length) {
      return res.json({
        rank: null,
        totalPlayers: 0,
        score: null,
        attempts: 0,
        filters: { period, metric, minInterviews },
      });
    }

    const me = meSummary[0];
    const meScore = metric === "average" ? me.avgScore : me.bestScore;

    const rankHigher = await Interview.aggregate([
      ...basePipeline,
      {
        $match: {
          $or: [
            { [scoreField]: { $gt: meScore } },
            { [scoreField]: meScore, lastInterview: { $gt: me.lastInterview } },
          ],
        },
      },
      { $count: "count" },
    ]);

    const totalPlayersAgg = await Interview.aggregate([...basePipeline, { $count: "count" }]);
    const totalPlayers = totalPlayersAgg[0]?.count || 0;
    const rank = (rankHigher[0]?.count || 0) + 1;

    res.json({
      rank,
      totalPlayers,
      percentile: totalPlayers > 0 ? Number((((totalPlayers - rank + 1) / totalPlayers) * 100).toFixed(2)) : 0,
      score: meScore,
      attempts: me.attempts,
      filters: { period, metric, minInterviews },
    });
  } catch (err) {
    console.error("Leaderboard me error:", err);
    res.status(500).json({ error: "Failed to load your leaderboard stats" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
