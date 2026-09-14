# Lesson U1 — Real login (replaces the fake login)

> **Track:** Frontend · **Lesson 2 of 10**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first real network call + your first Redux Toolkit thunks)
> **🧩 Prerequisites:** [Lesson U0 — Project hygiene](U0-project-hygiene.md) done (`src/api/client.ts`, `.env` with `VITE_API_URL` in place); backend **B3 — Authentication & login** running and seeded, so there's a real `POST /api/auth/student` and `POST /api/auth/admin` to call.
> **🌿 CR branch:** `cr/u1-real-auth` (off `cr/u0-hygiene`) · **📄 Source CR:** [CR U1](../ui-development-guide.md#cr-u1--real-login-replaces-the-fake-login) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## Run it & check your changes

One script brings up the whole stack — Postgres, the Flask API, and the React UI —
so you can see your changes running end-to-end:

```bash
scripts/local.sh up        # first run also sets up the database + dependencies
scripts/local.sh restart   # re-run this after you change code
scripts/local.sh down      # stop everything
```

- **UI:** http://localhost:5173
- **API health:** http://localhost:8000/api/health
- **Seeded logins (local dev only):** `admin` / `admin123`, or student codes `STU001`–`STU004`

Full runbook and troubleshooting: [`running-the-poc.md`](../../backend/running-the-poc.md).

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

**🖼 What changes on screen (before → after):**
```
        BEFORE (fake)                        AFTER (real login)
┌───────────────────────────┐      ┌───────────────────────────┐
│           Login           │      │       Student Login       │
│                           │      │                           │
│   [ Student ] [ Admin ]   │  ─▶  │   Code: [ STU001______ ]  │
│                           │      │        [   Login   ]      │
│  (click either = you're   │      │        [    Back    ]     │
│   instantly "logged in")  │      │   Invalid code   ◀── red  │
└───────────────────────────┘      └───────────────────────────┘
  any click let you in                a wrong code is rejected;
                                      a right one calls the server
```
Nothing about the *selection* screen's two buttons moves — what changes is that clicking one now opens a **real form** that checks with the server, instead of logging you in on the spot.

---

## 🤔 Why this lesson matters

Up to now, the login screen has been a magic trick — type anything, click a button, and you're "logged in," because the app never actually checked with anyone. That's fine for a click-through prototype, but it's not a real app: anyone could type in someone else's student code and see their data.

Real login means three things have to happen together:
1. The browser sends what you typed to the **backend**, which is the only place that knows whether a code or password is actually valid.
2. The backend replies with a **token** (a signed piece of text proving "yes, this is user #12, role student") that the browser must remember and re-send with every future request — this is how the server recognizes you on the *next* request without asking for your password again.
3. If you refresh the page, the browser has to **prove the token is still good** before showing you anything private, instead of just trusting whatever was in memory a second ago.

This is also your first time writing **[Redux Toolkit](GLOSSARY.md#redux-toolkit) [thunks](GLOSSARY.md#thunk)** (Redux is the app's *shared memory*; a thunk is an action that waits for something slow, like a network call) — the pattern every later lesson (loading lots, saving assignments, registering interest) reuses. Get comfortable with `createAsyncThunk` and `extraReducers` here, and U3–U6 will feel familiar instead of new.

> **New words ahead?** Every bolded term below links to the [**Glossary**](GLOSSARY.md) the first time it appears — click any you don't know, read the one-sentence version, and jump back. You never have to memorize a term before the lesson uses it.

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

// A "User" always has these fields. role can ONLY be one of these two words,
// so a typo like "studnet" is caught before the app even runs.
export interface User {
  id: number;
  role: "student" | "admin";
  name: string;
  email?: string;                          // the "?" means this field is optional
}

// The shape of the "auth" slice — the app's memory of who's logged in.
interface AuthState {
  isLoggedIn: boolean;
  user: User | null;                       // null until someone logs in
  status: "idle" | "loading" | "error";    // used to show a spinner / disable the button
  error: string | null;                    // the red message shown on a failed login
}

const initialState: AuthState = {
  // Start logged-out. If a token is already saved, we confirm it via fetchMe() on app start.
  isLoggedIn: false,
  user: null,
  status: "idle",
  error: null,
};

// --- Async thunks: each wraps ONE backend call (endpoints built in CR B3) ---
// loginStudent(code) sends the code to the server; RTK auto-fires pending → fulfilled/rejected.
export const loginStudent = createAsyncThunk(
  "auth/loginStudent",                                   // a unique name for this action
  (code: string) => api.post("/api/auth/student", { code }) as Promise<{ token: string; user: User }>
);

// Same idea for admins, but it sends a username + password instead of a code.
export const loginAdmin = createAsyncThunk(
  "auth/loginAdmin",
  (creds: { username: string; password: string }) =>
    api.post("/api/auth/admin", creds) as Promise<{ token: string; user: User }>
);

// Called on page load to restore the session: "here's my saved token — who am I?"
export const fetchMe = createAsyncThunk("auth/me", () => api.get("/api/auth/me") as Promise<User>);

const authSlice = createSlice({
  name: "auth",                 // this slice's key inside the store
  initialState,
  reducers: {
    // logout is a plain (non-async) action, so it lives here in `reducers`.
    logout(state) {
      setToken(null);            // clears localStorage + the in-memory token
      state.isLoggedIn = false;
      state.user = null;
      state.status = "idle";
      state.error = null;
    },
  },
  // extraReducers reacts to the thunks above (defined OUTSIDE this reducers block).
  extraReducers: (builder) => {
    // Shared handler for a successful login (student OR admin).
    const loginOk = (state: AuthState, action: { payload: { token: string; user: User } }) => {
      setToken(action.payload.token);      // save the token so a refresh keeps you logged in
      state.isLoggedIn = true;
      state.user = action.payload.user;
      state.status = "idle";
      state.error = null;
    };
    const loginPending = (state: AuthState) => { state.status = "loading"; state.error = null; }; // request started
    const loginFail = (state: AuthState, action: { error: { message?: string } }) => {           // request failed
      state.status = "error";
      state.error = action.error.message ?? "Login failed";   // show the server's message, or a fallback
    };

    // Wire each thunk's 3 stages to the handlers above.
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
        setToken(null);                    // saved token was invalid/expired — throw it away
        state.isLoggedIn = false;
        state.user = null;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;    // this reducer gets plugged into the store
```

The inline comments above cover *what* each line does. Here's the *why* — plus links if you want to go deeper:

**Why it works & further reading:**
- **[Interface](GLOSSARY.md#interface) `User`** — TypeScript checks every user object against this shape, so a missing or misspelled field is caught as you type, not by a user in production. → [TS: Object Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types).
- **[`createAsyncThunk`](GLOSSARY.md#thunk)** — you write only the network call; [Redux Toolkit](GLOSSARY.md#redux-toolkit) generates the *pending / fulfilled / rejected* [actions](GLOSSARY.md#action) for you, which is exactly why the slice can react to all three without extra plumbing. → [RTK: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk).
- **[`extraReducers`](GLOSSARY.md#extrareducers)** — the bridge that lets this [slice](GLOSSARY.md#slice) respond to thunks declared *outside* its own `reducers` block. → [RTK: createSlice](https://redux-toolkit.js.org/api/createSlice).
- **Why save the [token](GLOSSARY.md#jwt)?** `setToken` writes it to [localStorage](GLOSSARY.md#localstorage) so it survives a refresh and rides along on every later request (wired up in U0's `client.ts`). → [jwt.io](https://jwt.io/introduction).
- **Why `fetchMe.rejected` clears the token** — a saved-but-expired token should drop you to logged-out, not trap you in a broken half-logged-in state.

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
    e.preventDefault();                                                // stop the browser's old-style page reload
    const code = new FormData(e.currentTarget).get("code") as string;  // read the typed code by its name="code"
    dispatch(loginStudent(code));   // fire the thunk; on success the slice flips isLoggedIn
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
    e.preventDefault();                            // stop the old-style page reload
    const form = new FormData(e.currentTarget);    // grab all the typed fields at once
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

The inline comments cover the mechanics; here are the ideas worth remembering:

**Why it works & further reading:**
- **Uncontrolled form + [FormData](GLOSSARY.md#formdata)** — instead of tracking every keystroke in [state](GLOSSARY.md#state), we let the browser hold the values and read them all at once on submit. Less code, same result. → [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData).
- **No `.then()` needed after [`dispatch`](GLOSSARY.md#dispatch)** — the slice's [`extraReducers`](GLOSSARY.md#extrareducers) already update `isLoggedIn` / `error`, and the [component](GLOSSARY.md#component) re-draws automatically when that [store](GLOSSARY.md#store) value changes. That's the whole reason login lives in Redux.
- **The red message is just [state](GLOSSARY.md#state)** — `{error && …}` shows `state.auth.error`, which `loginFail` set back in Step 1; there's no separate error-handling code in the component. `disabled={loading}` works the same way, reading `status === "loading"` so the button can't be double-clicked mid-request.

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
    // Runs once, right after the page loads. If a token was saved last time,
    // confirm it with the server and reload the user, so a refresh keeps you logged in.
    if (localStorage.getItem("token")) {
      dispatch(fetchMe());
    }
  }, [dispatch]);   // the [dispatch] list means "run this effect once"; dispatch never changes

  return (
    <div className="App">
      <Login />
    </div>
  );
}

export default App;
```

**Why it works & further reading:**
- **[`useEffect`](GLOSSARY.md#useeffect) runs after the first draw** — right after a refresh, which is exactly when you need to ask "was I logged in before the page reloaded?" → [React: useEffect](https://react.dev/reference/react/useEffect).
- **The [token](GLOSSARY.md#jwt) is the whole trick** — if one survived in [localStorage](GLOSSARY.md#localstorage), `fetchMe` asks the server "who owns this token?" via `GET /api/auth/me`. A valid one lands you back on the dashboard with no retyping; an invalid one is cleared by `fetchMe.rejected` (Step 1) and you see the login screen. → [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

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

- **Blank page + `ReferenceError: Cannot access '…' before initialization` in the console** — a module-level value is computed before a function it depends on is defined; move the `let x = load()` below the function declarations.
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
