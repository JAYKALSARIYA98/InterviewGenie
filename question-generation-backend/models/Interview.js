import mongoose from "mongoose";

const questionResultSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answerQuality: { type: String },
    bodyLanguage: { type: String },
    finalScore: { type: Number, default: 0 },
    audioScore: { type: Number, default: 0 },
    videoScore: { type: Number, default: 0 },
    answerText: { type: String, maxlength: 4000 },
    transcript: { type: String, maxlength: 4000 },
    speechMetrics: {
      wordCount: { type: Number, default: 0 },
      fillerWordCount: { type: Number, default: 0 },
      fillerWordRatio: { type: Number, default: 0 },
    },
    visualMetrics: {
      confidence: { type: Number, default: 0 },
      nervousness: { type: Number, default: 0 },
      eyeContact: { type: Number, default: 0 },
      engagement: { type: Number, default: 0 },
      stability: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    questions: [{ type: String, required: true }],
    results: [questionResultSchema],
    overallScore: { type: Number, required: true },
  },
  { timestamps: true }
);

interviewSchema.index({ user: 1, createdAt: -1 });

const Interview = mongoose.model("Interview", interviewSchema);
export default Interview;
