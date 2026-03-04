import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getLeaderboard, getMyLeaderboardStats, listInterviews } from "../auth/api";

function scoreStyle(score) {
  if (score >= 8) return "text-emerald-700";
  if (score >= 6) return "text-amber-700";
  return "text-rose-700";
}

export default function DashboardPage() {
  const { user, token, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [period, setPeriod] = useState("all");
  const [metric, setMetric] = useState("best");
  const [minInterviews, setMinInterviews] = useState(2);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    let canceled = false;
    const load = async () => {
      try {
        const filters = { period, metric, minInterviews };
        const [interviewsRes, leaderboardRes] = await Promise.all([
          listInterviews(token),
          getLeaderboard(filters),
        ]);
        let myRankRes = null;
        try {
          myRankRes = await getMyLeaderboardStats(token, filters);
        } catch {
          myRankRes = null;
        }
        if (!canceled) {
          setInterviews(interviewsRes.interviews || []);
          setLeaderboard(leaderboardRes.leaderboard || []);
          setMyRank(myRankRes);
        }
      } catch (err) {
        if (!canceled) setError(err.message);
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, [token, period, metric, minInterviews]);

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-600">Welcome back, {user?.name || user?.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate("/profile")}
                className="rounded-lg bg-slate-200 px-4 py-2 text-slate-800 hover:bg-slate-300"
              >
                Profile
              </button>
              <button
                onClick={() => navigate("/question-form")}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
              >
                Start New Interview
              </button>
              <button
                onClick={() => {
                  clearAuth();
                  navigate("/login");
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          </div>
          {error && <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        </header>

        <main className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Your Interviews</h2>
            <p className="mb-4 text-sm text-slate-600">Track progress over time and review detailed results.</p>
            {interviews.length === 0 ? (
              <p className="text-sm text-slate-600">No interviews yet. Start your first session now.</p>
            ) : (
              <ul className="space-y-3">
                {interviews.map((iv) => (
                  <li key={iv._id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div>
                      <div className={`text-sm font-semibold ${scoreStyle(Number(iv.overallScore || 0))}`}>
                        Score: {iv.overallScore?.toFixed?.(1) ?? iv.overallScore} / 10
                      </div>
                      <div className="text-xs text-slate-500">
                        {iv.createdAt ? new Date(iv.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/results/${iv._id}`)}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm text-white hover:bg-cyan-700"
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Global Leaderboard</h2>
            <p className="mb-4 text-sm text-slate-600">Fair ranking with timeframe and minimum-attempt filters.</p>

            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All time</option>
                <option value="30d">Last 30 days</option>
                <option value="7d">Last 7 days</option>
                <option value="90d">Last 90 days</option>
              </select>

              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="best">Best score</option>
                <option value="average">Average score</option>
              </select>

              <select
                value={minInterviews}
                onChange={(e) => setMinInterviews(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value={1}>Min 1 attempt</option>
                <option value={2}>Min 2 attempts</option>
                <option value={3}>Min 3 attempts</option>
                <option value={5}>Min 5 attempts</option>
              </select>
            </div>

            {myRank?.rank ? (
              <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                <div className="text-sm font-semibold text-cyan-900">
                  Your Rank: #{myRank.rank} / {myRank.totalPlayers}
                </div>
                <div className="text-xs text-cyan-800">
                  Score: {Number(myRank.score || 0).toFixed(2)} | Percentile: {Number(myRank.percentile || 0).toFixed(2)}%
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                You are not ranked for current filters yet. Complete more interviews to appear.
              </div>
            )}

            {leaderboard.length === 0 ? (
              <p className="text-sm text-slate-600">No leaderboard data yet.</p>
            ) : (
              <ol className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <li key={entry.userId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <div className="text-sm text-slate-700">
                        {index + 1}. {entry.name || entry.email}
                      </div>
                      <div className="text-xs text-slate-500">Attempts: {entry.attempts || 0}</div>
                    </div>
                    <div className={`text-sm font-semibold ${scoreStyle(Number(metric === "average" ? entry.avgScore : entry.bestScore || 0))}`}>
                      {Number(metric === "average" ? entry.avgScore : entry.bestScore || 0).toFixed(2)} / 10
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </main>

        <footer className="text-center text-sm text-slate-500">
          <Link to="/">Back to landing page</Link>
        </footer>
      </div>
    </div>
  );
}
