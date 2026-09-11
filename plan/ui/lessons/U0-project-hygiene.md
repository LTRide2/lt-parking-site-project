# Lesson U0 — Project hygiene (foundation)

> **Track:** Frontend · **Lesson 1 of 10**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** gentle (no visible change yet — this is the plumbing later lessons need)
> **🧩 Prerequisites:** you've done the UI guide's [Part A — One-time setup](../ui-development-guide.md#part-a--one-time-setup-do-this-once) (VS Code, Node.js LTS, Git installed; `npm install` already run once in the project). It helps if the backend from the Backend track is runnable too, though this lesson doesn't call it yet.
> **🌿 CR branch:** `cr/u0-hygiene` (off `main`) · **📄 Source CR:** [CR U0](../ui-development-guide.md#cr-u0--project-hygiene-foundation-no-visible-change) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

The plumbing every later frontend lesson needs, **without changing what the user sees yet.** Concretely, by the end of this hour you will have:

- [`react-router-dom`](GLOSSARY.md#react-router) installed (you won't use it until Lesson U2, but the foundation goes in now).
- A local `.env` and a committed `env.example.txt` template, both holding the backend's address (and the mock toggle) — never hard-coded in your components.
- `src/api/client.ts` — the **one place** in the whole app that talks to the backend: it attaches the [login token](GLOSSARY.md#jwt), unwraps the response [envelope](GLOSSARY.md#envelope), and turns backend errors into JavaScript `Error`s you can `try/catch`.
- A clean `npm run lint` and `npm run build` — proof the app still compiles.

**✅ Done when (your deliverable checklist):**
- [ ] `npm run dev` shows the site looking and behaving **exactly as before** — same fake Student/Admin login.
- [ ] `src/api/client.ts` exists and exports `api` (with `get`/`post`/`patch`/`del`) and `setToken` — this lesson's starting surface; `put` (U8) and a separate `uploadFile()` (U7) land later in the same file.
- [ ] `.env` exists locally with `VITE_API_URL=http://localhost:8000` and `VITE_USE_MOCK=true`; the committed `env.example.txt` template has the same lines and **is** tracked by Git; `.env` is **not**.
- [ ] `npm run lint` and `npm run build` both finish with **no errors**.
- [ ] Your work is committed on branch `cr/u0-hygiene` and pushed, PR base = `main`.

**🖼 What changes on screen:** Nothing — this lesson is invisible plumbing; the site looks and behaves exactly as before. (Later lessons show before/after wireframes.)

---

## 🤔 Why this lesson matters

Every one of the next seven lessons needs to call the backend — logging a student in (U1), loading real parking lots (U3), saving admin changes (U4), and so on. If every [component](GLOSSARY.md#component) wrote its own [`fetch`](GLOSSARY.md#fetch)(...) call, you'd end up repeating the same token-attaching, error-unwrapping code seven times, and a bug in one copy wouldn't be a bug in the others.

So before touching a single visible screen, we build the **plumbing** once:

1. **One [API](GLOSSARY.md#api) client.** Every network call in the app goes through `src/api/client.ts`. Fix a bug there, and it's fixed everywhere. This is the same "don't repeat yourself" instinct that makes the backend's `config.py` read secrets in one place instead of scattering them through the code.
2. **Config in the environment, not in the code.** The backend's address (`http://localhost:8000` on your laptop, something else once it's deployed) is a **setting**, not a fact baked into your components. It lives in `.env` so it can change per-environment without touching a single line of TypeScript.
3. **Install dependencies before you need them.** `react-router-dom` isn't used until Lesson U2, but installing it now means U2 is only about *routing*, not *also* fighting a fresh install.

This lesson is intentionally invisible — nothing on screen changes. That's the point: you're pouring the foundation before the walls go up.

---

## 🧠 Concepts you'll meet

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Vite** | The build tool that runs your dev server and bundles the app; it also decides which environment variables reach your browser code. | [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode) |
| **TypeScript** | JavaScript with types added, so mistakes (like a missing field) are caught before you run the code. | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) |
| **ESLint** | A linter — it reads your code without running it and flags likely mistakes and style issues. | [ESLint: Getting Started](https://eslint.org/docs/latest/use/getting-started) |
| **react-router-dom** | The library that maps browser URLs to React screens (you'll wire it up in Lesson U2). | [React Router docs](https://reactrouter.com/en/main) |
| **Fetch API** | The browser's built-in way to make network requests — what `client.ts` uses under the hood. | [MDN: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) |
| **`localStorage`** | A small key-value store in the browser that survives a page refresh — where we'll park the login token. | [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) |
| **[Environment variable](GLOSSARY.md#environment-variable)** | A named setting read from *outside* the program at run time. | [Wikipedia: Environment variable](https://en.wikipedia.org/wiki/Environment_variable) |

---

> **New words ahead?** Every bolded term below links to the [**Glossary**](GLOSSARY.md) the first time it appears — click any you don't know, read the one-sentence version, and jump back. You never have to memorize a term before the lesson uses it.

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → install the router (5) → environment config (10) → build the API client (25) → verify it compiles (5) → test & commit (10).

**Get the code.** The frontend is its own repo: **[`github.com/LTRide2/lt-parking-site-project`](https://github.com/LTRide2/lt-parking-site-project)** (locally `~/workspace/LT_Proj/lt-parking-site-project`). If you haven't cloned it yet, do the [UI guide → A3](../ui-development-guide.md#a3-get-the-project-onto-your-computer) step first. This is a *different* repo from the backend (`LTR-Backend`, which also holds these lesson docs).

**Open your terminal, move into the project folder, and make your branch.** In the stacked-CR workflow each lesson lives on its own branch; U0 starts from `main`.

**macOS / Linux (bash/zsh):**
```bash
cd ~/workspace/LT_Proj/lt-parking-site-project   # the frontend repo
git checkout main
git pull
git checkout -b cr/u0-hygiene
```

**Windows (PowerShell):**
```powershell
cd $HOME\workspace\LT_Proj\lt-parking-site-project   # the frontend repo
git checkout main
git pull
git checkout -b cr/u0-hygiene
```

The three `git` commands are identical on every platform — only the path syntax differs (`~` and `/` on Unix, `$HOME` and `\` in PowerShell). Every `git`, `node`, and `npm` command in this lesson is cross-platform; the only steps that genuinely differ are the two below (the `.gitignore` one-liner and the deploy script), which show both forms.

**What this does & why:** `git checkout main` + `git pull` make sure you're branching from the *latest* shared code, and `checkout -b` creates and switches to your own branch so your changes are isolated and reviewable as one small unit. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Install the router (~5 min)

You won't use this until Lesson U2, but installing it now keeps the foundation in one place:

```bash
npm install react-router-dom
```

**What this does:** [`npm`](GLOSSARY.md#npm) `install <package>` downloads the library into `node_modules/` and adds it (with its version) to `package.json`, so anyone who clones the project and runs `npm install` gets the same dependency. → Reference: [npm install docs](https://docs.npmjs.com/cli/v10/commands/npm-install).

### Step 2 — Create the environment file (~10 min)

In the project root (next to `package.json`), create a file named `.env`:

```dotenv
# the backend's address — a setting, not a fact baked into your components
VITE_API_URL=http://localhost:8000
VITE_USE_MOCK=true
```

The committed template is `env.example.txt` (no leading dot, `.txt` extension so it's always tracked) — it already ships in the repo with the same two lines, so the next person knows the settings exist without seeing anyone's real value:

```dotenv
# same line as .env, but committed — so the next person knows the setting exists
VITE_API_URL=http://localhost:8000
VITE_USE_MOCK=true
```

Then keep your real `.env` out of Git. The shipped repo currently leaves `.env` **untracked but not ignored**, so add it to `.gitignore` to be safe:

**macOS / Linux (bash/zsh):**
```bash
grep -q '^\.env$' .gitignore || echo '.env' >> .gitignore   # exact-match check; append ".env" only if it's missing (safe to run twice)
```

**Windows (PowerShell):**
```powershell
if (-not (Select-String -Path .gitignore -Pattern '^\.env$' -Quiet)) { Add-Content .gitignore '.env' }
```

Both are the same safe "add-it-only-if-it's-missing" idiom; running either twice does nothing the second time. (Simplest of all: just open `.gitignore` in your editor and add a line containing `.env`.)

**Why it works & further reading:**
- **Why `VITE_` at the front?** [Vite](GLOSSARY.md#vite) only exposes [environment variables](GLOSSARY.md#environment-variable) that start with `VITE_` to your browser code (via `import.meta.env`) — a safety rail so you don't accidentally ship a secret to every visitor's browser. → Reference: [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode).
- The anchored pattern (`^\.env$`) matches the line **exactly**, not as a substring — so it can't accidentally also match `.env.example` or `.env.local`. → Reference: [gitignore pattern format](https://git-scm.com/docs/gitignore#_pattern_format).
- **Windows equivalent** — `Select-String -Quiet` is the `grep -q` counterpart (true/false) and `Add-Content` is the `>>` append; `if (-not (...))` is the same "only if missing" guard.

### Step 3 — Build the API client (~25 min)

Create `src/api/client.ts`. This is the **one place** in the app that talks to the backend — it attaches the login token, unwraps the `{data: ...}` envelope, and turns the backend's `{error:{message}}` into a thrown `Error` so callers can `try/catch`:

```ts
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
```

**Why it works & further reading:**
- **`?? "http://localhost:8000"`** — the "nullish coalescing" operator: falls back if the [environment variable](GLOSSARY.md#environment-variable) is missing, instead of crashing. → Reference: [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode).
- **`string | null`** — a [TypeScript](GLOSSARY.md#typescript) **union type**: this value is either a string or `null`, and TypeScript will remind you to check before using it as a string. → Reference: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html).
- **`async function request(...)`** — `async` means the function returns a `Promise` and can use `await` inside it. → Reference: [MDN: async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function).
- **Template literals** (the backtick strings with `${...}` inside) build strings like `"Bearer <token>"` and `${BASE}${path}` without manual concatenation.
- **`await fetch(...)`** — the actual network call, using the browser's built-in Fetch API; `{ ...options, headers }` spreads the caller's options, then overrides `headers` with the ones just built. → Reference: [MDN: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
- **`res.ok`** is `true` only for 2xx status codes — the one check that decides success vs. a thrown `Error` any caller can `try/catch`.
- **`api = { get, post, patch, del }`** — one small function per [HTTP method](GLOSSARY.md#http-methods) you'll need; every future lesson calls `api.get(...)`, `api.post(...)`, etc.

> **Heads-up — this is `client.ts`'s starting surface, not its final one.** The same "one place" file keeps growing as later lessons need more from it: **U7** adds a separate `uploadFile()` export for multipart uploads (a plain JSON `api` call can't carry binary data), and **U8** adds a `put` method for full-resource replacement. The shipped file also carries a `USE_MOCK` flag (**on** by default) that routes every call to an in-memory [mock backend](GLOSSARY.md#mock-backend) instead of real `fetch` — so the whole app runs standalone, without a live server — plus a `log()` call on every request/response for visibility. None of that changes how you call `api.get`/`api.post`/etc. today; it's just what the file becomes.

### Step 4 — Verify it compiles (~5 min)

No behavior has changed yet — this just proves nothing broke:

```bash
npm run lint
npm run build
```

**What this does:** `npm run lint` runs [ESLint](GLOSSARY.md#eslint) over the whole project looking for likely mistakes; `npm run build` runs the TypeScript compiler (`tsc`) and then Vite's production bundler — this is a **stricter** check than the dev server, so it catches type errors `npm run dev` might let slide. Both should finish with no errors. → References: [ESLint: Getting Started](https://eslint.org/docs/latest/use/getting-started), [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html).

---

## 🧪 Prove it works — testing guide

**Setup:**
```bash
npm install
npm run dev
```

**Steps:** open the site at the address printed in your terminal (e.g. `http://localhost:5173`); click **Student** and **Admin**; click around the existing fake login same as always.

**Expected:** the app looks and behaves **exactly as before** — no visible change, you only added files. Then confirm the compile checks are clean:

```bash
npm run lint
npm run build
```

Both commands should finish with **no errors**.

**☁️ Cloud check (optional):** `git push` then `./release.sh frontend` from the backend repo's `deploy/` folder. `release.sh` is a shell script, so on **Windows** run it from **Git Bash** or **WSL** (PowerShell can't execute `.sh` directly); macOS/Linux run it in any terminal. There's nothing new to *see* on the live site, but a clean build + deploy proves the **production** build still works — the cloud build is stricter than `npm run dev` because it also runs `tsc`. Open the live site; it should look exactly as before.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U0: add router dep, API client with token, env config"
git push -u origin cr/u0-hygiene
```

Then open a Pull Request on GitHub with **base = `main`**. Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`npm run build` complains it can't find `import.meta.env.VITE_API_URL`'s type** — make sure `.env` is at the **project root** (same folder as `package.json`), not inside `src/`.
- **`git status` shows `.env`** — the `grep`/`echo` line in Step 2 either didn't run, or ran in the wrong folder. Re-run it from the project root, and if `.env` was already tracked, run `git rm --cached .env` then commit.
- **`Cannot find module 'react-router-dom' or its corresponding type declarations'`** — the install in Step 1 didn't finish, or you're not in the project folder. Re-run `npm install react-router-dom` from the project root and check it appears under `"dependencies"` in `package.json`.
- **ESLint or `tsc` errors in `client.ts`** — check your file matches Step 3 exactly, especially the types (`string | null`, `Record<string, string>`) — a missing type annotation is the most common cause.
- **The app looks different or the fake login stopped working** — you likely edited an existing file (`Login.tsx`, `ControlBoard.tsx`, etc.) by mistake. This lesson only **adds** new files; nothing existing should change.
- **A totally blank white page as soon as a module-level `let` both loads *and* saves state** — watch the initialization order. A pattern like `let store = load()` placed *above* the `load`/`save` helpers it calls — where `save` reassigns `store` — throws `ReferenceError: Cannot access 'store' before initialization` (a *temporal dead zone* error) at **import time**, before React (or the `ErrorBoundary` you add in [U2](U2-routing.md)) can even mount, so you get a silent white page with only a console error. Fix by ordering: define the helper functions first and run the `let x = load()` initializer **last**, and keep each persist helper touching only its argument (`persist(db)`) rather than the module-level binding it's about to assign. `client.ts`'s `let token = localStorage.getItem("token")` is safe because its initializer never calls back into `setToken` — preserve that property as this file grows.

---

## 📝 Recap

- You installed `react-router-dom` ahead of needing it, so Lesson U2 is only about routing.
- You set up **config in the environment**: the backend's address and mock toggle live in `.env` (private, local) and `env.example.txt` (committed template), never hard-coded.
- You built `src/api/client.ts` — the single place every future lesson will call the backend through, complete with token handling and consistent error handling.
- You practiced the **stacked-CR git routine** (branch → change → test → commit → PR) you'll repeat in all 7 remaining frontend lessons.

---

## 📚 References

- [Vite — Env Variables and Modes](https://vite.dev/guide/env-and-mode) — how `VITE_`-prefixed variables reach your code.
- [MDN — Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [MDN — Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) and [ESLint — Getting Started](https://eslint.org/docs/latest/use/getting-started).
- [npm install docs](https://docs.npmjs.com/cli/v10/commands/npm-install) and [React Router docs](https://reactrouter.com/en/main).
- [Git Branching — Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell) and [gitignore pattern format](https://git-scm.com/docs/gitignore).
- Source of truth for this lesson: [UI guide → CR U0](../ui-development-guide.md#cr-u0--project-hygiene-foundation-no-visible-change).

---

## ➡️ Next lesson

**[Lesson U1 — Real login](U1-real-login.md).** You'll replace the fake Student/Admin buttons with a real login form that calls the backend through the `api` client you just built. → [source CR](../ui-development-guide.md#cr-u1--real-login-replaces-the-fake-login).
