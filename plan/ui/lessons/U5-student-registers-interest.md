# Lesson U5 — Student picks a spot & registers interest (core feature #1)

> **Track:** Frontend · **Lesson 6 of 10**
> **⏱ Time:** ~70 min · **🎚 Difficulty:** moderate–hard (your first real POST request, a new Redux slice, and a student-facing map view)
> **🧩 Prerequisites:** you've done [Lesson U4 — Make enable/disable actually save](U4-enable-disable-saves.md) and read the map/pan-zoom mechanics in [U3](U3-show-real-lots-and-spaces.md); backend **B6** (the interest endpoint) is running.
> **🌿 CR branch:** `cr/u5-student-interest` (off `cr/u4-save-status`) · **📄 Source CR:** [UI guide → CR U5](../ui-development-guide.md#cr-u5--student-registers-interest-core-feature-1) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

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

A **real** student dashboard that mirrors the admin's map — campus map → click a lot → see that lot's spots — but with **no admin sidebar**. Instead of a plain lot list with a "register interest" button, the student **clicks the actual spot they want** on the map, then submits. A student may request **exactly one spot**: clicking an available (yellow) spot picks it (turns green), clicking again clears it, and picking a different one replaces the first.

Once they submit, the request **locks**: the map and Submit/Clear go read-only and a side panel shows "Your request — *pending approval*". To change their mind, the student uses **Withdraw request** (offered only while `pending`), which rescinds it and re-opens the map to pick again. After an admin assigns them (U6), the request reads **Approved — spot assigned** and is fully locked (they'd contact the admin to change it).

**✅ Done when (your deliverable checklist):**
- [ ] `frontend/src/store/interestSlice.ts` exists with a `mine` field, plus `fetchMyInterest`, `registerInterest`, and `withdrawInterest` thunks.
- [ ] The `interest` reducer is registered in `frontend/src/store/index.ts`.
- [ ] `frontend/src/StudentDashboard.tsx` shows the **campus map → lot → spots** view (reusing U3's pan/zoom), **without** the admin sidebar.
- [ ] A student can **click an available spot to pick it** (green), click again to clear, and picking another **replaces** the first — never more than one.
- [ ] A **"Your selection"** panel names the picked spot with **Submit** and **Clear**; a top **banner** shows the current request (`lot · spot — status`).
- [ ] Opening the lot of an existing request **pre-loads** its picked spot.
- [ ] After **Submit**, the map + Submit/Clear are **disabled**; the panel flips to read-only "Your request". **Withdraw request** (only while `pending`) rescinds it and re-enables picking.
- [ ] Everything **survives a page refresh**.
- [ ] Work committed on `cr/u5-student-interest` and pushed, PR base = `cr/u4-save-status`.

**🖼 What changes on screen (before → after):**
```
        BEFORE (U2 stub)                     AFTER (U5 — pick & submit)
┌───────────────────────────┐      ┌─────────────────────────────────┐
│   Student dashboard       │      │   Lot A:   [Y][Y][G][Y]         │
│     (coming in U5)        │  ─▶  │            [Y][Y][Y][X]         │
│                           │      │   Your selection: Spot 3        │
│                           │      │      [ Submit ]   [ Clear ]     │
└───────────────────────────┘      └─────────────────────────────────┘
   a placeholder heading —              the real campus→lot→spots map;
   nothing on screen to click            click an available (Y) spot to
                                          pick it — it turns green (G),
                                          then Submit locks the request
```
Once submitted, Submit/Clear disappear and a read-only "Your request" panel with a **Withdraw request** button takes their place — see Step 3.

---

## 🤔 Why this lesson matters

Up to now the student dashboard has been a stub. This lesson turns it into the app's **first core feature** — and it's the moment the two halves of the product meet: the student picks a spot on the **same map** the admin arranged in U8, reading the **same** spaces the admin manages. It's worth the extra time over a plain button list because:

- **Students think in spots, not lot names.** Letting them point at the actual spot they want (and see which are taken) is the real product; a "register interest in Lot A" button was a scaffold.
- **You'll reuse the map everywhere.** The campus→lot→spots view with pan/zoom is the same one from U3/U8 — here you render it *without* the sidebar and make spots *clickable to pick*. Seeing the same map serve admin and student cements how [normalized coordinates](GLOSSARY.md#normalized-coordinates) (`x/y/w/h`) make one layout work for both.
- **"One active request, lockable, withdrawable" is a real state machine.** Pick → submit → (locked) → withdraw → pick again is the same request lifecycle U6 drives from the admin side. Building the student side here makes U6 click into place.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Controlled UI by state** | What you show (pick mode vs locked "your request") depends on the request's `status`, not a separate flag. | [React docs: Reacting to input with state](https://react.dev/learn/reacting-to-input-with-state) |
| **`fetch` with `POST`** | Sending data *to* the server (the picked spot) by setting `method` and a JSON `body`. | [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) |
| **Redux Toolkit async thunks** | A function that does an `async` request; Redux tracks its `pending`/`fulfilled`/`rejected` for you. | [RTK: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) |
| **Normalized coordinates** | Spots stored as fractions (`x/y/w/h` ∈ 0..1) so one layout renders at any map size — shared with U3/U8. | [Lesson U3](U3-show-real-lots-and-spaces.md), [U8](U8-place-and-arrange-spots.md) |
| **Idempotent upsert** | Submitting replaces your single active request rather than piling up duplicates. | [Wikipedia: Idempotence](https://en.wikipedia.org/wiki/Idempotence) |

> **New words ahead?** Every bolded term below links to the [**Glossary**](GLOSSARY.md) the first time it appears — click any you don't know, read the one-sentence version, and jump back. You never have to memorize a term before the lesson uses it.

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → `interestSlice.ts` (15) → register the slice (5) → rewrite `StudentDashboard.tsx` as the map view (30) → test & commit (15).

**The backend contract this lesson calls.** An `interest` request now carries the **picked spot**, not just a lot. Each bullet below is one [endpoint](GLOSSARY.md#endpoint) this lesson calls, using the [HTTP methods](GLOSSARY.md#http-methods) `GET`, `POST`, and `DELETE`:

- `Interest` gains **`space_ids: number[]`** and **`space_labels: string[]`** — arrays for forward-compatibility, but the PoC holds **at most one** (a student picks one spot).
- `GET /api/interest/me` → the student's one active request (or `null`).
- `POST /api/interest { lotId, spaceIds }` — validates the spot is **in that lot** and **available**: **400** if `spaceIds` is empty, **400** if it has **more than one**, **409** if the spot isn't available. **Upserts** the single active `pending` request (submitting again replaces it).
- `DELETE /api/interest/me` → cancels (withdraws) the active request (`204`); status becomes `cancelled`.
- `GET /api/lots/:id/spaces` is **login-gated, not admin-only** — a student must be able to read a lot's layout to see and pick spots. (This is a change from U3/U4 where it was admin-only; the real backend must allow any authenticated user to read spaces.)

> **Status → what the student sees:** `pending` → *"Pending approval"*, `fulfilled` → *"Approved — spot assigned"*, `cancelled` → *"Withdrawn"*.

**Make your branch.** This CR branches off U4:

```bash
git checkout cr/u4-save-status
git checkout -b cr/u5-student-interest
```

---

## 🛠 Build it, step by step

### Step 1 — Create the interest slice (~15 min)

Create `frontend/src/store/interestSlice.ts`. Note `space_ids`/`space_labels` on the type, and the new `withdrawInterest` [thunk](GLOSSARY.md#thunk):

```ts
// frontend/src/store/interestSlice.ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../api/client";

// The shape of ONE request, as the server sends it back.
export interface Interest {
  id: number;
  user_id: number;
  lot_id: number;
  lot_name?: string;
  space_ids: number[];      // holds ≤ 1 in the PoC (arrays for forward-compat)
  space_labels: string[];
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
}

// The shape of this slice's corner of the store — this student's own request.
interface InterestState {
  mine: Interest | null;    // this student's one active request
  status: "idle" | "loading" | "error";
  error: string | null;
}

const initialState: InterestState = { mine: null, status: "idle", error: null };

// GET /api/interest/me -> my one active request, or null if I haven't asked for a spot yet.
export const fetchMyInterest = createAsyncThunk(
  "interest/me",
  () => api.get("/api/interest/me") as Promise<Interest | null>
);

// POST /api/interest { lotId, spaceIds } -> Interest
export const registerInterest = createAsyncThunk(
  "interest/register",
  ({ lotId, spaceIds }: { lotId: number; spaceIds: number[] }) =>
    api.post("/api/interest", { lotId, spaceIds }) as Promise<Interest>
);

// DELETE /api/interest/me, then refetch  (withdraw / rescind)
export const withdrawInterest = createAsyncThunk(
  "interest/withdraw",
  async (_: void, { dispatch }) => {
    await api.del("/api/interest/me");     // cancel on the server
    await dispatch(fetchMyInterest());     // then reload "mine" (now null)
  }
);

const interestSlice = createSlice({
  name: "interest",
  initialState,
  reducers: {},                            // no plain (non-async) actions needed here
  extraReducers: (builder) => {
    // Shared handlers, reused across all three thunks below.
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
      .addCase(registerInterest.rejected, fail)
      .addCase(withdrawInterest.pending, pending)
      // no .fulfilled case for withdraw — the fetchMyInterest it triggers handles that
      .addCase(withdrawInterest.rejected, fail);
  },
});

export default interestSlice.reducer;    // this reducer gets plugged into the store in Step 2
```

**Why it works & further reading:**
- **[Interface](GLOSSARY.md#interface) `Interest`** — one shape shared by every request object, so a missing or misspelled field (like `space_ids`) is caught as you type. → [TS: Object Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types).
- **Plural `spaceIds`, singular PoC** — the payload is always an array because the [API](GLOSSARY.md#api) is built for multiple picks later; only the backend's own validation enforces "at most one" for now.
- **`api.post` / `api.del`** — the same [API](GLOSSARY.md#api) client from U0/U1; it sends the JSON body and attaches your token, so this thunk doesn't have to.
- **`withdrawInterest` has no `.fulfilled` of its own** — it dispatches `fetchMyInterest` again, and *that* thunk's `.fulfilled` is what actually clears `mine` to `null`. One source of truth for "what's my request right now?"
- **[`extraReducers`](GLOSSARY.md#extrareducers)** — the same `pending`/`fulfilled`/`rejected` wiring from U1, reused for all three thunks here.

### Step 2 — Register the slice (~5 min)

In `frontend/src/store/index.ts`:

```ts
import interestReducer from "./interestSlice";   // Step 1's default export
// ...
export const store = configureStore({
  reducer: {
    auth: authReducer,
    parking: parkingReducer,
    interest: interestReducer,   // <-- add
  },
});
```

**Why it works & further reading:**
- **`interestReducer`** — Step 1's `default export`, the actual [reducer](GLOSSARY.md#reducer) function that updates `InterestState` in response to [actions](GLOSSARY.md#action).
- **`configureStore({ reducer: { ... } })`** — `reducer` is a map from a name you pick to the reducer that owns that [slice](GLOSSARY.md#slice) of state; `configureStore` wires every entry into one global [store](GLOSSARY.md#store), added alongside the existing `auth` and `parking` keys. → [RTK: configureStore](https://redux-toolkit.js.org/api/configureStore).
- **The key must match** — `useAppSelector((s) => s.interest)`, a [selector](GLOSSARY.md#selector) used throughout this lesson, reads the store by that exact `interest` key. Register it under a different name and `s.interest` is `undefined` — every `mine`/`status`/`error` read from it breaks.

### Step 3 — Rewrite `StudentDashboard.tsx` as the map view (~30 min)

The student dashboard now reuses the **campus map → lot → spots** view you built for admin in U3, **minus the sidebar**, plus spot-picking. Rather than repeat the whole pan/zoom map here, lift the map-rendering pieces you already have (campus image with lot markers, per-lot spaces render, the shared `translate`-offset pan + cursor-anchored wheel zoom from U3/U8) into a [component](GLOSSARY.md#component) the student screen can render read-only. The **new** behaviour is spot-picking and the lock/withdraw states:

```tsx
// frontend/src/StudentDashboard.tsx  (key logic — map/pan/zoom reused from U3)
const { mine, status, error } = useAppSelector((s) => s.interest);   // this student's one active request
const [pickedSpaceId, setPickedSpaceId] = useState<number | null>(null);   // local: highlighted spot pre-Submit

const locked = mine != null;                          // submitted → read-only
const canPick = !locked;

// Pre-load the existing pick when opening the lot of an active request:
const openLot = (lotId: number) => {
  dispatch(fetchSpaces(lotId));                        // login-gated, students allowed
  setSelectedLotId(lotId);
  setPickedSpaceId(mine?.lot_id === lotId ? (mine.space_ids[0] ?? null) : null);
};

// Click a spot on the map:
const onSpaceClick = (space: Space) => {
  if (!canPick || space.status !== "available") return;   // can't pick taken/disabled, or when locked
  setPickedSpaceId((cur) => (cur === space.id ? null : space.id));  // toggle / replace
};

const submit = () => {
  if (pickedSpaceId == null || selectedLotId == null) return;
  dispatch(registerInterest({ lotId: selectedLotId, spaceIds: [pickedSpaceId] }));  // array-of-one
};
```

Spot colour while picking: available = **yellow**, your pick = **green**, taken/disabled = grey/red (same legend as U3). A spot is green when `space.id === pickedSpaceId`.

The two panels — pick mode vs locked — are pure "controlled UI by state":

```tsx
{/* Top banner: always shows the current request, if any */}
{mine && (
  <div className="banner">
    {mine.lot_name} · {mine.space_labels[0] ?? "—"} —{" "}
    {/* `cancelled` is a defensive fallback — withdrawing sets `mine = null`, so
        this banner (which only renders when `mine` exists) won't normally show it. */}
    <b>{ {pending: "Pending approval", fulfilled: "Approved — spot assigned",
          cancelled: "Withdrawn"}[mine.status] }</b>
  </div>
)}

{locked ? (
  /* Read-only "Your request" */
  <aside>
    <h3>Your request</h3>
    <p>{mine!.lot_name} · <b>{mine!.space_labels[0]}</b></p>
    <p>Status: {mine!.status === "fulfilled" ? "Approved — spot assigned" : "Pending approval"}</p>
    {mine!.status === "pending" && (
      <button onClick={() => dispatch(withdrawInterest())}>Withdraw request</button>
    )}
    {mine!.status === "fulfilled" && <p>Assigned by the office — contact an admin to change.</p>}
  </aside>
) : (
  /* Pick mode: "Your selection" */
  <aside>
    <h3>Your selection</h3>
    <p>{pickedSpaceId ? `Spot picked in this lot` : "Click an available (yellow) spot to pick it."}</p>
    <button disabled={pickedSpaceId == null || status === "loading"} onClick={submit}>Submit</button>
    <button disabled={pickedSpaceId == null} onClick={() => setPickedSpaceId(null)}>Clear</button>
  </aside>
)}
{error && <p style={{ color: "red" }}>{error}</p>}
```

**Why it works & further reading:**
- **[`useState`](GLOSSARY.md#usestate) for the pick, `useAppSelector` for the request** — `pickedSpaceId` is a [hook](GLOSSARY.md#hook)-backed local [state](GLOSSARY.md#state) value; only this screen cares about it before Submit, so it doesn't belong in Redux. → [React: useState](https://react.dev/reference/react/useState).
- **`locked = mine != null`** — the request's existence, not a separate flag, decides pick-mode vs read-only ("controlled UI by state," from the Concepts table above).
- **Toggle / replace in one line** — a single `pickedSpaceId` means picking a new spot automatically replaces the old one; you never track more than one.
- **Pre-load on open** — `openLot` seeds `pickedSpaceId` from `mine.space_ids[0]`, so the green spot shows where the student already asked.
- **Withdraw only while `pending`** — a `fulfilled` request is fully locked; `withdrawInterest` deletes it, then [dispatches](GLOSSARY.md#dispatch) `fetchMyInterest` again, whose `.fulfilled` drops `locked` back to `false`.
- **Reset in the click handler, not a [`useEffect`](GLOSSARY.md#useeffect)** — respects the `react-hooks/set-state-in-effect` rule from U3/U8.

> **Hover tooltip (optional polish).** Like the admin map (U3), give student spots a floating cursor tooltip showing **lot number · spot label · availability** (*Available / Taken / Unavailable / Selected by you*) instead of the native `title`.

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend through **B6**, seeded; `npm run dev`; log in as a seeded student (**STU001** — the login hint lists `STU001`–`STU004`).
2. **Steps:** from the campus map, open a lot; click an available (yellow) spot (it turns **green**); click it again (clears); click a different one (the pick moves); **Submit**. Then **refresh**. Re-open the same lot. Click **Withdraw request**, pick a different spot, and submit again.
3. **Expected:**
   - Picking is single-spot: only one spot is ever green; taken/disabled spots don't respond.
   - After **Submit**, the banner shows `lot · spot — Pending approval`, the map + Submit/Clear are **disabled**, and the panel shows read-only "Your request".
   - After **refresh**, the request persists (loaded by `fetchMyInterest`), and re-opening its lot pre-selects the green spot.
   - **Withdraw** re-opens picking (banner clears); you can pick + submit a fresh spot.
   - Submitting a second time doesn't create a duplicate — it replaces the one active request (upsert). Hitting the API with two spot ids returns **400**; an already-taken spot returns **409** shown in red.
4. **Admin cross-check (needs U6):** once an admin assigns you, your request reads **Approved — spot assigned** and Withdraw is gone.

**☁️ Cloud check (optional):** needs **B6** deployed. Deploy the frontend, log in as a student, pick + submit a spot, refresh — it persists. (The other half of the E2E lands with U6.)

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U5: student self-service map — pick a spot, submit/withdraw interest (single active request)"
git push -u origin cr/u5-student-interest
```

Open a PR with **base = `cr/u4-save-status`**. Paste your "Prove it works" output. Record it in the [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker).

---

## 🧯 If something breaks

- **Clicking a spot does nothing** — confirm the spot is `available` and no request is active (`locked`); a submitted request disables picking until you withdraw.
- **`s.interest` is `undefined`** — you skipped Step 2; the reducer isn't registered.
- **Students get 403 reading a lot's spaces** — `GET /api/lots/:id/spaces` must be **login-gated, not admin-only** (contract change from U3/U4). Fix the backend guard.
- **400 on submit** — you sent an empty `spaceIds`, or more than one. The PoC allows exactly one picked spot.
- **409 on submit** — the spot was taken between load and submit; refetch the lot's spaces and pick another.
- **The map + Submit stay disabled forever** — that's `locked` (`mine != null`). Use **Withdraw request** (only shown while `pending`) to re-open; a `fulfilled` request is intentionally locked.
- **Refreshing loses the request** — it was only in Redux, not the DB. Confirm `registerInterest` calls `api.post` and B6 persists it.
- **Set-state-in-effect eslint error** — reset `pickedSpaceId` in click/nav handlers, not a `useEffect`.

---

## 📝 Recap

- You built your first **write** thunk (`registerInterest`, a `POST`) and a **withdraw** thunk (`withdrawInterest`, a `DELETE`) alongside the **read** (`fetchMyInterest`) — one thunk per verb.
- You reused the **campus→lot→spots map** (pan/zoom, normalized coords) from U3/U8 on the **student** side, minus the sidebar, and made spots **clickable to pick** — single-spot, toggle-to-clear, replace-on-new.
- You modelled a real **request lifecycle** with controlled-by-state UI: pick → **submit (locks)** → **withdraw (re-opens)**, and a `fulfilled` request that's fully locked.
- You proved persistence the right way — the picked spot and status survive a refresh.

---

## 📚 References

- [React docs — Reacting to input with state](https://react.dev/learn/reacting-to-input-with-state) — pick-mode vs locked "your request" from one piece of data.
- [MDN — Using the Fetch API (POST)](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) — how the picked spot gets sent.
- [Redux Toolkit — createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) — the thunk pattern for all three verbs.
- [Lesson U3](U3-show-real-lots-and-spaces.md) & [U8](U8-place-and-arrange-spots.md) — the map, normalized coordinates, and pan/zoom this screen reuses.
- Source of truth: [UI guide → CR U5](../ui-development-guide.md#cr-u5--student-registers-interest-core-feature-1).

---

## ➡️ Next lesson

**[Lesson U6 — Admin assigns spaces](U6-admin-assigns-spaces.md).** You'll build the other half: an admin sees pending requests (with the student's name and picked spot as a hint), assigns a real space, and flips the status `pending → fulfilled` — which is exactly the "Approved — spot assigned" state this screen shows. → [source CR](../ui-development-guide.md#cr-u6--admin-assigns-spaces-core-feature-2).
