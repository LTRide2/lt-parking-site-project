// src/api/client.ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"; // read from .env; falls back to localhost if unset

// The login token lives here. We keep a copy in localStorage so a page
// refresh doesn't log you out. setToken(null) clears it (logout).
let token: string | null = localStorage.getItem("token");

// The ONLY function allowed to change the token — call it on login (with a value) or logout (null).
export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

// The shared engine behind every api.* call below: attaches the token, unwraps the envelope, throws on failure.
async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;   // attach the token on every request, if we have one

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null;            // "no content" (e.g. logout)

  const body = await res.json().catch(() => ({})); // parse JSON; fall back to {} instead of crashing on an empty/bad body
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`); // surface the backend's message, or a fallback
  }
  return body.data;                                // unwrap {data: ...}
}

// One small named function per HTTP method — every future lesson calls these instead of fetch directly.
export const api = {
  get: (p: string) => request(p),
  post: (p: string, b?: unknown) =>
    request(p, { method: "POST", body: JSON.stringify(b ?? {}) }),
  patch: (p: string, b: unknown) =>
    request(p, { method: "PATCH", body: JSON.stringify(b) }),
  del: (p: string) => request(p, { method: "DELETE" }),
};