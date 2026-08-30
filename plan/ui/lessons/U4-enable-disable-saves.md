# Lesson U4 — Make enable/disable actually save

> **Track:** Frontend · **Lesson 5 of 10**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first optimistic update with rollback)
> **🧩 Prerequisites:** you've done [Lesson U3 — Show real lots and spaces](U3-show-real-lots-and-spaces.md); backend **B5** (the `PATCH /api/spaces` endpoint) is running.
> **🌿 CR branch:** `cr/u4-save-status` (off `cr/u3-real-lots`) · **📄 Source CR:** [UI guide → CR U4](../ui-development-guide.md#cr-u4--make-enabledisable-actually-save) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Right now, when an admin disables a parking space in Edit Mode, the grey colour is a **lie** — it only lives in the browser's memory, and a page refresh erases it. This lesson makes it real: clicking **Disable** or **Enable** sends the change to the backend and saves it in the database, so it **survives a refresh**.

**✅ Done when (your deliverable checklist):**
- [ ] `src/store/parkingSlice.ts` has an `updateSpaces` thunk that calls `PATCH /api/spaces`.
- [ ] `updateSpaces`'s `pending`/`fulfilled`/`rejected` cases are handled in `extraReducers` (optimistic recolour on `pending`; on `rejected`, surface the error — no auto-revert).
- [ ] `ControlBoard.tsx`'s **Disable** and **Enable** sub-panel buttons both dispatch `updateSpaces` on click, instead of the old, deleted `enableSelectedSpaces`/`disableSelectedSpaces`.
- [ ] Disabling a space, then **refreshing the page**, still shows it grey.
- [ ] Your work is committed on branch `cr/u4-save-status` and pushed, PR base = `cr/u3-real-lots`.

---

## 🤔 Why this lesson matters

U3 made the parking grid **read** real data from the backend. But the admin's Disable/Enable buttons still only *write* to a local Redux list — the moment you refresh, the server's original data comes back and undoes your change. That's not a real feature; it's a visual trick.

This lesson closes that gap, and it introduces a pattern you'll use for almost every "admin makes a change" screen for the rest of the app:

1. **Optimistic update** — the instant you click **Disable** (or **Enable**), the spaces flip colour *before* the server has even answered. The app feels instant instead of laggy.
2. **Re-fetch to confirm** — right after the write succeeds, the thunk re-asks the server for the truth, so what you see always matches what's actually saved.
3. **Roll back on failure** — if the request fails (backend down, or the space was already `assigned`), the user sees an error instead of a screen that silently lied to them.

Get this pattern comfortable now, because U5 and U6 (student requests, admin assignments) both use the same read-thunk / write-thunk / optimistic-then-confirm shape.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **`fetch` with `PATCH`** | The HTTP method for "partially update this resource" — here, "change the status of these space ids." | [MDN: PATCH method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) |
| **Sending the `Authorization` header** | How the backend knows *which admin* is making the request — your login token, attached automatically by `api.patch`. | [MDN: Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) |
| **Redux Toolkit state updates** | Writing `state.spacesByLot[...] = ...` directly inside a reducer looks like mutation, but RTK's Immer makes it safe. | [Redux Toolkit: Writing Reducers with Immer](https://redux-toolkit.js.org/usage/immer-reducers) |
| **Optimistic UI updates** | Updating the screen *before* the server confirms, so the app feels instant — then correcting it if the request fails. | [Redux Toolkit: Optimistic Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates) |
| **Error handling from a thunk** | `createAsyncThunk` automatically fires a `.rejected` action with the thrown error's message when the request fails. | [Redux Toolkit: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) |

---

## ✅ Before you start

**Prerequisites:** [Lesson U3](U3-show-real-lots-and-spaces.md) done (you're on `cr/u3-real-lots`), and backend **B5** (the `PATCH /api/spaces` endpoint) running locally.

**Time budget for the hour:** setup & branch (5 min) → `updateSpaces` thunk + `extraReducers` (25) → wire the buttons in `ControlBoard.tsx` (15) → test & commit (15).

**Open your terminal and make your branch.** This CR branches off U3, not `main`:

```bash
git checkout cr/u3-real-lots
git checkout -b cr/u4-save-status
```

---

## 🛠 Build it, step by step

### Step 1 — Add the `updateSpaces` thunk (~25 min)

Open `src/store/parkingSlice.ts` (the one you rewrote in U3). Add this thunk next to `fetchSpaces`:

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

**Explanation, piece by piece:**
- **`api.patch("/api/spaces", ...)`** — this method already exists; you built it back in U0 alongside `api.get`/`api.post`. It sends a `PATCH` request with a JSON body and attaches your login token as an `Authorization: Bearer <token>` header automatically — you never have to add that header yourself. → [MDN: PATCH method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH), [MDN: Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization).
- **The `{ dispatch }` argument** — `createAsyncThunk` hands your function a second argument with tools, including `dispatch`, so a thunk can trigger *another* thunk. Here, once the PATCH succeeds, we immediately `dispatch(fetchSpaces(args.lotId))` — the same read-thunk from U3 — so the store's `spacesByLot` gets refreshed with whatever the database actually says now. → [Redux Toolkit: createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk).
- **Why re-fetch instead of trusting the PATCH response?** The backend's answer to "I updated these" doesn't necessarily include full lot data. Re-running `fetchSpaces` guarantees what's on screen matches the database exactly — no risk of drifting out of sync.

Now handle the thunk's three states in `extraReducers`, right after the ones you wrote for `fetchSpaces` in U3 (optimistic: recolour immediately; on failure, surface the error — the optimistic colour is corrected by the next `fetchSpaces`, not auto-reverted here):

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

**Explanation, piece by piece:**
- **`updateSpaces.pending`** — RTK fires this the *instant* you `dispatch(updateSpaces(...))`, before `api.patch` has even reached the server. `action.meta.arg` is the exact object you passed in (`{ lotId, ids, status }`) — that's how a `pending` handler gets at the thunk's arguments. Looping over `spacesByLot[lotId]` and flipping `s.status` for every selected id is the **optimistic update**: the grid recolours immediately, before any network round trip finishes. → [Redux Toolkit: Optimistic Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates).
- **Mutating `s.status` directly** — this looks like it breaks Redux's "never mutate state" rule, but Redux Toolkit wraps every reducer in [Immer](https://redux-toolkit.js.org/usage/immer-reducers), which safely turns this style of code into an immutable update behind the scenes. That's what makes the one-line `for` loop above safe to write.
- **`updateSpaces.fulfilled`** — by the time this fires, the thunk's own `dispatch(fetchSpaces(...))` has already re-loaded the real data, so this handler doesn't need to touch `spacesByLot` again. It just cleans up the editing UI: clear the selection and close Edit Mode.
- **`updateSpaces.rejected`** — if `api.patch` throws (network error, or the backend rejecting an already-`assigned` space with a 409), `createAsyncThunk` automatically dispatches this action with the thrown error's message on `action.error.message`. Storing it in `state.error` is what puts a readable message on screen instead of failing silently.

### Step 2 — Wire the buttons in `ControlBoard.tsx` (~15 min)

The old **Enable**/**Disable** buttons dispatched `enableSelectedSpaces`/`disableSelectedSpaces` — reducers that only touched a local, browser-only list. U3 already deleted those reducers, so right now those buttons are broken. Replace both dispatches with `updateSpaces`.

> **Gating note — how the admin buttons turn on.** The Admin Control Panel activates the moment a **lot is selected** — `isControlPanelActive = selectedLotId != null` — *not* when a separate "Edit Mode" is flipped. Gate the lot-scoped actions on that (Disable/Enable additionally need at least one selected space). **Edit Mode is optional editing chrome** — the pink border + Cancel affordance — not a hard gate. An earlier prototype double-gated on `isEditMode && selectedLotId != null`, so selecting a lot left every button disabled until you *also* toggled Edit Mode, which reads as broken. This is the same panel model U3 introduces — keep them consistent.

> **Menu note — Disable/Enable now live in a sub-panel.** The main sidebar used to list **Disable** and **Enable** as separate top-level buttons. They've been grouped, Arrange-Spots-style, under one mode button — **"Slot Enable/Disable"** (the old "Single Select") — that reveals a sub-panel containing **Disable** and **Enable**, plus the current selection count. The buttons act on whatever spaces are already selected on the grid; nothing else about Step 1's thunk or Step 2's dispatches changes. Every main-menu button (and this sub-panel's buttons) also gets a `title=` tooltip describing what it does — a one-line accessibility/discoverability win, no contract change.

Each sub-panel button saves **immediately on click** — there's no separate "Done" step. The **Disable** button:
```tsx
onClick={() => {
  if (selectedLotId != null)
    dispatch(updateSpaces({ lotId: selectedLotId, ids: selectedSpaces, status: 'disabled' }));
}}
```

The **Enable** button is identical except for the status it sends:
```tsx
onClick={() => {
  if (selectedLotId != null)
    dispatch(updateSpaces({ lotId: selectedLotId, ids: selectedSpaces, status: 'available' }));
}}
```

Then add `updateSpaces` to the import list from `./store/parkingSlice`.

**Explanation, piece by piece:**
- **`selectedLotId != null` guard** — `updateSpaces` needs a `lotId` to know which lot's spaces to re-fetch afterward. This is the same "Home view has no lot selected" guard you saw in U3.
- **`ids: selectedSpaces`** — the numeric space ids the admin has clicked, already tracked in `parkingSlice`'s `selectedSpaces` array since U3.
- **`status: 'available'` vs `'disabled'`** — the only difference between the two buttons is which status string they send; both go through the exact same thunk and the exact same optimistic logic you wrote in Step 1.
- **No confirm step** — the click *is* the save. The only button in the edit-mode chrome is **Cancel ✕**, which just closes Edit Mode (`dispatch(setIsEditMode(false))`); it never calls the server.

**What it looks like — admin about to disable two spaces:**
```
┌──────────────────────────────────────────────────────────┐
│ LTRide                                                  ☰  │
├───────────────┬──────────────────────────────────────────┤
│ ┌───────────┐ │                                  [ Cancel X ]│  ← just closes Edit Mode
│ │Admin Ctrl │ │   ▢ ▢ ▣ ▢ ▢ ▢   ▢ ▢ ▢ ▢ ▢ ▢               │
│ │Slot En/Dis│ │   ▢ ▣ ▢ ▢ ▨ ▨   ▢ ▢ ▢ ▢ ▢ ▢               │  ▢ available (yellow)
│ │  Disable ▣│ │   ▢ ▢ ▢ ▢ ▢ ▢   ▣ ▢ ▢ ▢ ▢ ▢               │  ▨ selected (gold)
│ │  Enable   │ │                                            │  ▣ disabled (grey)
│ │Assign Spot│ │                                            │  ▦ assigned (blue)
│ │Update Map │ │   [Home][Lot A][Lot B]                     │
│ └───────────┘ │                                            │
│ [👤 My Acct]  │   Edit Mode ●——                       LT   │
└───────────────┴──────────────────────────────────────────┘
```
The instant you click **Disable** in the sub-panel, the two selected (gold) spaces turn grey — that's the optimistic update from Step 1. After a **refresh**, they're still grey, because the PATCH actually reached the database.

> **Status colours (the legend both U3 and U4 use).** available = **yellow** (`#ffeb3b`), selected = **gold** (`#f5c542`), disabled = **grey** (`#aaa`), assigned = **blue** (`#7aa7ff`). Available is yellow, *not* white — a white spot washes out against a light map photo. The space objects the grid reads (`id`, `status`, `lot_id`, `assigned_user_id`) are snake_case, matching the U3 data contract.

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend running (through **B5**); `npm run dev`; admin logged in.
2. **Steps:** select a lot → **Slot Enable/Disable** → click 2–3 available (yellow) spaces (they turn gold when selected) → **Disable** (in the sub-panel); then **refresh the page**. Repeat with **Enable** to turn them back. (Edit Mode is optional — the buttons work once a lot is selected.)
3. **Expected:**
   - Right after clicking **Disable**, the spaces turn grey **immediately** (optimistic), the selection clears, and edit mode closes.
   - After **refresh**, they're **still grey** — it saved to the database.
   - If you stop the backend and try again, a red error appears; the optimistic grey stays on screen (it isn't auto-reverted) until the next load re-fetches the real state.
   - A space that's already `assigned` can't be disabled — the server returns 409 and you see the error (don't select assigned/blue spaces).

**☁️ Cloud check (optional):** needs backend **B5** deployed. `./release.sh frontend`, disable a few spaces on the live site, then **refresh** — they stay grey, proving it saved to RDS (not just your browser).

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U4: persist enable/disable via PATCH /api/spaces (optimistic + rollback)"
git push -u origin cr/u4-save-status
```

Then open a Pull Request on GitHub with **base = `cr/u3-real-lots`** (this CR branches off U3, not `main`). Fill in the CR description template and paste your "Prove it works" output as the testing evidence. The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **The Enable/Disable buttons crash with a "not defined" error** — you forgot to add `updateSpaces` to the import list from `./store/parkingSlice` in `ControlBoard.tsx`.
- **Spaces flip colour but go back to their old status after refresh** — the PATCH never reached the backend. Check the browser console for a network error, and confirm backend **B5** is actually running.
- **Clicking Disable on a blue (`assigned`) space always errors** — that's expected: the server returns 409 for spaces that are already assigned. Only select yellow (`available`) or grey (`disabled`) spaces to test enable/disable.
- **Selected a lot but every admin button stays greyed out** — you're double-gating on a separate Edit Mode. The panel should activate on lot selection (`isControlPanelActive = selectedLotId != null`); gate Disable/Enable on having a selection, and treat Edit Mode as optional chrome, not a required switch (see the Gating note in Step 2).
- **Can't find the Disable/Enable buttons** — they're no longer top-level; open the **"Slot Enable/Disable"** mode button first, which reveals the sub-panel that contains them (see the Menu note in Step 2).
- **Nothing happens when you click Disable/Enable** — confirm a lot is selected (`selectedLotId != null`) and at least one space is selected (`selectedSpaces` non-empty); the click dispatches `updateSpaces` directly, so if nothing saves, one of those guards is failing.
- **`state.error` never clears between attempts** — this lesson's `rejected` handler only sets `error`; if you want it cleared on a fresh attempt, make sure `updateSpaces.pending` (or `fetchSpaces.pending` from U3) resets it, the same way U3's `fetchSpaces.pending` does.

---

## 📝 Recap

- You built your first **optimistic update**: the UI recolours instantly on `pending`, before the server has responded, so the app feels fast.
- You practiced the **write-then-re-fetch** pattern — `updateSpaces` calls `PATCH`, then dispatches `fetchSpaces` itself, so the store always ends up matching the database exactly.
- You retired the old browser-only `enableSelectedSpaces`/`disableSelectedSpaces` reducers for good, replacing them with a single thunk that actually talks to the backend.
- You proved persistence the right way: not just "the screen updated," but "the screen still shows it after a refresh."
- You saw the admin menu reorganized into mode buttons + sub-panels (Disable/Enable now live under **"Slot Enable/Disable"**) with tooltips on every button — same buttons, same thunk, better discoverability.

---

## 📚 References

- [MDN — HTTP PATCH method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) — partially updating a resource, used for the status change.
- [MDN — Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) — how `api.patch` identifies the admin making the request.
- [Redux Toolkit — Writing Reducers with Immer](https://redux-toolkit.js.org/usage/immer-reducers) — why "mutating" `state.spacesByLot` inside a reducer is safe.
- [Redux Toolkit — Optimistic Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates) — the update-now, confirm-or-revert-later pattern behind this lesson.
- [Redux Toolkit — createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) — the `pending`/`fulfilled`/`rejected` lifecycle and `action.meta.arg`.
- Source of truth for this lesson: [UI guide → CR U4](../ui-development-guide.md#cr-u4--make-enabledisable-actually-save).

---

## ➡️ Next lesson

**[Lesson U5 — Student registers interest](U5-student-registers-interest.md).** You'll build the app's first student-facing core feature: registering interest in a lot, with the same read-thunk / write-thunk pattern you just practiced here. → [source CR](../ui-development-guide.md#cr-u5--student-registers-interest-core-feature-1).
