import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext;
import { APP_API_BASE } from "../config";

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [health, setHealth] = useState({ app: "unknown", video: "unknown" });

  useEffect(() => {
    let canceled = false;
    const ping = async () => {
      try {
        await fetch(`${APP_API_BASE}/health`, { cache: "no-store" });
        if (!canceled) setHealth((h) => ({ ...h, app: "ok" }));
      } catch {
        if (!canceled) setHealth((h) => ({ ...h, app: "down" }));
      }
      try {
        await fetch(`${APP_API_BASE}/video/health`, { cache: "no-store" });
        if (!canceled) setHealth((h) => ({ ...h, video: "ok" }));
      } catch {
        if (!canceled) setHealth((h) => ({ ...h, video: "down" }));
      }
    };
    ping();
    return () => {
      canceled = true;
    };
  }, []);

  const badge = (value) => {
    if (value === "ok") return "bg-emerald-400/20 text-emerald-100 border-emerald-400/30";
    if (value === "down") return "bg-rose-400/20 text-rose-100 border-rose-400/30";
    return "bg-white/10 text-slate-100 border-white/20";
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-950 to-emerald-900 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.35),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.25),transparent_30%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.25),transparent_35%)]" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="mb-8 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Sparkles className="mr-2 h-4 w-4 text-cyan-200" />
          <span className="text-sm text-slate-100">AI Interview Practice Studio</span>
        </motion.div>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs ${badge(health.app)}`}>
            App API: {health.app}
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs ${badge(health.video)}`}>
            Video Engine: {health.video}
          </span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-100">
            Warming engines so you do not wait later
          </span>
        </div>

        <h1 className="text-center text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
          Sharpen Your Interview Presence
          <br />
          <span className="text-cyan-200">With Real-Time AI Feedback</span>
        </h1>

        <p className="mt-6 max-w-3xl text-center text-lg text-slate-200/90 md:text-xl">
          Practice speaking answers, get instant scoring on verbal quality and body language, and iterate quickly.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <motion.button
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group inline-flex items-center rounded-xl bg-cyan-400 px-7 py-3 text-base font-semibold text-slate-900 transition hover:bg-cyan-300"
          >
            {isAuthenticated ? "Go to Dashboard" : "Get Started"}
            <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
          </motion.button>

          <motion.a
            href="https://www.youtube.com/watch?v=czjKFkQY2Ao"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-base font-medium text-white backdrop-blur hover:bg-white/20"
          >
            <PlayCircle className="mr-2 h-5 w-5" />
            Watch Demo
          </motion.a>
        </div>

        <div className="mt-16 grid w-full gap-4 md:grid-cols-3">
          {[
            {
              title: "Voice Scoring",
              description: "Transcription + answer quality analysis tuned for interview clarity and depth.",
            },
            {
              title: "Facial Presence",
              description: "Eye contact, movement stability, and confidence cues from your recorded response.",
            },
            {
              title: "Progress History",
              description: "Track interview sessions, compare scores, and improve with repeated practice.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-200">{item.description}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
