# LTRide — UI (Frontend) Development Guide

> **Who this is for:** someone brand new to coding. This guide is written so you can follow it **literally, line by line**. When you see a gray box, that's a command you type into your terminal. Type one line, press Enter, wait for it to finish, then do the next line.
>
> **What you are building:** the website students and admins see in their browser. It talks to the "backend" (the server + database) over the internet. The backend has its own guide: [`../backend/backend-development-guide.md`](../backend/backend-development-guide.md). Read the [overall plan](../plan.md) first for the big picture.
>
> **Where this doc sits:** this is the **frontend design + implementation guide**, one of four docs in `plan/` — see the [document map in plan.md §0](../plan.md#0-start-here--which-document-do-i-read). `../plan.md` is the master/orchestrator; the sibling backend guide is `../backend/backend-development-guide.md`; deployment has its own guide at [`../deploy/deployment-guide.md`](../deploy/deployment-guide.md).
>
> **The code you're editing lives in its own repo:** [`github.com/LTRide2/lt-parking-site-project`](https://github.com/LTRide2/lt-parking-site-project) (locally `~/workspace/LT_Proj/lt-parking-site-project`). This `plan/` folder lives in the **backend** repo (`LTR-Backend`); the guides describe the frontend, but the frontend source is cloned separately — see [A3](#a3-get-the-project-onto-your-computer) below.

---

## Part A — One-time setup (do this once)

### A1. Install the tools

You need three programs. Install them in this order.

1. **A code editor — VS Code.** Download from <https://code.visualstudio.com>, open the `.dmg`, drag to Applications.
2. **Node.js (this runs the website code).** Download the **LTS** version from <https://nodejs.org>. Install it like any Mac app.
3. **Git (this saves versions of your code).** macOS usually has it. Check by opening the **Terminal** app and typing:
   ```bash
   git --version
   ```
   If you see a version number (like `git version 2.39`), you're done. If it asks to "install command line developer tools", click **Install** and wait.

**Check Node is installed.** In Terminal:
```bash
node --version
npm --version
```
Both should print version numbers. `node` should be v20 or higher.

### A2. Tell Git who you are (one time)

Replace the name and email with yours:
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### A3. Get the project onto your computer

The frontend lives in its own GitHub repository: **[`github.com/LTRide2/lt-parking-site-project`](https://github.com/LTRide2/lt-parking-site-project)**. `cd` means "change directory" (move into a folder); `~` means your home folder.

**If you don't have the project yet, clone it** (downloads a copy from GitHub):
```bash
cd ~/workspace/LT_Proj                 # the folder that holds both repos (make it with: mkdir -p ~/workspace/LT_Proj)
git clone https://github.com/LTRide2/lt-parking-site-project.git
cd lt-parking-site-project
```

**If you already have it,** just move into it:
```bash
cd ~/workspace/LT_Proj/lt-parking-site-project
```
> **Tip:** to see where you are, type `pwd` (print working directory). To list files in the current folder, type `ls`. This is a **different repo** from the backend (`~/workspace/LT_Proj/LTR-Backend`, which also holds these `plan/` docs) — keep the two terminals/folders straight.

### A4. Install the project's building blocks

This downloads all the code libraries the project needs (it reads the list from `package.json`). Run it inside the project folder:
```bash
npm install
```
This can take a minute. It creates a `node_modules` folder — never edit that folder by hand.

### A5. Run the website on your computer

```bash
npm run dev
```
You'll see a line like `Local: http://localhost:5173/`. Hold **Cmd** and click it, or paste it into your browser. You should see the LTRide login screen. **Leave this running** in its terminal while you work — it auto-refreshes when you save a file.

To **stop** it later, click that terminal and press **Ctrl + C**.

---

## Part B — Git basics you'll use every day

You don't need to be a Git expert. You only need these moves. We'll repeat them for every CR.

| What you want to do | Command |
|---|---|
| See what you changed | `git status` |
| See which branch you're on | `git branch` |
| Create a new branch and switch to it | `git checkout -b cr/u1-real-auth` |
| Switch to an existing branch | `git checkout cr/u1-real-auth` |
| Stage your changes (mark them to save) | `git add -A` |
| Save a snapshot with a message | `git commit -m "describe what you did"` |
| Upload your branch to GitHub | `git push -u origin cr/u1-real-auth` |
| Get the latest from GitHub | `git pull` |

> **Mental model:** you *edit files* → `git add` (put them in a box) → `git commit` (seal the box with a label) → `git push` (mail the box to GitHub). A **branch** is a separate line of work so you don't disturb the main copy.

---

## Part C — How we work: one branch per CR (stacked)

A **CR** ("change request") is one small, complete piece of work. We do them one at a time. The rule from the [plan](../plan.md) (the full stacked-CR strategy and the live [CR status tracker](../plan.md#82-cr-status-tracker) are in `../plan.md §8`):

> **Each CR branches off the *previous* CR's branch**, so you can keep building while an earlier CR is being reviewed.

**The routine for every UI CR** (you'll repeat this exact pattern):

```bash
# 1. Start from the branch this CR depends on (the previous CR).
git checkout cr/u0-hygiene          # the parent branch

# 2. Create this CR's branch on top of it.
git checkout -b cr/u1-real-auth

# 3. ...edit files in VS Code, save, watch the browser...

# 4. Save your progress as you go (do this often).
git add -A
git commit -m "U1: add login API call and auth guard"

# 5. When the CR is done, push it to GitHub.
git push -u origin cr/u1-real-auth
```

Then open a **Pull Request** on GitHub with the **base branch set to the parent** (`cr/u0-hygiene`), not `main`. Fill in the CR description template (see Part E). While it's being reviewed, start the next CR off *this* branch.

---

## Part D — What already exists (so you know what you're changing)

The current app is a **prototype** — it looks right but has no real data and forgets everything on refresh. Key files in `src/`:

| File | What it does today |
|---|---|
| `src/main.tsx` | Starts the app, connects Redux store. |
| `src/App.tsx` | Top-level component; just renders `<Login />`. |
| `src/Login.tsx` | Login screen (Student / Admin), fake login. |
| `src/ControlBoard.tsx` | The shared screen for **both** roles: campus map + all 17 lots + edit mode. Admins get the control panel; students can click a spot to claim/unclaim it. |
| `src/store/index.ts` | The Redux "store" (central data) + typed hooks. |
| `src/store/authSlice.ts` | Login/logout state (currently fake). |
| `src/store/parkingSlice.ts` | Selected lot, edit mode, selected/disabled spaces, and `assignedSpaces` (which student claimed/was-assigned each spot). All local-only — it resets on refresh. |

> **Redux in one sentence:** it's a single shared box of data (`state`) that any component can read with `useAppSelector`, and change by `dispatch`-ing an action. Don't worry about mastering it — you'll copy the existing patterns.

**Vocabulary you'll meet:**
- **Component** — a reusable piece of UI, written as a function that returns HTML-like code (JSX).
- **Props** — inputs passed into a component.
- **State** — data that can change over time.
- **Thunk** — a special action that does something slow first (like calling the backend) before updating state.

### The source structure you're building toward

The left side is what's in `src/` today; the right side is where you're heading. Each CR adds a little of the right.

**Today (a click-only prototype):**
```
lt-parking-site-project/
├── public/
│   └── lots/              # cropped photos of each real lot (lot1.jpg … lot17.jpg)
└── src/
    ├── main.tsx           # boots React, wraps app in the Redux <Provider>
    ├── App.tsx            # just renders <Login />
    ├── Login.tsx          # login screen; fakes login; gates <ControlBoard>
    ├── ControlBoard.tsx   # shared screen for both roles: map, 17 lots, edit mode,
    │                      #   student claim/unclaim, admin manual-assign (all local-only)
    └── store/
        ├── index.ts       # the Redux store + typed hooks
        ├── authSlice.ts   # {isLoggedIn, userType, userCode} — fake login
        └── parkingSlice.ts# selectedLot, isEditMode, selectedSpaces, disabledSpaces,
                           #   assignedSpaces {spaceId: studentId}
```

**The target (filled in, each file tagged by the CR that adds it):**
```
src/
├── main.tsx              # adds <BrowserRouter>                                (U2)
├── App.tsx               # defines <Routes>, restores session on load          (U1, U2)
├── ProtectedRoute.tsx    # blocks pages you're not allowed to see              (U2)
├── Login.tsx             # real login form, shows errors                       (U1)
├── StudentDashboard.tsx  # student: see availability, register interest        (U5)
├── ControlBoard.tsx      # admin: data-driven map, disable, assign,
│                         #        arrange spots (drag-drop), add lot           (U3,U4,U6,U7,U8,U9)
├── api/
│   └── client.ts         # the ONE place that talks to the backend            (U0)
└── store/
    ├── index.ts          # registers the slices below
    ├── authSlice.ts      # real login thunks + token                           (U1)
    ├── parkingSlice.ts   # fetchLots / fetchSpaces / updateSpaces /
    │                     #   saveLayout / createLot thunks                     (U3,U4,U8,U9)
    └── interestSlice.ts  # registerInterest / fetchInterest / assign thunks    (U5,U6)
```

> **How to read this:** a **slice** is one Redux file owning a slice of the shared data (auth, parking, interest). A **thunk** inside a slice is an async action that calls the backend. The full request/response shape of every endpoint is in the backend guide's [**API Reference**](../backend/backend-development-guide.md#appendix-a--backend-api-reference-v1) (`../backend/backend-development-guide.md`); the frontend-side conventions are collected in [Appendix — Frontend architecture reference](#appendix--frontend-architecture-reference) at the end of this guide.

> **⚠️ Heads-up — the prototype has grown past this guide in one spot.** Since these CRs were first written, someone added a **local-only "assigned spaces" feature** to the prototype:
> - `parkingSlice.ts` now has an extra `assignedSpaces` field (a `{spaceId: studentId}` map) plus `assignSpace` / `unassignSpace` reducers.
> - `ControlBoard.tsx` now (a) draws **all 17 lots** from a `LOT_CONFIGS` table over cropped lot photos, (b) lets a **student click an open spot to claim it** (with a confirmation pop-up, one spot max), and (c) makes the admin's **Manual Assign** button work locally by typing a student ID.
>
> This all lives **only in the browser and resets on refresh** — there's still no backend behind it. The CRs below (especially **U3, U4, U6**) are the plan to make it *real* (data-driven + saved on the server). Where a CR says "replace the whole file" or shows a "BEFORE", expect the file on your screen to have these extra `assignedSpaces` bits — that's fine, the CR's new version intentionally supersedes them. Each affected CR has a short **"📸 What's already in the prototype"** note so you're not surprised.

---

## Part E — The CR description template (use for every PR)

When you open a Pull Request, paste this and fill it in:

```markdown
## <CR id> — <title>
**Depends on:** <parent CR>     **Base branch:** cr/<parent>

### What & why
<1–3 sentences in plain English: what changed and why.>

### Changes
- <file> — <what you changed>

### Local testing guide
1. Setup: <what to start, e.g. backend running, npm run dev>
2. Steps: <exact clicks/commands a reviewer follows>
3. Expected: <what they should see, including error cases>

### Rollback
<how to undo: usually "revert this PR">
```

---

## Part F — The UI CRs, step by step

> **Before each CR:** make sure the backend is running if the CR needs data (see the backend guide). Start the frontend with `npm run dev`. The API base URL comes from a file called `.env` (created in U0) holding `VITE_API_URL=http://localhost:8000`.

### The "☁️ Cloud check" recipe (deploy a UI CR and test it on the real site)

Every CR has a **Local testing guide** (test on your laptop — always do this first). Most also have a **☁️ Cloud check**: deploy the same CR to the real AWS server and confirm it works on the live site. This catches "works locally, breaks in production" problems (wrong API URL, CORS, a backend endpoint that isn't deployed yet) early.

**One-time prerequisite:** the server has to exist. That's the backend guide's **D0 → D1 → D2** (provision AWS) plus a first `./release.sh all`. Do that once; then this recipe is just two commands.

**The repeatable recipe — after committing the UI CR you want to verify in the cloud:**
```bash
git push                                  # release.sh builds from your pushed code
cd ~/workspace/LTR-Backend/deploy
./release.sh frontend                     # builds the UI with the PROD api url + uploads to nginx
./deploy.sh outputs                       # shows your site address (ElasticIp / domain)
```
> **Key difference from local:** `release.sh frontend` builds with `VITE_API_URL` pointing at the **deployed backend** (not `localhost`). So a UI cloud check only works if the **matching backend CR is already deployed** (e.g. U3 needs B4 live, U5 needs B6 live). Open `http://<ElasticIp>` (or your domain) and repeat that CR's browser steps there.
>
> If the live site shows "Failed to fetch"/CORS, the backend isn't deployed or its `CORS_ORIGINS` doesn't include your site's address — fix in the backend guide, not here.

---

### CR U0 — Project hygiene (foundation, no visible change)

**Goal:** add the plumbing later CRs need — routing, an API helper, environment config, and code formatting — **without changing what the user sees yet.**

**Branch:**
```bash
git checkout main
git pull
git checkout -b cr/u0-hygiene
```

**Steps:**

1. **Install the router** (used in U2; install now so the foundation is in place):
   ```bash
   npm install react-router-dom
   ```

2. **Create the environment file.** In the project root (next to `package.json`) make a file named `.env`:
   ```dotenv
   VITE_API_URL=http://localhost:8000
   ```
   Also create `.env.example` with the same line — this one *is* committed so the next person knows the setting exists. Then confirm `.gitignore` ignores your real `.env`:
   ```bash
   grep -q '^\.env$' .gitignore || echo '.env' >> .gitignore
   ```
   > **Why `VITE_` at the front?** Vite only exposes variables that start with `VITE_` to your browser code, via `import.meta.env`. Anything else stays hidden.

3. **Create the API helper** at `src/api/client.ts`. This is the **one place** that talks to the backend. It attaches the login token, unwraps the `{data: ...}` envelope, and turns the backend's `{error:{message}}` into a thrown `Error` so callers can `try/catch`:
   ```ts
   // src/api/client.ts
   const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

   // The login token lives here. We keep a copy in localStorage so a page
   // refresh doesn't log you out. setToken(null) clears it (logout).
   let token: string | null = localStorage.getItem("token");

   export function setToken(t: string | null) {
     token = t;
     if (t) localStorage.setItem("token", t);
     else localStorage.removeItem("token");
   }

   async function request(path: string, options: RequestInit = {}) {
     const headers: Record<string, string> = {
       "Content-Type": "application/json",
       ...(options.headers as Record<string, string> | undefined),
     };
     if (token) headers["Authorization"] = `Bearer ${token}`;

     const res = await fetch(`${BASE}${path}`, { ...options, headers });
     if (res.status === 204) return null;            // "no content" (e.g. logout)

     const body = await res.json().catch(() => ({}));
     if (!res.ok) {
       throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
     }
     return body.data;                                // unwrap {data: ...}
   }

   export const api = {
     get: (p: string) => request(p),
     post: (p: string, b?: unknown) =>
       request(p, { method: "POST", body: JSON.stringify(b ?? {}) }),
     patch: (p: string, b: unknown) =>
       request(p, { method: "PATCH", body: JSON.stringify(b) }),
     del: (p: string) => request(p, { method: "DELETE" }),
   };
   ```

4. **Make sure it compiles** (no behavior change yet):
   ```bash
   npm run lint
   npm run build
   ```

**UI mock (after this phase):** *no visible change* — U0 only adds plumbing files. The screen is identical to before:
```
┌────────────────────────────┐
│           Login            │
│                            │
│      [Student] [Admin]     │
└────────────────────────────┘
```

**Local testing guide:**
1. Setup: `npm install` then `npm run dev`.
2. Steps: open the site; click Student/Admin; click around the existing fake login.
3. Expected: the app looks and behaves **exactly as before** (no visible change — you only added files). `npm run lint` and `npm run build` finish with **no errors**.

**☁️ Cloud check (optional):** `git push` then `./release.sh frontend`. There's nothing new to *see*, but a clean build + deploy proves the production build still works (the cloud build is stricter than `npm run dev` — it runs `tsc`). Open the live site; it should look exactly as before.

**Commit & push:**
```bash
git add -A
git commit -m "U0: add router dep, API client with token, env config"
git push -u origin cr/u0-hygiene
```
Open a PR with base = `main`.

---

### CR U1 — Real login (replaces the fake login)

**Depends on:** U0 and backend **B3** (auth endpoints must exist). **Branch off U0.**

**Goal:** when a student types their code (or an admin types username/password), actually call the backend, get a token, and stay logged in across refreshes.

**Branch:**
```bash
git checkout cr/u0-hygiene
git checkout -b cr/u1-real-auth
```

**Step 1 — Rewrite `src/store/authSlice.ts`** with real async thunks. Replace the whole file:
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
> **What changed vs. the old slice?** The old `userType`/`userCode` fields are gone — the real `user` object (with `role`) now comes from the server. Any component reading `state.auth.userType` must switch to `state.auth.user?.role` (the ControlBoard/Login below already do).

**Step 2 — Rewrite `src/Login.tsx`** so the forms call the thunks and show errors. Replace the whole file:
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

**Step 3 — Restore the session on refresh.** In `src/App.tsx`, ask the backend "who am I?" on load if a token exists:
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

**Local testing guide:**
1. Setup: start the backend ([`../backend/backend-development-guide.md`](../backend/backend-development-guide.md), through **B3**, seeded) and `npm run dev`.
2. Steps:
   - Student: enter a seeded code (`STU001`) → Login.
   - Enter a **wrong** code (`NOPE`) → Login.
   - Admin: username `admin`, password `admin123` → Login.
   - Log in, then **refresh** the browser.
   - Click Logout (in the ControlBoard).
3. Expected:
   - Valid code/credentials → you land on the dashboard.
   - Wrong code/password → a **red error message**, you stay on the login screen.
   - After refresh → **still logged in** (the token + `/api/auth/me` restore you).
   - Logout → back to the login selection; refresh now stays logged out.

**☁️ Cloud check (optional):** needs backend **B3** deployed. `./release.sh frontend`, open the live site, and log in as `STU001` / `admin`. Logging in on the real domain proves the deployed UI reaches the deployed auth API (and that CORS is configured for your live origin).

**Commit & push:**
```bash
git add -A
git commit -m "U1: real student/admin login via API, session restore, logout"
git push -u origin cr/u1-real-auth
```
PR base = `cr/u0-hygiene`.

---

### CR U2 — Routing (real pages with URLs)

**Depends on:** U1. **Branch off U1.**

**Goal:** replace the manual "which screen shows" logic with real URLs: `/login`, `/student`, `/admin`. Logged-out users who visit a protected page get sent to `/login`; a student can't open `/admin`.

**Branch:**
```bash
git checkout cr/u1-real-auth
git checkout -b cr/u2-routing
```

**Step 1 — Wrap the app in a router.** In `src/main.tsx`, add `BrowserRouter`:
```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./store";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
```

**Step 2 — Create the guard `src/ProtectedRoute.tsx`:**
```tsx
// src/ProtectedRoute.tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "./store";

export function ProtectedRoute({ role, children }: { role?: "student" | "admin"; children: ReactNode }) {
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const userRole = useAppSelector((s) => s.auth.user?.role);

  if (!isLoggedIn) return <Navigate to="/login" replace />;          // not logged in
  if (role && userRole !== role) return <Navigate to="/login" replace />; // wrong role
  return <>{children}</>;
}
```

**Step 3 — Define the routes in `src/App.tsx`.** Now `App` owns the URLs; `Login.tsx` becomes just the login *page* (no longer the gate):
```tsx
// src/App.tsx
import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./App.css";
import Login from "./Login";
import StudentDashboard from "./StudentDashboard";   // created in U5; stub it for now
import { ControlBoard } from "./ControlBoard";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAppDispatch, useAppSelector } from "./store";
import { fetchMe, logout } from "./store/authSlice";

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    if (localStorage.getItem("token")) dispatch(fetchMe());
  }, [dispatch]);

  // When the user becomes known, send them to their home page.
  useEffect(() => {
    if (user?.role === "admin") navigate("/admin");
    else if (user?.role === "student") navigate("/student");
  }, [user, navigate]);

  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/student" element={
          <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute role="admin">
            <ControlBoard onLogout={() => { dispatch(logout()); navigate("/login"); }} />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

export default App;
```

**Step 4 — Simplify `Login.tsx`.** Remove the `if (isLoggedIn) return <ControlBoard …>` block (routing handles that now) — keep only the selection / student form / admin form. The forms are unchanged from U1.

**Step 5 — Temporary stub** so it compiles before U5. Create `src/StudentDashboard.tsx`:
```tsx
// src/StudentDashboard.tsx  (replaced for real in U5)
export default function StudentDashboard() {
  return <h2>Student dashboard (coming in U5)</h2>;
}
```

**UI mock (after this phase):** same screens as before, but now each has its **own URL**, and wrong-role / logged-out visits bounce back to `/login`.
```
  /login                /student                     /admin
┌──────────────┐   ┌──────────────────┐   ┌──────────────────────────┐
│    Login     │   │ Welcome, Alice   │   │ LTRide                ☰  │
│ [Student]    │   │ (student dash)   │   │ [Admin control board…]   │
│ [Admin]      │   │                  │   │                          │
└──────────────┘   └──────────────────┘   └──────────────────────────┘
        ▲  a student typing /admin, or anyone logged-out, is redirected here
```

**Local testing guide:**
1. Setup: backend running (through B3) + `npm run dev`.
2. Steps: log in as a student → URL becomes `/student`; while logged in as a student, type `/admin` in the address bar; log out and visit `/admin` directly; use the browser Back button.
3. Expected:
   - Student lands on `/student`, admin on `/admin` (each shows their own page).
   - A student visiting `/admin` is redirected to `/login` (wrong role).
   - A logged-out user visiting any protected URL → redirected to `/login`.
   - Back/Forward buttons navigate between pages without a full reload.

**☁️ Cloud check (optional):** `./release.sh frontend`, then on the live site visit `/admin` while logged out — you should be redirected to `/login`. **Heads-up:** deep links like `https://yoursite/admin` only work if nginx is configured to serve `index.html` for unknown paths (SPA fallback). If a refresh on `/admin` gives a 404, that's the nginx `try_files` rule — see **Part 3 / nginx config** in the backend guide.

**Commit & push:**
```bash
git add -A && git commit -m "U2: react-router routes + role-guarded ProtectedRoute" && git push -u origin cr/u2-routing
```
PR base = `cr/u1-real-auth`.

---

### CR U3 — Show real lots and spaces (data-driven map)

**Depends on:** U2 and backend **B4**. **Branch off U2.**

**Goal:** today the grid is hard-coded (`renderParkingLot()` draws 3×2×20 fake boxes with string IDs like `1-0-5`, and "disabled" lives only in the browser). Replace that with the **real** lots and spaces from the backend, each space coloured by its server `status`.

> **Big idea / what changes:** the old slice tracked spaces as strings (`selectedSpaces: string[]`, `disabledSpaces: string[]`). The backend gives every space a **numeric `id`** and a **`status`** (`available` / `disabled` / `assigned`). So in this CR selection becomes `number[]`, and "disabled" is no longer a separate list — it's just `status === "disabled"` coming from the server. U4 then makes changes *save*.

> **📸 What's already in the prototype:** the file on your screen has grown since this CR was written. `parkingSlice.ts` has an extra `assignedSpaces: Record<string, string>` field with `assignSpace`/`unassignSpace` reducers, and `ControlBoard.tsx` already draws **all 17 lots** from a `LOT_CONFIGS` table over photos in `public/lots/`. **That's expected.** The "replace the whole file" step below throws away the *string-based, browser-only* version on purpose — the server (`status: "assigned"`) becomes the single source of truth for who has which spot. Keep the 17-lot `LOT_CONFIGS` / photo-drawing code; only the **data source** (strings → server ids + status) changes. The claim/assign *behaviour* gets rebuilt properly against the backend in **U6**.

**Branch:**
```bash
git checkout cr/u2-routing
git checkout -b cr/u3-real-lots
```

**Step 1 — Rewrite `src/store/parkingSlice.ts`** to be data-driven. Replace the whole file:
```ts
// src/store/parkingSlice.ts
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api } from "../api/client";

type EditAction = "single" | "group" | "disable" | "enable" | "manual" | "update" | null;

export interface Lot {
  id: number;
  name: string;
  capacity: number;
  available_count: number;
}
export interface Space {
  id: number;
  lot_id: number;
  label: string;
  status: "available" | "disabled" | "assigned";
}

interface ParkingState {
  lots: Lot[];
  selectedLotId: number | null;          // null = the "Home" campus-map view
  spacesByLot: Record<number, Space[]>;  // cache of spaces per lot id
  isEditMode: boolean;
  editAction: EditAction;
  selectedSpaces: number[];              // now numeric server ids
  status: "idle" | "loading" | "error";
  error: string | null;
}

const initialState: ParkingState = {
  lots: [],
  selectedLotId: null,
  spacesByLot: {},
  isEditMode: false,
  editAction: null,
  selectedSpaces: [],
  status: "idle",
  error: null,
};

// GET /api/lots  -> Lot[]
export const fetchLots = createAsyncThunk("parking/fetchLots", () => api.get("/api/lots") as Promise<Lot[]>);

// GET /api/lots/:id/spaces  -> Space[]   (returns the lotId too, so the reducer knows where to store)
export const fetchSpaces = createAsyncThunk("parking/fetchSpaces", async (lotId: number) => {
  const spaces = (await api.get(`/api/lots/${lotId}/spaces`)) as Space[];
  return { lotId, spaces };
});

const parkingSlice = createSlice({
  name: "parking",
  initialState,
  reducers: {
    setSelectedLot(state, action: PayloadAction<number | null>) {
      state.selectedLotId = action.payload;
      state.selectedSpaces = [];           // clear selection when switching lots
    },
    toggleEditMode(state) {
      state.isEditMode = !state.isEditMode;
      if (!state.isEditMode) { state.editAction = null; state.selectedSpaces = []; }
    },
    setIsEditMode(state, action: PayloadAction<boolean>) {
      state.isEditMode = action.payload;
      if (!action.payload) { state.editAction = null; state.selectedSpaces = []; }
    },
    setEditAction(state, action: PayloadAction<EditAction>) {
      state.editAction = action.payload;
    },
    toggleSpaceSelection(state, action: PayloadAction<number>) {
      const id = action.payload;
      const idx = state.selectedSpaces.indexOf(id);
      if (idx === -1) state.selectedSpaces.push(id);
      else state.selectedSpaces.splice(idx, 1);
    },
    clearSelectedSpaces(state) {
      state.selectedSpaces = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLots.fulfilled, (state, action) => { state.lots = action.payload; })
      .addCase(fetchSpaces.pending, (state) => { state.status = "loading"; state.error = null; })
      .addCase(fetchSpaces.fulfilled, (state, action) => {
        state.status = "idle";
        state.spacesByLot[action.payload.lotId] = action.payload.spaces;
      })
      .addCase(fetchSpaces.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Could not load spaces";
      });
  },
});

export const {
  setSelectedLot, toggleEditMode, setIsEditMode, setEditAction,
  toggleSpaceSelection, clearSelectedSpaces,
} = parkingSlice.actions;
export default parkingSlice.reducer;
```
> **What I removed and why:** `enableSelectedSpaces` / `disableSelectedSpaces` (they edited a local `disabledSpaces` list) and `disabledSpaces` itself are gone — disabling now goes through the server in **U4**. If your editor flags the old imports in `ControlBoard.tsx`, that's expected; the next steps fix them.

**Step 2 — Fix the auth field in `ControlBoard.tsx`.** Line ~37 still reads the deleted `userType`/`userCode`. Change it to the new `user` object from U1:
```tsx
// BEFORE:
const { userType, userCode } = useAppSelector(state => state.auth);
// AFTER:
const user = useAppSelector(state => state.auth.user);
```
Then update the two usages: the student branch test `if (userType === 'student')` → `if (user?.role === 'student')`, and `Logged in as: {userCode}` → `Logged in as: {user?.name}`.

**Step 3 — Load data and react to the selected lot.** Update the imports and add a fetch effect near the top of `ControlBoard`:
```tsx
import {
  setSelectedLot, setIsEditMode, setEditAction, toggleEditMode,
  toggleSpaceSelection, fetchLots, fetchSpaces,
} from './store/parkingSlice';
// ...
const dispatch = useAppDispatch();
const user = useAppSelector(state => state.auth.user);
const { lots, selectedLotId, spacesByLot, isEditMode, editAction, selectedSpaces, status, error } =
  useAppSelector(state => state.parking);

// Load the list of lots once.
useEffect(() => { dispatch(fetchLots()); }, [dispatch]);
// Load this lot's spaces whenever the selected lot changes.
useEffect(() => { if (selectedLotId != null) dispatch(fetchSpaces(selectedLotId)); }, [selectedLotId, dispatch]);
```

**Step 4 — Draw spaces from data.** Replace `renderParkingLot()` and the `spaceColor` helper so they read the fetched spaces and colour by `status`:
```tsx
const spaceColor = (space: Space) => {
  if (selectedSpaces.includes(space.id)) return '#f5c542';  // currently selected (yellow)
  if (space.status === 'disabled') return '#aaa';            // grey
  if (space.status === 'assigned') return '#7aa7ff';         // blue = taken
  return 'white';                                            // available
};

const renderParkingLot = () => {
  const spaces = selectedLotId != null ? (spacesByLot[selectedLotId] ?? []) : [];
  if (status === 'loading' && spaces.length === 0) return <div style={{ color: '#333' }}>Loading…</div>;
  if (error) return <div style={{ color: '#900' }}>{error}</div>;
  if (spaces.length === 0) return <div style={{ color: '#333' }}>No spaces in this lot.</div>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '400px' }}>
      {spaces.map(space => (
        <div
          key={space.id}
          title={`${space.label} — ${space.status}`}
          onClick={() => isSelecting && dispatch(toggleSpaceSelection(space.id))}
          style={{
            width: '30px', height: '12px',
            backgroundColor: spaceColor(space),
            border: selectedSpaces.includes(space.id) ? '1px solid #c8a000' : '1px solid #aaa',
            cursor: isSelecting ? 'pointer' : 'default',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
};
```

**Step 5 — Drive the bottom lot-nav from real lots.** Replace the hard-coded `['Home', ...'Lot 1'..'Lot 17']` buttons with a **Home** button plus one button per fetched lot:
```tsx
<div style={lotNavigationStyle}>
  <button style={lotButtonStyle(selectedLotId === null)} onClick={() => dispatch(setSelectedLot(null))}>
    Home
  </button>
  {lots.map(lot => (
    <button key={lot.id} style={lotButtonStyle(selectedLotId === lot.id)} onClick={() => dispatch(setSelectedLot(lot.id))}>
      {lot.name}
    </button>
  ))}
</div>
```
Then in the canvas body, the campus map shows when `selectedLotId === null`, and the grid shows otherwise. Update those two conditions: `selectedLot === 'Home'` → `selectedLotId === null`, and the `selectedLot === 'Lot 1'` / `renderParkingLot()` branch → `selectedLotId !== null && renderParkingLot()`. (Search the file for `selectedLot` and update each — there are a handful in the map drag/zoom effects too; those all become `selectedLotId === null`.)

**UI mock (after this phase):** the bottom nav now lists the **real** lots, and each lot draws its own server spaces coloured by status.
```
┌──────────────────────────────────────────────────────────┐
│ LTRide                                                  ☰  │
├───────────────┬──────────────────────────────────────────┤
│ ┌───────────┐ │   ▢ ▢ ▢ ▣ ▢ ▢   ▦ ▢ ▢ ▢                   │
│ │Admin Ctrl │ │   ▢ ▢ ▢ ▢ ▢ ▢   ▢ ▢ ▢ ▢                   │  ▢ available (white)
│ │ (dimmed   │ │   ▢ ▣ ▢ ▢ ▢ ▢                              │  ▣ disabled (grey)
│ │  until    │ │                                            │  ▦ assigned (blue)
│ │  Edit on) │ │   hover a space → "A-04 — available"       │
│ └───────────┘ │                                            │
│ [👤 My Acct]  │   [Home][Lot A][Lot B]   ← real lots       │
│               │   Edit Mode ○——                            │
└───────────────┴──────────────────────────────────────────┘
```

**Local testing guide:**
1. Setup: backend running with seeded data (backend guide through **B4**); `npm run dev`; log in as admin.
2. Steps: click through the lots in the bottom nav; hover a space (tooltip shows its label + status); temporarily **stop the backend** and click a lot.
3. Expected:
   - Each lot draws its **own** real spaces (the seed gives Lot A 12 and Lot B 8); seeded disabled spaces appear grey, assigned ones blue.
   - While a lot loads you briefly see **"Loading…"**.
   - With the backend off, you see a **red error**, not a blank/crashed page.

**☁️ Cloud check (optional):** needs backend **B4** deployed and RDS seeded. `./release.sh frontend`, open the live site as admin, click through the lots — they should draw the server's real spaces, same as local.

**Commit & push:**
```bash
git add -A && git commit -m "U3: data-driven lots + spaces from API, status colours" && git push -u origin cr/u3-real-lots
```
PR base = `cr/u2-routing`.

---

### CR U4 — Make enable/disable actually save

**Depends on:** U3 and backend **B5**. **Branch off U3.**

**Goal:** when an admin disables (or re-enables) spaces, it must **persist** — survive a refresh — because it now saves to the backend instead of a browser-only list.

**Branch:**
```bash
git checkout cr/u3-real-lots
git checkout -b cr/u4-save-status
```

**Step 1 — Add an `updateSpaces` thunk to `parkingSlice.ts`.** It PATCHes the selected ids to a new status, then returns the lot id so we can re-fetch. Add the thunk next to `fetchSpaces`:
```ts
// PATCH /api/spaces  body { ids:number[], status:"available"|"disabled" }
export const updateSpaces = createAsyncThunk(
  "parking/updateSpaces",
  async (args: { lotId: number; ids: number[]; status: "available" | "disabled" }, { dispatch }) => {
    await api.patch("/api/spaces", { ids: args.ids, status: args.status });
    await dispatch(fetchSpaces(args.lotId));   // re-load the truth from the server
    return args;
  }
);
```
And handle its states in `extraReducers` (optimistic: recolour immediately, roll back on failure):
```ts
.addCase(updateSpaces.pending, (state, action) => {
  // optimistic: flip the affected spaces right away
  const { lotId, ids, status } = action.meta.arg;
  const spaces = state.spacesByLot[lotId];
  if (spaces) for (const s of spaces) if (ids.includes(s.id)) s.status = status;
})
.addCase(updateSpaces.fulfilled, (state) => {
  state.selectedSpaces = [];
  state.isEditMode = false;
  state.editAction = null;
})
.addCase(updateSpaces.rejected, (state, action) => {
  // fetchSpaces inside the thunk already reloads the real state on success;
  // on failure show the error (the re-fetch in step 1 didn't run).
  state.error = action.error.message ?? "Could not save changes";
});
```

**Step 2 — Wire the buttons in `ControlBoard.tsx`.** Replace the old `enableSelectedSpaces` / `disableSelectedSpaces` dispatches (which no longer exist) with `updateSpaces`. The **Enable** button:
```tsx
onClick={() => {
  if (selectedLotId != null)
    dispatch(updateSpaces({ lotId: selectedLotId, ids: selectedSpaces, status: 'available' }));
}}
```
The green **Done** button's disable branch:
```tsx
onClick={() => {
  if (editAction === 'disable' && selectedLotId != null) {
    dispatch(updateSpaces({ lotId: selectedLotId, ids: selectedSpaces, status: 'disabled' }));
  } else {
    dispatch(setIsEditMode(false));
  }
}}
```
Add `updateSpaces` to the import list from `./store/parkingSlice`.

**Step 3 — UI mock (after this phase).** Admin in Edit Mode, two spaces selected, about to press **Done** to disable them. After Done + refresh, those two stay grey.
```
┌──────────────────────────────────────────────────────────┐
│ LTRide                                                  ☰  │
├───────────────┬──────────────────────────────────────────┤
│ ┌───────────┐ │                       [ Cancel X ][ Done ✓]│  ← Done saves to server
│ │Admin Ctrl │ │   ▢ ▢ ▣ ▢ ▢ ▢   ▢ ▢ ▢ ▢ ▢ ▢               │
│ │ Single ▣  │ │   ▢ ▣ ▢ ▢ ▨ ▨   ▢ ▢ ▢ ▢ ▢ ▢               │  ▢ available
│ │ Group     │ │   ▢ ▢ ▢ ▢ ▢ ▢   ▣ ▢ ▢ ▢ ▢ ▢               │  ▨ selected (yellow)
│ │ Disable ▣ │ │                                            │  ▣ disabled (grey)
│ │ Enable    │ │                                            │  ▦ assigned (blue)
│ │ Manual    │ │   [Home][Lot A][Lot B]                     │
│ │ Update Map│ │                                            │
│ └───────────┘ │   Edit Mode ●——                            │
│ [👤 My Acct]  │                                       LT   │
└───────────────┴──────────────────────────────────────────┘
```

**Local testing guide:**
1. Setup: backend running (through **B5**); `npm run dev`; admin logged in.
2. Steps: toggle **Edit Mode** on → **Single Select** → click 2–3 white spaces (they turn yellow) → **Disable** → **Done ✓**; then **refresh the page**. Repeat with **Enable** to turn them back.
3. Expected:
   - Right after **Done**, the spaces turn grey **immediately** (optimistic), edit mode closes.
   - After **refresh**, they're **still grey** — it saved to the database.
   - If you stop the backend and try again, the colour change **rolls back** and a red error appears.
   - A space that's already `assigned` can't be disabled — the server returns 409 and you see the error (don't select assigned/blue spaces).

**☁️ Cloud check (optional):** needs backend **B5** deployed. `./release.sh frontend`, disable a few spaces on the live site, then **refresh** — they stay grey, proving it saved to RDS (not just your browser).

**Commit & push:**
```bash
git add -A && git commit -m "U4: persist enable/disable via PATCH /api/spaces (optimistic + rollback)" && git push -u origin cr/u4-save-status
```
PR base = `cr/u3-real-lots`.

---

### CR U5 — Student registers interest (core feature #1)

**Depends on:** U2 and backend **B6**. **Branch off U4.**

**Goal:** build the **real** student dashboard (replacing the U2 stub). A student sees overall availability, **registers interest** in a parking spot, and sees their request status (`pending` / `fulfilled`).

**Branch:**
```bash
git checkout cr/u4-save-status
git checkout -b cr/u5-student-interest
```

**Step 1 — Create `src/store/interestSlice.ts`:**
```ts
// src/store/interestSlice.ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../api/client";

export interface Interest {
  id: number;
  user_id: number;
  lot_id: number;
  lot_name?: string;
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
}

interface InterestState {
  mine: Interest | null;            // this student's current request (one active at a time)
  status: "idle" | "loading" | "error";
  error: string | null;
}

const initialState: InterestState = { mine: null, status: "idle", error: null };

// GET /api/interest/me -> Interest | null
export const fetchMyInterest = createAsyncThunk("interest/me", () => api.get("/api/interest/me") as Promise<Interest | null>);

// POST /api/interest { lotId } -> Interest
export const registerInterest = createAsyncThunk(
  "interest/register",
  (lotId: number) => api.post("/api/interest", { lotId }) as Promise<Interest>
);

const interestSlice = createSlice({
  name: "interest",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const pending = (s: InterestState) => { s.status = "loading"; s.error = null; };
    const fail = (s: InterestState, a: { error: { message?: string } }) => {
      s.status = "error"; s.error = a.error.message ?? "Something went wrong";
    };
    builder
      .addCase(fetchMyInterest.pending, pending)
      .addCase(fetchMyInterest.fulfilled, (s, a) => { s.status = "idle"; s.mine = a.payload; })
      .addCase(fetchMyInterest.rejected, fail)
      .addCase(registerInterest.pending, pending)
      .addCase(registerInterest.fulfilled, (s, a) => { s.status = "idle"; s.mine = a.payload; })
      .addCase(registerInterest.rejected, fail);
  },
});

export default interestSlice.reducer;
```

**Step 2 — Register the slice.** In `src/store/index.ts`, add it to the reducer map:
```ts
import interestReducer from "./interestSlice";
// ...
export const store = configureStore({
  reducer: {
    auth: authReducer,
    parking: parkingReducer,
    interest: interestReducer,   // <-- add
  },
});
```

**Step 3 — Replace the stub `src/StudentDashboard.tsx`** with the real screen:
```tsx
// src/StudentDashboard.tsx
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "./store";
import { logout } from "./store/authSlice";
import { fetchLots } from "./store/parkingSlice";
import { fetchMyInterest, registerInterest } from "./store/interestSlice";

export default function StudentDashboard() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const lots = useAppSelector((s) => s.parking.lots);
  const { mine, status, error } = useAppSelector((s) => s.interest);

  useEffect(() => {
    dispatch(fetchLots());
    dispatch(fetchMyInterest());
  }, [dispatch]);

  return (
    <div style={{ padding: "24px", maxWidth: "560px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Welcome, {user?.name}</h1>
        <button onClick={() => dispatch(logout())}>Logout</button>
      </div>

      <h3>Parking availability</h3>
      <ul>
        {lots.map((lot) => (
          <li key={lot.id}>{lot.name}: {lot.available_count} of {lot.capacity} available</li>
        ))}
      </ul>

      <h3>Your request</h3>
      {mine ? (
        <p>
          You requested <b>{mine.lot_name ?? `lot #${mine.lot_id}`}</b> — status:{" "}
          <b style={{ color: mine.status === "fulfilled" ? "green" : "#b80" }}>{mine.status}</b>
        </p>
      ) : (
        <div>
          <p>You haven't requested a spot yet. Pick a lot:</p>
          {lots.map((lot) => (
            <button
              key={lot.id}
              disabled={status === "loading"}
              onClick={() => dispatch(registerInterest(lot.id))}
              style={{ marginRight: "8px" }}
            >
              Register interest — {lot.name}
            </button>
          ))}
        </div>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
```

**Step 4 — UI mock (after this phase).** Before registering (left) and after (right):
```
  BEFORE registering                         AFTER registering
┌────────────────────────────────┐        ┌────────────────────────────────┐
│ Welcome, Alice        [Logout]  │        │ Welcome, Alice        [Logout]  │
│                                 │        │                                 │
│ Parking availability            │        │ Parking availability            │
│  • Lot A: 11 of 12 available    │        │  • Lot A: 10 of 12 available    │
│  • Lot B:  8 of  8 available    │        │  • Lot B:  8 of  8 available    │
│                                 │        │                                 │
│ Your request                    │        │ Your request                    │
│  You haven't requested a spot.  │        │  You requested Lot A — status:  │
│  [Register interest — Lot A]    │        │  pending                        │
│  [Register interest — Lot B]    │        │                                 │
└────────────────────────────────┘        └────────────────────────────────┘
```

**Local testing guide:**
1. Setup: backend running (through **B6**), seeded; `npm run dev`; log in as a seeded student (`STU001`).
2. Steps: read the availability list; click **Register interest — Lot A**; **refresh**; try registering a second time (the buttons should be gone, replaced by your status).
3. Expected:
   - After clicking, "Your request" shows **Lot A — pending**.
   - After **refresh**, the request is still there (loaded by `fetchMyInterest`).
   - You can't create a second active request (the register buttons disappear once you have one); if you hit the API directly the backend returns 409 and you'd see a red error.

**☁️ Cloud check (optional):** needs backend **B6** deployed. `./release.sh frontend`, log in as a student on the live site, register interest, and refresh — the request persists. (Half of the full cloud E2E; the other half lands with U6.)

**Commit & push:**
```bash
git add -A && git commit -m "U5: student dashboard + interestSlice (register + view status)" && git push -u origin cr/u5-student-interest
```
PR base = `cr/u4-save-status`.

---

### CR U6 — Admin assigns spaces (core feature #2)

**Depends on:** U5 and backend **B7**. **Branch off U5.**

**Goal:** the admin sees the list of pending student interest and **assigns** a space to a student. The space flips to `assigned` (blue) and the student's request flips to `fulfilled`.

> **📸 What's already in the prototype:** `ControlBoard.tsx` already has a **local** Manual Assign (select a space → a modal asks you to type a student ID → it writes to `assignedSpaces`) **and** a **student self-claim** flow (a student clicks an open spot, confirms a pop-up, and claims it). Both are browser-only and vanish on refresh. This CR **replaces the local Manual Assign** with the real server-backed one below: instead of *typing* a student ID, the admin picks a **pending interest request** (which already knows the student) and clicks a space. The old `assignSpace`/`unassignSpace` reducers and the type-in-ID modal can be deleted once this is wired.
>
> **What about the student self-claim?** That's a *different* idea from the plan's "student registers interest, admin assigns" flow (see [`../plan.md` §6](../plan.md#6-runtime-views-sequence-diagrams)). For now, the plan keeps **admin-assigns** as the real feature; a student-self-claim endpoint isn't in the API yet. Leave the prototype's claim UI as-is or remove it — it won't conflict with this CR. If the team decides self-claim should be the real product, that's a **new backend CR** (a student-facing `POST /api/assignments` with its own rules), not part of U6.

**Branch:**
```bash
git checkout cr/u5-student-interest
git checkout -b cr/u6-admin-assign
```

**Step 1 — Add admin thunks to `interestSlice.ts`.** The admin needs the full list plus an "assign" action. Add an interface field and these thunks:
```ts
// fields to add to InterestState:
//   all: Interest[];        // admin's full list

// GET /api/interest?status=pending  -> Interest[]
export const fetchInterest = createAsyncThunk(
  "interest/all",
  (statusFilter: string = "pending") => api.get(`/api/interest?status=${statusFilter}`) as Promise<Interest[]>
);

// POST /api/assignments { spaceId, userId, interestId }
export const createAssignment = createAsyncThunk(
  "interest/assign",
  async (args: { spaceId: number; userId: number; interestId: number; lotId: number }, { dispatch }) => {
    await api.post("/api/assignments", {
      spaceId: args.spaceId, userId: args.userId, interestId: args.interestId,
    });
    await dispatch(fetchInterest("pending"));   // refresh the pending list
    return args;
  }
);
```
Add `all: []` to `initialState` and handle `fetchInterest.fulfilled` in `extraReducers`:
```ts
.addCase(fetchInterest.fulfilled, (s, a) => { s.status = "idle"; s.all = a.payload; })
```

**Step 2 — Track the chosen request in `ControlBoard.tsx`.** When the admin clicks **Manual Assign** they first pick a request, then click a space. Use local state for the picked request:
```tsx
import { fetchInterest, createAssignment, type Interest } from './store/interestSlice';
// ...
const interestList = useAppSelector(state => state.interest.all);
const [pickedInterest, setPickedInterest] = useState<Interest | null>(null);

useEffect(() => { dispatch(fetchInterest('pending')); }, [dispatch]);
```

**Step 3 — Show the interest panel** when `editAction === 'manual'`. Add this inside the sidebar (below the control panel):
```tsx
{editAction === 'manual' && (
  <div style={{ background: '#fff', color: '#000', borderRadius: '10px', padding: '8px', fontSize: '0.8rem' }}>
    <b>Pending requests</b>
    {interestList.length === 0 && <div>None</div>}
    {interestList.map(req => (
      <div
        key={req.id}
        onClick={() => setPickedInterest(req)}
        style={{
          padding: '4px', cursor: 'pointer', borderRadius: '4px',
          background: pickedInterest?.id === req.id ? '#f5c542' : 'transparent',
        }}
      >
        #{req.user_id} → {req.lot_name ?? `lot ${req.lot_id}`}
      </div>
    ))}
    {pickedInterest && <div style={{ marginTop: '6px' }}>Now click an available space →</div>}
  </div>
)}
```

**Step 4 — Make clicking a space assign it.** In `renderParkingLot`'s `onClick`, when in manual mode with a picked request and an available space, dispatch the assignment:
```tsx
onClick={() => {
  if (isSelecting) { dispatch(toggleSpaceSelection(space.id)); return; }
  if (editAction === 'manual' && pickedInterest && space.status === 'available' && selectedLotId != null) {
    dispatch(createAssignment({
      spaceId: space.id,
      userId: pickedInterest.user_id,
      interestId: pickedInterest.id,
      lotId: selectedLotId,
    }));
    setPickedInterest(null);
    dispatch(fetchSpaces(selectedLotId));   // re-colour the lot
  }
}}
```
Add `fetchSpaces` to the parkingSlice import if it isn't already there.

**Step 5 — UI mock (after this phase).** Admin in Manual Assign: request `#1 → Lot A` is picked (yellow), about to click an available space, which then turns blue (assigned).
```
┌──────────────────────────────────────────────────────────┐
│ LTRide                                                  ☰  │
├───────────────┬──────────────────────────────────────────┤
│ ┌───────────┐ │                                            │
│ │Admin Ctrl │ │   ▢ ▢ ▦ ▢ ▢ ▢   ▢ ▢ ▢ ▢                   │  ▢ available
│ │ Manual ▣  │ │   ▢ ▢ ▢ ▢ ▢ ▢   ▢ ▢ ▢ ▢                   │  ▦ assigned (blue)
│ └───────────┘ │   ▢ ▢ ▢ ▢ ▢ ▢                              │  ▣ disabled
│ ┌───────────┐ │                                            │
│ │Pending req│ │       ↑ click any ▢ to assign it           │
│ │ #1→Lot A ▣│ │         to the picked request              │
│ │ #2→Lot B  │ │                                            │
│ │click space│ │   [Home][Lot A][Lot B]                     │
│ └───────────┘ │   Edit Mode ●——                            │
│ [👤 My Acct]  │                                       LT   │
└───────────────┴──────────────────────────────────────────┘
```

**Local testing guide:**
1. Setup: backend running (through **B7**); at least one student has registered interest (do U5's flow first, or seed it); log in as **admin**.
2. Steps: **Edit Mode** on → **Manual Assign** → click a request in "Pending requests" (it highlights yellow) → click an available (white) space in that lot.
3. Expected:
   - The clicked space turns **blue** (`assigned`); the request disappears from the pending list (now `fulfilled`).
   - Log in separately as that student → their dashboard shows **status: fulfilled**.
   - Clicking an already-assigned or disabled space does nothing; assigning when no request is picked does nothing.

**☁️ Cloud check (optional):** needs backend **B7** deployed. `./release.sh all`, then run the **full two-window E2E story (Part F2)** against the **live site** instead of localhost — student registers, admin assigns, student sees `fulfilled`. This is the real end-to-end production test.

**Commit & push:**
```bash
git add -A && git commit -m "U6: admin interest panel + Manual Assign via POST /api/assignments" && git push -u origin cr/u6-admin-assign
```
PR base = `cr/u5-student-interest`.

---

### CR U7 — Update the school map image

**Depends on:** U6 and the backend **map-upload** endpoint (`POST /api/lots/:id/map`). **Branch off U6.**

**Goal:** wire the **Update School Map** button so an admin can upload a new image for a lot. This request is **not** JSON — it's `multipart/form-data`, so it bypasses the JSON `api` helper.

> **Why a special path?** Our `api` client always sends `Content-Type: application/json` and `JSON.stringify`s the body. A file upload must instead send `FormData` and let the browser set the `Content-Type` (with the multipart boundary) itself. So we add **one** dedicated upload helper rather than forcing it through `api`.

**Branch:**
```bash
git checkout cr/u6-admin-assign
git checkout -b cr/u7-map-upload
```

**Step 1 — Add an upload helper to `src/api/client.ts`.** It reuses the token but sends `FormData`:
```ts
// add to src/api/client.ts
export async function uploadFile(path: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;   // NOTE: no Content-Type — the browser sets it
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: fd, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
  return body.data;
}
```
> `token` and `BASE` are module-level in `client.ts`, so this helper can read them directly.

**Step 2 — Add an upload thunk to `parkingSlice.ts`:**
```ts
import { api, uploadFile } from "../api/client";   // extend the existing import
// ...
// POST /api/lots/:id/map  (multipart) -> updated Lot
export const uploadLotMap = createAsyncThunk(
  "parking/uploadMap",
  async (args: { lotId: number; file: File }, { dispatch }) => {
    await uploadFile(`/api/lots/${args.lotId}/map`, args.file);
    await dispatch(fetchLots());     // refresh so the new map_url is in state
    return args.lotId;
  }
);
```
Handle its `rejected` case to surface errors:
```ts
.addCase(uploadLotMap.rejected, (state, action) => {
  state.error = action.error.message ?? "Map upload failed";
})
```

**Step 3 — Wire the button in `ControlBoard.tsx`.** Add a hidden file input and trigger it from **Update School Map**:
```tsx
import { uploadLotMap } from './store/parkingSlice';
// ...
const fileInputRef = useRef<HTMLInputElement>(null);

const onMapFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file && selectedLotId != null) dispatch(uploadLotMap({ lotId: selectedLotId, file }));
  e.target.value = "";   // allow re-choosing the same file later
};
```
Update the **Update School Map** button's `onClick` to open the picker, and add the hidden input nearby:
```tsx
<button
  style={sideButtonStyle(editAction === 'update', !isControlPanelActive)}
  onClick={() => { dispatch(setEditAction('update')); fileInputRef.current?.click(); }}
  disabled={!isControlPanelActive}
>
  Update School Map
</button>
<input
  ref={fileInputRef}
  type="file"
  accept="image/png,image/jpeg"
  style={{ display: 'none' }}
  onChange={onMapFileChosen}
/>
```

**Step 4 — UI mock (after this phase).** Pressing **Update School Map** opens the OS file picker; after a successful upload the campus image on Home refreshes.
```
┌───────────────┐        ┌─────────────────────────────┐
│ │ Single    │ │        │  Choose file to upload      │
│ │ Group     │ │        │  ┌───────────────────────┐  │
│ │ Disable   │ │  click │  │ lotA-map-2026.png   ▼ │  │
│ │ Enable    │ │ ─────▶ │  └───────────────────────┘  │
│ │ Manual    │ │        │       [Cancel]  [Open]      │
│ │ Update Map│◀┘        └─────────────────────────────┘
│ └───────────┘            (PNG/JPG only; others rejected
└───────────────┘             with a red error message)
```

**Local testing guide:**
1. Setup: backend running (with the map-upload endpoint); `npm run dev`; admin logged in.
2. Steps: **Edit Mode** on → **Update School Map** → pick a PNG/JPG → confirm. Then try a non-image (e.g. a `.txt`) or an oversized file.
3. Expected:
   - A valid image uploads; after the `fetchLots` refresh the new map shows on the Home view.
   - A non-image or too-large file → the server rejects it (400/413) and you see a **red error**, no crash.

**☁️ Cloud check (optional):** needs the backend map-upload endpoint deployed. `./release.sh all`, upload an image on the live site. **Heads-up:** large uploads can hit nginx's `client_max_body_size` limit (default 1 MB → `413`). If real photos are rejected in the cloud but work locally, raise that limit in the nginx config (**Part 3 / nginx config** in the backend guide).

**Commit & push:**
```bash
git add -A && git commit -m "U7: admin map upload via multipart POST /api/lots/:id/map" && git push -u origin cr/u7-map-upload
```
PR base = `cr/u6-admin-assign`.

---

### CR U8 — Place & arrange parking spots (drag-and-drop layout editor)

**Depends on:** U7 and backend **B8** (`PUT /api/lots/:id/layout` — persist a lot's spot layout). **Branch off U7.**

**Goal:** today a spot's position on the map is **source code** — three hand-tuned tables (`LOT_CONFIGS`, `LOT_MAP_CONFIGS`, `LOT_FAN_CONFIGS`) that only a developer can change. Make positions **data an admin authors in the browser**: add a spot by clicking the map, drag it to place, rotate/delete it, and **Save Layout** to the server so it survives refresh and shows for everyone.

> **Big idea / what changes:** a spot's position becomes **normalized** coordinates — `x`/`y` are fractions `0..1` of the map image (plus `rotation` in degrees), so the same numbers place the spot identically at any zoom or screen size (the same instinct as the existing `MAP_DISPLAY_SCALE` math, promoted to real data). Lots **with** a saved layout render from it; lots **without** one keep rendering from the existing config tables — no regression.

> **📸 What's already in the prototype:** the three hard-coded position tables and the `MAP_ONLY_LOTS` set stay exactly as-is — they become the *fallback*. This CR adds a higher-priority path that draws from server `x`/`y` when present. Nothing from U3–U7 is removed.

**Backend contract (B8):**
- `GET /api/lots/:id/spaces` gains optional `x`, `y` (floats `0..1`) and `rotation` (degrees) per space; legacy spaces send `null`.
- `PUT /api/lots/:id/layout` — admin only. Body `{ spaces: [{ id?, label, x, y, rotation? }] }`. **Replaces** the lot's spot set in one transaction (entries with `id` updated, without `id` created, missing existing ids deleted); refuses to delete an `assigned` space (`409`). Returns the updated `Space[]`.

**Branch:**
```bash
git checkout cr/u7-map-upload
git checkout -b cr/u8-arrange-spots
```

**Step 1 — Extend the `Space` type and add a `saveLayout` thunk in `parkingSlice.ts`.** Add `x?`, `y?`, `rotation?` to `Space`, add an `"arrange"` value to the `EditAction` union, and (if missing) a `put` method to `client.ts`. Then:
```ts
// PUT /api/lots/:id/layout  body { spaces:[{id?,label,x,y,rotation?}] } -> Space[]
export const saveLayout = createAsyncThunk(
  "parking/saveLayout",
  async (args: { lotId: number; spaces: Array<Pick<Space, "id" | "label" | "x" | "y" | "rotation">> }, { dispatch }) => {
    await api.put(`/api/lots/${args.lotId}/layout`, { spaces: args.spaces });
    await dispatch(fetchSpaces(args.lotId));   // reload the server's truth
    return args.lotId;
  }
);
```
Handle `saveLayout.rejected` to surface the 409/error into `state.error`.

**Step 2 — Add an "Arrange Spots" edit action + an editable canvas in `ControlBoard.tsx`.** A new sidebar button dispatches `setEditAction('arrange')`. While arranging, hold the working layout in local state (`draft`, seeded from `spacesByLot[selectedLotId]`) and measure the map wrapper with a `ref`. Convert a mouse point to a fraction, render each draft spot absolutely-positioned, and wire click-to-add + pointer-capture drag. (Full code — the `toNorm` helper, `renderArrangeCanvas`, and pointer handlers — is in [Lesson U8](lessons/U8-place-and-arrange-spots.md#step-2--add-the-arrange-spots-mode-and-an-editable-canvas-25-min).)

**Step 3 — Add rotate, delete, and Save Layout; render saved layouts in normal view.** A small toolbar (shown only while arranging) rotates/deletes the picked spot and, on **Save Layout**, maps the draft to the PUT body (dropping temporary negative ids so the server creates those spaces) and dispatches `saveLayout`. Update `renderParkingLot` to prefer a saved layout (`spaces.some(s => s.x != null)`) — a read-only version of the arrange canvas — and otherwise fall through to the existing config/fan rendering.

**UI mock (after this phase):** the selected lot's map becomes an editable canvas — click to add, drag to move, a picked spot outlined in gold, a toolbar to rotate/delete/save.
```
┌──────────────────────────────────────────────────────────┐
│ LTRide                                       [Cancel][Done]│
├───────────────┬──────────────────────────────────────────┤
│ ┌───────────┐ │   ┌───────────── lot map ──────────────┐  │
│ │Admin Ctrl │ │   │   ▭   ▭   ▭        ▭   ▭            │  │  ▭ spot
│ │ Arrange ▣ │ │   │     ▧◀picked (drag me)   ▭          │  │  ▧ picked
│ └───────────┘ │   │   ▭     click empty map = add ↑     │  │
│ ┌───────────┐ │   └────────────────────────────────────┘  │
│ │ Rotate15° │ │                                            │
│ │ Delete    │ │   [Home][Lot A][Lot B][North Lot]          │
│ │ [Save Lay]│ │   Edit Mode ●——                            │
│ └───────────┘ │                                       LT   │
└───────────────┴──────────────────────────────────────────┘
```

**Local testing guide:**
1. Setup: backend running through **B8** (seeded); `npm run dev`; admin logged in; a lot selected.
2. Steps: **Edit Mode** → **Arrange Spots** → click the map to add spots → drag one → pick it, **Rotate 15°**, **Delete** another → **Save Layout**; then **refresh** and **resize the window**.
3. Expected:
   - Click-to-add drops a spot where you clicked; drag moves it and it stays on release; rotate/delete work.
   - After **Save Layout** the spots render in place; after **refresh** they're unchanged (persisted); after **resize** they stay put relative to the map (normalized coords).
   - Deleting an **assigned** spot and saving surfaces a red error (`409`) — nothing lost.
   - A never-arranged lot still draws via the old config tables.

**☁️ Cloud check (optional):** needs backend **B8** deployed. `./release.sh all`, arrange a lot on the live site, **refresh** — the layout persists in RDS; a second browser sees the same arrangement (it's server data now).

**Commit & push:**
```bash
git add -A && git commit -m "U8: drag-and-drop spot layout editor + saved layouts (PUT /api/lots/:id/layout)" && git push -u origin cr/u8-arrange-spots
```
PR base = `cr/u7-map-upload`.

---

### CR U9 — Add a new parking lot from the admin UI

**Depends on:** U8 and backend **B9** (`POST /api/lots` — create a lot). **Branch off U8.**

**Goal:** today the lot list is a hard-coded `Home + Lot 1..17` loop — there's no way to add lot 18 without editing code. Let an admin click **➕ Add Lot**, name it (optional capacity), and get a real new lot that appears in the nav immediately and is auto-selected, ready to receive its map (U7) and arranged spots (U8).

> **📸 What's already in the prototype:** since **U3** the bottom nav is `lots.map(...)` fed by `fetchLots()`, not the hard-coded list. So a newly created lot appears for free once `fetchLots()` re-runs; this CR just adds the create path.

**Backend contract (B9):** `POST /api/lots` — admin only. Body `{ name, capacity?, display_order? }`. Creates the lot (and, if `capacity` given, that many positionless `available` spaces to place in U8). Returns the new `Lot`. Rejects blank/duplicate `name` with `400`/`409` and the standard error envelope.

**Branch:**
```bash
git checkout cr/u8-arrange-spots
git checkout -b cr/u9-add-lot
```

**Step 1 — Add a `createLot` thunk to `parkingSlice.ts`** (next to `fetchLots`): POST the body, `await dispatch(fetchLots())` to refresh the nav, and return the new `Lot`. In `extraReducers`, set `state.selectedLotId = action.payload.id` on `createLot.fulfilled` (land on the new lot) and write the message to `state.error` on `rejected`.

**Step 2 — Add the button + Create Lot modal in `ControlBoard.tsx`.** An **➕ Add Lot** button inside the `isAdmin` control panel (admin-only; not gated by Edit Mode) opens a modal mirroring U6's Manual Assign modal: a required **Name** and optional **Capacity**, a red inline error from `state.error`, and a **Create** button disabled until the name is non-blank. On click, `await dispatch(createLot(...))` and close the modal only if `createLot.fulfilled.match(res)` — so a rejected create keeps the modal open with the error. (Full modal JSX is in [Lesson U9](lessons/U9-add-a-parking-lot.md#step-2--add-the-button-and-the-create-lot-modal-in-controlboardtsx-20-min).)

**Step 3 — Hand off to map + arrange.** `createLot.fulfilled` already selected the new lot, so the canvas switches to it. Show a hint when the selected lot has no spaces yet, pointing the admin at **Update School Map** (U7) then **Arrange Spots** (U8).

**UI mock (after this phase):** ➕ Add Lot opens a create modal; after Create the nav gains the lot, selects it, and a next-step hint appears.
```
   click ➕ Add Lot                 after Create
┌───────────────┐        ┌────────────────────────────┐
│ │➕ Add Lot  │◀─────── │  Create Parking Lot         │
│ │ Single    │ │        │  Name     [North Lot____]   │
│ │ Arrange   │ │        │  Capacity [ 20 ]            │
│ └───────────┘ │        │        [Cancel] [Create]    │
└───────────────┘        └────────────────────────────┘
  ▶ nav: [Home][Lot A]…[Lot 17][North Lot]  ← new, selected
```

**Local testing guide:**
1. Setup: backend running through **B9** (seeded); `npm run dev`; admin logged in.
2. Steps: **➕ Add Lot** → name `North Lot`, capacity `10` → **Create**; then try a **blank** name and a **duplicate** name; **refresh**; log in as a **student**.
3. Expected:
   - The new lot appears in the nav immediately and is selected; the next-step hint shows.
   - Blank name disables **Create**; a duplicate name shows a red error and the modal stays open.
   - After **refresh** the lot is still listed (persisted); you can Update School Map (U7) + Arrange Spots (U8) on it.
   - A **student** never sees ➕ Add Lot.

**☁️ Cloud check (optional):** needs backend **B9** deployed. `./release.sh all`, create a lot live, **refresh** — persists in RDS; a second browser sees it. Full loop: create → map (U7) → arrange (U8) → student sees it in availability.

**Commit & push:**
```bash
git add -A && git commit -m "U9: admin creates a new lot (POST /api/lots) + hand off to map/arrange" && git push -u origin cr/u9-add-lot
```
PR base = `cr/u8-arrange-spots`.

---

## Part F2 — End-to-end (E2E) test: the whole system together

Up to now each CR's "Local testing guide" checked **one slice** of the app. An **end-to-end test** is different: you run the **real backend and the real frontend at the same time** and click through the *entire* story a real user would — student asks for a spot, admin grants it, student sees it granted. If that works, the pieces fit together.

> Do this E2E pass at least once after **U6** is merged (the first point where both core features exist), and again before any release.

### Step 1 — Start the backend (Terminal 1)

In the **backend** repo (`~/workspace/LTR-Backend`):
```bash
cd ~/workspace/LTR-Backend
# make sure PostgreSQL is running (see backend guide B2 "Installing and starting PostgreSQL")
brew services start postgresql@16        # or @17, whichever you installed

source .venv/bin/activate                 # the virtualenv from backend Part 0
# fresh, known data: re-run the schema + seed so emails/codes are predictable
psql "$DATABASE_URL" -f webapp/sql/migrations/001_init.sql
psql "$DATABASE_URL" -f webapp/sql/seed.sql

export FLASK_APP=webapp.App
flask run --port 8000
```
Leave this running. Quick check in a **third** terminal (or your browser):
```bash
curl -s http://localhost:8000/api/health
# expect: {"data":{"status":"ok"}}
```

### Step 2 — Start the frontend (Terminal 2)

In the **frontend** repo (`~/workspace/LT_Proj/lt-parking-site-project`):
```bash
cd ~/workspace/LT_Proj/lt-parking-site-project
# .env must point at the backend you just started:
#   VITE_API_URL=http://localhost:8000
npm run dev
```
Open the printed URL (usually `http://localhost:5173`).

> **CORS reminder:** the backend's `CORS_ORIGINS` must include `http://localhost:5173`. If the browser console shows a CORS error, fix it in the backend's `.env` and restart Terminal 1 (backend guide B0/B1).

### Step 3 — Walk the full story (two browser windows)

Use a normal window **and** a private/incognito window so a student and an admin can be logged in at the same time.

| # | Window | Action | Expected |
|---|--------|--------|----------|
| 1 | Normal | Log in as student `STU001` | Lands on `/student`, sees availability list |
| 2 | Normal | Click **Register interest — Lot A** | "Your request: Lot A — **pending**" |
| 3 | Incognito | Log in as admin (`admin` / `admin123`) | Lands on `/admin`, sees the lot map |
| 4 | Incognito | Edit Mode → **Manual Assign** → pick request `#…→Lot A` → click a white space | That space turns **blue**; request leaves the pending list |
| 5 | Normal | **Refresh** the student window | "Your request: Lot A — **fulfilled**" ✅ |
| 6 | Incognito | Edit Mode → select the same space → **Disable** → Done, then refresh | (Negative check) an *assigned* space can't be disabled — red error / 409 |

If steps 1–5 all pass, the **core end-to-end flow works**: the student's request travelled through the API into PostgreSQL, the admin's assignment updated three tables in one transaction, and the student saw the result on a fresh load — all across two separate browser sessions hitting the live backend.

### Step 4 — Tear down

- Terminal 2: `Ctrl-C` to stop Vite.
- Terminal 1: `Ctrl-C` to stop Flask. Optionally `brew services stop postgresql@16`.

### If something fails mid-flow

- **Student request never appears for the admin** — confirm both are pointed at the *same* backend (`VITE_API_URL`) and the admin's list filter is `pending`.
- **"Failed to fetch" / CORS** — backend not running, wrong `VITE_API_URL`, or `CORS_ORIGINS` missing `http://localhost:5173`.
- **Assignment "succeeds" but student still sees pending** — you forgot to refresh, or the backend transaction didn't update the interest row (check backend B7).
- Re-running Step 1's migrate+seed gives you a clean slate any time the data gets messy.

---

## Part F3 — Deployment (frontend)

> **Scope.** This covers only how the **React SPA is built and served in production**. The AWS infrastructure it runs on — EC2, RDS, nginx/systemd, CloudFormation, DNS/TLS, and the cost model — lives in the [deployment guide](../deploy/deployment-guide.md): the [step-by-step (Part 1)](../deploy/deployment-guide.md#part-1--deploy-to-aws-step-by-step-crs-d0d4) and the [reference (Part 3)](../deploy/deployment-guide.md#part-3--reference-architecture-iac--cost-model). The runnable scripts/templates live in the repo-root [`deploy/`](../../deploy/README.md) folder.

### F3.1 What "deploying the frontend" means

The frontend is **static files**. `npm run build` compiles the app into a `dist/` folder (HTML + hashed JS/CSS + assets); there is no Node server in production. Those files are copied onto the same EC2 box and **nginx serves them directly**, while `/api/*` requests are proxied to the Flask backend. There's nothing to "restart" for a frontend release — you just replace the files.

```
npm run build ──▶ dist/ ──(rsync / release.sh)──▶ /var/www/ltride on EC2 ──▶ nginx serves it
                                                                    └─ /api/* ─▶ gunicorn (Flask)
```

### F3.2 Build for production

```bash
cd ~/workspace/LT_Proj/lt-parking-site-project
# Point the build at the PUBLIC API URL (NOT localhost) — baked in at build time:
VITE_API_URL=https://<your-domain> npm run build
# output: dist/  (this is the entire deployable artifact)
npm run preview        # optional: serve dist/ locally to sanity-check the prod build
```

- **`VITE_API_URL` is baked in at build time**, not read at runtime. If the API URL changes, you must **rebuild**. Use `https://<your-domain>` for production (never `http://localhost:8000`).
- Keep prod values in `.env.production` (committed without secrets — Vite only exposes `VITE_*`) so `npm run build` picks them up automatically.

### F3.3 How it gets onto the server

You normally don't copy files by hand — the repo-root [`deploy/release.sh`](../../deploy/release.sh) does the frontend release for you:

```bash
./deploy/release.sh frontend    # builds with the prod VITE_API_URL, rsyncs dist/ to nginx
./deploy/release.sh all         # backend + frontend together
```

The equivalent manual step (for debugging) is an `rsync` of `dist/` to `/var/www/ltride` on the box — see [deployment guide §B.7](../deploy/deployment-guide.md#b7-build--place-the-frontend).

### F3.4 nginx: static files + SPA fallback + API proxy

Two rules matter for a React SPA, both already in the shipped nginx config ([`deploy/server/nginx-ltride.conf`](../../deploy/server/nginx-ltride.conf)):

- **SPA fallback** — unknown paths must return `index.html` so client-side routing (React Router from [U2](#cr-u2--routing-real-pages-with-urls)) works on deep links / refresh: `try_files $uri /index.html;`. Without this, refreshing `/admin` returns a 404.
- **API proxy** — `location /api/ { proxy_pass http://127.0.0.1:8000; ... }` keeps the SPA and API on the **same origin** in production, so there are no CORS issues and no `VITE_API_URL` cross-origin config needed (you can even build with a relative `/api`).

### F3.5 Cache busting

Vite fingerprints asset filenames (e.g. `index-a1b2c3.js`), so browsers safely cache them forever; only `index.html` must not be cached (it references the new hashes). If you add cache headers, set `Cache-Control: no-cache` for `index.html` and long-lived immutable caching for the hashed assets.

### F3.6 Frontend deployment checklist

1. `VITE_API_URL` points at the **production** URL (or a relative `/api`), not localhost.
2. `npm run build` succeeds; `npm run preview` renders and can log in against the prod API.
3. Deep-link + refresh on a protected route works (SPA fallback in nginx).
4. After `release.sh frontend`, hard-refresh the site and confirm the new build loads (check a changed string / the network tab hashes).

---

## Part G — When something goes wrong

- **Red text in the terminal running `npm run dev`** — read the top line; it usually names the file and line number. Fix and save; it reloads.
- **Blank white page** — open the browser, right-click → **Inspect** → **Console** tab; the red error there tells you what broke.
- **"CORS" error in the console** — the backend isn't allowing your origin. Make sure the backend is running and its `CORS_ORIGINS` includes `http://localhost:5173` (backend guide).
- **"Failed to fetch"** — the backend isn't running, or `VITE_API_URL` in `.env` is wrong.
- **You made a mess and want to undo uncommitted changes to a file:** `git checkout -- path/to/file`.
- **You committed on the wrong branch:** ask before doing anything destructive; the safe move is usually to create the correct branch from here: `git checkout -b cr/correct-name`.

---

## Part H — Daily checklist

1. `cd ~/workspace/LT_Proj/lt-parking-site-project`
2. `git status` (am I on the right branch? any leftover changes?)
3. `npm run dev` (start the site)
4. Make small changes → save → check the browser.
5. `git add -A && git commit -m "..."` often.
6. `git push` when the CR is ready → open the PR with the right base branch.

---

## Appendix — Frontend architecture reference

> **Moved here from `plan.md §7.2` / §7.3** as part of the doc reorg — this is the frontend design detail behind the step-by-step CRs above. The master plan links here from [`../plan.md §7`](../plan.md#7-implementation-details-live-in-the-two-guides); the per-endpoint request/response contracts this code calls live in the backend guide's [API Reference](../backend/backend-development-guide.md#appendix-a--backend-api-reference-v1).

### A. Module structure (target)

The React SPA is organised as a thin **API client**, three Redux **slices**, and route-guarded **pages**. The static module view is diagrammed in [`../plan.md §5.3`](../plan.md#53-frontend-module-structure); the file-by-file target layout (tagged by the CR that adds each file) is in [Part D → "The target"](#the-source-structure-youre-building-toward) above.

### B. Design conventions

- **API client** (`src/api/client.ts`): a single `fetch` wrapper. Base URL from `import.meta.env.VITE_API_URL`; attaches the `Authorization: Bearer <token>` header; unwraps the success envelope `{data: ...}`; turns the backend's `{error:{message}}` into a thrown `Error` so callers can `try/catch`. It is the **one place** that talks to the backend (built in **U0**).
- **State (Redux Toolkit):** convert slices to use **`createAsyncThunk`** for every server call; keep pure-UI state (`selectedLotId`, `isEditMode`, `selectedSpaces`) local to the slice, not on the server. Slices: `authSlice` (**U1**), `parkingSlice` (**U3/U4**), `interestSlice` (**U5/U6**).
- **Routing:** `react-router-dom` with routes `/login`, `/student`, `/admin`; a `ProtectedRoute` reads `auth.isLoggedIn` + `auth.user.role` and redirects (**U2**).
- **Data-driven map:** the prototype already draws all 17 lots from a hard-coded `LOT_CONFIGS` table (photo crops + curved/radial layouts). Keep that layout/photo code; replace only the **space data** with spaces fetched from `GET /api/lots/:id/spaces`, rendering `label`/`status` from the server (**U3**). Keep the existing pan/zoom for the "Home" campus map.
- **Authored layouts (positions as data):** spot *positions* start as those hard-coded tables but become **normalized `x`/`y`/`rotation` fields** (`0..1` of the map image) an admin edits via a drag-and-drop editor and saves with `PUT /api/lots/:id/layout` (**U8**). A lot with a saved layout renders from it; a lot without one falls back to the config tables — the tables are never deleted, just demoted to a default. Lots themselves are created from the UI via `POST /api/lots` (**U9**), so the lot set is no longer fixed at 17.
- **UX states:** loading spinners, empty states ("No spaces available" only when truly empty), error toasts, and **optimistic updates with refetch on failure** (**U4**).

### C. Cross-cutting (frontend side)

- **Config:** a local `.env` holds `VITE_API_URL`; commit `.env.example`, never the real `.env`. See **U0**.
- **Token storage:** the JWT is held in-memory in `client.ts` with a `localStorage` copy so a refresh doesn't log you out; on app load, `fetchMe()` re-validates it via `GET /api/auth/me` and falls back to logged-out if the token is stale (**U1**). *(If the backend is later changed to serve the SPA from the same origin, an httpOnly cookie becomes an option — see [`../plan.md §11` open decisions](../plan.md#11-open-decisions-to-confirm).)*
- **Observability (client side):** on any failed API call, log `method path → status` to the browser console via the `api` client's error path, and surface a user-visible toast rather than crashing. This is the frontend end of the request trace whose backend half is the Flask access log (backend guide, `ltride.service`).

### D. Where each piece is built

| Concern | Slice / file | CR |
|---|---|---|
| API client + token | `src/api/client.ts` | [U0](#cr-u0--project-hygiene-foundation-no-visible-change) |
| Auth (login/session) | `authSlice.ts`, `Login.tsx`, `App.tsx` | [U1](#cr-u1--real-login-replaces-the-fake-login) |
| Routing + guards | `main.tsx`, `App.tsx`, `ProtectedRoute.tsx` | [U2](#cr-u2--routing-real-pages-with-urls) |
| Lots/spaces data | `parkingSlice.ts`, `ControlBoard.tsx` | [U3](#cr-u3--show-real-lots-and-spaces-data-driven-map) |
| Persist enable/disable | `parkingSlice.ts` (`updateSpaces`) | [U4](#cr-u4--make-enabledisable-actually-save) |
| Student interest | `interestSlice.ts`, `StudentDashboard.tsx` | [U5](#cr-u5--student-registers-interest-core-feature-1) |
| Admin assignment | `interestSlice.ts`, `ControlBoard.tsx` | [U6](#cr-u6--admin-assigns-spaces-core-feature-2) |
| Map upload | `client.ts` (`uploadFile`), `parkingSlice.ts` | [U7](#cr-u7--update-the-school-map-image) |
| Arrange spots (drag-drop layout) | `parkingSlice.ts` (`saveLayout`), `ControlBoard.tsx` | [U8](#cr-u8--place--arrange-parking-spots-drag-and-drop-layout-editor) |
| Add a parking lot | `parkingSlice.ts` (`createLot`), `ControlBoard.tsx` | [U9](#cr-u9--add-a-new-parking-lot-from-the-admin-ui) |
