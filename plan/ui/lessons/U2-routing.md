# Lesson U2 — Routing (real pages with URLs)

> **Track:** Frontend · **Lesson 3 of 10**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (two new ideas — routing and route guards — but the code is short)
> **🧩 Prerequisites:** you've completed [Lesson U1 — Real login](U1-real-login.md) (on branch `cr/u1-real-auth`, with the backend running through B3 and seeded).
> **🌿 CR branch:** `cr/u2-routing` (off `cr/u1-real-auth`) · **📄 Source CR:** [CR U2](../ui-development-guide.md#cr-u2--routing-real-pages-with-urls) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

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

Right now the app decides "which screen to show" with a plain JavaScript `if` — there's no real URL for the student dashboard or the admin board, and the browser's Back button doesn't work the way you'd expect. By the end of this hour, every screen will have its own **real address**: `/login`, `/student`, `/admin`. Visit the wrong one and you'll get bounced somewhere sensible instead of seeing something you shouldn't.

**✅ Done when (your deliverable checklist):**
- [ ] Logging in as a student sends you to `/student` (check the address bar).
- [ ] Logging in as an admin sends you to `/admin`.
- [ ] While logged in as a student, typing `/admin` into the address bar redirects you to `/login`.
- [ ] While logged out, visiting any protected URL (`/student` or `/admin`) redirects you to `/login`.
- [ ] The browser's **Back**/**Forward** buttons move between pages without a full page reload.
- [ ] Your work is committed on branch `cr/u2-routing` and pushed, PR base = `cr/u1-real-auth`.

**🖼 What changes on screen (before → after):**
```
      BEFORE (no real routes)                  AFTER (real routes)
┌───────────────────────────┐      ┌───────────────────────────┐
│        Address: "/"       │      │  Address: /login          │
│                           │      │  Address: /student        │
│  Login ↔ student board ↔  │  ─▶  │  Address: /admin          │
│  admin board — all swap   │      │                           │
│  in place, URL never moves│      │  Student visits /admin →  │
│                           │      │  bounced back to /login   │
│  Back button: unreliable  │      │  Back / Forward: just work│
└───────────────────────────┘      └───────────────────────────┘
```
Every screen gets its own bookmarkable address; the guard you'll build decides who's allowed on it.

---

## 🤔 Why this lesson matters (read this first — it's the "why")

Right now, `Login.tsx` decides what to show with a [`useState`](GLOSSARY.md#usestate) (a hook for a component's own memory) `<"selection" | "student" | "admin">` and an `if (isLoggedIn) return <ControlBoard />`. That works for a tiny prototype, but it breaks down fast in a real app:

- **There's no address to bookmark or share.** Every screen lives at the same URL (`/`), so you can't send a teammate a link straight to the admin board, and refreshing always dumps you back at the start of whatever [component](GLOSSARY.md#component) tree happened to be mounted.
- **The browser's Back button does the wrong thing.** Without real routes, "back" doesn't mean "the page I was just on" — it means "whatever the last [React](GLOSSARY.md#react) re-render happened to show."
- **"Should I even be here?" is checked in the wrong place.** Today a student who's logged in just... doesn't see an `/admin` button. But nothing stops them from guessing the flow and getting there anyway, because there's no single place that says "this page requires the admin role."

**[React Router](GLOSSARY.md#react-router)** (the library that connects a URL to the screen that renders there) solves all three: it maps a URL path to a component, gives the browser real navigation (Back/Forward/bookmark/share all work), and lets you write one reusable **[protected route](GLOSSARY.md#protected-route)** guard — `ProtectedRoute` — that every protected page passes through. This is the standard pattern almost every production React app uses, and it's also the plumbing that lesson U3 onward build on top of (e.g. deep-linking to a specific lot).

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **React Router** | The library that maps a URL path to the React component that should render there. | [React Router — Tutorial](https://reactrouter.com/en/main/start/tutorial) |
| **Client-side routing / SPA** | The browser swaps *components*, not full pages — no reload, no losing your Redux state. | [MDN: Single-page application (SPA)](https://developer.mozilla.org/en-US/docs/Glossary/SPA) |
| **`<BrowserRouter>`** | Wraps your app once, at the top, so any component inside can use routing. | [React Router — `BrowserRouter`](https://reactrouter.com/en/main/router-components/browser-router) |
| **`<Routes>` / `<Route>`** | `<Route path="/admin" element={...} />` — "if the URL matches this path, render this." | [React Router — `Route`](https://reactrouter.com/en/main/route/route) |
| **Protected / private route** | A wrapper component that checks "are you allowed here?" and redirects if not, before rendering the real page. | [React Router — `Navigate`](https://reactrouter.com/en/main/components/navigate) |
| **`useNavigate`** | A hook that lets code (not just a link) send the user to a new URL, e.g. after login. | [React Router — `useNavigate`](https://reactrouter.com/en/main/hooks/use-navigate) |
| **URL params** | Later CRs will put IDs right in the URL (e.g. `/admin/lots/3`) instead of only in Redux state. | [React Router — Routing concepts](https://reactrouter.com/en/main/start/concepts) |

> **New words ahead?** Every bolded term below links to the [**Glossary**](GLOSSARY.md) the first time it appears — click any you don't know, read the one-sentence version, and jump back. You never have to memorize a term before the lesson uses it.

---

## ✅ Before you start

**Time budget for the hour:** branch (5 min) → wrap the app in a router + add an ErrorBoundary (10) → build the `ProtectedRoute` guard (10) → define the routes (15) → simplify `Login.tsx` (5) → stub `StudentDashboard.tsx` (5) → test & commit (10).

**Open your terminal in the frontend project and make your branch.** This CR branches off `cr/u1-real-auth` — the login work from the previous lesson has to exist first, since the routes below depend on `state.auth.isLoggedIn` and `state.auth.user?.role`.

```bash
git checkout cr/u1-real-auth
git checkout -b cr/u2-routing
```

**What this does & why:** you're stacking this CR on top of U1's branch (not `main`), because the routes and guard you're about to write read the real `auth` state U1 built. → Reference: [Part C — one branch per CR (stacked)](../ui-development-guide.md#part-c--how-we-work-one-branch-per-cr-stacked).

---

## 🛠 Build it, step by step

### Step 1 — Wrap the app in a router, and add an ErrorBoundary safety net (~10 min)

Right now, any runtime render error (a typo'd [prop](GLOSSARY.md#props), a `null` where an object was expected) blanks the whole page silently — no error, no stack, just white. Before wiring up routes, give the app a **safety net** that turns that silent blank page into an on-screen error message.

Create `frontend/src/ErrorBoundary.tsx`:

```tsx
// frontend/src/ErrorBoundary.tsx
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }              // whatever this boundary wraps
interface State { error: Error | null }               // the crash we caught, if any

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };                      // start assuming no crash

  static getDerivedStateFromError(error: Error) {
    return { error };                                  // React calls this when a child below throws
  }

  render() {
    if (this.state.error) {
      // Show the crash on-screen instead of a silent blank page.
      return (
        <pre style={{ padding: 20, color: "crimson", whiteSpace: "pre-wrap" }}>
          {this.state.error.message}
          {"\n\n"}
          {this.state.error.stack}
        </pre>
      );
    }
    return this.props.children;                        // no crash: render normally
  }
}
```

Then open `frontend/src/main.tsx` and wrap `<App />` in both the boundary and `BrowserRouter`:

```tsx
// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./store";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>                    {/* catches a render crash anywhere below here */}
      <Provider store={store}>         {/* Redux state: available to everything below */}
        <BrowserRouter>                {/* turns on real URL-based navigation below here */}
          <App />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);
```

**Why it works & further reading:**
- **[Error boundary](GLOSSARY.md#error-boundary)** — `ErrorBoundary` must be a class component; `getDerivedStateFromError` is part of React's error-boundary lifecycle, only available on classes (not on function components). → [React docs: Error boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary).
- It's wired **outermost of all** (around `Provider` *and* `BrowserRouter`), so a render crash anywhere in the app — a bad route, a bad page, a bad guard, even something during store setup — surfaces here instead of blanking the page.
- **`<BrowserRouter>`** lets any nested component ask "what's the URL right now?" or "take me to a different one." → [React Router — `BrowserRouter`](https://reactrouter.com/en/main/router-components/browser-router).
- **Wrapping order** — `<ErrorBoundary>` wraps `<Provider>` ([Redux](GLOSSARY.md#redux)), which wraps `<BrowserRouter>`, which wraps `<App>`, so every component can read Redux state *and* use routing while the boundary sits outside both to catch a crash even in store or router setup.
- You installed the `react-router-dom` package back in **U0** ([`npm`](GLOSSARY.md#npm) `install react-router-dom`) specifically so it would be ready for this lesson.

### Step 2 — Build the route guard: `frontend/src/ProtectedRoute.tsx` (~10 min)

This is the "are you allowed here?" check, written **once** and reused by every protected page:

```tsx
// frontend/src/ProtectedRoute.tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "./store";

export function ProtectedRoute({ role, children }: { role?: "student" | "admin"; children: ReactNode }) {
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const userRole = useAppSelector((s) => s.auth.user?.role);

  if (!isLoggedIn) return <Navigate to="/login" replace />;          // not logged in
  if (role && userRole !== role) return <Navigate to="/login" replace />; // wrong role
  return <>{children}</>;                                            // allowed: render the wrapped page
}
```

**Why it works & further reading:**
- `role?` is optional — omit it and any logged-in user may see the page; `children` is whatever page this guard wraps.
- Reads the exact `auth` fields `authSlice` (built in **U1**) keeps in Redux. If your `authSlice.ts` uses different field names, the guard always fails — see **🧯 If something breaks** below.
- `<Navigate replace />` renders a redirect instead of the page; `replace` skips adding a Back-button entry for the bounce itself, so pressing Back after being bounced from `/admin` doesn't just send you right back. → [React Router — `Navigate`](https://reactrouter.com/en/main/components/navigate).
- The two checks run **top to bottom**: not logged in beats everything; only then does a mismatched `role` also bounce to `/login`.
- `<>{children}</>` uses a **[Fragment](GLOSSARY.md#fragment)** so `children` render without an extra wrapping element.

### Step 3 — Define the routes in `frontend/src/App.tsx` (~15 min)

Now `App` owns the URLs. `Login.tsx` becomes just the login *page*, not the gatekeeper — replace the whole file:

```tsx
// frontend/src/App.tsx
import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./App.css";
import Login from "./Login";
import StudentDashboard from "./StudentDashboard";   // created in Step 5; stub for now
import { ControlBoard } from "./ControlBoard";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAppDispatch, useAppSelector } from "./store";
import { fetchMe, logout } from "./store/authSlice";

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    // Same session-restore call as U1: a saved token means "confirm who I am."
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
          // Guarded: only a logged-in student may render StudentDashboard.
          <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          // Guarded: only a logged-in admin may render ControlBoard.
          <ProtectedRoute role="admin">
            <ControlBoard onLogout={() => { dispatch(logout()); navigate("/login"); }} />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />  {/* unknown URL: send to login */}
      </Routes>
    </div>
  );
}

export default App;
```

**Why it works & further reading:**
- **`<Routes>`** renders the single `<Route>` whose path matches the current URL. → [React Router — `Routes`](https://reactrouter.com/en/main/route/route).
- Wrapping the `/student` and `/admin` elements in `<ProtectedRoute>` from Step 2 means the guard runs *before* the real page ever mounts.
- `path="*"` is the catch-all — a typo'd URL or old bookmark gets redirected to `/login` instead of a blank page.
- The first [`useEffect`](GLOSSARY.md#useeffect) is unchanged from **U1**; the second is new here — logging in only updates Redux state, it doesn't navigate by itself, so this effect is what actually lands a fresh login on `/student` or `/admin`.
- `useNavigate()` is a [hook](GLOSSARY.md#hook) for navigating **from code**, not a click — needed because "go to `/admin`" happens as a *reaction* to login succeeding. → [React Router — `useNavigate`](https://reactrouter.com/en/main/hooks/use-navigate).

### Step 4 — Simplify `Login.tsx` (~5 min)

`Login.tsx` no longer decides whether to show `<ControlBoard>` — the router does that now via the `/admin` route. Remove the block that used to do that:

```tsx
// REMOVE this whole block from the top of the Login component:
if (isLoggedIn) {
  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <ControlBoard onLogout={() => dispatch(logout())} />
    </div>
  );
}
```

Everything else — the selection screen, `StudentLoginForm`, `AdminLoginForm` — stays exactly as you built it in **U1**. You can also remove the now-unused `ControlBoard` and `logout` imports from `Login.tsx` if your editor flags them.

**Why this is safe to delete:** the `useEffect` you just added in `App.tsx` (Step 3) already redirects a logged-in user to `/student` or `/admin` the moment `user` becomes known. Having `Login.tsx` *also* try to render `<ControlBoard>` would be redundant — and would fight with the router over what's on screen.

### Step 5 — Temporary stub so everything compiles (~5 min)

`StudentDashboard` doesn't exist yet — it's built for real in lesson U5. Create a placeholder so `App.tsx` has something to import:

```tsx
// frontend/src/StudentDashboard.tsx  (replaced for real in U5)
export default function StudentDashboard() {
  return <h2>Student dashboard (coming in U5)</h2>;
}
```

**Explanation:** this is a **stub** — a minimal stand-in that satisfies the import so [TypeScript](GLOSSARY.md#typescript) and the router are happy, with no real behavior yet. It gets fully replaced in a later lesson; for now it just proves the `/student` route and its `ProtectedRoute` guard work end-to-end.

---

## 🧪 Prove it works — testing guide

**Setup:** backend running through **B3** (seeded), and `npm run dev`.

**Steps and what you should see:**

1. Open the site while logged out and visit `/student` directly in the address bar → you land on `/login` (redirected).
2. Log in as a seeded student (`STU001`) → the address bar changes to `/student`, and you see the stub "Student dashboard (coming in U5)".
3. While still logged in as that student, type `/admin` into the address bar and press Enter → you're redirected back to `/login` (wrong role, not the admin page).
4. Log out (via the admin board's logout, or by logging in as admin and using its logout button), then visit `/admin` directly → redirected to `/login` (logged out).
5. Log in as admin (`admin` / `admin123`) → the address bar changes to `/admin` and you see the control board.
6. Use the browser's **Back** button a couple of times, then **Forward** → the page changes without a full reload (no flash-to-white, no "loading" spinner from scratch).

If all six behave as described, the guard and the routes are wired correctly.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U2: react-router routes + role-guarded ProtectedRoute"
git push -u origin cr/u2-routing
```

Then open a Pull Request on GitHub with **base = `cr/u1-real-auth`** (not `main` — this CR stacks on U1). Use the CR description template from the guide and paste your "Prove it works" results as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **Blank white page** — check the console; the `ErrorBoundary` you added in Step 1 should catch a render crash and print the error message + stack right on the page instead of leaving it blank. If you still see a truly blank page with no error text at all, the crash happened outside React's render (e.g. in `main.tsx` before the boundary even mounts) — the console is your only signal there.
- **Blank white page after adding `BrowserRouter`, but the `ErrorBoundary` isn't catching it either** — open the browser console (right-click → Inspect → Console). A common cause is a component using a routing hook (`useNavigate`, `useAppSelector` for routing state) *outside* of `<BrowserRouter>` — double-check the wrapping order in `main.tsx` from Step 1.
- **You're bounced to `/login` even though you just logged in successfully** — `ProtectedRoute` is reading `s.auth.isLoggedIn` / `s.auth.user?.role`. If your `authSlice.ts` from U1 uses different field names, the guard will always see "not logged in." Compare the field names in Step 2 against your actual `authSlice.ts`.
- **Logging in doesn't navigate anywhere** — check the second `useEffect` in `App.tsx` (Step 3). It only fires when `user` changes, so if login isn't actually updating `state.auth.user`, you'll stay on `/login`. Confirm U1's login thunks are working first (re-run U1's testing guide).
- **`Cannot find module './StudentDashboard'` or a TypeScript error about a missing default export** — you skipped Step 5, or the stub file's export isn't `export default`. Re-check the exact snippet in Step 5.
- **Typing `/admin` directly and refreshing shows a 404** — this shouldn't happen with `npm run dev` ([Vite](GLOSSARY.md#vite)'s dev server serves `index.html` for any path automatically). If you *do* see it locally, make sure you're running `npm run dev` and not opening a built `dist/index.html` directly. (This exact problem *can* happen after deploying to production — that's an nginx "[SPA](GLOSSARY.md#spa) fallback" setting, covered in the guide's [Part F3.4](../ui-development-guide.md#f34-nginx-static-files--spa-fallback--api-proxy) — not something to worry about in this lesson.)

---

## 📝 Recap — what you built and learned

- You replaced a hand-rolled `if (isLoggedIn)` screen switch with **real URLs**: `/login`, `/student`, `/admin`.
- You added an **`ErrorBoundary`** around the app shell, so a render crash shows its message + stack on-screen instead of silently blanking the page.
- You learned the core React Router building blocks: `<BrowserRouter>`, `<Routes>`/`<Route>`, `<Navigate>`, and `useNavigate`.
- You wrote a reusable **`ProtectedRoute`** guard — the standard pattern for "does this user belong on this page?" that every later admin/student page will reuse.
- You practiced the **stacked-CR git routine** again, branching off the previous lesson's branch instead of `main`.

---

## 📚 References

- [React Router — Tutorial](https://reactrouter.com/en/main/start/tutorial) — the official getting-started walkthrough.
- [React Router — `BrowserRouter`](https://reactrouter.com/en/main/router-components/browser-router).
- [React Router — `Route`](https://reactrouter.com/en/main/route/route) and [`Routes`](https://reactrouter.com/en/main/route/route).
- [React Router — `Navigate`](https://reactrouter.com/en/main/components/navigate) — how the redirect-based guard works.
- [React Router — `useNavigate`](https://reactrouter.com/en/main/hooks/use-navigate) — navigating from code after login.
- [React Router — Routing concepts](https://reactrouter.com/en/main/start/concepts) — includes URL/dynamic segments, useful background for later CRs.
- [MDN — Single-page application (SPA)](https://developer.mozilla.org/en-US/docs/Glossary/SPA) — why client-side routing avoids full page reloads.
- Source of truth for this lesson: [UI guide → CR U2](../ui-development-guide.md#cr-u2--routing-real-pages-with-urls).

---

## ➡️ Next lesson

**[Lesson U3 — Show real lots and spaces](U3-show-real-lots-and-spaces.md).** You'll replace the hard-coded parking grid with real lots and spaces fetched from the backend, each space colored by its server `status`. → [source CR](../ui-development-guide.md#cr-u3--show-real-lots-and-spaces-data-driven-map)
