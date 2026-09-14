# Lesson U6 — Admin assigns spaces (core feature #2)

> **Track:** Frontend · **Lesson 7 of 10**
> **⏱ Time:** ~75 min · **🎚 Difficulty:** moderate (several moving pieces — a per-lot request list, a click handler that now talks to the server, and a second select-then-act flow for unassign/move)
> **🧩 Prerequisites:** you've done [Lesson U5 — Student registers interest](U5-student-registers-interest.md); backend **B7** (the assignments endpoint) running.
> **🌿 CR branch:** `cr/u6-admin-assign` (off `cr/u5-student-interest`) · **📄 Source CR:** [ui guide → CR U6](../ui-development-guide.md#cr-u6--admin-assigns-spaces-core-feature-2) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

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

Right now the admin's **Manual Assign** button is a toy — it pops up a box asking you to *type* a student ID, and the "assignment" only lives in your browser tab; refresh and it's gone. By the end of this hour, Manual Assign — relabelled **"Assign to Spot"** — talks to the **real backend**: the admin picks a **pending interest request by name** — a request that now also shows **which spot the student asked for** (the `space_labels` sent in U5) — scoped to the currently-open lot, and clicks an open space to give it to them — for real, saved on the server. You'll also add the other half of the story: **unassigning** a student, and **moving** their request to a different lot.

Concretely, you will have:

- A `fetchInterest` [thunk](GLOSSARY.md#thunk) that loads **all** pending interest requests (the admin's view, not just "mine"), now carrying each requester's **name**.
- A `createAssignment` thunk that [`POST`](GLOSSARY.md#http-methods)s to `/api/assignments` and then **refreshes** the pending list.
- An `unassignSpace` thunk (`DELETE /api/assignments/:spaceId`) that frees a space **and** re-queues the student's request as `pending`.
- A `moveAssignment` thunk (`POST /api/assignments/move`) that frees a space and re-queues the occupant's request as `pending` **in a different lot**.
- An "Assign to Spot" sub-panel in `ControlBoard.tsx`, split into **requests for this lot** (clickable, by name, each showing **the spot they requested**) and **requests for other lots** (read-only), plus an unassign/move panel for an already-assigned spot.
- The **requested spot outlined on the map** (a green dashed border) once a request is picked, so the admin can find and click the exact spot the student chose.

**✅ Done when (your deliverable checklist):**
- [ ] With a lot selected and **Assign to Spot** open, you see **"Requests for this lot (N)"** listed by student **name** and the **spot they requested**, earliest-first, separate from a read-only **"Requests for other lots"** list.
- [ ] Clicking a request highlights it **and outlines the spot they requested on the map**; clicking an available space afterward turns that space **blue** (`assigned`) and the request disappears from the pending list.
- [ ] Logging in as that student (in a separate session) shows their request as **status: fulfilled**.
- [ ] Clicking an already-assigned (blue) space **selects** it and opens an **Unassign** / **Move request to another lot** sub-panel — it does not immediately unassign.
- [ ] **Unassign** frees the space and the student's request goes back to `pending` for that lot; **Move** frees the space and re-queues the request as `pending` in the chosen lot instead.
- [ ] Clicking a disabled space, or clicking an available space with no request picked, does **nothing**.
- [ ] A stale pick from another lot can never get assigned into the wrong lot (`pickedInterest.lot_id === selectedLotId` is checked before assigning).
- [ ] Your work is committed on branch `cr/u6-admin-assign` and pushed, PR base = `cr/u5-student-interest`.

**🖼 What changes on screen (before → after):**
```
      BEFORE (toy manual assign)                   AFTER (real assign/unassign/move)
┌───────────────────────────┐          ┌───────────────────────────┐
│   Admin Ctrl              │          │   Admin Ctrl              │
│   [Manual Assign]         │   ─▶     │   [Assign to Spot]        │
│                           │          │   This lot (2):           │
│  click a space → type a   │          │    Ana  · wants A3        │
│  student ID by hand       │          │    Ben  · wants —         │
│  (never saved anywhere)   │          │   [Unassign]  Move: [▾]   │
└───────────────────────────┘          └───────────────────────────┘
  the "assignment" only                  pick a request, click its
  lives in your browser tab              outlined spot — saved for real
```
Clicking an already-*assigned* space no longer assigns or removes anything on the spot — it now **selects** that space and opens the Unassign / Move sub-panel below it.

---

## 🤔 Why this lesson matters

Lesson U5 gave students a way to **ask** for a spot. But asking isn't getting — someone on the other side has to say yes. That's what U6 is: the other half of the same conversation. The student's request and the admin's assignment are two views onto **one shared piece of server truth** (the `interest` and `spaces` tables you built on the backend).

This is also your first lesson where a UI action **changes data that another user is looking at**. When the admin clicks "assign," the student's dashboard needs to reflect that — not because the browser magically syncs, but because the student's page will [`fetch`](GLOSSARY.md#fetch) again later and get the new answer from the server. Getting comfortable with "the server is the single source of truth, the UI just asks it questions" is the single most important mental model for the rest of your career as a web developer.

Finally, this CR is a good example of **replacing a fake feature with a real one without starting over**. The prototype's UI (the sidebar, the panel styling, the click-to-select flow) stays. Only the *data* — where the list of requests comes from, and what happens on click — gets rewired to the server. You'll do this again and again in real jobs: swap the wiring behind a screen that already looks right.

> **Scope note:** this lesson covers assigning/unassigning/moving a student who already filed an **interest request**. Assigning a *roster* student who never filed a request (e.g. one only entered via [CSV](GLOSSARY.md#csv) import) is a separate flow covered in the Student Management lesson.

> **New words ahead?** Every bolded term below links to the [**Glossary**](GLOSSARY.md) the first time it appears — click any you don't know, read the one-sentence version, and jump back. You never have to memorize a term before the lesson uses it.

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
| **Sending a DELETE request** | Asking the server to *remove* something (here, an assignment) — used to free a space and re-queue its occupant. | [MDN: HTTP DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) |
| **Resetting state in an event handler, not an effect** | Clearing "which spot/request is picked" belongs in the click handler that changes the lot or mode, not in a `useEffect` that reacts to them — the latter is exactly what the `react-hooks/set-state-in-effect` lint rule flags. | [React docs: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) |

---

## ✅ Before you start

**Time budget:** setup & branch (5 min) → Step 1, admin thunks (20) → Step 2, track the picked request/spot (15) → Step 3, the per-lot panel (20) → Step 4, click-to-assign/select + requested-spot outline (15) → Step 5, unassign/move sub-panel (10) → test & commit (10).

You need backend **B7** running (it adds `POST /api/assignments`), and at least one student registered interest — either do U5's flow yourself first, or seed the database. Log in as the seeded admin.

**Make your branch.** U6 continues where U5 left off, so branch off `cr/u5-student-interest`, not `main`:

```bash
git checkout cr/u5-student-interest
git checkout -b cr/u6-admin-assign
```

**What this does & why:** stacking branches this way means your PR for U6 only shows *this lesson's* diff, even though your working tree also has U5's code in it — GitHub compares against the U5 branch, not `main`. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Add admin thunks to `interestSlice.ts` (~20 min)

The student-facing [slice](GLOSSARY.md#slice) you built in U5 only tracks "my" request. The admin needs the **full** list of pending requests (with names, not just ids), a way to create an assignment, and ways to undo one. Add an `all` field and four thunks:

> **Contract change — interest now carries a name.** `GET /api/interest` items now include **`user_name`**, so the admin panel can show *who* is asking instead of a raw id. Add `user_name?: string;` next to `lot_name?` on the shared `Interest` [interface](GLOSSARY.md#interface) in `interestSlice.ts` (from U5) if it isn't there yet.

```ts
// fields to add to InterestState:
//   all: Interest[];        // admin's full list

// GET /api/interest?status=pending  -> Interest[]  (each item now includes user_name)
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

// DELETE /api/assignments/:spaceId  -> frees the space AND reverts the
// occupant's fulfilled interest for that lot back to "pending"
export const unassignSpace = createAsyncThunk(
  "interest/unassign",
  async (args: { spaceId: number; lotId: number }, { dispatch }) => {
    await api.del(`/api/assignments/${args.spaceId}`);
    await dispatch(fetchInterest("pending"));   // the student's request is pending again
    return args;
  }
);

// POST /api/assignments/move { fromSpaceId, toLotId }  -> frees the space
// and re-queues the occupant's request as "pending" in the NEW lot
export const moveAssignment = createAsyncThunk(
  "interest/move",
  async (args: { fromSpaceId: number; toLotId: number }, { dispatch }) => {
    await api.post("/api/assignments/move", { fromSpaceId: args.fromSpaceId, toLotId: args.toLotId });
    await dispatch(fetchInterest("pending"));   // re-queues the moved student's request as pending in the new lot
    return args;
  }
);
```

Notice neither thunk takes a `fromLotId`/source-lot argument, and neither dispatches `fetchSpaces` itself — each only re-dispatches `fetchInterest`. Refreshing the *spaces* grid is the calling component's job, done in a `.then()` after the dispatch (Steps 4–5) — that's deliberate: the thunk doesn't know which lot's grid is currently on screen, only `ControlBoard.tsx` does.

**Why it works & further reading:**
- `fetchInterest` calls the same `/api/interest` [endpoint](GLOSSARY.md#endpoint) U5 used — `GET`-only, but for *everyone's* pending requests, each now carrying `user_name`.
- [Redux Toolkit](GLOSSARY.md#redux-toolkit)'s `thunkAPI` hands `createAssignment` its own [`dispatch`](GLOSSARY.md#dispatch), so the payload creator can fire a *second* thunk (`fetchInterest`) once the `POST` resolves. → [RTK: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk).
- Refetching beats hand-patching state — only the server knows an interest row flipped to `fulfilled`, so asking it again can't drift out of sync. → [RTK: Optimistic Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates).
- `lotId` never leaves the browser — it's there only so `ControlBoard.tsx` (Step 4) knows which lot's spaces to refetch; the `POST` body itself is just `{ spaceId, userId, interestId }`.
- `unassignSpace`'s single `DELETE` frees the space **and** reverts the occupant's interest row to `pending` server-side, so the student re-enters the queue instead of vanishing. → [MDN: HTTP DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE).
- `api.post`/`api.del` attach the admin's [token](GLOSSARY.md#jwt) as an `Authorization` header automatically — how the backend knows an admin, not a visitor, is asking. → [MDN: Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization).
- `moveAssignment` only takes a target **lot**, not a target spot — the admin assigns the actual space afterward through the normal Step 4 flow, keeping one assign path instead of two.

Add `all: []` to `initialState`, and handle the new fulfilled action in [`extraReducers`](GLOSSARY.md#extrareducers):

```ts
.addCase(fetchInterest.fulfilled, (s, a) => { s.status = "idle"; s.all = a.payload; })
```

**Why it works & further reading:**
- Same "listen for `.fulfilled`" pattern as `fetchMyInterest` in U5, just writing to a different field (`state.all`) — the [reducer](GLOSSARY.md#reducer) only runs when the thunk actually succeeds.
- `unassignSpace`/`moveAssignment` don't need their own `all`-updating case — each re-dispatches `fetchInterest`, and *that* thunk's `.fulfilled` handler already does the real update. Each still gets a `.rejected` case wired to the shared `fail` handler, same as `createAssignment`.

### Step 2 — Track the chosen request and the chosen spot in `ControlBoard.tsx` (~15 min)

Assigning is a two-click flow: pick a request, *then* click a space. **Unassign/move is also two-click:** click an assigned (blue) space to select it, *then* pick Unassign or a target lot in the sub-panel. None of this is shared data — it only matters while the admin is mid-flow — so it all belongs in local component state, not Redux:

```tsx
import { fetchInterest, createAssignment, unassignSpace, moveAssignment, type Interest } from './store/interestSlice';
// ...
const interestList = useAppSelector(state => state.interest.all);   // admin's full pending list from Step 1
const [pickedInterest, setPickedInterest] = useState<Interest | null>(null);   // which request the admin clicked
const [assignedPick, setAssignedPick] = useState<Space | null>(null);          // which assigned space is selected for unassign/move
const [moveLotId, setMoveLotId] = useState<number | null>(null);              // target lot chosen in the Move dropdown

useEffect(() => { dispatch(fetchInterest('pending')); }, [dispatch]);   // load the pending list once, on mount

// Clears the "which spot is picked for unassign/move" state. Called directly
// from the lot-nav buttons and the "Assign to Spot" mode button below —
// NOT from a useEffect watching selectedLotId/editAction, which is exactly
// what the react-hooks/set-state-in-effect lint rule forbids.
function resetAssignPick() {
  setPickedInterest(null);
  setAssignedPick(null);
  setMoveLotId(null);
}
```

**Why it works & further reading:**
- `interestList` reads `all` the same way other pieces of `ControlBoard`'s state are read, via [`useAppSelector`](GLOSSARY.md#selector).
- `pickedInterest` is plain [React](GLOSSARY.md#react) [state](GLOSSARY.md#state) ([`useState`](GLOSSARY.md#usestate)), not [Redux](GLOSSARY.md#redux) — nothing outside this [component](GLOSSARY.md#component) needs to know about it. `assignedPick`/`moveLotId` are the same idea, for the Step 5 unassign/move flow.
- `resetAssignPick()` exists so a stale pick from a lot you've left, or a previous trip into Assign-to-Spot mode, can't linger — it's called directly from the lot-nav and mode-entry `onClick`s below, as a consequence of the action that changed lot/mode, not as a reaction to it.
- The [`useEffect`](GLOSSARY.md#useeffect) runs once on mount (`[dispatch]` never changes) so the panel isn't empty the first time it opens. → [React: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects).

**Wire the reset into the lot-nav buttons (built back in U3) and the mode-entry button:**

```tsx
// lot-nav button (U3) — add the reset alongside the existing dispatch
onClick={() => { dispatch(setSelectedLot(lot.id)); resetAssignPick(); }}

// the "Assign to Spot" menu button (was "Manual Assign")
onClick={() => { dispatch(setEditAction('manual')); resetAssignPick(); }}
```

**Why it works & further reading:**
- Both handlers call `resetAssignPick()` right after their original `dispatch(...)` — switching lots still works exactly as in U3, it just also clears any half-finished pick on the way out.
- That's what makes the `pickedInterest.lot_id === selectedLotId` guard hold in practice: a pick from the lot you just left can never carry over into the wrong one. → [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

### Step 3 — Show the Assign to Spot panel, split by lot (~20 min)

> **Menu note — grouped into sub-panels, with tooltips.** The old flat sidebar had **Manual Assign** and **Unassign** as separate top-level buttons. They're now one mode button, **"Assign to Spot"** (`editAction === 'manual'` — the internal name is unchanged, only the label), whose sub-panel handles picking a request, assigning, unassigning, *and* moving. Every main-menu button and sub-panel button gets a `title=` tooltip describing what it does — add one to each button you touch in this lesson.

The old panel rendered every pending request as `#<user_id>` with all lots mixed together — unusable once two students want the same lot. Split it into **"Requests for this lot"** (clickable, shown by name, earliest-first) and a read-only **"Requests for other lots"** hint:

```tsx
const requestsForThisLot = [...interestList]
  .filter(r => r.lot_id === selectedLotId)               // only requests for the lot currently open
  .sort((a, b) => a.created_at.localeCompare(b.created_at));   // earliest submitted = first-come order
const requestsForOtherLots = interestList.filter(r => r.lot_id !== selectedLotId);   // read-only hint list
```

Add a tiny helper above the return, so a request with no chosen spot still reads sensibly (older lot-only data):

```tsx
// The spot(s) the student picked in U5, or a hint when they only asked for the lot.
const requestedSpotText = (req: Interest) =>
  req.space_labels?.length ? req.space_labels.join(', ') : 'no specific spot';
```

Then render the panel — each row now also names the requested spot:

```tsx
{editAction === 'manual' && (
  <div style={{ background: '#fff', color: '#000', borderRadius: '10px', padding: '8px', fontSize: '0.8rem' }}>
    <b>Assign to Spot</b>

    {/* This lot's requests are clickable — picking one arms the assign click in Step 4 */}
    <div style={{ marginTop: '6px', fontWeight: 600 }}>Requests for this lot ({requestsForThisLot.length})</div>
    {requestsForThisLot.length === 0 && <div>None</div>}
    {requestsForThisLot.map(req => (
      <div
        key={req.id}
        title={`Approve ${req.user_name ?? `user #${req.user_id}`}'s request`}
        onClick={() => setPickedInterest(req)}
        style={{
          padding: '4px', cursor: 'pointer', borderRadius: '4px',
          background: pickedInterest?.id === req.id ? '#f5c542' : 'transparent',   // gold highlight when picked
        }}
      >
        {req.user_name ?? `user #${req.user_id}`} · wants {requestedSpotText(req)}
      </div>
    ))}

    {/* Read-only — switching lots is required before these can be acted on */}
    {requestsForOtherLots.length > 0 && (
      <>
        <div style={{ marginTop: '8px', fontWeight: 600 }}>Requests for other lots</div>
        {requestsForOtherLots.map(req => (
          <div key={req.id} style={{ padding: '4px', opacity: 0.6 }} title="Switch to this lot to assign this request">
            {req.user_name ?? `user #${req.user_id}`} → {req.lot_name ?? `lot ${req.lot_id}`}
          </div>
        ))}
      </>
    )}

    {/* Guides the admin to the next click once a request is picked */}
    {pickedInterest && <div style={{ marginTop: '6px' }}>Approving <b>{pickedInterest.user_name ?? `user #${pickedInterest.user_id}`}</b> — wants spot <b>{requestedSpotText(pickedInterest)}</b> — now click an available space →</div>}
  </div>
)}
```

**Why it works & further reading:**
- `{editAction === 'manual' && (...)}` is the usual "only render while in this mode" guard.
- Filtering by `r.lot_id === selectedLotId` is what splits "this lot" from "other lots" — the fix for one long mixed-lot list once two students want the same lot.
- `.sort(...)` on `created_at` orders this lot's requests earliest-first, matching first-come order.
- `req.user_name ?? \`user #${req.user_id}\`` shows a **name** now that the backend sends one; `requestedSpotText(req)` shows the **spot** the student picked in U5 (or `no specific spot` for older lot-only data).
- "Requests for other lots" rows have no `onClick` and are dimmed — a read-only hint, not a dead end (switching lots makes them actionable).

### Step 4 — Make clicking a space assign it — or select it for unassign/move (~15 min)

Now wire the payoff. In Assign to Spot mode, a click means one of two things depending on the space's colour: click an **available** (yellow) space with a request picked → assign; click an **assigned** (blue) space → *select* it (Step 5's sub-panel then offers Unassign or Move). Find `renderParkingLot`'s space `onClick` and extend it:

```tsx
onClick={() => {
  if (isSelecting) { dispatch(toggleSpaceSelection(space.id)); return; }   // space-select mode from earlier lessons — unchanged
  if (editAction !== 'manual' || selectedLotId == null) return;           // only act while in Assign to Spot mode, with a lot open

  if (space.status === 'assigned') {
    // Select it for the Step 5 sub-panel — do NOT unassign on this click.
    setAssignedPick(space);
    return;
  }
  if (pickedInterest && space.status === 'available' && pickedInterest.lot_id === selectedLotId) {   // guards against a stale cross-lot pick
    dispatch(createAssignment({
      spaceId: space.id,
      userId: pickedInterest.user_id,
      interestId: pickedInterest.id,
      lotId: selectedLotId,
    }));
    setPickedInterest(null);              // clear the highlight so the next click doesn't reuse this request
    dispatch(fetchSpaces(selectedLotId));   // re-colour the lot
  }
}}
```
(Make sure `fetchSpaces` is imported from `parkingSlice` alongside the other actions, if it isn't already.)

**Why it works & further reading:**
- The `isSelecting` branch is unchanged from earlier lessons; the mode/lot guard below it stops everything else from running outside Assign to Spot.
- Clicking an **assigned** space now *selects* it (`setAssignedPick`) instead of unassigning immediately — Step 5's sub-panel reads that pick and offers Unassign/Move.
- Clicking an **available** space only assigns when `pickedInterest.lot_id === selectedLotId` — closes a real bug where a stale cross-lot pick could assign into the wrong lot's space.
- `createAssignment` already re-dispatches `fetchInterest` internally, so the request disappears from the panel on its own; `dispatch(fetchSpaces(selectedLotId))` is the separate call that re-colors the grid, since `createAssignment` never touches the spaces list.

**Outline the picked request's spot on the map.** Showing the requested spot in the list is good; outlining it **on the map** is better — the admin can see exactly which box the student wants and click it. Add a helper next to the space-colour logic (`spaceColor`, from U3):

```tsx
// The spot the picked request asked for — outlined on the map so the admin
// can find and approve the exact spot the student chose.
const isRequestedSpot = (space: Space) =>
  editAction === 'manual' && !!pickedInterest?.space_ids?.includes(space.id);
```

Then, where each space is drawn in `renderParkingLot` (the same element whose `onClick` you extended above), give a requested spot a distinct border:

```tsx
border: isRequestedSpot(space) ? '3px dashed #2e7d32' : '1px solid #1a3d7a',
```

**Why it works & further reading:**
- `isRequestedSpot` is true only in Assign to Spot mode, for a space whose `id` is in the picked request's `space_ids` — so the outline tracks exactly which request is selected.
- The dashed green border reads as "the target," visually distinct from the available/assigned/disabled fills already on the map.

### Step 5 — Unassign or move the selected assigned spot (~10 min)

Add a second sub-panel that appears once `assignedPick` is set — it offers **Unassign** (send the occupant back to the pending queue for this lot) or **Move request to another lot** (send them to the pending queue for a *different* lot instead):

```tsx
{editAction === 'manual' && assignedPick && selectedLotId != null && (
  <div style={{ background: '#fff', color: '#000', borderRadius: '10px', padding: '8px', fontSize: '0.8rem', marginTop: '6px' }}>
    <b>Spot {assignedPick.label} — assigned</b>

    <div style={{ marginTop: '6px' }}>
      <button
        title="Free this spot and put the student back in the pending queue for this lot"
        onClick={() => {
          const who = assignedPick.assigned_user_name ?? `user #${assignedPick.assigned_user_id ?? '?'}`;
          if (!window.confirm(`Unassign ${who} from ${assignedPick.label}? Their request goes back to the pending queue.`)) return;   // bail out on Cancel
          dispatch(unassignSpace({ spaceId: assignedPick.id, lotId: selectedLotId })).then(() => dispatch(fetchSpaces(selectedLotId)));   // re-colour after the DELETE resolves
          resetAssignPick();
        }}
      >
        Unassign
      </button>
    </div>

    <div style={{ marginTop: '8px' }}>
      <div>Move request to another lot:</div>
      <select
        title="Pick the lot to re-queue this student's request into"
        value={moveLotId ?? ''}
        onChange={e => setMoveLotId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Choose a lot…</option>
        {lots.filter(l => l.id !== selectedLotId).map(l => (   // every lot EXCEPT the one being viewed
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <button
        title="Free this spot; the request re-queues as pending in the chosen lot"
        disabled={moveLotId == null}
        onClick={() => {
          const fromLotId = selectedLotId;   // capture before the async dispatch resolves
          dispatch(moveAssignment({ fromSpaceId: assignedPick.id, toLotId: moveLotId! })).then(() => {
            dispatch(fetchSpaces(fromLotId));   // freed spot becomes available here
            resetAssignPick();
          });
        }}
      >
        Move
      </button>
    </div>
  </div>
)}
```

**Why it works & further reading:**
- This panel only renders once an assigned space is *picked* (Step 4) — "select, then choose an action," not act-on-click.
- **Unassign** confirms via a plain `window.confirm(...)` naming the student and spot before dispatching `unassignSpace`; since the thunk only refreshes the interest list, the handler chains `.then(...)` to also refetch spaces, then clears the pick.
- **Move** only asks for a target **lot** — the admin assigns the actual spot afterward in that lot via the normal Step 4 flow, so there's one assign path, not two. No confirm dialog here (only Unassign asks).
- `moveAssignment` takes no source-lot argument, so the handler captures `selectedLotId` into `fromLotId` *before* dispatching, then refetches that lot's spaces once the move resolves.

**UI mock (after this phase).** Admin in **Assign to Spot**: Ana's request (this lot) is picked (gold) and the spot she asked for is **outlined (dashed)** on the map, about to be clicked, which then turns blue (assigned). A second admin session has instead clicked an already-assigned space, opening the Unassign/Move sub-panel.
```
┌──────────────────────────────────────────────────────────┐
│ LTRide                                                  ☰  │
├───────────────┬──────────────────────────────────────────┤
│ ┌───────────┐ │                                            │
│ │Admin Ctrl │ │   ▢ ▢ ⬚ ▢ ▢ ▢   ▦ ▢ ▢ ▢                   │  ▢ available
│ │Assign Spot│ │   ▢ ▢ ▢ ▢ ▢ ▢   ▢ ▢ ▢ ▢                   │  ⬚ requested (dashed)
│ └───────────┘ │   ▢ ▢ ▢ ▢ ▢ ▢                              │  ▦ assigned (blue)   ▣ disabled
│ ┌───────────┐ │                                            │
│ │This lot(2)│ │       ↑ click any ▢ to assign it           │
│ │ Ana     ▣ │ │         to the picked request              │
│ │ Ben       │ │                                            │
│ │Other lots │ │   [Home][Lot A][Lot B]                     │
│ │ Cam→Lot B │ │   Edit Mode ●——                            │
│ └───────────┘ │                                            │
│ ┌───────────┐ │   (clicking a ▦ instead selects it and     │
│ │Spot 7-3   │ │    shows Unassign / Move-to-lot below)     │
│ │ [Unassign]│ │                                            │
│ │ Move: [▾] │ │                                            │
│ │    [Move] │ │                                            │
│ └───────────┘ │                                            │
│ [👤 My Acct]  │                                       LT   │
└───────────────┴──────────────────────────────────────────┘
```

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend running (through **B7**); at least two students have registered interest **in the same lot** (do U5's flow twice, or seed it); log in as **admin**.
2. **Steps (assign):** select that lot → **Assign to Spot** → confirm both requests show under "Requests for this lot", by **name and the spot each one requested**, earliest-first, and any other-lot requests show read-only under "Requests for other lots" → click a request (it highlights gold **and its requested spot gets a dashed outline on the map**) → click that outlined (or any available yellow) space in that lot.
3. **Expected (assign):**
   - Each request row names the student **and their requested spot** (e.g. `Ana · wants A3`); a lot-only request reads `no specific spot`.
   - Picking a request **outlines its requested spot** (green dashed) on the map.
   - The clicked space turns **blue** (`assigned`); the request disappears from the pending list (now `fulfilled`).
   - Log in separately as that student → their dashboard shows **status: fulfilled**.
   - Clicking an already-assigned or disabled space does not assign; assigning when no request is picked does nothing.
4. **Steps (unassign):** with the same admin, click the now-blue space → the Unassign/Move sub-panel appears (selecting it did **not** unassign it) → click **Unassign** → confirm the `window.confirm(...)` prompt.
5. **Expected (unassign):** the space turns **available** (yellow) again; that student's request reappears under "Requests for this lot" as `pending`.
6. **Steps (move):** re-assign the space to a student, click the blue space again, choose a different lot from the **Move** dropdown, click **Move**.
7. **Expected (move):** the space in the original lot turns **available**; switching to the target lot's "Assign to Spot" panel shows that student's request now under "Requests for this lot", `pending` — assign it there the normal way to finish placing them.
8. **Nav check:** while a request or an assigned space is picked, click a different lot (or leave and re-enter Assign to Spot) — the pick clears; it doesn't carry over and silently apply to the new lot/mode.

**☁️ Cloud check (optional):** needs backend **B7** deployed. `./release.sh all`, then run the **full two-window E2E story (Part F2)** against the **live site** instead of localhost — student registers, admin assigns, student sees `fulfilled`. This is the real end-to-end production test.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U6: Assign to Spot (by-name, per-lot) + unassign/move via /api/assignments"
git push -u origin cr/u6-admin-assign
```

Then open a Pull Request on GitHub with **base = `cr/u5-student-interest`**. Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **"Requests for this lot" is always empty even though someone registered interest** — you're probably filtering on the wrong lot, or the request really is for a different lot (check "Requests for other lots"). Double-check backend **B7** is running and that `fetchInterest('pending')` is actually being dispatched (Network tab: `GET /api/interest?status=pending`).
- **Requests show `user #3` instead of a name** — the backend response is missing `user_name`; confirm `GET /api/interest` returns it and that you added `user_name?: string;` to the `Interest` interface.
- **Clicking a space does nothing at all** — make sure `editAction === 'manual'` is true (Assign to Spot is selected) and, for the assign path, that you clicked a request first; the click handler's guards silently no-op otherwise, by design.
- **The space turns blue but the request never leaves the panel** — check that `createAssignment`'s payload creator actually awaits `dispatch(fetchInterest("pending"))`; if that line is missing or not awaited, the panel is showing stale data.
- **Space color doesn't update after assigning** — you likely forgot the `dispatch(fetchSpaces(selectedLotId))` call in Step 4; `createAssignment` only refreshes the interest list, not the spaces grid.
- **Clicking a blue space immediately unassigns it, with no sub-panel** — that's the old U-23 behaviour; make sure Step 4's `onClick` selects (`setAssignedPick`) instead of dispatching `unassignSpace` directly, and that Step 5's sub-panel is the only place `unassignSpace` gets dispatched from.
- **Unassign frees the space but the student's request never comes back** — the bug is server-side: `DELETE /api/assignments/:spaceId` must both clear the space and flip the interest row back to `pending`, not just clear the space.
- **Move succeeds but the admin can't find the student in the target lot** — the moved request lands as `pending` (not auto-assigned by design), so look under that lot's "Requests for this lot," not among assigned/blue spaces.
- **Moving an available (not-yet-assigned) space 409s** — expected: `POST /api/assignments/move` requires the *source* space to be `assigned`; Move only appears once a space is already assigned, so this should only happen if you call the thunk manually out of order.
- **A stale pick from another lot leaks into this one** — confirm the lot-nav buttons and the Assign-to-Spot mode button both call `resetAssignPick()` directly in their `onClick` (Step 2); don't try to fix this with a `useEffect` watching `selectedLotId`/`editAction`.
- **Every request shows "no specific spot"** — the student registered before U5 sent `spaceIds`, or the backend isn't returning `space_labels` on `GET /api/interest`. Register a fresh request via U5's flow and confirm the response includes `space_labels`.
- **The requested spot isn't outlined on the map** — check `isRequestedSpot` reads `pickedInterest?.space_ids` (not `space_labels`), that you actually picked a request, and that you're in `manual` (Assign to Spot) mode.
- **401/403 from `/api/assignments`, the DELETE, or the move endpoint** — confirm you're logged in as an **admin** (not a student) and that `api.post`/`api.del` are sending the `Authorization` header (check you didn't log out in another tab, clearing the shared token).

---

## 📝 Recap — what you built and learned

- You added an **admin's-eye** view of pending interest (`fetchInterest`) alongside the student's-eye view from U5 — and made it show **names**, split **per lot**, so choosing which student to approve is actually usable.
- You surfaced **which spot each student requested** — in the request rows and as a dashed green outline on the map — by reading the `space_labels`/`space_ids` the student sent in U5, so the admin can approve the exact spot chosen.
- You built thunks that **chain** a mutation and a refetch (`createAssignment`/`unassignSpace`/`moveAssignment` → `fetchInterest`/`fetchSpaces`) — the "ask the server again" pattern you'll reuse constantly.
- You wired a real two-click assign flow (pick a request, then click a space) and a real two-click unassign/move flow (select an assigned space, then choose an action) on top of state that already existed in the prototype.
- You closed a cross-lot bug (`pickedInterest.lot_id === selectedLotId`) and learned to reset "which thing is picked" state directly in the event handler that changes lot/mode — not in a `useEffect`.
- You saw the admin menu reorganized into mode buttons + sub-panels ("Assign to Spot") with tooltips on every button.
- You replaced a browser-only fake feature with a server-backed real one, without touching the surrounding UI.

---

## 📚 References

- [Redux Toolkit — createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) — the `thunkAPI` argument and dispatching from inside a thunk.
- [Redux Toolkit — Optimistic Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates) — contrasts refetch-after-mutation with optimistic local updates.
- [MDN — Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) — POST requests with `fetch`.
- [MDN — HTTP DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) — used by `unassignSpace`.
- [React docs — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — why `resetAssignPick()` is called from event handlers, not a `useEffect`.
- [MDN — Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) — how the admin's token proves who's asking.
- [React docs — Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects) — the `useEffect` re-fetch-on-mount pattern.
- [GitHub Docs — Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [ui guide → CR U6](../ui-development-guide.md#cr-u6--admin-assigns-spaces-core-feature-2).

---

## ➡️ Next lesson

**[Lesson U7 — Update the school map image](U7-update-school-map.md).** You'll wire a file-upload button so an admin can replace a lot's map image — your first request that isn't JSON. → [source CR](../ui-development-guide.md#cr-u7--update-the-school-map-image).
