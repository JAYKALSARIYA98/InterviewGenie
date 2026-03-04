import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getInterview } from "../auth/api";

function scoreBadge(score) {
  if (score >= 8) return "bg-emerald-100 text-emerald-800";
  if (score >= 6) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { token } = useAuth();

  const [results, setResults] = useState(location.state?.results || []);
  const [overallScore, setOverallScore] = useState(location.state?.overallScore || 0);
  const [loading, setLoading] = useState(Boolean(params.id) && !location.state);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.id;
    if (!id || location.state || !token) return;

    let canceled = false;
    const load = async () => {
      try {
        const data = await getInterview(id, token);
        if (!canceled && data.interview) {
          setResults(data.interview.results || []);
          setOverallScore(data.interview.overallScore || 0);
        }
      } catch (err) {
        if (!canceled) setError(err.message);
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, [params.id, token, location.state]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Interview Report</h1>
          <p className="mt-1 text-sm text-slate-600">Detailed feedback on answer quality and on-camera presence.</p>

          {error && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

          <div className="mt-4 inline-flex items-center gap-3 rounded-xl bg-cyan-50 px-4 py-3">
            <span className="text-sm text-cyan-800">Overall Score</span>
            <span className={`rounded-lg px-3 py-1 text-sm font-semibold ${scoreBadge(overallScore)}`}>
              {overallScore.toFixed(1)} / 10
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {results.map((result, index) => (
            <article key={index} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Q{index + 1}. {result.question}
                </h2>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${scoreBadge(Number(result.finalScore) || 0)}`}>
                  {Number(result.finalScore || 0).toFixed(1)} / 10
                </span>
              </div>

              <p className="mb-2 text-sm text-slate-700">
                <strong>Answer Quality:</strong> {result.answerQuality || "N/A"}
              </p>
              <p className="mb-2 text-sm text-slate-700">
                <strong>Body Language:</strong> {result.bodyLanguage || "N/A"}
              </p>

              {(typeof result.audioScore === "number" || typeof result.videoScore === "number") && (
                <p className="mb-2 text-sm text-slate-600">
                  Audio: {Number(result.audioScore || 0).toFixed(1)} | Video: {Number(result.videoScore || 0).toFixed(1)}
                </p>
              )}

              {result.speechMetrics?.wordCount ? (
                <p className="text-xs text-slate-500">
                  Words: {result.speechMetrics.wordCount} | Fillers: {result.speechMetrics.fillerWordCount} (
                  {(Number(result.speechMetrics.fillerWordRatio || 0) * 100).toFixed(1)}%)
                </p>
              ) : null}

              {(result.answerText || result.transcript) ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="mb-1 text-xs font-semibold text-slate-600">Your Answer</p>
                  <p className="text-xs text-slate-700">{result.answerText || result.transcript}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
