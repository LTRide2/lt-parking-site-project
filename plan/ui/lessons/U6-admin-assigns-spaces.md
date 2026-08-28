# Lesson U6 — Admin assigns spaces (core feature #2)

> **Track:** Frontend · **Lesson 7 of 8**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (two moving pieces — a new list to fetch and a click handler that now talks to the server)
> **🧩 Prerequisites:** you've done [Lesson U5 — Student registers interest](U5-student-registers-interest.md); backend **B7** (the assignments endpoint) running.
> **🌿 CR branch:** `cr/u6-admin-assign` (off `cr/u5-student-interest`) · **📄 Source CR:** [ui guide → CR U6](../ui-development-guide.md#cr-u6--admin-assigns-spaces-core-feature-2) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Right now the admin's **Manual Assign** button is a toy — it pops up a box asking you to *type* a student ID, and the "assignment" only lives in your browser tab; refresh and it's gone. By the end of this hour, Manual Assign talks to the **real backend**: the admin picks a **pending interest request** (which already knows who the student is) and clicks an open space to give it to them — for real, saved on the server.

Concretely, you will have:

- A `fetchInterest` thunk that loads **all** pending interest requests (the admin's view, not just "mine").
- A `createAssignment` thunk that `POST`s to `/api/assignments` and then **refreshes** the pending list.
- A "Pending requests" panel in `ControlBoard.tsx` where the admin picks a request.
- A click handler that, once a request is picked, assigns the clicked space to that student.

**✅ Done when (your deliverable checklist):**
- [ ] With **Edit Mode** on and **Manual Assign** selected, you see a "Pending requests" list (not an empty box, assuming someone has registered interest).
- [ ] Clicking a request highlights it; clicking an available space afterward turns that space **blue** (`assigned`) and the request disappears from the pending list.
- [ ] Logging in as that student (in a separate session) shows their request as **status: fulfilled**.
- [ ] Clicking an already-assigned/disabled space, or clicking a space with no request picked, does **nothing**.
- [ ] Your work is committed on branch `cr/u6-admin-assign` and pushed, PR base = `cr/u5-student-interest`.

---

## 🤔 Why this lesson matters

Lesson U5 gave students a way to **ask** for a spot. But asking isn't getting — someone on the other side has to say yes. That's what U6 is: the other half of the same conversation. The student's request and the admin's assignment are two views onto **one shared piece of server truth** (the `interest` and `spaces` tables you built on the backend).

This is also your first lesson where a UI action **changes data that another user is looking at**. When the admin clicks "assign," the student's dashboard needs to reflect that — not because the browser magically syncs, but because the student's page will `fetch` again later and get the new answer from the server. Getting comfortable with "the server is the single source of truth, the UI just asks it questions" is the single most important mental model for the rest of your career as a web developer.

Finally, this CR is a good example of **replacing a fake feature with a real one without starting over**. The prototype's UI (the sidebar, the panel styling, the click-to-select flow) stays. Only the *data* — where the list of requests comes from, and what happens on click — gets rewired to the server. You'll do this again and again in real jobs: swap the wiring behind a screen that already looks right.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Sending a POST request** | Asking the server to *create* something (here, an assignment), as opposed to just reading data. | [MDN: Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) |
| **`createAsyncThunk` (Redux Toolkit)** | Wraps an async API call so Redux can track its loading/success/error state automatically. | [Redux Toolkit: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) |
| **Dispatching from inside a thunk** | A thunk's function receives `dispatch` itself, so it can kick off *another* thunk (e.g. "refresh the list") when it finishes. | [Redux Toolkit: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) (see the `thunkAPI` argument) |
| **Refetch-after-mutation** | After changing data on the server, ask the server for the *current* list again rather than guessing what changed — simpler and less error-prone than patching local state by hand. | [Redux Toolkit: Optimistic Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates) (contrasts this with the "update first, hope it works" approach) |
| **`Authorization` header** | How the admin's login token rides along on every request so the server knows *who* is asking and checks they're allowed to assign spaces. | [MDN: Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) |
| **Re-fetching on mount (`useEffect`)** | Running a fetch once when a component first appears, so its list is fresh instead of stale/empty. | [React docs: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → Step 1, admin thunks (15) → Step 2, track the picked request (10) → Step 3, the panel (15) → Step 4, click-to-assign (10) → test & commit (5).

You need backend **B7** running (it adds `POST /api/assignments`), and at least one student registered interest — either do U5's flow yourself first, or seed the database. Log in as the seeded admin.

**Make your branch.** U6 continues where U5 left off, so branch off `cr/u5-student-interest`, not `main`:

```bash
git checkout cr/u5-student-interest
git checkout -b cr/u6-admin-assign
```

**What this does & why:** stacking branches this way means your PR for U6 only shows *this lesson's* diff, even though your working tree also has U5's code in it — GitHub compares against the U5 branch, not `main`. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Add admin thunks to `interestSlice.ts` (~15 min)

The student-facing slice you built in U5 only tracks "my" request. The admin needs the **full** list of pending requests, plus a way to create an assignment. Add an `all` field and two thunks:

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

**Explanation, piece by piece:**
- `fetchInterest` takes a `statusFilter` argument (defaulting to `"pending"`) and calls `GET /api/interest?status=pending` — the same endpoint U5 used, but without narrowing to "mine." That's the admin's-eye view of everyone's requests.
- `createAssignment`'s payload creator is an `async` function that does **two** things in sequence: first it `POST`s the new assignment, then it **dispatches `fetchInterest` again** using the `dispatch` Redux Toolkit hands it in the second argument (`thunkAPI`). → [createAsyncThunk docs](https://redux-toolkit.js.org/api/createAsyncThunk).
- Why refetch instead of just removing the assigned request from `all` by hand? Because the server is the one place that actually knows the new truth (the request's `status` flipped to `fulfilled` there). Asking it again is simpler and can't drift out of sync. → [Refetch vs. optimistic update](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates).
- `api.post` (from `src/api/client.ts`, built in U0) automatically attaches `Authorization: Bearer <token>` to the request — that's how the backend knows this call is coming from a logged-in admin and not a random visitor. → [MDN: Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization).

Add `all: []` to `initialState`, and handle the new fulfilled action in `extraReducers`:

```ts
.addCase(fetchInterest.fulfilled, (s, a) => { s.status = "idle"; s.all = a.payload; })
```

**What this does:** whenever `fetchInterest` finishes successfully, the reducer copies the returned array into `state.all`. This is the exact same "listen for `.fulfilled`" pattern you used for `fetchMyInterest` in U5, just writing to a different field.

### Step 2 — Track the chosen request in `ControlBoard.tsx` (~10 min)

Assigning is a two-click flow: pick a request, *then* click a space. The "which request is picked right now" only matters while you're doing that — it isn't shared data, so it belongs in local component state, not Redux:

```tsx
import { fetchInterest, createAssignment, type Interest } from './store/interestSlice';
// ...
const interestList = useAppSelector(state => state.interest.all);
const [pickedInterest, setPickedInterest] = useState<Interest | null>(null);

useEffect(() => { dispatch(fetchInterest('pending')); }, [dispatch]);
```

**Explanation:**
- `interestList` reads the `all` array you just added, the same way `selectedLotId` and the other pieces of `ControlBoard`'s state are already read via `useAppSelector`.
- `pickedInterest` is plain React state (`useState`), not Redux — it only exists to remember "which request is highlighted" between the two clicks, and nothing outside this component needs to know about it.
- The `useEffect` runs once when `ControlBoard` mounts (its dependency array is just `[dispatch]`, which never changes) and loads the pending list right away, so the panel isn't empty the first time the admin opens Manual Assign. → [React docs: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects).

### Step 3 — Show the interest panel (~15 min)

Add this inside the sidebar, so it appears whenever the admin has **Manual Assign** selected (`editAction === 'manual'`):

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

**Explanation:**
- `{editAction === 'manual' && (...)}` is React's usual "only render this if the condition is true" trick — the panel only shows up while the admin is in Manual Assign mode.
- `interestList.map(...)` draws one row per pending request. `key={req.id}` is required by React whenever you render a list, so it can tell rows apart across re-renders.
- Clicking a row calls `setPickedInterest(req)`, which re-renders the panel with that row highlighted (`background: '#f5c542'` — the same yellow the rest of the app uses for "selected").
- `req.lot_name ?? \`lot ${req.lot_id}\`` — the `??` ("nullish coalescing") operator means "use `lot_name` if the backend sent one, otherwise fall back to a plain `lot ${id}` string." It's a small defensive touch in case older data doesn't have a joined lot name.
- The hint line ("Now click an available space →") only appears once a request is picked, guiding the admin to the next step.

### Step 4 — Make clicking a space assign it (~10 min)

Now wire the payoff: clicking a space, while a request is picked and that space is open, creates the assignment. Find `renderParkingLot`'s space `onClick` and extend it:

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
(Make sure `fetchSpaces` is imported from `parkingSlice` alongside the other actions, if it isn't already.)

**Explanation:**
- The first `if` is unchanged from earlier lessons — while the admin is *selecting spaces to enable/disable*, a click just toggles the selection and stops there.
- The second `if` is new: it only fires in Manual Assign mode, only when a request has been picked, and only when the clicked space is actually `available`. Guarding on all three means stray clicks (no request picked, or clicking an already-blue/disabled space) safely do nothing — that's your "clicking does nothing" checklist item.
- `dispatch(createAssignment({...}))` sends the `POST` from Step 1. Because `createAssignment` also dispatches `fetchInterest` internally, the pending list updates on its own — you don't need to do anything extra here to make the request disappear from the panel.
- `setPickedInterest(null)` clears the local "picked" highlight so the admin doesn't accidentally assign the *next* space to the *same* request by mistake.
- `dispatch(fetchSpaces(selectedLotId))` re-fetches this lot's spaces so the grid re-colors the assigned space blue. `createAssignment` only refreshes the *interest* list, not the *spaces* list, so this second dispatch is what actually updates the grid you're looking at.

**UI mock (after this phase).** Admin in Manual Assign: request `#1 → Lot A` is picked (yellow), about to click an available space, which then turns blue (assigned).
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

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend running (through **B7**); at least one student has registered interest (do U5's flow first, or seed it); log in as **admin**.
2. **Steps:** **Edit Mode** on → **Manual Assign** → click a request in "Pending requests" (it highlights yellow) → click an available (white) space in that lot.
3. **Expected:**
   - The clicked space turns **blue** (`assigned`); the request disappears from the pending list (now `fulfilled`).
   - Log in separately as that student → their dashboard shows **status: fulfilled**.
   - Clicking an already-assigned or disabled space does nothing; assigning when no request is picked does nothing.

**☁️ Cloud check (optional):** needs backend **B7** deployed. `./release.sh all`, then run the **full two-window E2E story (Part F2)** against the **live site** instead of localhost — student registers, admin assigns, student sees `fulfilled`. This is the real end-to-end production test.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U6: admin interest panel + Manual Assign via POST /api/assignments"
git push -u origin cr/u6-admin-assign
```

Then open a Pull Request on GitHub with **base = `cr/u5-student-interest`**. Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **"Pending requests" is always empty** — double-check backend **B7** is running and that `fetchInterest('pending')` is actually being dispatched (check the Network tab for `GET /api/interest?status=pending`). Also confirm a student actually registered interest first (U5).
- **Clicking a space does nothing at all** — make sure `editAction === 'manual'` is true (Manual Assign is selected) and that you clicked a request first; the click handler's guard silently no-ops otherwise, by design.
- **The space turns blue but the request never leaves the panel** — check that `createAssignment`'s payload creator actually awaits `dispatch(fetchInterest("pending"))`; if that line is missing or not awaited, the panel is showing stale data.
- **Space color doesn't update after assigning** — you likely forgot the `dispatch(fetchSpaces(selectedLotId))` call in Step 4; `createAssignment` only refreshes the interest list, not the spaces grid.
- **401/403 from `/api/assignments`** — confirm you're logged in as an **admin** (not a student) and that `api.post` is sending the `Authorization` header (check you didn't log out in another tab, clearing the shared token).

---

## 📝 Recap — what you built and learned

- You added an **admin's-eye** view of pending interest (`fetchInterest`) alongside the student's-eye view from U5.
- You built a thunk that **chains** a mutation and a refetch (`createAssignment` → `fetchInterest`) — the "ask the server again" pattern you'll reuse constantly.
- You wired a real two-click UI flow (pick a request, then click a space) on top of state that already existed in the prototype.
- You replaced a browser-only fake feature with a server-backed real one, without touching the surrounding UI.

---

## 📚 References

- [Redux Toolkit — createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) — the `thunkAPI` argument and dispatching from inside a thunk.
- [Redux Toolkit — Optimistic Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates) — contrasts refetch-after-mutation with optimistic local updates.
- [MDN — Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) — POST requests with `fetch`.
- [MDN — Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) — how the admin's token proves who's asking.
- [React docs — Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects) — the `useEffect` re-fetch-on-mount pattern.
- [GitHub Docs — Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [ui guide → CR U6](../ui-development-guide.md#cr-u6--admin-assigns-spaces-core-feature-2).

---

## ➡️ Next lesson

**[Lesson U7 — Update the school map image](U7-update-school-map.md).** You'll wire a file-upload button so an admin can replace a lot's map image — your first request that isn't JSON. → [source CR](../ui-development-guide.md#cr-u7--update-the-school-map-image).
