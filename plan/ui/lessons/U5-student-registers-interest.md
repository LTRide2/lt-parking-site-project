# Lesson U5 — Student registers interest (core feature #1)

> **Track:** Frontend · **Lesson 6 of 8**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first real POST request + a new Redux slice)
> **🧩 Prerequisites:** you've done [Lesson U4 — Make enable/disable actually save](U4-enable-disable-saves.md); backend **B6** (the interest endpoint) is running.
> **🌿 CR branch:** `cr/u5-student-interest` (off `cr/u4-save-status`) · **📄 Source CR:** [UI guide → CR U5](../ui-development-guide.md#cr-u5--student-registers-interest-core-feature-1) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

A **real** student dashboard. Instead of the U2 stub screen, a logged-in student will see the live parking availability, be able to click a button to **register interest** in a lot, and see their request's status (`pending` now, `fulfilled` once an admin assigns them a space in U6).

**✅ Done when (your deliverable checklist):**
- [ ] `src/store/interestSlice.ts` exists with a `mine` field, plus `fetchMyInterest` and `registerInterest` thunks.
- [ ] The `interest` reducer is registered in `src/store/index.ts`.
- [ ] `src/StudentDashboard.tsx` shows the availability list, a "Register interest" button per lot when the student has no active request, and their request + status once they do.
- [ ] Clicking a "Register interest" button POSTs to the backend, and the result **survives a page refresh**.
- [ ] Your work is committed on branch `cr/u5-student-interest` and pushed, PR base = `cr/u4-save-status`.

---

## 🤔 Why this lesson matters

Up to now, the student dashboard has been a stub — a placeholder screen that doesn't talk to the database. This lesson turns it into the app's **first core feature**: a student saying "I want a spot in this lot" and that request actually sticking around.

Notice the shape of what you're building, because you'll use this exact pattern for the rest of the app:

1. A **thunk** asks the backend to do something (`GET` to read, `POST` to write).
2. The **slice** stores the result in Redux so any component can read it.
3. The **component** renders different UI depending on what's in the store — no request yet? Show buttons. Already have one? Show status instead.

This "read state, render one of two UIs" pattern is the heart of almost every interactive screen you'll build. Get comfortable with it here, because U6 (admin assigns spaces) leans on the same `interest` data from the other side.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Controlled UI by state** | The buttons you show depend on data (`mine === null` vs not), not on a separate "mode" flag. | [React docs: Reacting to input with state](https://react.dev/learn/reacting-to-input-with-state) |
| **`fetch` with `POST`** | Sending data *to* the server (not just asking for it) by setting `method` and a JSON `body`. | [MDN: Using the Fetch API — making POST requests](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) |
| **Redux Toolkit async thunks** | A function that does an `async` request, then Redux tracks its `pending` / `fulfilled` / `rejected` states for you. | [RTK docs: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) |
| **Disabling a button mid-request** | Prevents a student from double-clicking and firing the request twice. | [MDN: `disabled` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#disabled) |
| **Showing server errors in the UI** | Turning a caught `Error` (from `api.post`) into a message the user can actually read. | [MDN: Error-handling with try/catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch) |

---

## ✅ Before you start

**Prerequisites:** [Lesson U4](U4-enable-disable-saves.md) done (you're on `cr/u4-save-status`), and backend **B6** (the `/api/interest` endpoints) running locally.

**Time budget for the hour:** setup & branch (5 min) → `interestSlice.ts` (15) → register the slice (5) → rewrite `StudentDashboard.tsx` (20) → test & commit (15).

**Open your terminal and make your branch.** This CR branches off U4, not off `main` — remember, each CR builds on the one before it:

```bash
git checkout cr/u4-save-status
git checkout -b cr/u5-student-interest
```

---

## 🛠 Build it, step by step

### Step 1 — Create the interest slice (~15 min)

Create `src/store/interestSlice.ts`:

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

**Explanation, piece by piece:**
- **`Interest` interface** — the shape of one request as the backend sends it: which lot, whose it is, and its `status`. `lot_name?` has a `?` because the backend may or may not include it — always handle the "not there" case.
- **`InterestState.mine`** — a student has **at most one active request**, so this is a single `Interest | null`, not an array. `null` means "hasn't asked yet."
- **`fetchMyInterest`** — a `GET` thunk, same pattern as `fetchLots` from U3: no arguments, just ask the backend "what's my current request?" → [createAsyncThunk docs](https://redux-toolkit.js.org/api/createAsyncThunk).
- **`registerInterest`** — your first **`POST`** thunk. It takes `lotId` as an argument and calls `api.post("/api/interest", { lotId })`. `api.post` (built back in U0/U1) sends `lotId` as the JSON body and attaches your login token automatically. → [MDN: making POST requests with fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).
- **`extraReducers`** — the same `pending` / `fulfilled` / `rejected` pattern as every other slice in this app: `pending` clears old errors and shows a loading state, `fulfilled` stores the result, `rejected` stores a readable error message. Both thunks share the same `mine = a.payload` logic on success, because registering *is* the new "your current request."

> **Why one thunk for reading, one for writing?** Keeping `fetchMyInterest` (read) and `registerInterest` (write) separate means each has one job and one clear success shape. You'll reuse this "one thunk per HTTP verb" habit for every feature from here on.

### Step 2 — Register the slice (~5 min)

Open `src/store/index.ts` and add the new reducer to the store:

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

**Why this step exists:** a slice's reducer only actually manages state once it's plugged into the store under a key (here, `"interest"`). That key is what `useAppSelector((s) => s.interest)` reads from — skip this step and `s.interest` would be `undefined`.

### Step 3 — Rewrite the student dashboard (~20 min)

Replace the whole contents of `src/StudentDashboard.tsx` with the real screen:

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

**Explanation, piece by piece:**
- **`useEffect(..., [dispatch])`** — on the very first render, dispatch two reads at once: the lot list (from U3's `parkingSlice`) and this student's own request. Both run in parallel; neither waits for the other. → [React docs: useEffect](https://react.dev/reference/react/useEffect).
- **`const { mine, status, error } = useAppSelector((s) => s.interest)`** — pulls all three fields out of the `interest` slice you registered in Step 2, in one line.
- **`{mine ? (...) : (...)}`** — this is the "controlled UI by state" concept from the table above: **one `if`, driven entirely by data.** No `mine` yet → show the register buttons. Have a `mine` → show its status instead. There's no separate "hasRegistered" flag to keep in sync — the data itself *is* the truth. → [React docs: Reacting to input with state](https://react.dev/learn/reacting-to-input-with-state).
- **`disabled={status === "loading"}`** — while a `registerInterest` request is in flight, the buttons are disabled so a student can't fire two requests by double-clicking. → [MDN: `disabled`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#disabled).
- **`onClick={() => dispatch(registerInterest(lot.id))}`** — clicking a lot's button dispatches the write thunk with that lot's id. On success, `mine` fills in and React re-renders straight into the "Your request" branch — the buttons disappear on their own, because they only render when `mine` is `null`.
- **`{error && <p ...>{error}</p>}`** — if the backend rejects the request (for example, a 409 because the student already has an active request), `interestSlice`'s `fail` reducer put a readable message in `error`, and this line shows it in red. → [MDN: try/catch error handling](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch).

**What it looks like, before and after registering:**

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

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend running (through **B6**), seeded; `npm run dev`; log in as a seeded student (`STU001`).
2. **Steps:** read the availability list; click **Register interest — Lot A**; **refresh**; try registering a second time (the buttons should be gone, replaced by your status).
3. **Expected:**
   - After clicking, "Your request" shows **Lot A — pending**.
   - After **refresh**, the request is still there (loaded by `fetchMyInterest`).
   - You can't create a second active request (the register buttons disappear once you have one); if you hit the API directly the backend returns 409 and you'd see a red error.

**☁️ Cloud check (optional):** needs backend **B6** deployed. `./release.sh frontend`, log in as a student on the live site, register interest, and refresh — the request persists. (Half of the full cloud E2E; the other half lands with U6.)

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U5: student dashboard + interestSlice (register + view status)"
git push -u origin cr/u5-student-interest
```

Then open a Pull Request on GitHub with **base = `cr/u4-save-status`** (this CR branches off U4, not `main`). Fill in the CR description template and paste your "Prove it works" output as the testing evidence. The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **Clicking the button does nothing** — check the browser console for a network error. Confirm backend **B6** is actually running and `VITE_API_URL` points at it.
- **`s.interest` is `undefined` in the console** — you skipped Step 2; the reducer isn't registered in `src/store/index.ts`.
- **The register buttons never disappear after clicking** — check that `registerInterest.fulfilled` is setting `s.mine = a.payload` in `interestSlice.ts`; if `mine` never gets set, the `mine ? ... : ...` branch never switches.
- **Refreshing loses your request** — that means it was only ever stored in Redux, not the database. Confirm `registerInterest` is really calling `api.post` (not just updating local state) and that B6's endpoint is saving to Postgres.
- **You get a 409 error every time, even on a fresh account** — the seeded student may already have a `pending` request from an earlier test run; check the `interest` table in the database or use a different seeded student code.

---

## 📝 Recap

- You built your first **write** thunk (`registerInterest`, a `POST`) alongside a **read** thunk (`fetchMyInterest`, a `GET`) — the same one-thunk-per-verb pattern you'll reuse for the rest of the app.
- You practiced **controlled UI by state**: the dashboard shows register buttons or status entirely based on whether `mine` is `null`, with no separate flag to keep in sync.
- You disabled a button during an in-flight request to prevent duplicate submissions, and surfaced a server-side error (like a 409 conflict) as readable text.
- You proved persistence the right way: not just "the screen updated," but "the screen still shows it after a refresh."

---

## 📚 References

- [React docs — Reacting to input with state](https://react.dev/learn/reacting-to-input-with-state) — the pattern behind rendering buttons vs. status from one piece of data.
- [React docs — useEffect](https://react.dev/reference/react/useEffect) — running the initial data fetches when the component mounts.
- [MDN — Using the Fetch API: making POST requests](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) — how a POST body gets sent.
- [Redux Toolkit — createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) — the thunk pattern used for both `fetchMyInterest` and `registerInterest`.
- [MDN — `<button>` `disabled` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#disabled) — preventing double-submission.
- [MDN — try/catch error handling](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch) — how a thrown `Error` becomes a message in `error`.
- Source of truth for this lesson: [UI guide → CR U5](../ui-development-guide.md#cr-u5--student-registers-interest-core-feature-1).

---

## ➡️ Next lesson

**[Lesson U6 — Admin assigns spaces](U6-admin-assigns-spaces.md).** You'll build the other half of this feature: an admin sees the list of pending requests and assigns a real space to each one, flipping the student's status from `pending` to `fulfilled`. → [source CR](../ui-development-guide.md#cr-u6--admin-assigns-spaces-core-feature-2).
