# Lesson U1 — Real login (replaces the fake login)

> **Track:** Frontend · **Lesson 2 of 8**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first real network call + your first Redux Toolkit thunks)
> **🧩 Prerequisites:** [Lesson U0 — Project hygiene](U0-project-hygiene.md) done (`src/api/client.ts`, `.env` with `VITE_API_URL` in place); backend **B3 — Authentication & login** running and seeded, so there's a real `POST /api/auth/student` and `POST /api/auth/admin` to call.
> **🌿 CR branch:** `cr/u1-real-auth` (off `cr/u0-hygiene`) · **📄 Source CR:** [CR U1](../ui-development-guide.md#cr-u1--real-login-replaces-the-fake-login) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

A login screen that talks to the **real backend** instead of pretending. Concretely, by the end of this hour you will have:

- `src/store/authSlice.ts` rewritten with real Redux Toolkit thunks that call `POST /api/auth/student`, `POST /api/auth/admin`, and `GET /api/auth/me`.
- `src/Login.tsx` rewritten so the Student and Admin forms submit to those thunks and show a red error message on failure.
- `src/App.tsx` updated to ask the backend "who am I?" on page load, so a **refresh doesn't log you out**.
- A login token stored in `localStorage` and attached to every API call automatically (via the `client.ts` you built in U0).

**✅ Done when (your deliverable checklist):**
- [ ] Logging in with seeded student code `STU001` lands you on the dashboard.
- [ ] Logging in with a wrong code (e.g. `NOPE`) shows a **red error message** and keeps you on the login screen.
- [ ] Logging in as admin (`admin` / `admin123`) works the same way.
- [ ] After a successful login, **refreshing the browser keeps you logged in**.
- [ ] Clicking Logout returns you to the login selection screen, and a refresh after that stays logged **out**.
- [ ] Your work is committed on branch `cr/u1-real-auth` and pushed, PR base = `cr/u0-hygiene`.

---

## 🤔 Why this lesson matters

Up to now, the login screen has been a magic trick — type anything, click a button, and you're "logged in," because the app never actually checked with anyone. That's fine for a click-through prototype, but it's not a real app: anyone could type in someone else's student code and see their data.

Real login means three things have to happen together:
1. The browser sends what you typed to the **backend**, which is the only place that knows whether a code or password is actually valid.
2. The backend replies with a **token** (a signed piece of text proving "yes, this is user #12, role student") that the browser must remember and re-send with every future request — this is how the server recognizes you on the *next* request without asking for your password again.
3. If you refresh the page, the browser has to **prove the token is still good** before showing you anything private, instead of just trusting whatever was in memory a second ago.

This is also your first time writing **Redux Toolkit thunks** — the pattern every later lesson (loading lots, saving assignments, registering interest) reuses. Get comfortable with `createAsyncThunk` and `extraReducers` here, and U3–U6 will feel familiar instead of new.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **`fetch` API** | The browser's built-in way to make an HTTP request to a server. | [MDN: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) |
| **Redux Toolkit `createAsyncThunk`** | Wraps a slow, async action (like "call the login API") into three automatic states: pending, fulfilled, rejected. | [RTK: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) |
| **Redux Toolkit `createSlice`** | Bundles a piece of state, its reducers, and its `extraReducers` (which react to thunks) into one file. | [RTK: createSlice](https://redux-toolkit.js.org/api/createSlice) |
| **Controlled form + `FormData`** | Reading what the user typed out of a submitted `<form>` without wiring up `onChange` for every field. | [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) |
| **`localStorage`** | A small key-value store in the browser that survives a page refresh (unlike React state). | [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) |
| **JWT (JSON Web Token)** | The signed-token format the backend hands back on login; the browser just stores and re-sends it, it doesn't need to understand it. | [jwt.io: Introduction to JWT](https://jwt.io/introduction) |
| **TypeScript `interface`** | Describes the shape of an object (like `User`) so mistyped fields are caught before you even run the code. | [TypeScript Handbook: Object Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → rewrite `authSlice.ts` (15) → rewrite `Login.tsx` (15) → session restore in `App.tsx` (10) → test & commit (15).

**Start the backend first** (through B3, seeded — you need `STU001` and the admin account to exist), then in a second terminal, branch off U0's branch:

```bash
git checkout cr/u0-hygiene   # the parent branch — U1 builds on U0's plumbing
git checkout -b cr/u1-real-auth
```

**What this does & why:** U1 depends on the API client and `.env` that U0 added, so it branches off `cr/u0-hygiene`, not `main`. This is the same "each CR branches off the previous CR's branch" rule from the [stacked-CR routine](../ui-development-guide.md#part-c--how-we-work-one-branch-per-cr-stacked). → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Rewrite `src/store/authSlice.ts` with real thunks (~15 min)

Replace the whole file:

```ts
// src/store/authSlice.ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, setToken } from "../api/client";

export interface User {
  id: number;
  role: "student" | "admin";
  name: string;
  email?: string;
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  status: "idle" | "loading" | "error";
  error: string | null;
}

const initialState: AuthState = {
  // If a token is already saved, we'll confirm it via fetchMe() on app start.
  isLoggedIn: false,
  user: null,
  status: "idle",
  error: null,
};

// --- Async thunks: these call the backend (created in CR B3) ---
export const loginStudent = createAsyncThunk(
  "auth/loginStudent",
  (code: string) => api.post("/api/auth/student", { code }) as Promise<{ token: string; user: User }>
);

export const loginAdmin = createAsyncThunk(
  "auth/loginAdmin",
  (creds: { username: string; password: string }) =>
    api.post("/api/auth/admin", creds) as Promise<{ token: string; user: User }>
);

// Called on page load to restore the session from a saved token.
export const fetchMe = createAsyncThunk("auth/me", () => api.get("/api/auth/me") as Promise<User>);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      setToken(null);            // clears localStorage + the in-memory token
      state.isLoggedIn = false;
      state.user = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const loginOk = (state: AuthState, action: { payload: { token: string; user: User } }) => {
      setToken(action.payload.token);
      state.isLoggedIn = true;
      state.user = action.payload.user;
      state.status = "idle";
      state.error = null;
    };
    const loginPending = (state: AuthState) => { state.status = "loading"; state.error = null; };
    const loginFail = (state: AuthState, action: { error: { message?: string } }) => {
      state.status = "error";
      state.error = action.error.message ?? "Login failed";
    };

    builder
      .addCase(loginStudent.pending, loginPending)
      .addCase(loginStudent.fulfilled, loginOk)
      .addCase(loginStudent.rejected, loginFail)
      .addCase(loginAdmin.pending, loginPending)
      .addCase(loginAdmin.fulfilled, loginOk)
      .addCase(loginAdmin.rejected, loginFail)
      // fetchMe restores the session; if the token is bad, fall back to logged-out.
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.user = action.payload;
      })
      .addCase(fetchMe.rejected, (state) => {
        setToken(null);
        state.isLoggedIn = false;
        state.user = null;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
```

**Explanation, piece by piece:**
- `export interface User { ... }` — a **TypeScript interface** describing exactly what a logged-in user looks like. `role: "student" | "admin"` means "only these two strings are allowed," so a typo like `"studnet"` is a compile error, not a bug you find in production. → [TS Handbook: Object Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types).
- `createAsyncThunk("auth/loginStudent", (code) => api.post(...))` — bundles "call this async function" into an action you can `dispatch()`. Redux Toolkit automatically fires a `pending` action first, then `fulfilled` (with the result) or `rejected` (with the error) — you don't write that plumbing yourself. → [RTK: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk).
- `api.post("/api/auth/student", { code })` — under the hood this calls the browser's `fetch` (the API client you built in U0 wraps it). → [MDN: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
- `setToken(action.payload.token)` — saves the **JWT** the backend returned into `localStorage` (via `client.ts`), so it survives a page refresh and gets attached to every future request. → [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) · [jwt.io: Introduction](https://jwt.io/introduction).
- `extraReducers` with `builder.addCase(...)` — this is how a slice reacts to thunks defined *outside* its own `reducers` block: one case per thunk state (`pending` / `fulfilled` / `rejected`). → [RTK: createSlice](https://redux-toolkit.js.org/api/createSlice).
- `fetchMe.rejected` calls `setToken(null)` — if the saved token turns out to be invalid or expired, we clear it and fall back to logged-out instead of getting stuck in a broken half-logged-in state.

> **What changed vs. the old slice?** The old fake `userType`/`userCode` fields are gone — the real `user` object (with `role`) now comes from the server. Any component still reading `state.auth.userType` needs to switch to `state.auth.user?.role`.

### Step 2 — Rewrite `src/Login.tsx` so the forms call the thunks (~15 min)

Replace the whole file:

```tsx
// src/Login.tsx
import { useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "./store";
import { loginStudent, loginAdmin, logout } from "./store/authSlice";
import { ControlBoard } from "./ControlBoard";

const StudentLoginForm = ({ onBack }: { onBack: () => void }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const loading = useAppSelector((s) => s.auth.status === "loading");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get("code") as string;
    dispatch(loginStudent(code));   // thunk; success flips isLoggedIn
  };

  return (
    <div>
      <h2>Student Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Code: </label>
          <input type="text" name="code" required />
        </div>
        <button type="submit" disabled={loading}>{loading ? "…" : "Login"}</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={onBack} style={{ marginTop: "10px" }}>Back</button>
    </div>
  );
};

const AdminLoginForm = ({ onBack }: { onBack: () => void }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const loading = useAppSelector((s) => s.auth.status === "loading");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    dispatch(loginAdmin({
      username: form.get("username") as string,
      password: form.get("password") as string,   // now actually sent!
    }));
  };

  return (
    <div>
      <h2>Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <div><label>Admin Username: </label><input type="text" name="username" required /></div>
        <div><label>Password: </label><input type="password" name="password" required /></div>
        <button type="submit" disabled={loading}>{loading ? "…" : "Login"}</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={onBack} style={{ marginTop: "10px" }}>Back</button>
    </div>
  );
};

const Login = () => {
  const [view, setView] = useState<"selection" | "student" | "admin">("selection");
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const dispatch = useAppDispatch();

  if (isLoggedIn) {
    return (
      <div style={{ height: "100vh", width: "100vw" }}>
        <ControlBoard onLogout={() => dispatch(logout())} />
      </div>
    );
  }

  const content =
    view === "student" ? <StudentLoginForm onBack={() => setView("selection")} /> :
    view === "admin"   ? <AdminLoginForm onBack={() => setView("selection")} /> : (
      <div>
        <h1>Login</h1>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button onClick={() => setView("student")}>Student</button>
          <button onClick={() => setView("admin")}>Admin</button>
        </div>
      </div>
    );

  return <div style={{ paddingTop: "50px" }}>{content}</div>;
};

export default Login;
```

**Explanation, piece by piece:**
- `<form onSubmit={handleSubmit}>` with plain `<input name="code" />` (no `value`/`onChange`) — this is a lighter-weight alternative to a fully "controlled" input. Instead of tracking every keystroke in React state, we let the browser hold the value and read it all at once on submit via `FormData`. → [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData).
- `e.preventDefault()` — stops the browser's default "reload the page and submit like it's 1999" behavior, so React can handle the submit instead.
- `new FormData(e.currentTarget).get("code") as string` — pulls the typed value out by its `name` attribute. `as string` tells TypeScript "trust me, this field is always present" (it's a required input).
- `dispatch(loginStudent(code))` — fires the thunk from Step 1. You don't need `.then()` here — the slice's `extraReducers` already handle success and failure by updating `isLoggedIn` / `error`, and the component just re-renders when that state changes.
- `disabled={loading}` — reads `state.auth.status === "loading"` so the button can't be double-clicked mid-request.
- `{error && <p style={{ color: "red" }}>{error}</p>}` — the red error message comes straight from `state.auth.error`, which `loginFail` set in Step 1's slice.

### Step 3 — Restore the session on refresh, in `src/App.tsx` (~10 min)

```tsx
// src/App.tsx
import { useEffect } from "react";
import "./App.css";
import Login from "./Login";
import { useAppDispatch } from "./store";
import { fetchMe } from "./store/authSlice";

function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // If a token was saved last time, confirm it and reload the user.
    if (localStorage.getItem("token")) {
      dispatch(fetchMe());
    }
  }, [dispatch]);

  return (
    <div className="App">
      <Login />
    </div>
  );
}

export default App;
```

**Explanation, piece by piece:**
- `useEffect(() => { ... }, [dispatch])` — runs once when the app first mounts (right after a refresh), which is exactly when you need to check "was I logged in before this page reload happened?"
- `localStorage.getItem("token")` — checks whether a token survived the refresh. → [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
- `dispatch(fetchMe())` — if a token exists, ask the backend "who does this token belong to?" via `GET /api/auth/me`. If the token is still valid, `fetchMe.fulfilled` (from Step 1) sets `isLoggedIn = true` and you land straight on the dashboard — no re-typing your code. If it's expired or invalid, `fetchMe.rejected` clears it and you see the login screen instead.

**UI mock (after this phase):** the selection screen, the student form, and a failed login showing the red error.
```
  selection            student form              wrong code
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│    Login     │   │  Student Login   │   │  Student Login   │
│              │   │  Code: [______]  │   │  Code: [NOPE___] │
│ [Student]    │   │     [ Login ]    │   │     [ Login ]    │
│ [Admin]      │   │     [ Back ]     │   │  Invalid code    │ ← red
│              │   │                  │   │     [ Back ]     │
└──────────────┘   └──────────────────┘   └──────────────────┘
```

---

## 🧪 Prove it works — testing guide

1. **Setup:** start the [backend](../../backend/backend-development-guide.md), through **B3**, seeded, and run `npm run dev`.
2. **Steps:**
   - Student: enter a seeded code (`STU001`) → Login.
   - Enter a **wrong** code (`NOPE`) → Login.
   - Admin: username `admin`, password `admin123` → Login.
   - Log in, then **refresh** the browser.
   - Click Logout (in the ControlBoard).
3. **Expected:**
   - Valid code/credentials → you land on the dashboard.
   - Wrong code/password → a **red error message**, you stay on the login screen.
   - After refresh → **still logged in** (the token + `/api/auth/me` restore you).
   - Logout → back to the login selection; refresh now stays logged out.

**☁️ Cloud check (optional):** needs backend **B3** deployed. `./release.sh frontend`, open the live site, and log in as `STU001` / `admin`. Logging in on the real domain proves the deployed UI reaches the deployed auth API (and that CORS is configured for your live origin).

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U1: real student/admin login via API, session restore, logout"
git push -u origin cr/u1-real-auth
```

Then open a Pull Request on GitHub with **base = `cr/u0-hygiene`** (not `main` — U1 depends on U0's branch). Use the [CR description template](../ui-development-guide.md#part-e--the-cr-description-template-use-for-every-pr) and paste your "Prove it works" output as the testing evidence. The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **Browser console shows a CORS error** ("blocked by CORS policy") — the backend's `CORS_ORIGINS` setting doesn't include your frontend's address. Check the backend's `.env` has `CORS_ORIGINS=http://localhost:5173` (see backend [Lesson B0](../../backend/lessons/B0-clean-slate-and-safety.md)) and restart the backend.
- **Every request fails with "Failed to fetch" / a network error** — either the backend isn't running, or your frontend `.env`'s `VITE_API_URL` doesn't match the backend's actual address/port. Confirm both terminals: backend running, and `VITE_API_URL=http://localhost:8000` in your `.env` (from U0).
- **Login succeeds but every *next* request comes back `401 Unauthorized`** — the token isn't being attached. Open DevTools → Application tab → Local Storage and confirm a `token` key exists after login; if it's missing, double-check `setToken` is being called in the `loginOk` case in Step 1.
- **Refreshing logs you out even after a successful login** — `fetchMe` is failing. Check the backend's `GET /api/auth/me` endpoint (from B3) is implemented and returns `200` for a valid token, and that the token in `localStorage` isn't stale from an earlier backend restart.
- **TypeScript error mentioning `userType` or `userCode`** — you have leftover code (maybe in `ControlBoard.tsx`) still reading the old fake auth fields. Switch it to `state.auth.user?.role` as noted after Step 1.

---

## 📝 Recap — what you built and learned

- You replaced the fake, memory-only login with real calls to the backend's `/api/auth/student`, `/api/auth/admin`, and `/api/auth/me` endpoints.
- You wrote your first **Redux Toolkit thunks** (`createAsyncThunk`) and wired their pending/fulfilled/rejected states into a slice's `extraReducers` — the exact pattern U3–U6 will reuse for lots, spaces, and interest.
- You learned why the token lives in `localStorage` and gets re-sent on every request, and why a page refresh needs its own "am I still logged in?" check (`fetchMe`) instead of just trusting old React state.
- You practiced the **stacked-CR git routine** again, this time branching off a *previous CR's branch* (`cr/u0-hygiene`) instead of `main`.

---

## 📚 References

- [MDN: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) — how the browser makes HTTP requests.
- [Redux Toolkit: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) and [createSlice](https://redux-toolkit.js.org/api/createSlice) — the async-action pattern used throughout this app.
- [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) — reading submitted form values.
- [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — persisting the token across refreshes.
- [jwt.io: Introduction to JWT](https://jwt.io/introduction) — what the token the backend returns actually is.
- [TypeScript Handbook: Object Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types) — the `interface User { ... }` pattern.
- Source of truth for this lesson: [UI guide → CR U1](../ui-development-guide.md#cr-u1--real-login-replaces-the-fake-login).

---

## ➡️ Next lesson

**[Lesson U2 — Routing (real pages with URLs)](U2-routing.md).** You'll add `react-router-dom` routes so the dashboard and login live at real URLs instead of one component swapping its own view. → [source CR](../ui-development-guide.md#cr-u2--routing-real-pages-with-urls).
