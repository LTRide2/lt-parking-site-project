// The ONE place the app talks to the backend. It attaches the login token,
// unwraps the {data:...} envelope, and turns {error:{message}} into a thrown
// Error so callers can try/catch. When VITE_USE_MOCK is on (the default) it
// routes to the in-memory mock backend instead of the network — so the
// frontend runs fully on its own, independent of any real server.
import { mockFetch, mockUpload } from "./mock/backend";
import { log } from "../lib/log";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";

// The login token lives here. We keep a copy in localStorage so a page
// refresh doesn't log you out. setToken(null) clears it (logout).
let token: string | null = localStorage.getItem("token");

export function setToken(next: string | null) {
  token = next;
  if (next) localStorage.setItem("token", next);
  else localStorage.removeItem("token");
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const method = options.method ?? "GET";
  log("api", `→ ${method} ${path}${USE_MOCK ? " (mock)" : ""}`);
  const res = USE_MOCK
    ? await mockFetch(path, { method: options.method, body: options.body as string, headers })
    : await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 204) { log("api", `← ${method} ${path} 204`); return null; } // "no content" (e.g. logout)
  const body = (await res.json().catch(() => ({}))) as { data?: unknown; error?: { message?: string } };
  if (!res.ok) {
    log("api", `✗ ${method} ${path} → ${res.status}`, body?.error);
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  log("api", `← ${method} ${path} ${res.status}`, body.data);
  return body.data;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, requestBody?: unknown) =>
    request(path, { method: "POST", body: JSON.stringify(requestBody ?? {}) }),
  patch: (path: string, requestBody: unknown) =>
    request(path, { method: "PATCH", body: JSON.stringify(requestBody) }),
  put: (path: string, requestBody: unknown) =>
    request(path, { method: "PUT", body: JSON.stringify(requestBody) }),
  del: (path: string) => request(path, { method: "DELETE" }),
};

// File upload uses multipart/form-data, so it bypasses the JSON helper above.
export async function uploadFile(path: string, file: File) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`; // NOTE: no Content-Type — the browser sets it

  if (USE_MOCK) {
    const res = await mockUpload(path, file, headers);
    const body = (await res.json()) as { data?: unknown; error?: { message?: string } };
    if (!res.ok) throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
    return body.data;
  }

  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: formData, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
  return body.data;
}
