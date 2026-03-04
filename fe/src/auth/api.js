import { APP_API_BASE } from "../config";

async function request(path, options = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${APP_API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || data.message || "Request failed";
    throw new Error(message);
  }
  return data;
}

export function registerUser(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyEmail(payload) {
  return request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProfile(payload, token) {
  return request(
    "/auth/profile",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token
  );
}

export function changePassword(payload, token) {
  return request(
    "/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );
}

export function requestPasswordReset(payload) {
  return request("/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveInterview(payload, token) {
  return request(
    "/interviews",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );
}

export function listInterviews(token) {
  return request("/interviews", { method: "GET" }, token);
}

export function getInterview(id, token) {
  return request(`/interviews/${id}`, { method: "GET" }, token);
}

export function getLeaderboard(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/leaderboard${suffix}`, { method: "GET" });
}

export function getMyLeaderboardStats(token, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/leaderboard/me${suffix}`, { method: "GET" }, token);
}

export function getMe(token) {
  return request("/auth/me", { method: "GET" }, token);
}

export async function getVideoHealth() {
  const res = await fetch(`${APP_API_BASE}/video/health`, { method: "GET", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Video health check failed");
  }
  return data;
}

export async function submitVideoJob(videoBlob, questionText) {
  const formData = new FormData();
  formData.append("video", videoBlob, "response.mp4");
  formData.append("questionText", questionText);

  const res = await fetch(`${APP_API_BASE}/video/jobs`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to queue video job");
  }
  return data;
}

export async function getVideoJobStatus(jobId) {
  const res = await fetch(`${APP_API_BASE}/video/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch video job status");
  }
  return data;
}

// Fire-and-forget warmup for Render cold starts.
// Never throws (so it is safe to call from route-level useEffect).
export function warmupBackends() {
  const appPing = fetch(`${APP_API_BASE}/health`, { method: "GET", cache: "no-store" }).catch(
    () => null
  );
  const videoPing = fetch(`${APP_API_BASE}/video/health`, { method: "GET", cache: "no-store" }).catch(
    () => null
  );
  return Promise.allSettled([appPing, videoPing]);
}
