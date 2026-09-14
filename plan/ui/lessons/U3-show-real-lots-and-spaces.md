# Lesson U3 — Show real lots and spaces (data-driven map)

> **Track:** Frontend · **Lesson 4 of 10**
> **⏱ Time:** ~75 min · **🎚 Difficulty:** moderate (a new pattern — fetch on load, render whatever comes back — but each piece is small)
> **🧩 Prerequisites:** you've completed [Lesson U2 — Routing](U2-routing.md) (on branch `cr/u2-routing`), and backend [Lesson B4 — Read lots and spaces](../../backend/lessons/B4-read-lots-and-spaces.md)'s endpoints (`GET /api/lots`, `GET /api/lots/:id/spaces`) are running and seeded.
> **🌿 CR branch:** `cr/u3-real-lots` (off `cr/u2-routing`) · **📄 Source CR:** [CR U3](../ui-development-guide.md#cr-u3--show-real-lots-and-spaces-data-driven-map) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

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

Right now the parking grid is **faked**: `renderParkingLot()` just draws 3 rows × 2 columns × 20 boxes with made-up string IDs like `1-0-5`, and "disabled" only ever lived in your browser's memory — reload the page and it's gone. By the end of this hour, every lot and every space comes from the **real backend** (`GET /api/lots` and `GET /api/lots/:id/spaces`), and each space is colored by the server's own `status` field.

**✅ Done when (your deliverable checklist):**
- [ ] The bottom lot-nav lists the **real** lots returned by `GET /api/lots` — not a hard-coded `['Lot 1' .. 'Lot 17']` array.
- [ ] Clicking a lot draws **that lot's own real spaces** from `GET /api/lots/:id/spaces` (the seed gives Lot A 12 spaces and Lot B 8).
- [ ] Spaces are colored by the server's `status`: **yellow** = `available`, grey = `disabled`, blue = `assigned`.
- [ ] Clicking a space in Edit Mode still highlights it yellow — using its new numeric `id` instead of the old string ID.
- [ ] While a lot's spaces are loading you briefly see **"Loading…"**; if you stop the backend and click a lot, you see a **red error message**, not a blank or crashed page.
- [ ] Your work is committed on branch `cr/u3-real-lots` and pushed, PR base = `cr/u2-routing`.

**🖼 What changes on screen (before → after):**
```
        BEFORE (faked)                        AFTER (data-driven)
┌───────────────────────────┐      ┌───────────────────────────┐
│  Home Lot1 Lot2 … Lot17   │      │      Home   Lot A   Lot B  │
│  (hard-coded button list) │  ─▶  │   (from GET /api/lots)     │
│  ▢▢ ▢▢ ▢▢   ▢▢ ▢▢ ▢▢      │      │   [ map photo ]             │
│  ▢▢ ▢▢ ▢▢   ▢▢ ▢▢ ▢▢      │      │    🟨🟨 ⬜ 🟦 🟨            │
│  (3×2×20 fake boxes,      │      │    yellow=available         │
│   ids like "1-0-5")       │      │    grey=disabled blue=taken │
└───────────────────────────┘      └───────────────────────────┘
  every lot looks identical;         each lot draws its OWN real
  "disabled" forgotten on refresh    spaces, colored by server status
```
Nothing about *where* the lot-nav or the map sit moves — what changes is that the boxes are now real spaces, positioned and colored from the server, that survive a refresh.

---

## 🤔 Why this lesson matters (read this first — it's the "why")

Right now `ControlBoard.tsx` and `parkingSlice.ts` don't know anything about your database — they just draw the same 20 fake boxes for every lot and track "disabled" as a plain array of strings living in the browser tab. That's fine for a mockup, but it breaks the moment two things are true at once, which they now are: **backend B4 exists and knows the real lots and spaces**, and **the app needs to agree with the backend about what's true.**

This is the idea of a **single source of truth**. Today, if you disabled a space and then refreshed the page, it would forget — because "disabled" only existed in your browser's memory, not on the server. After this lesson, "disabled" (and later, "assigned") is a fact the *server* knows, and the browser just displays it. That's also *why* the data model changes shape: instead of tracking spaces as strings in three different arrays (`selectedSpaces: string[]`, `disabledSpaces: string[]`), every space now has a real numeric `id` and a `status` field the server assigns. Selection becomes `number[]`; "disabled" is no longer its own list — it's just `status === "disabled"`.

This lesson only makes the map **show** real data. Actually *changing* that data (disable/enable, and later assigning a space to a student) is deliberately left for lesson U4 and U6 — one change at a time, so each CR is small and easy to review. That's the same stacked-CR discipline from [Lesson U2](U2-routing.md), applied to data instead of routes.

> **Heads up if your files look bigger than the snippets below:** if `parkingSlice.ts` already has an `assignedSpaces` field, or `ControlBoard.tsx` already draws lots from uploaded map photos with spaces positioned by the server's `x`/`y` (falling back to a grid of coloured boxes), that's expected — later work has already landed on top of this lesson's starting point. Keep that lot-photo code; this lesson only replaces **where the data comes from** (hard-coded strings → the server's numeric ids and `status`).

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **React `useEffect`** | Runs code in reaction to a component appearing or a value changing — this is how you say "go fetch when this screen shows up." | [React docs: `useEffect`](https://react.dev/reference/react/useEffect) |
| **Redux Toolkit `createAsyncThunk`** | Wraps an async API call so Redux automatically tracks whether it's pending, succeeded, or failed. | [Redux Toolkit docs: `createAsyncThunk`](https://redux-toolkit.js.org/api/createAsyncThunk) |
| **Rendering lists with `key`** | Turning an array of data (lots, spaces) into an array of elements on screen — React needs a stable `key` per item to track them. | [React docs: Rendering Lists](https://react.dev/learn/rendering-lists) |
| **Loading / error UI states** | Showing different UI depending on whether data is still loading, failed to load, or is ready. | [React docs: Conditional Rendering](https://react.dev/learn/conditional-rendering) |
| **`fetch` / HTTP requests** | The browser API that `api.get(...)` uses under the hood to ask a server for data over the network. | [MDN: Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) |
| **Normalized coordinates** | A spot's position/size stored as fractions of the map image (`x`,`y`,`w`,`h` in 0..1), so it stays put and correctly sized at any zoom. | [MDN: CSS percentage](https://developer.mozilla.org/en-US/docs/Web/CSS/percentage) |
| **Floating tooltip** | A cursor-following box you render yourself (vs. the native `title`), so you control its content and style. | [MDN: `position: fixed`](https://developer.mozilla.org/en-US/docs/Web/CSS/position) |

> **New words ahead?** Every bolded term below links to the [**Glossary**](GLOSSARY.md) the first time it appears — click any you don't know, read the one-sentence version, and jump back. You never have to memorize a term before the lesson uses it.

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
  number: number;              // admin-set lot number; prefixes spot labels as `<number>-<n>` (U9)
  capacity: number;
  available_count: number;
  display_order: number;
  map_image_url: string | null;
}
export interface Space {
  id: number;
  lot_id: number;
  label: string;
  status: "available" | "disabled" | "assigned";
  assigned_user_id: number | null;     // who holds it (server FK; null unless assigned)
  assigned_user_name: string | null;   // who holds it, for the hover tooltip (null unless assigned)
  // Authored map position + size, all normalized fractions of the map image (0..1); null until placed in U8.
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
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

// GET /api/lots/:id/spaces  ->  Space[]   (a bare array, NOT an envelope)
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
    // flips Edit Mode on/off; turning it off also drops any in-progress action + selection
    toggleEditMode(state) {
      state.isEditMode = !state.isEditMode;
      if (!state.isEditMode) { state.editAction = null; state.selectedSpaces = []; }
    },
    // same reset, but for a specific target value instead of a toggle
    setIsEditMode(state, action: PayloadAction<boolean>) {
      state.isEditMode = action.payload;
      if (!action.payload) { state.editAction = null; state.selectedSpaces = []; }
    },
    // records which admin action (disable/enable/… — U4/U6) is currently armed
    setEditAction(state, action: PayloadAction<EditAction>) {
      state.editAction = action.payload;
    },
    // on/off toggle: add the id if it's not selected yet, remove it if it is
    toggleSpaceSelection(state, action: PayloadAction<number>) {
      const id = action.payload;
      const idx = state.selectedSpaces.indexOf(id);
      if (idx === -1) state.selectedSpaces.push(id);
      else state.selectedSpaces.splice(idx, 1);
    },
    // wipes the selection, e.g. once an admin action has been applied
    clearSelectedSpaces(state) {
      state.selectedSpaces = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // lots rarely change mid-session, so there's no pending/error handling here
      .addCase(fetchLots.fulfilled, (state, action) => { state.lots = action.payload; })
      // entering "loading" is what triggers the "Loading…" text in Step 4
      .addCase(fetchSpaces.pending, (state) => { state.status = "loading"; state.error = null; })
      .addCase(fetchSpaces.fulfilled, (state, action) => {
        state.status = "idle";
        state.spacesByLot[action.payload.lotId] = action.payload.spaces;   // cache this lot's spaces
      })
      .addCase(fetchSpaces.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Could not load spaces";     // shown as the red error in Step 4
      });
  },
});

export const {
  setSelectedLot, toggleEditMode, setIsEditMode, setEditAction,
  toggleSpaceSelection, clearSelectedSpaces,
} = parkingSlice.actions;
export default parkingSlice.reducer;
```

**Why it works & further reading:**
- **[Interface](GLOSSARY.md#interface)** `Lot`/`Space` — [TypeScript](GLOSSARY.md#typescript) checks every object against this shape, so a typo like `"disbaled"` in `status` (a union of string literals, not just `string`) is caught before it ships. → [TS: Object Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types).
- **[`createAsyncThunk`](GLOSSARY.md#thunk)** — wraps the network call and auto-fires `pending`/`fulfilled`/`rejected` [actions](GLOSSARY.md#action) for you; no manual [dispatch](GLOSSARY.md#dispatch) of those three needed. → [RTK: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk).
- **The spaces [endpoint](GLOSSARY.md#endpoint) returns a bare array, not an [envelope](GLOSSARY.md#envelope)** — `fetchSpaces` bundles `lotId` back into its result itself, since the reducer needs to know which `spacesByLot[lotId]` slot to fill.
- **[`extraReducers`](GLOSSARY.md#extrareducers)** — how this [slice](GLOSSARY.md#slice) reacts to the thunks' three stages without dispatching them by hand. → [RTK: createSlice](https://redux-toolkit.js.org/api/createSlice).
- `selectedSpaces` is now `number[]`, holding the real server `id`s — not the old fake string ids like `"1-0-5"`.
- Field names are **snake_case** wherever the server owns them (`lot_id`, `available_count`, `assigned_user_id`, `assigned_user_name`, `map_image_url`, `display_order`); match them exactly or the fields read back `undefined`.

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

**Why it works & further reading:**
- `state.auth.user` is the shape U1's `authSlice` actually stores — an object with `role` and `name` — not the old flat `userType`/`userCode` fields.
- `user?.role` is **optional chaining**: if `user` is `null` (nobody logged in yet), it safely evaluates to `undefined` instead of crashing. → [MDN: Optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining).

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
// pulls the parking data + status/error flags Step 4's loading/error UI needs
const { lots, selectedLotId, spacesByLot, isEditMode, editAction, selectedSpaces, status, error } =
  useAppSelector(state => state.parking);

// Load the list of lots once.
useEffect(() => { dispatch(fetchLots()); }, [dispatch]);
// Load this lot's spaces whenever the selected lot changes.
useEffect(() => { if (selectedLotId != null) dispatch(fetchSpaces(selectedLotId)); }, [selectedLotId, dispatch]);
```

**Why it works & further reading:**
- **[`useEffect`](GLOSSARY.md#useeffect)** with `[dispatch]` as its only dependency really means "once, on mount" — `dispatch` itself never changes. → [React docs: useEffect](https://react.dev/reference/react/useEffect).
- The second effect's `[selectedLotId, dispatch]` dependency list is what makes clicking a different lot in the nav re-fetch that lot's spaces.
- `if (selectedLotId != null)` skips fetching for the "Home" view, where nothing is selected yet.
- `useAppSelector` is a [selector](GLOSSARY.md#selector) — it reads values out of the [store](GLOSSARY.md#store) so this component redraws whenever they change.

### Step 4 — Draw spaces from data (~15 min)

Replace `renderParkingLot()` and the `spaceColor` helper so they read the fetched spaces and color by `status`:

```tsx
const spaceColor = (space: Space) => {
  if (selectedSpaces.includes(space.id)) return '#f5c542';  // currently selected (yellow)
  if (space.status === 'disabled') return '#aaa';            // grey
  if (space.status === 'assigned') return '#7aa7ff';         // blue = taken
  return '#ffeb3b';                                          // available (yellow — white washes out against a light map photo)
};

const renderParkingLot = () => {
  const spaces = selectedLotId != null ? (spacesByLot[selectedLotId] ?? []) : [];   // cached spaces, empty until fetchSpaces resolves
  if (status === 'loading' && spaces.length === 0) return <div style={{ color: '#333' }}>Loading…</div>;   // first landing on this lot
  if (error) return <div style={{ color: '#900' }}>{error}</div>;                                          // last fetch failed
  if (spaces.length === 0) return <div style={{ color: '#333' }}>No spaces in this lot.</div>;             // loaded, genuinely empty

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '400px' }}>
      {spaces.map(space => (
        <div
          key={space.id}
          title={`${space.label} — ${space.status}`}   // native tooltip — Step 4b swaps this for a floating one
          onClick={() => isSelecting && dispatch(toggleSpaceSelection(space.id))}   // no-op unless Edit Mode + an action are armed
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

**Why it works & further reading:**
- Checking **selection before status** means a selected-but-disabled space still shows as selected (gold), not grey — order matters. Full legend: available = yellow, selected = gold (`#f5c542`), disabled = grey (`#aaa`), assigned = blue (`#7aa7ff`) — the same four colors U4 and U8 reuse.
- Every mapped item needs a `key={space.id}` so [React](GLOSSARY.md#react) can track it across re-renders without repainting the whole grid. → [React docs: Rendering Lists](https://react.dev/learn/rendering-lists).
- The three `if` checks run in that order — **loading → error → empty** — before the grid ever draws. → [React docs: Conditional Rendering](https://react.dev/learn/conditional-rendering).
- The native `title` tooltip here is temporary: it's slow to appear and can't say *who* holds a spot. Step 4b below replaces it with a floating tooltip that can.
- `isSelecting && dispatch(...)` — the click is a no-op unless Edit Mode is on with an action chosen.

### Step 4b — Position spots on the map, size them right, and add a floating tooltip (~10 min)

The plain wrap-grid above is the **fallback** for a lot with no authored positions. Once a lot's spaces carry `x`/`y`/`w`/`h` (you'll place them in [U8](U8-place-and-arrange-spots.md)), draw each spot **on top of the lot's map image** at those coordinates instead:

```tsx
// x, y, w, h are fractions of the map image (0..1). Render position AND size as % of the map box.
<div style={{ position: 'relative' }}>
  <img src={lot.map_image_url ?? undefined} style={{ width: '100%', display: 'block' }} />
  {/* only spaces already placed in U8 get drawn here; the rest fall back to Step 4's plain grid */}
  {spaces.filter(s => s.x != null).map(space => (
    <div key={space.id} {...hoverProps(space)}
      onClick={() => isSelecting && dispatch(toggleSpaceSelection(space.id))}
      style={{
        position: 'absolute',
        // position + size as % of the map box — fractions (0..1) × 100
        left: `${space.x! * 100}%`, top: `${space.y! * 100}%`,
        width: `${(space.w ?? 0.05) * 100}%`, height: `${(space.h ?? 0.03) * 100}%`,
        backgroundColor: spaceColor(space), border: '1px solid #888', boxSizing: 'border-box',
      }} />
  ))}
</div>
```

**Why it works & further reading:**
- `.filter(s => s.x != null)` — only spaces already placed in [U8](U8-place-and-arrange-spots.md) draw here (`!= null` catches both `null` and `undefined`); everything else falls back to Step 4's plain grid.
- `{...hoverProps(space)}` — spreads the three hover handlers (defined in the tooltip block below) onto the `div` in one go, instead of writing each one out by hand.
- The trailing `!` is TypeScript's **non-null assertion operator** — safe only because the `.filter(...)` above already excluded every case where `x`/`y` could be null. → [TS Handbook: Non-null assertion operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator).
- `w`/`h` can still be `null` even once a space has `x`/`y` (position and size are authored separately in U8); `??` falls back to a sensible default (5% × 3% of the map) instead of a zero-size, invisible spot.

**Why fractions:** the key idea — see [normalized coordinates](GLOSSARY.md#normalized-coordinates). Because `x`/`y`/`w`/`h` are all fractions of the map, position *and* size stay correct at any display size, and the map's zoom scale never needs to be stored anywhere.

**A floating hover tooltip** (nicer than the native `title` from Step 4): track the cursor and show one absolutely-positioned box.

```tsx
const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);   // null = hidden
const availability = (s: Space) =>          // turns status into the tooltip's wording
  s.status === 'assigned' ? `Taken${s.assigned_user_name ? ` — ${s.assigned_user_name}` : ''}`
  : s.status === 'disabled' ? 'Disabled' : 'Available';
const hoverProps = (s: Space) => ({         // bundles the 3 hover handlers so they can be spread onto a spot
  onMouseEnter: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text: `Spot ${s.label} — ${availability(s)}` }),
  onMouseMove:  (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text: `Spot ${s.label} — ${availability(s)}` }),   // keeps the tooltip following the cursor
  onMouseLeave: () => setTip(null),         // hide it the instant the cursor leaves
});
// …render once, near the end of the component:
// pointerEvents:'none' below lets hover/click events pass through the box to the spot underneath
{tip && (
  <div style={{ position: 'fixed', left: tip.x + 14, top: tip.y + 14, zIndex: 200,   // offset so the box isn't under the pointer
    background: '#222', color: 'white', padding: '4px 8px', borderRadius: '6px',
    fontSize: '0.75rem', pointerEvents: 'none' }}>{tip.text}</div>
)}
```

**Why it works & further reading:**
- One **[`useState`](GLOSSARY.md#usestate)** holds either `null` (hidden) or `{x, y, text}`; hovering sets it, leaving clears it. → [React docs: useState](https://react.dev/reference/react/useState).
- `onMouseMove` (not just `onMouseEnter`) is what makes the tooltip follow the cursor instead of freezing where it first appeared. → [MDN: mousemove event](https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event).
- `e.clientX`/`clientY` are viewport-relative — exactly what a `position: 'fixed'` box needs for its own `left`/`top`. → [MDN: MouseEvent.clientX](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX).
- `pointerEvents: 'none'` makes the tooltip invisible to the mouse, so hover/click events pass through to the spot underneath instead of the tooltip box swallowing them (which could fire `onMouseLeave` early or block a click). → [MDN: pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events).

Delete the `title={...}` attribute from Step 4 and spread `{...hoverProps(space)}` on each spot instead — in both the grid and the positioned view.

(Panning and cursor-anchored wheel zoom for this positioned lot view — reusing the same `translate` model as the campus "Home" view, plus the sidebar-width fix — are built in **Step 6** below.)

### Step 5 — Drive the bottom lot-nav from real lots (~5 min)

Replace the hard-coded `['Home', 'Lot 1', ..., 'Lot 17']` buttons with a **Home** button plus one button per fetched lot:

```tsx
<div style={lotNavigationStyle}>
  <button style={lotButtonStyle(selectedLotId === null)} onClick={() => dispatch(setSelectedLot(null))}>
    Home
  </button>
  {/* one button per real lot, in whatever order the server returns them */}
  {lots.map(lot => (
    <button key={lot.id} style={lotButtonStyle(selectedLotId === lot.id)} onClick={() => dispatch(setSelectedLot(lot.id))}>
      {lot.name}
    </button>
  ))}
</div>
```

Then update the two view conditions that used to compare against the old string-based `selectedLot`: `selectedLot === 'Home'` becomes `selectedLotId === null`, and the `selectedLot === 'Lot 1'` / `renderParkingLot()` branch becomes `selectedLotId !== null && renderParkingLot()`. Search the file for `selectedLot` (not `selectedLotId`) — there are a handful more in the map drag/zoom effects; those all become `selectedLotId === null` too.

**Why it works & further reading:**
- `lots.map(...)` is the same array → elements + `key` pattern as rendering spaces in Step 4, just for lots.
- `lotButtonStyle(selectedLotId === lot.id)` now feeds in a numeric comparison instead of the old string one, to highlight the active lot.

### Step 6 — Give the lot view the SAME pan + zoom as Home (folded refinement) (~10 min)

The campus "Home" view already pans and zooms; the selected-lot view was fixed-size, so a big lot didn't fit. Reuse the **same transform model** rather than inventing a new one — do **not** reach for `overflow:auto` + `scrollLeft/scrollTop` (it only pans where content overflows, so a tall-narrow map pans vertically but not horizontally and shows a lone scrollbar that reads as broken).

- The map image + its spots live in one layer with `transform: translate(lotOffsetX, lotOffsetY) scale(lotZoom)` and `transform-origin: 0 0`; the container is `overflow:hidden` (no scrollbars). The toolbar (−/%/＋/Reset) sits **outside** the translated layer.
- Drag to pan: `onMouseDown`/`onMouseMove` update `lotOffset` by the drag delta; a move greater than ~4px sets a `moved` flag so the mouse-up doesn't also count as a space click.
- Wheel to zoom is **cursor-anchored** and registered `{ passive: false }`: read the current zoom/offset from a ref mirror and shift the offset by `cursor * (1 - ratio)` using the layer's [`getBoundingClientRect()`](GLOSSARY.md#getboundingclientrect), so the point under the cursor stays put.
- **Reset zoom inside the lot-nav click handler**, not in a `useEffect` — `react-hooks/set-state-in-effect` forbids setting state from an effect, and doing it on nav-click is where it belongs anyway.

**Pin the sidebar against zoom.** Zooming a wide map used to steal width from the left menu. The flexbox fix: `flexShrink: 0` on the sidebar `aside` **and** `minWidth: 0` on the `main` column, so the growing map is clipped by `main` instead of squashing the sidebar.

> **Key teaching point:** a spot's position (`x`,`y`) and size (`w`,`h`) are all stored as **fractions of the map image** (0..1), so they stay aligned at any zoom — you never persist the zoom scale itself; it's purely a viewing convenience. (The mock backend stores and returns these under the same `x`/`y`/`w`/`h` names the frontend uses — there's no separate column naming to map.)

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
- The floating tooltip that follows your cursor shows the spot's label and availability (and, for a taken spot, who holds it), e.g. `"Spot A-04 — Available"`.
- The lot map pans by dragging and zooms to the cursor with the −/%/＋ toolbar; the left menu keeps its width.
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
- **Spaces render but every single one is yellow** — check the order of checks inside `spaceColor`; also double-check the backend's `status` strings match exactly `"available"` / `"disabled"` / `"assigned"` (case-sensitive).
- **Clicking a lot in the nav does nothing / it never highlights** — you likely missed one of the `selectedLot === 'Home'` / `selectedLot === 'Lot 1'` string comparisons from Step 5; search the whole file for `selectedLot` (not `selectedLotId`) and convert each one.
- **The network tab shows the same request firing over and over** — a `useEffect` dependency array is missing a value or capturing something that changes every render; re-check the two effects in Step 3 against the exact arrays shown (`[dispatch]` and `[selectedLotId, dispatch]`).
- **Spaces load but are all `undefined`/blank** — you likely mismatched a field name, not the response shape: `GET /api/lots/:id/spaces` is a bare `Space[]` (Step 1), so don't wrap it in `.spaces` or expect a `{ lot_id, spaces }` envelope. Same trap for `undefined` fields: the server uses snake_case (`assigned_user_name`, `available_count`), not camelCase.
- **The lot map shows a lone vertical scrollbar and won't pan sideways** — you used `overflow:auto` + scroll instead of the `translate` layer from Step 6. Switch the container to `overflow:hidden` and pan via a `translate` offset like the Home view.
- **Zooming shrinks the left menu instead of the map** — the sidebar `aside` is missing `flexShrink:0` and/or `main` is missing `minWidth:0` (Step 6).
- **ESLint fails with `react-hooks/set-state-in-effect`** — you reset the lot zoom inside a `useEffect`; move that reset into the lot-nav click handler.
- **Selecting a lot leaves the admin buttons disabled** — you'll hit this once you add the admin actions in U4/U6: don't double-gate the control panel behind a separate Edit Mode. Activate the panel on lot selection (`isControlPanelActive = selectedLotId != null`) and gate each lot-scoped action on `selectedLotId == null` (plus a selection for Disable/Enable); keep Edit Mode as optional editing chrome, not a hard gate.

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
