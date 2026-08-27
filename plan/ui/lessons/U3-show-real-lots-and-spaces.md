# Lesson U3 — Show real lots and spaces (data-driven map)

> **Track:** Frontend · **Lesson 4 of 8**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (a new pattern — fetch on load, render whatever comes back — but each piece is small)
> **🧩 Prerequisites:** you've completed [Lesson U2 — Routing](U2-routing.md) (on branch `cr/u2-routing`), and backend [Lesson B4 — Read lots and spaces](../../backend/lessons/B4-read-lots-and-spaces.md)'s endpoints (`GET /api/lots`, `GET /api/lots/:id/spaces`) are running and seeded.
> **🌿 CR branch:** `cr/u3-real-lots` (off `cr/u2-routing`) · **📄 Source CR:** [CR U3](../ui-development-guide.md#cr-u3--show-real-lots-and-spaces-data-driven-map) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Right now the parking grid is **faked**: `renderParkingLot()` just draws 3 rows × 2 columns × 20 boxes with made-up string IDs like `1-0-5`, and "disabled" only ever lived in your browser's memory — reload the page and it's gone. By the end of this hour, every lot and every space comes from the **real backend** (`GET /api/lots` and `GET /api/lots/:id/spaces`), and each space is colored by the server's own `status` field.

**✅ Done when (your deliverable checklist):**
- [ ] The bottom lot-nav lists the **real** lots returned by `GET /api/lots` — not a hard-coded `['Lot 1' .. 'Lot 17']` array.
- [ ] Clicking a lot draws **that lot's own real spaces** from `GET /api/lots/:id/spaces` (the seed gives Lot A 12 spaces and Lot B 8).
- [ ] Spaces are colored by the server's `status`: white = `available`, grey = `disabled`, blue = `assigned`.
- [ ] Clicking a space in Edit Mode still highlights it yellow — using its new numeric `id` instead of the old string ID.
- [ ] While a lot's spaces are loading you briefly see **"Loading…"**; if you stop the backend and click a lot, you see a **red error message**, not a blank or crashed page.
- [ ] Your work is committed on branch `cr/u3-real-lots` and pushed, PR base = `cr/u2-routing`.

---

## 🤔 Why this lesson matters (read this first — it's the "why")

Right now `ControlBoard.tsx` and `parkingSlice.ts` don't know anything about your database — they just draw the same 20 fake boxes for every lot and track "disabled" as a plain array of strings living in the browser tab. That's fine for a mockup, but it breaks the moment two things are true at once, which they now are: **backend B4 exists and knows the real lots and spaces**, and **the app needs to agree with the backend about what's true.**

This is the idea of a **single source of truth**. Today, if you disabled a space and then refreshed the page, it would forget — because "disabled" only existed in your browser's memory, not on the server. After this lesson, "disabled" (and later, "assigned") is a fact the *server* knows, and the browser just displays it. That's also *why* the data model changes shape: instead of tracking spaces as strings in three different arrays (`selectedSpaces: string[]`, `disabledSpaces: string[]`), every space now has a real numeric `id` and a `status` field the server assigns. Selection becomes `number[]`; "disabled" is no longer its own list — it's just `status === "disabled"`.

This lesson only makes the map **show** real data. Actually *changing* that data (disable/enable, and later assigning a space to a student) is deliberately left for lesson U4 and U6 — one change at a time, so each CR is small and easy to review. That's the same stacked-CR discipline from [Lesson U2](U2-routing.md), applied to data instead of routes.

> **Heads up if your files look bigger than the snippets below:** if `parkingSlice.ts` already has an `assignedSpaces` field, or `ControlBoard.tsx` already draws all 17 lots from a `LOT_CONFIGS` table over photos, that's expected — later work has already landed on top of this lesson's starting point. Keep that lot-photo code; this lesson only replaces **where the data comes from** (hard-coded strings → the server's numeric ids and `status`).

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **React `useEffect`** | Runs code in reaction to a component appearing or a value changing — this is how you say "go fetch when this screen shows up." | [React docs: `useEffect`](https://react.dev/reference/react/useEffect) |
| **Redux Toolkit `createAsyncThunk`** | Wraps an async API call so Redux automatically tracks whether it's pending, succeeded, or failed. | [Redux Toolkit docs: `createAsyncThunk`](https://redux-toolkit.js.org/api/createAsyncThunk) |
| **Rendering lists with `key`** | Turning an array of data (lots, spaces) into an array of elements on screen — React needs a stable `key` per item to track them. | [React docs: Rendering Lists](https://react.dev/learn/rendering-lists) |
| **Loading / error UI states** | Showing different UI depending on whether data is still loading, failed to load, or is ready. | [React docs: Conditional Rendering](https://react.dev/learn/conditional-rendering) |
| **`fetch` / HTTP requests** | The browser API that `api.get(...)` uses under the hood to ask a server for data over the network. | [MDN: Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) |

---

## ✅ Before you start

**Time budget for the hour:** branch (5 min) → rewrite `parkingSlice.ts` (15) → fix the auth field (5) → load data on mount (10) → draw spaces from data (15) → drive the lot-nav from real data (5) → test & commit (5).

**Make sure backend B4 is running and seeded first** — this lesson has nothing to fetch without it. Then open your terminal in the frontend project and make your branch. This CR branches off `cr/u2-routing`, not `main`, because it needs the routes and login you built in U1/U2 to already exist:

```bash
git checkout cr/u2-routing
git checkout -b cr/u3-real-lots
```

**What this does & why:** you're stacking this CR on top of U2's branch, the same [stacked-CR pattern](../ui-development-guide.md#part-c--how-we-work-one-branch-per-cr-stacked) from Lesson U2 — each lesson builds on the last one's branch instead of starting over from `main`.

---

## 🛠 Build it, step by step

### Step 1 — Rewrite `src/store/parkingSlice.ts` to be data-driven (~15 min)

Replace the whole file with this version:

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

**Explanation, piece by piece:**
- `interface Lot` / `interface Space` — these describe the exact shape the backend sends back. Note `status` is a **union of string literals**, not just `string` — TypeScript will now catch a typo like `"disbaled"` at compile time.
- `createAsyncThunk("parking/fetchLots", () => api.get("/api/lots") as Promise<Lot[]>)` — wraps the API call so Redux automatically fires three actions for you as the request happens: `pending` (started), `fulfilled` (succeeded, with the data), and `rejected` (failed, with an error). You never dispatch those three by hand. → [Redux Toolkit docs: `createAsyncThunk`](https://redux-toolkit.js.org/api/createAsyncThunk).
- `fetchSpaces` takes a `lotId` argument and returns `{ lotId, spaces }` — it bundles the id back in because by the time the response arrives, the reducer needs to know *which* lot's cache slot (`spacesByLot[lotId]`) to fill.
- `extraReducers` — this is where a slice reacts to actions it didn't define itself, like the three auto-generated thunk actions. `.addCase(fetchSpaces.pending, ...)` sets `status: "loading"` the instant the request starts; `.fulfilled` stores the data and clears loading; `.rejected` stores a human-readable error message from `action.error.message`.
- `selectedSpaces: number[]` — this used to be `string[]` holding fake ids like `"1-0-5"`. Now it holds the real numeric `id` values the backend assigned, which is also what `toggleSpaceSelection` now expects.

> **What's gone, and why:** the old `enableSelectedSpaces` / `disableSelectedSpaces` reducers and the `disabledSpaces` array are **not** in this version. They used to edit a local, browser-only list — but per this lesson's whole point, "disabled" is now a fact the *server* owns (`status === "disabled"`), not something the browser can just set. Actually flipping that status is lesson **U4**'s job. If your editor flags old imports of those in `ControlBoard.tsx`, that's expected — the next steps fix them.

### Step 2 — Fix the auth field in `ControlBoard.tsx` (~5 min)

Lesson U1 changed how the logged-in user is stored, but `ControlBoard.tsx` still reads the old field names. Find the line near the top of the component and update it:

```tsx
// BEFORE:
const { userType, userCode } = useAppSelector(state => state.auth);
// AFTER:
const user = useAppSelector(state => state.auth.user);
```

Then update its two usages: `if (userType === 'student')` → `if (user?.role === 'student')`, and `Logged in as: {userCode}` → `Logged in as: {user?.name}`.

**Explanation:** `state.auth.user` is the shape U1's `authSlice` actually stores (an object with `role` and `name`), not the old flat `userType`/`userCode` fields. `user?.role` uses **optional chaining** — if `user` happens to be `null` (nobody logged in yet), this safely evaluates to `undefined` instead of crashing.

### Step 3 — Load data and react to the selected lot (~10 min)

Update the imports at the top of `ControlBoard.tsx` and add two fetch effects near the top of the component:

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

**Explanation, line by line:**
- The first `useEffect` has a dependency array of `[dispatch]` — since `dispatch` never actually changes, this effect really only runs **once**, right when `ControlBoard` first mounts. That's exactly what "load the list of lots" needs. → [React docs: `useEffect`](https://react.dev/reference/react/useEffect).
- The second `useEffect` depends on `[selectedLotId, dispatch]` — it re-runs **every time the selected lot changes**, which is what makes clicking a different lot in the nav fetch that lot's spaces.
- `if (selectedLotId != null)` guards against fetching spaces for the "Home" view (`selectedLotId === null`), where there's no lot selected yet.
- Pulling `status` and `error` out of `state.parking` here is what Step 4's loading/error UI will read.

### Step 4 — Draw spaces from data (~15 min)

Replace `renderParkingLot()` and the `spaceColor` helper so they read the fetched spaces and color by `status`:

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

**Explanation, piece by piece:**
- `spaceColor` checks selection **first**, then `disabled`, then `assigned`, falling through to `white` for `available`. Order matters here: a selected-but-disabled space should still show as selected (yellow), not grey.
- `spaces.map(space => ...)` turns the array of `Space` objects into an array of `<div>` elements — one per space. Each one needs a `key={space.id}` so React can tell them apart across re-renders without repainting the whole grid every time. → [React docs: Rendering Lists](https://react.dev/learn/rendering-lists).
- The three `if` checks before the `return` are the **loading / error / empty** states, checked in that order: still loading with nothing cached yet → "Loading…"; the last fetch failed → the red error message; loaded but the lot genuinely has zero spaces → "No spaces in this lot." Only if none of those apply do you reach the real grid. → [React docs: Conditional Rendering](https://react.dev/learn/conditional-rendering).
- `title={...}` sets the native browser tooltip — hover any space and you'll see its label and status, e.g. `"A-04 — available"`. No extra library needed; this is a plain HTML attribute.
- `isSelecting && dispatch(...)` — clicking only does something while `isSelecting` is true (Edit Mode is on with an action chosen); otherwise the click is a no-op.

### Step 5 — Drive the bottom lot-nav from real lots (~5 min)

Replace the hard-coded `['Home', 'Lot 1', ..., 'Lot 17']` buttons with a **Home** button plus one button per fetched lot:

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

Then update the two view conditions that used to compare against the old string-based `selectedLot`: `selectedLot === 'Home'` becomes `selectedLotId === null`, and the `selectedLot === 'Lot 1'` / `renderParkingLot()` branch becomes `selectedLotId !== null && renderParkingLot()`. Search the file for `selectedLot` (not `selectedLotId`) — there are a handful more in the map drag/zoom effects; those all become `selectedLotId === null` too.

**Explanation:** `lots.map(...)` is the exact same "array → elements, with a `key`" pattern from Step 4, just for lots instead of spaces. `lotButtonStyle(selectedLotId === lot.id)` presumably highlights whichever button matches the currently-selected lot — you're just feeding it the new numeric comparison instead of a string one.

---

## 🧪 Prove it works — testing guide

**Setup:** backend running with seeded data (backend guide through **B4**); `npm run dev`; log in as admin.

**Steps:**
1. Click through the lots in the bottom nav.
2. Hover a space and check the tooltip.
3. Temporarily **stop the backend**, then click a lot.

**Expected:**
- Each lot draws its **own** real spaces (the seed gives Lot A 12 and Lot B 8); seeded disabled spaces appear grey, assigned ones blue.
- While a lot loads you briefly see **"Loading…"**.
- The tooltip on a space shows its label and status, e.g. `"A-04 — available"`.
- With the backend off, you see a **red error message**, not a blank or crashed page.

**☁️ Cloud check (optional):** needs backend B4 deployed and RDS seeded. Run `./release.sh frontend`, open the live site as admin, and click through the lots — they should draw the server's real spaces, same as local.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U3: data-driven lots + spaces from API, status colours"
git push -u origin cr/u3-real-lots
```

Then open a Pull Request on GitHub with **base = `cr/u2-routing`** (not `main` — this CR stacks on U2). Use the CR description template from the guide and paste your "Prove it works" results as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **TypeScript errors about `disabledSpaces` or `enableSelectedSpaces` not existing** — leftover code in `ControlBoard.tsx` still referencing the fields Step 1 removed from the slice. That's expected; work through Steps 2–5 to replace each usage.
- **Every lot shows "No spaces in this lot."** — the backend isn't running, isn't seeded through B4, or `api.get` is pointed at the wrong base URL. Confirm `GET /api/lots/:id/spaces` returns data directly in your browser or with `curl` first.
- **Spaces render but every single one is white** — check the order of checks inside `spaceColor`; also double-check the backend's `status` strings match exactly `"available"` / `"disabled"` / `"assigned"` (case-sensitive).
- **Clicking a lot in the nav does nothing / it never highlights** — you likely missed one of the `selectedLot === 'Home'` / `selectedLot === 'Lot 1'` string comparisons from Step 5; search the whole file for `selectedLot` (not `selectedLotId`) and convert each one.
- **The network tab shows the same request firing over and over** — a `useEffect` dependency array is missing a value or capturing something that changes every render; re-check the two effects in Step 3 against the exact arrays shown (`[dispatch]` and `[selectedLotId, dispatch]`).

---

## 📝 Recap — what you built and learned

- You replaced hard-coded, browser-only fake data with **real lots and spaces fetched from the backend**, keyed by numeric `id` instead of made-up strings.
- You learned the **`createAsyncThunk` + `extraReducers`** pattern for wrapping an API call so Redux tracks pending/fulfilled/rejected for you.
- You used `useEffect` with the right dependency arrays to fetch once on mount, and again whenever the selected lot changes.
- You practiced rendering a **loading state, an error state, and a real list** from the same data, and rendering lists safely with `key`.
- You practiced the **stacked-CR git routine** again, branching off the previous lesson's branch instead of `main`.

---

## 📚 References

- [React docs: `useEffect`](https://react.dev/reference/react/useEffect) — running code on mount and on dependency changes.
- [Redux Toolkit docs: `createAsyncThunk`](https://redux-toolkit.js.org/api/createAsyncThunk) — wrapping async calls with automatic pending/fulfilled/rejected actions.
- [React docs: Rendering Lists](https://react.dev/learn/rendering-lists) — turning arrays into elements with `key`.
- [React docs: Conditional Rendering](https://react.dev/learn/conditional-rendering) — showing loading/error/empty/real-data states.
- [MDN: Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) — the browser API underneath `api.get(...)`.
- [GitHub Docs: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [UI guide → CR U3](../ui-development-guide.md#cr-u3--show-real-lots-and-spaces-data-driven-map).

---

## ➡️ Next lesson

**[Lesson U4 — Make enable/disable actually save](U4-enable-disable-saves.md).** You'll take the read-only map you just built and wire up Edit Mode so disabling/enabling a space actually persists on the server instead of resetting on reload. → [source CR](../ui-development-guide.md#cr-u4--make-enabledisable-actually-save)
